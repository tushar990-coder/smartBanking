using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public class SwanidhiController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SwanidhiController(AppDbContext context)
        {
            _context = context;
        }

        // Standard official categories from Maharashtra Co-operative Department Circular
        private static readonly List<SwanidhiCategoryDto> StandardCategories = new()
        {
            new SwanidhiCategoryDto("PAID_UP_CAPITAL", "१. वसूल भाग भांडवल (Paid-up Share Capital)", "Addition", "नियमित व नाममात्र सभासदांचे शेअर्स भाग भांडवल"),
            new SwanidhiCategoryDto("STATUTORY_RESERVE", "२. राखीव निधी (Statutory Reserve Fund)", "Addition", "कलम ६६ अन्वये दरवर्षी नफ्यातून २५% काढलेला वैधानिक राखीव निधी"),
            new SwanidhiCategoryDto("BUILDING_FUND", "३. इमारत निधी (Building Fund)", "Addition", "संस्थेच्या नफ्यातून निर्माण झालेला इमारत निधी"),
            new SwanidhiCategoryDto("FREE_AND_DEVELOPMENT_RESERVE", "४. मुक्त व विकास निधी (Free & Development Reserves)", "Addition", "नफ्यातून तयार झालेले व ज्यावर कोणतीही बाह्य देयता नाही असे निधी (उदा. लाभांश समानीकरण, तंत्रज्ञान निधी) - स्पष्टीकरण-१"),
            new SwanidhiCategoryDto("STANDARD_ASSET_PROVISION", "५. उत्तम जिंदगी तरतूद (General Provision on Standard Assets)", "Addition", "नियमित/स्टँडर्ड कर्जांवर केलेली सामान्य जोखीम तरतूद (०.४०%)"),
            new SwanidhiCategoryDto("ACCUMULATED_LOSS", "ब. संचित तोटा (Accumulated Losses - Deduction)", "Deduction", "मागील व चालू वर्षाचा ताळेबंदातील संचित तोटा"),
            new SwanidhiCategoryDto("EXCLUDED_RESERVES", "वगळलेले बाह्य देयता निधी (Excluded / Non-Free Reserves)", "Excluded", "ज्या निधींवर बाह्य देयता आहे (उदा. सभासद/सेवक कल्याण, धर्मादाय, घसारा, संशयित बुडीत निधी - स्वनिधीत समाविष्ट होत नाहीत)")
        };

        private static bool _tablesVerified = false;

        private async Task EnsureTablesExistAsync()
        {
            if (_tablesVerified) return;

            string sql = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SwanidhiLedgerMappings')
                BEGIN
                    CREATE TABLE [SwanidhiLedgerMappings] (
                        [MappingID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        [CategoryCode] nvarchar(50) NOT NULL,
                        [CategoryName] nvarchar(150) NOT NULL,
                        [LedgerID] int NOT NULL,
                        [CreatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                        [UpdatedOn] datetime2 NOT NULL DEFAULT GETDATE()
                    );
                END

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SwanidhiSettings')
                BEGIN
                    CREATE TABLE [SwanidhiSettings] (
                        [SettingID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        [BranchID] int NOT NULL DEFAULT 1,
                        [BorrowingLimitMultiplier] decimal(5,2) NOT NULL DEFAULT 10.00,
                        [Year1DividendRate] decimal(5,2) NOT NULL DEFAULT 9.00,
                        [Year2DividendRate] decimal(5,2) NOT NULL DEFAULT 9.00,
                        [Year3DividendRate] decimal(5,2) NOT NULL DEFAULT 9.00,
                        [ManualCertifiedNetProfit] decimal(18,2) NULL,
                        [UpdatedOn] datetime2 NOT NULL DEFAULT GETDATE()
                    );

                    INSERT INTO [SwanidhiSettings] ([BranchID], [BorrowingLimitMultiplier], [Year1DividendRate], [Year2DividendRate], [Year3DividendRate], [UpdatedOn])
                    VALUES (1, 10.00, 9.00, 9.00, 9.00, GETDATE());
                END
            ";

            try
            {
                await _context.Database.ExecuteSqlRawAsync(sql);
                _tablesVerified = true;
            }
            catch { }
        }

        // 1. GET: api/Swanidhi/Config
        [HttpGet("Config")]
        public async Task<IActionResult> GetConfig([FromQuery] int? branchId)
        {
            try
            {
                await EnsureTablesExistAsync();
                int bId = branchId ?? 1;

                var savedMappings = await _context.SwanidhiLedgerMappings
                    .Include(m => m.Ledger).ThenInclude(l => l!.AccountGroup)
                    .ToListAsync();

                // If no mappings yet, trigger auto-map so defaults are available immediately
                if (!savedMappings.Any())
                {
                    await RunAutoMap();
                    savedMappings = await _context.SwanidhiLedgerMappings
                        .Include(m => m.Ledger).ThenInclude(l => l!.AccountGroup)
                        .ToListAsync();
                }

                var setting = await _context.SwanidhiSettings
                    .FirstOrDefaultAsync(s => s.BranchID == bId);

                if (setting == null)
                {
                    setting = new SwanidhiSetting
                    {
                        BranchID = bId,
                        BorrowingLimitMultiplier = 10.0m,
                        Year1DividendRate = 9.0m,
                        Year2DividendRate = 9.0m,
                        Year3DividendRate = 9.0m,
                        UpdatedOn = DateTime.UtcNow
                    };
                    _context.SwanidhiSettings.Add(setting);
                    await _context.SaveChangesAsync();
                }

                var allLedgers = await _context.Ledgers
                    .Where(l => l.IsActive)
                    .Include(l => l.AccountGroup)
                    .Select(l => new
                    {
                        l.LedgerID,
                        LedgerName = l.LedgerName ?? "",
                        LedgerCode = l.LedgerCode ?? "",
                        GroupName = l.AccountGroup != null ? (l.AccountGroup.GroupName ?? "") : "",
                        Nature = l.AccountGroup != null ? (l.AccountGroup.NatureOfGroup ?? "") : "",
                        l.OpeningBalance,
                        OpeningBalanceType = l.OpeningBalanceType ?? "Dr"
                    })
                    .OrderBy(l => l.GroupName)
                    .ThenBy(l => l.LedgerName)
                    .ToListAsync();

                return Ok(new
                {
                    Categories = StandardCategories,
                    SavedMappings = savedMappings.Select(m => new
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

        // 2. POST: api/Swanidhi/Config (Save dynamic mappings & settings)
        [HttpPost("Config")]
        public async Task<IActionResult> SaveConfig([FromBody] SaveSwanidhiConfigDto dto)
        {
            if (dto == null) return BadRequest("माहिती उपलब्ध नाही.");

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                await EnsureTablesExistAsync();
                int bId = dto.BranchID > 0 ? dto.BranchID : 1;

                // 1. Update Settings
                var setting = await _context.SwanidhiSettings.FirstOrDefaultAsync(s => s.BranchID == bId);
                if (setting == null)
                {
                    setting = new SwanidhiSetting { BranchID = bId };
                    _context.SwanidhiSettings.Add(setting);
                }

                setting.BorrowingLimitMultiplier = dto.BorrowingLimitMultiplier > 0 ? dto.BorrowingLimitMultiplier : 10.0m;
                setting.Year1DividendRate = dto.Year1DividendRate;
                setting.Year2DividendRate = dto.Year2DividendRate;
                setting.Year3DividendRate = dto.Year3DividendRate;
                setting.ManualCertifiedNetProfit = dto.ManualCertifiedNetProfit;
                setting.UpdatedOn = DateTime.UtcNow;

                // 2. Replace Mappings
                var oldMappings = await _context.SwanidhiLedgerMappings.ToListAsync();
                if (oldMappings.Any())
                {
                    _context.SwanidhiLedgerMappings.RemoveRange(oldMappings);
                }

                if (dto.Mappings != null && dto.Mappings.Any())
                {
                    foreach (var m in dto.Mappings)
                    {
                        if (m.LedgerID > 0 && !string.IsNullOrWhiteSpace(m.CategoryCode))
                        {
                            var cat = StandardCategories.FirstOrDefault(c => c.CategoryCode == m.CategoryCode);
                            _context.SwanidhiLedgerMappings.Add(new SwanidhiLedgerMapping
                            {
                                CategoryCode = m.CategoryCode,
                                CategoryName = cat?.CategoryName ?? m.CategoryName ?? m.CategoryCode,
                                LedgerID = m.LedgerID,
                                CreatedOn = DateTime.UtcNow,
                                UpdatedOn = DateTime.UtcNow
                            });
                        }
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "स्वनिधी डायनॅमिक लेजर मॅपिंग व नियम यशस्वीरीत्या सेव्ह झाले!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "मॅपिंग सेव्ह करताना त्रुटी आली: " + ex.Message });
            }
        }

        // 3. POST: api/Swanidhi/AutoMap (Smart auto-tagging based on GL patterns)
        [HttpPost("AutoMap")]
        public async Task<IActionResult> RunAutoMap()
        {
            try
            {
                await EnsureTablesExistAsync();
                var ledgers = await _context.Ledgers.Where(l => l.IsActive).ToListAsync();
                var newMappings = new List<SwanidhiLedgerMapping>();

                foreach (var l in ledgers)
                {
                    string name = l.LedgerName ?? "";
                    string code = "";

                    if (name.Contains("भाग भांडवल") || name.Contains("सभासद भाग") || name.Contains("Share Capital") || name.Contains("शेअर्स"))
                    {
                        code = "PAID_UP_CAPITAL";
                    }
                    else if (name.Contains("राखीव निधी") || name.Contains("Reserve Fund") || name.Contains("वैधानिक राखीव"))
                    {
                        code = "STATUTORY_RESERVE";
                    }
                    else if (name.Contains("इमारत निधी") || name.Contains("Building Fund"))
                    {
                        code = "BUILDING_FUND";
                    }
                    else if (name.Contains("लाभांश सम") || name.Contains("तंत्रज्ञान") || name.Contains("विकास निधी") || name.Contains("Dividend Equal"))
                    {
                        code = "FREE_AND_DEVELOPMENT_RESERVE";
                    }
                    else if (name.Contains("उत्तम जिंदगी") || name.Contains("Standard Asset Provision"))
                    {
                        code = "STANDARD_ASSET_PROVISION";
                    }
                    else if (name.Contains("संचित तोटा") || name.Contains("चालू तोटा") || name.Contains("Loss"))
                    {
                        code = "ACCUMULATED_LOSS";
                    }
                    else if (name.Contains("कल्याण") || name.Contains("धर्मादाय") || name.Contains("घसारा") || name.Contains("संशयित बुडीत") || l.ExcludeFromRule35Swanidhi)
                    {
                        code = "EXCLUDED_RESERVES";
                    }

                    if (!string.IsNullOrEmpty(code))
                    {
                        var cat = StandardCategories.FirstOrDefault(c => c.CategoryCode == code);
                        newMappings.Add(new SwanidhiLedgerMapping
                        {
                            CategoryCode = code,
                            CategoryName = cat?.CategoryName ?? code,
                            LedgerID = l.LedgerID,
                            CreatedOn = DateTime.UtcNow,
                            UpdatedOn = DateTime.UtcNow
                        });
                    }
                }

                var old = await _context.SwanidhiLedgerMappings.ToListAsync();
                _context.SwanidhiLedgerMappings.RemoveRange(old);
                _context.SwanidhiLedgerMappings.AddRange(newMappings);
                await _context.SaveChangesAsync();

                return Ok(new { 
                    message = $"यशस्वी! {newMappings.Count} लेजर्स स्वनिधीच्या शासकीय हेड्सशी आपोआप मॅप करण्यात आले आहेत.",
                    mappedCount = newMappings.Count 
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "ऑटो-मॅपिंग अयशस्वी: " + ex.Message });
            }
        }

        // 4. GET: api/Swanidhi/Report (Official Maharashtra Circular Swanidhi Report)
        [HttpGet("Report")]
        public async Task<IActionResult> GetReport(
            [FromQuery] DateTime? asOnDate, 
            [FromQuery] int? branchId,
            [FromQuery] decimal? customMultiplier)
        {
            try
            {
                await EnsureTablesExistAsync();
                DateTime targetDate = asOnDate ?? DateTime.Today;
                int bId = branchId ?? 1;

                // Load Settings
                var setting = await _context.SwanidhiSettings.FirstOrDefaultAsync(s => s.BranchID == bId);
                decimal multiplier = customMultiplier ?? setting?.BorrowingLimitMultiplier ?? 10.0m;
                decimal y1 = setting?.Year1DividendRate ?? 9.0m;
                decimal y2 = setting?.Year2DividendRate ?? 9.0m;
                decimal y3 = setting?.Year3DividendRate ?? 9.0m;
                decimal avgDivRate = setting?.AverageDividendRate ?? 9.0m;

                // Load Mappings
                var mappings = await _context.SwanidhiLedgerMappings
                    .Include(m => m.Ledger)
                    .ToListAsync();

                // If mappings are empty, run auto-map once
                if (!mappings.Any())
                {
                    await RunAutoMap();
                    mappings = await _context.SwanidhiLedgerMappings
                        .Include(m => m.Ledger)
                        .ToListAsync();
                }

                // Get Sanstha details
                var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();

                // Compute Ledger Balances As of Target Date
                var mappedLedgerIds = mappings.Select(m => m.LedgerID).Distinct().ToList();

                // Query vouchers up to target date
                var vDetails = await _context.VoucherDetails
                    .Where(vd => mappedLedgerIds.Contains(vd.LedgerID) &&
                                 vd.Voucher != null &&
                                 vd.Voucher.Status == "Approved" &&
                                 vd.Voucher.VoucherDate.Date <= targetDate.Date)
                    .Select(vd => new {
                        vd.LedgerID,
                        vd.DrCr,
                        vd.Amount
                    })
                    .ToListAsync();

                var vGroups = vDetails.GroupBy(vd => vd.LedgerID)
                    .ToDictionary(g => g.Key, g => new
                    {
                        Dr = g.Where(x => x.DrCr == "Dr").Sum(x => x.Amount),
                        Cr = g.Where(x => x.DrCr == "Cr").Sum(x => x.Amount)
                    });

                // Function to get Credit Balance (for Liabilities, Capital, Reserves)
                decimal GetCreditBalance(Ledger? l)
                {
                    if (l == null) return 0;
                    decimal opening = l.OpeningBalance;
                    if (l.OpeningBalanceType == "Dr") opening = -opening;

                    decimal dr = 0, cr = 0;
                    if (vGroups.TryGetValue(l.LedgerID, out var tx))
                    {
                        dr = tx.Dr;
                        cr = tx.Cr;
                    }
                    return opening + cr - dr;
                }

                // Function to get Debit Balance (for Losses, Assets)
                decimal GetDebitBalance(Ledger? l)
                {
                    if (l == null) return 0;
                    decimal opening = l.OpeningBalance;
                    if (l.OpeningBalanceType == "Cr") opening = -opening;

                    decimal dr = 0, cr = 0;
                    if (vGroups.TryGetValue(l.LedgerID, out var tx))
                    {
                        dr = tx.Dr;
                        cr = tx.Cr;
                    }
                    return opening + dr - cr;
                }

                // 1. वसूल भाग भांडवल (Paid-up Capital)
                var capMappings = mappings.Where(m => m.CategoryCode == "PAID_UP_CAPITAL").ToList();
                decimal paidUpCapital = capMappings.Sum(m => Math.Max(0, GetCreditBalance(m.Ledger)));
                var capItems = capMappings.Select(m => new SwanidhiItemDetailDto(
                    m.LedgerID, m.Ledger?.LedgerName ?? "", GetCreditBalance(m.Ledger)
                )).ToList();

                // 2. राखीव निधी (Statutory Reserve Fund)
                var resMappings = mappings.Where(m => m.CategoryCode == "STATUTORY_RESERVE").ToList();
                decimal statutoryReserve = resMappings.Sum(m => Math.Max(0, GetCreditBalance(m.Ledger)));
                var resItems = resMappings.Select(m => new SwanidhiItemDetailDto(
                    m.LedgerID, m.Ledger?.LedgerName ?? "", GetCreditBalance(m.Ledger)
                )).ToList();

                // 3. इमारत निधी (Building Fund)
                var bldMappings = mappings.Where(m => m.CategoryCode == "BUILDING_FUND").ToList();
                decimal buildingFund = bldMappings.Sum(m => Math.Max(0, GetCreditBalance(m.Ledger)));
                var bldItems = bldMappings.Select(m => new SwanidhiItemDetailDto(
                    m.LedgerID, m.Ledger?.LedgerName ?? "", GetCreditBalance(m.Ledger)
                )).ToList();

                // 4. मुक्त व विकास निधी (Free & Development Reserves - स्पष्टीकरण-१)
                var freeMappings = mappings.Where(m => m.CategoryCode == "FREE_AND_DEVELOPMENT_RESERVE").ToList();
                decimal freeReserves = freeMappings.Sum(m => Math.Max(0, GetCreditBalance(m.Ledger)));
                var freeItems = freeMappings.Select(m => new SwanidhiItemDetailDto(
                    m.LedgerID, m.Ledger?.LedgerName ?? "", GetCreditBalance(m.Ledger)
                )).ToList();

                // 5. उत्तम जिंदगी तरतूद (Standard Asset Provision)
                var stdMappings = mappings.Where(m => m.CategoryCode == "STANDARD_ASSET_PROVISION").ToList();
                decimal standardAssetProvision = stdMappings.Sum(m => Math.Max(0, GetCreditBalance(m.Ledger)));
                
                // If 0, auto-estimate 0.40% from standard active loans
                if (standardAssetProvision == 0)
                {
                    decimal standardLoans = await _context.LoanAccounts
                        .Where(l => l.Status == "Active")
                        .SumAsync(l => l.PrincipalBalance);
                    standardAssetProvision = Math.Round(standardLoans * 0.0040m, 2); // 0.40%
                }
                var stdItems = stdMappings.Select(m => new SwanidhiItemDetailDto(
                    m.LedgerID, m.Ledger?.LedgerName ?? "", GetCreditBalance(m.Ledger)
                )).ToList();

                // 6. शिल्लक निव्वळ नफा (Undistributed Net Profit - स्पष्टीकरण-२)
                // Calculate P&L Net Profit up to targetDate
                decimal netProfit = 0;
                if (setting?.ManualCertifiedNetProfit.HasValue == true && setting.ManualCertifiedNetProfit.Value > 0)
                {
                    netProfit = setting.ManualCertifiedNetProfit.Value;
                }
                else
                {
                    // Income Cr - Dr
                    var incomeLedgers = await _context.Ledgers
                        .Where(l => l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Income")
                        .Select(l => l.LedgerID)
                        .ToListAsync();
                    
                    var expLedgers = await _context.Ledgers
                        .Where(l => l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Expense")
                        .Select(l => l.LedgerID)
                        .ToListAsync();

                    var incVouchers = await _context.VoucherDetails
                        .Where(vd => incomeLedgers.Contains(vd.LedgerID) && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.VoucherDate.Date <= targetDate.Date)
                        .SumAsync(vd => (vd.DrCr == "Cr" ? vd.Amount : -vd.Amount));

                    var expVouchers = await _context.VoucherDetails
                        .Where(vd => expLedgers.Contains(vd.LedgerID) && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.VoucherDate.Date <= targetDate.Date)
                        .SumAsync(vd => (vd.DrCr == "Dr" ? vd.Amount : -vd.Amount));

                    netProfit = Math.Max(0, incVouchers - expVouchers);
                }

                // Proposed Dividend deduction based on 3-year average dividend rate (स्पष्टीकरण-२)
                decimal proposedDividendAmount = Math.Round(paidUpCapital * (avgDivRate / 100.0m), 2);
                decimal undistributedNetProfit = Math.Max(0, netProfit - proposedDividendAmount);

                // एकूण - (अ) सकल स्वनिधी
                decimal totalGrossSwanidhi = paidUpCapital + statutoryReserve + buildingFund + freeReserves + standardAssetProvision + undistributedNetProfit;

                // ब. वजा - संचित तोटा (Accumulated Loss)
                var lossMappings = mappings.Where(m => m.CategoryCode == "ACCUMULATED_LOSS").ToList();
                decimal accumulatedLoss = lossMappings.Sum(m => Math.Max(0, GetDebitBalance(m.Ledger)));
                var lossItems = lossMappings.Select(m => new SwanidhiItemDetailDto(
                    m.LedgerID, m.Ledger?.LedgerName ?? "", GetDebitBalance(m.Ledger)
                )).ToList();

                decimal totalDeductions = accumulatedLoss;

                // निव्वळ स्वनिधी (अ - ब)
                decimal netOwnedFunds = totalGrossSwanidhi - totalDeductions;

                // आकडे लाखात (Amounts in Lakhs)
                decimal ToLakh(decimal amt) => Math.Round(amt / 100000.0m, 2);

                // Borrowing Capacity & Compliance Analysis
                decimal maxBorrowingLimit = Math.Round(netOwnedFunds * multiplier, 2);

                // Actual Outside Liabilities (Deposits + External Loans)
                decimal savingBalance = await _context.SavingAccountMasters.Where(s => s.Status == "Active").SumAsync(s => s.CurrentBalance);
                decimal fdBalance = await _context.FdAccounts.Where(f => f.Status == "Active").SumAsync(f => f.DepositAmount);
                decimal rdBalance = await _context.RdAccounts.Where(r => r.Status == "Active").SumAsync(r => r.TotalDepositedAmount);
                decimal pigmyBalance = await _context.PigmyAccounts.Where(p => p.Status == "Active").SumAsync(p => p.TotalDepositedAmount - p.TotalWithdrawnAmount);
                
                // Outside Bank Loans / External Borrowings if any
                var borrowingLedgers = await _context.Ledgers
                    .Where(l => l.AccountGroup != null &&
                                (l.AccountGroup.NatureOfGroup == "Liability" || l.AccountGroup.NatureOfGroup == "Liabilities") &&
                                (l.LedgerName.Contains("बँक कर्ज") || l.LedgerName.Contains("शिखर") || l.LedgerName.Contains("मध्यवर्ती") || l.LedgerName.Contains("कर्ज उचल") || l.LedgerName.Contains("उचल कर्ज")))
                    .ToListAsync();
                decimal outsideBankLoans = borrowingLedgers.Sum(l => Math.Max(0, GetCreditBalance(l)));

                decimal actualOutsideLiabilities = savingBalance + fdBalance + rdBalance + pigmyBalance + outsideBankLoans;

                decimal surplusHeadroom = maxBorrowingLimit - actualOutsideLiabilities;
                bool isComplied = surplusHeadroom >= 0;

                // Excluded Reserves items for transparency
                var exclMappings = mappings.Where(m => m.CategoryCode == "EXCLUDED_RESERVES").ToList();
                var excludedItems = exclMappings.Select(m => new SwanidhiItemDetailDto(
                    m.LedgerID, m.Ledger?.LedgerName ?? "", GetCreditBalance(m.Ledger)
                )).ToList();

                var borrowingCapacityObj = new
                {
                    GrossOwnedFunds = totalGrossSwanidhi,
                    GrossOwnedFundsInLakhs = ToLakh(totalGrossSwanidhi),
                    TotalDeductions = totalDeductions,
                    TotalDeductionsInLakhs = ToLakh(totalDeductions),
                    NetOwnedFunds = netOwnedFunds,
                    NetOwnedFundsInLakhs = ToLakh(netOwnedFunds),
                    Multiplier = multiplier,
                    MaxBorrowingLimit = maxBorrowingLimit,
                    MaxBorrowingLimitInLakhs = ToLakh(maxBorrowingLimit),
                    SavingBalance = savingBalance,
                    SavingBalanceInLakhs = ToLakh(savingBalance),
                    FdBalance = fdBalance,
                    FdBalanceInLakhs = ToLakh(fdBalance),
                    RdBalance = rdBalance,
                    RdBalanceInLakhs = ToLakh(rdBalance),
                    PigmyBalance = pigmyBalance,
                    PigmyBalanceInLakhs = ToLakh(pigmyBalance),
                    OutsideBankLoans = outsideBankLoans,
                    OutsideBankLoansInLakhs = ToLakh(outsideBankLoans),
                    ActualOutsideLiabilities = actualOutsideLiabilities,
                    ActualOutsideLiabilitiesInLakhs = ToLakh(actualOutsideLiabilities),
                    SurplusHeadroom = surplusHeadroom,
                    SurplusHeadroomInLakhs = ToLakh(surplusHeadroom),
                    IsComplied = isComplied,
                    ComplianceStatusText = isComplied ? "✅ नियम ३५ चे तंतोतंत पालन (मर्यादा सुरक्षित)" : "⚠️ मर्यादा ओलांडली (तूट)",
                    ComplianceText = isComplied 
                        ? "✅ नियम ३५ नुसार संस्था सुरक्षित असून कमाल उचल मर्यादेचे तंतोतंत पालन झालेले आहे." 
                        : "⚠️ सावधान: बाह्य देणी कमाल उचल मर्यादेपेक्षा जास्त आहेत. स्वनिधी वाढवणे आवश्यक आहे.",
                    DetailedComplianceNote = isComplied
                        ? $"संस्थेची प्रत्यक्ष बाह्य देणी ₹ {actualOutsideLiabilities:N2} ({ToLakh(actualOutsideLiabilities)} लाख) ही नियम ३५ अन्वये अनुज्ञेय कमाल मर्यादा ₹ {maxBorrowingLimit:N2} ({ToLakh(maxBorrowingLimit)} लाख) च्या आत मर्यादित असून, संस्थेकडे अजून ₹ {surplusHeadroom:N2} ({ToLakh(surplusHeadroom)} लाख) इतकी उचल मर्यादा शिल्लक आहे. सबब संस्थेने महाराष्ट्र सहकारी संस्था नियम, १९६१ मधील नियम ३५ चे तंतोतंत पालन केले असून संस्था सुरक्षित आहे."
                        : $"सावधान: संस्थेची प्रत्यक्ष बाह्य देणी ₹ {actualOutsideLiabilities:N2} ({ToLakh(actualOutsideLiabilities)} लाख) ही नियम ३५ अन्वये अनुज्ञेय कमाल मर्यादा ₹ {maxBorrowingLimit:N2} ({ToLakh(maxBorrowingLimit)} लाख) पेक्षा जास्त आहेत. संस्थेकडे ₹ {Math.Abs(surplusHeadroom):N2} ({ToLakh(Math.Abs(surplusHeadroom))} लाख) इतकी मर्यादा तूट आहे. नियम ३५ चे पालन करण्यासाठी स्वनिधी वाढवणे आवश्यक आहे."
                };

                var divCalcObj = new
                {
                    Year1DividendRate = y1,
                    Year2DividendRate = y2,
                    Year3DividendRate = y3,
                    AverageDividendRate = avgDivRate,
                    CertifiedNetProfit = netProfit,
                    EstimatedDividendAmount = proposedDividendAmount,
                    SurplusProfitInOwnedFunds = undistributedNetProfit,
                    Year1Rate = y1,
                    Year2Rate = y2,
                    Year3Rate = y3,
                    AverageRate = avgDivRate,
                    ProposedDividendAmount = proposedDividendAmount,
                    SurplusNetProfit = undistributedNetProfit
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
                    TargetDate = targetDate.ToString("yyyy-MM-dd"),
                    TargetDateDisplay = targetDate.ToString("dd/MM/yyyy"),
                    BorrowingLimitMultiplier = multiplier,
                    
                    // Table Rows
                    Rows = new List<object>
                    {
                        new {
                            SrNo = "१.",
                            Particular = "वसूल भाग भांडवल",
                            Reference = "नियमित व नाममात्र",
                            AmountInRupees = paidUpCapital,
                            AmountInLakhs = ToLakh(paidUpCapital),
                            Items = capItems
                        },
                        new {
                            SrNo = "२.",
                            Particular = "राखीव निधी",
                            Reference = "कलम ६६ प्रमाणे २५%",
                            AmountInRupees = statutoryReserve,
                            AmountInLakhs = ToLakh(statutoryReserve),
                            Items = resItems
                        },
                        new {
                            SrNo = "३.",
                            Particular = "इमारत निधी",
                            Reference = "नफ्यातून निर्मित",
                            AmountInRupees = buildingFund,
                            AmountInLakhs = ToLakh(buildingFund),
                            Items = bldItems
                        },
                        new {
                            SrNo = "४.",
                            Particular = "मुक्त व विकास निधी",
                            Reference = "(स्पष्टीकरण-१ पाहणे)",
                            AmountInRupees = freeReserves,
                            AmountInLakhs = ToLakh(freeReserves),
                            Items = freeItems
                        },
                        new {
                            SrNo = "५.",
                            Particular = "उत्तम जिंदगी तरतूद",
                            Reference = "०.४०% सामान्य तरतूद",
                            AmountInRupees = standardAssetProvision,
                            AmountInLakhs = ToLakh(standardAssetProvision),
                            Items = stdItems
                        },
                        new {
                            SrNo = "६.",
                            Particular = "शिल्लक निव्वळ नफा",
                            Reference = "(स्पष्टीकरण-२ पाहणे)",
                            AmountInRupees = undistributedNetProfit,
                            AmountInLakhs = ToLakh(undistributedNetProfit),
                            Items = new List<object>
                            {
                                new { Label = "एकूण प्रमाणित निव्वळ नफा", Amount = netProfit },
                                new { Label = $"मागील ३ वर्षांची लाभांश सरासरी ({avgDivRate}%)", Amount = proposedDividendAmount },
                                new { Label = "शिल्लक उर्वरित नफा (स्वनिधीत ग्राह्य)", Amount = undistributedNetProfit }
                            }
                        },
                        new {
                            SrNo = "",
                            Particular = "एकूण - (अ) सकल स्वनिधी (Gross Owned Funds)",
                            Reference = "",
                            AmountInRupees = totalGrossSwanidhi,
                            AmountInLakhs = ToLakh(totalGrossSwanidhi),
                            IsTotal = true,
                            Items = (object)null!
                        },
                        new {
                            SrNo = "ब)",
                            Particular = "वजा: संचित तोटा (Accumulated Losses)",
                            Reference = "ताळेबंद तोटा",
                            AmountInRupees = accumulatedLoss,
                            AmountInLakhs = ToLakh(accumulatedLoss),
                            IsDeduction = true,
                            Items = lossItems
                        },
                        new {
                            SrNo = "",
                            Particular = "एकूण - (ब) एकूण वजावटी (Total Deductions)",
                            Reference = "",
                            AmountInRupees = totalDeductions,
                            AmountInLakhs = ToLakh(totalDeductions),
                            IsTotal = true,
                            Items = (object)null!
                        },
                        new {
                            SrNo = "क)",
                            Particular = "एकूण - निव्वळ स्वनिधी (Net Owned Funds / Swanidhi) [अ - ब]",
                            Reference = "",
                            AmountInRupees = netOwnedFunds,
                            AmountInLakhs = ToLakh(netOwnedFunds),
                            IsGrandTotal = true,
                            Items = (object)null!
                        }
                    },

                    TotalA = new
                    {
                        Title = "एकूण - (अ)",
                        AmountInRupees = totalGrossSwanidhi,
                        AmountInLakhs = ToLakh(totalGrossSwanidhi)
                    },

                    Deductions = new List<object>
                    {
                        new {
                            SrNo = "१.",
                            Particular = "संचित तोटा",
                            Reference = "ताळेबंद तोटा",
                            AmountInRupees = accumulatedLoss,
                            AmountInLakhs = ToLakh(accumulatedLoss),
                            Items = lossItems
                        }
                    },

                    TotalB = new
                    {
                        Title = "एकूण - (ब)",
                        AmountInRupees = totalDeductions,
                        AmountInLakhs = ToLakh(totalDeductions)
                    },

                    NetSwanidhi = new
                    {
                        Title = "निव्वळ स्वनिधी (अ - ब)",
                        AmountInRupees = netOwnedFunds,
                        AmountInLakhs = ToLakh(netOwnedFunds)
                    },

                    // Part 2 - Rule 35 Borrowing Limit vs Liabilities Statement
                    Part2 = new
                    {
                        Title = "भाग - २ : नियम ३५ अन्वये कमाल उचल मर्यादा व प्रत्यक्ष देयता ताळमेळ विवरणपत्र",
                        NetOwnedFunds = netOwnedFunds,
                        NetOwnedFundsInLakhs = ToLakh(netOwnedFunds),
                        Multiplier = multiplier,
                        MaxBorrowingLimit = maxBorrowingLimit,
                        MaxBorrowingLimitInLakhs = ToLakh(maxBorrowingLimit),
                        LiabilitiesBreakdown = new List<object>
                        {
                            new { SrNo = "(अ)", Particular = "बचत ठेवी (Savings Bank Deposits)", Basis = "प्रत्यक्ष ठेव शिल्लक", AmountInRupees = savingBalance, AmountInLakhs = ToLakh(savingBalance) },
                            new { SrNo = "(ब)", Particular = "मुदत ठेवी (Fixed Deposits)", Basis = "प्रत्यक्ष ठेव शिल्लक", AmountInRupees = fdBalance, AmountInLakhs = ToLakh(fdBalance) },
                            new { SrNo = "(क)", Particular = "आवर्ती ठेवी (Recurring Deposits - RD)", Basis = "प्रत्यक्ष ठेव शिल्लक", AmountInRupees = rdBalance, AmountInLakhs = ToLakh(rdBalance) },
                            new { SrNo = "(ड)", Particular = "दैनिक / पिग्मी ठेवी (Daily / Pigmy Deposits)", Basis = "प्रत्यक्ष ठेव शिल्लक", AmountInRupees = pigmyBalance, AmountInLakhs = ToLakh(pigmyBalance) },
                            new { SrNo = "(इ)", Particular = "इतर बाह्य वित्तीय संस्थांची कर्जे / देयता (Outside Loans)", Basis = "प्रत्यक्ष बाह्य देणी", AmountInRupees = outsideBankLoans, AmountInLakhs = ToLakh(outsideBankLoans) }
                        },
                        TotalActualLiabilities = actualOutsideLiabilities,
                        TotalActualLiabilitiesInLakhs = ToLakh(actualOutsideLiabilities),
                        SurplusHeadroom = surplusHeadroom,
                        SurplusHeadroomInLakhs = ToLakh(surplusHeadroom),
                        IsComplied = isComplied,
                        ComplianceStatusText = borrowingCapacityObj.ComplianceStatusText,
                        DetailedComplianceNote = borrowingCapacityObj.DetailedComplianceNote
                    },

                    // Borrowing Power & Limits
                    BorrowingCapacity = borrowingCapacityObj,
                    Compliance = borrowingCapacityObj,

                    // 3-Year Dividend Breakdown for Explanation-2
                    Explanation2Breakdown = divCalcObj,
                    DividendCalc = divCalcObj,

                    // Excluded Reserves List
                    ExcludedReserves = excludedItems,

                    // Verbatim Official Explanations from Maharashtra Circular
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

    // DTOs
    public record SwanidhiCategoryDto(string CategoryCode, string CategoryName, string CategoryType, string Description);

    public record SwanidhiItemDetailDto(int LedgerID, string LedgerName, decimal Balance);

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
