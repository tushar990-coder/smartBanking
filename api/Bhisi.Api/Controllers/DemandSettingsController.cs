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
    [Authorize]
    public class DemandSettingsController : ControllerBase
    {
        private readonly AppDbContext _context;

        private static readonly HashSet<string> AllowedItemTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "LOAN",
            "THRIFT_SAVING",
            "RD",
            "SHARE",
            "LEDGER_OTHER"
        };

        public DemandSettingsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/DemandSettings
        [HttpGet]
        public async Task<ActionResult<object>> GetDemandSettings()
        {
            var settings = await _context.DemandColumnSettings
                .AsNoTracking()
                .Where(s => s.IsActive)
                .OrderBy(s => s.SequenceOrder)
                .ThenBy(s => s.DemandColumnSettingId)
                .ToListAsync();

            var loanRates = await _context.LoanRates
                .AsNoTracking()
                .Where(r => r.IsActive)
                .OrderBy(r => r.LoanRateID)
                .Select(r => new
                {
                    r.LoanRateID,
                    r.LoanType,
                    r.LoanCode,
                    r.ShortName,
                    r.LoanLedgerID,
                    r.InterestLedgerID,
                    r.ReceivableInterestLedgerID,
                    r.OverdueInterestLedgerID,
                    r.InterestRate,
                    r.OverdueInterestRate,
                    r.InterestCalculationMethod
                })
                .ToListAsync();

            var savingSchemes = await _context.SavingInterestSettings
                .AsNoTracking()
                .OrderBy(s => s.SettingID)
                .Select(s => new
                {
                    s.SettingID,
                    s.SchemeCode,
                    s.SchemeName,
                    s.InterestRate,
                    s.PostingFrequency,
                    s.SavingLiabilityLedgerID,
                    s.LedgerID,
                    s.InterestExpenseLedgerID
                })
                .ToListAsync();

            var rdSchemes = await _context.RdSchemes
                .AsNoTracking()
                .Where(r => r.IsActive)
                .OrderBy(r => r.RdSchemeID)
                .Select(r => new
                {
                    r.RdSchemeID,
                    r.SchemeCode,
                    r.SchemeName,
                    r.DurationMonths,
                    r.MinimumInstallment,
                    r.RdLiabilityLedgerID,
                    r.InterestExpenseLedgerID
                })
                .ToListAsync();

            var shareSchemes = await _context.ShareSchemes
                .AsNoTracking()
                .Where(s => s.IsActive)
                .OrderBy(s => s.ShareSchemeId)
                .Select(s => new
                {
                    s.ShareSchemeId,
                    s.SchemeCode,
                    s.SchemeName,
                    s.ShareFaceValue,
                    s.ShareCapitalLedgerID
                })
                .ToListAsync();

            var ledgers = await _context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .Where(l => l.IsActive)
                .OrderBy(l => l.LedgerName)
                .Select(l => new
                {
                    l.LedgerID,
                    l.LedgerCode,
                    l.LedgerName,
                    l.AccountType,
                    NatureOfGroup = l.AccountGroup != null ? l.AccountGroup.NatureOfGroup : ""
                })
                .ToListAsync();

            // Build non-persisted suggested defaults if institution has not saved settings yet
            var suggestedDefaults = new List<object>();
            if (!settings.Any())
            {
                int seq = 1;
                foreach (var lr in loanRates)
                {
                    suggestedDefaults.Add(new
                    {
                        demandColumnSettingId = 0,
                        sequenceOrder = seq++,
                        columnHeaderMr = !string.IsNullOrWhiteSpace(lr.ShortName) ? lr.ShortName : lr.LoanType,
                        itemType = "LOAN",
                        loanRateID = (int?)lr.LoanRateID,
                        savingSchemeID = (int?)null,
                        rdSchemeID = (int?)null,
                        shareSchemeId = (int?)null,
                        principalOrDepositLedgerID = lr.LoanLedgerID,
                        interestLedgerID = lr.InterestLedgerID,
                        receivableInterestLedgerID = lr.ReceivableInterestLedgerID,
                        overdueInterestLedgerID = lr.OverdueInterestLedgerID,
                        showBalanceColumn = true,
                        includeOverduePenalInterest = false,
                        loanIntraAllocationOrder = "INTEREST_FIRST",
                        isContributionTarget = false,
                        defaultAmount = 0m,
                        isActive = true
                    });
                }

                var preferredThrift = savingSchemes
                    .OrderByDescending(s => (s.PostingFrequency ?? "").Contains("Year", StringComparison.OrdinalIgnoreCase)
                                            || (s.SchemeName ?? "").Contains("संजीवनी")
                                            || (s.SchemeName ?? "").Contains("वर्गणी")
                                            || (s.SchemeName ?? "").Contains("Thrift", StringComparison.OrdinalIgnoreCase))
                    .FirstOrDefault();

                if (preferredThrift != null)
                {
                    suggestedDefaults.Add(new
                    {
                        demandColumnSettingId = 0,
                        sequenceOrder = seq++,
                        columnHeaderMr = !string.IsNullOrWhiteSpace(preferredThrift.SchemeName) ? preferredThrift.SchemeName : "संजीवनी ठेव",
                        itemType = "THRIFT_SAVING",
                        loanRateID = (int?)null,
                        savingSchemeID = (int?)preferredThrift.SettingID,
                        rdSchemeID = (int?)null,
                        shareSchemeId = (int?)null,
                        principalOrDepositLedgerID = preferredThrift.SavingLiabilityLedgerID ?? preferredThrift.LedgerID,
                        interestLedgerID = (int?)null,
                        receivableInterestLedgerID = (int?)null,
                        overdueInterestLedgerID = (int?)null,
                        showBalanceColumn = false,
                        includeOverduePenalInterest = false,
                        loanIntraAllocationOrder = "INTEREST_FIRST",
                        isContributionTarget = true,
                        defaultAmount = 0m,
                        isActive = true
                    });
                }

                foreach (var rd in rdSchemes)
                {
                    suggestedDefaults.Add(new
                    {
                        demandColumnSettingId = 0,
                        sequenceOrder = seq++,
                        columnHeaderMr = rd.SchemeName,
                        itemType = "RD",
                        loanRateID = (int?)null,
                        savingSchemeID = (int?)null,
                        rdSchemeID = (int?)rd.RdSchemeID,
                        shareSchemeId = (int?)null,
                        principalOrDepositLedgerID = rd.RdLiabilityLedgerID,
                        interestLedgerID = (int?)null,
                        receivableInterestLedgerID = (int?)null,
                        overdueInterestLedgerID = (int?)null,
                        showBalanceColumn = false,
                        includeOverduePenalInterest = false,
                        loanIntraAllocationOrder = "INTEREST_FIRST",
                        isContributionTarget = false,
                        defaultAmount = rd.MinimumInstallment,
                        isActive = true
                    });
                }
            }

            return Ok(new
            {
                isConfigured = settings.Any(),
                settings,
                suggestedDefaults,
                loanRates,
                savingSchemes,
                rdSchemes,
                shareSchemes,
                ledgers
            });
        }

        // PUT: api/DemandSettings
        [HttpPut]
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
        public async Task<ActionResult<object>> SaveDemandSettings([FromBody] SaveDemandSettingsDto request)
        {
            if (request == null || request.Items == null || !request.Items.Any())
            {
                return BadRequest("डिमांड सेटिंगमध्ये किमान एक सक्रिय रकाना (Column) जोडणे आवश्यक आहे.");
            }

            var activeInputs = request.Items
                .Where(i => i.IsActive)
                .OrderBy(i => i.SequenceOrder)
                .ToList();

            if (!activeInputs.Any())
            {
                return BadRequest("किमान एक सक्रिय डिमांड कॉलम असणे आवश्यक आहे.");
            }

            int contributionCount = activeInputs.Count(i => i.IsContributionTarget);
            if (contributionCount > 1)
            {
                return BadRequest("फक्त एकच ठेव/वर्गणी कॉलम 'वर्गणी ठेव Auto-Fill' म्हणून निवडता येईल.");
            }

            var loanRatesMap = await _context.LoanRates.AsNoTracking().ToDictionaryAsync(r => r.LoanRateID);
            var savingSchemesMap = await _context.SavingInterestSettings.AsNoTracking().ToDictionaryAsync(s => s.SettingID);
            var rdSchemesMap = await _context.RdSchemes.AsNoTracking().ToDictionaryAsync(r => r.RdSchemeID);
            var shareSchemesMap = await _context.ShareSchemes.AsNoTracking().ToDictionaryAsync(s => s.ShareSchemeId);
            var validLedgerIds = (await _context.Ledgers.AsNoTracking().Select(l => l.LedgerID).ToListAsync()).ToHashSet();

            var validatedRows = new List<DemandColumnSettingDto>();
            int seqCounter = 1;
            var usedLoanIds = new HashSet<int>();
            var usedRdIds = new HashSet<int>();

            foreach (var item in activeInputs)
            {
                string type = (item.ItemType ?? string.Empty).Trim().ToUpperInvariant();
                if (!AllowedItemTypes.Contains(type))
                {
                    return BadRequest($"अवैध प्रकार: '{item.ItemType}'.");
                }

                string header = (item.ColumnHeaderMr ?? string.Empty).Trim();
                int? prinLedger = item.PrincipalOrDepositLedgerID;
                int? intLedger = item.InterestLedgerID;
                int? recIntLedger = item.ReceivableInterestLedgerID;
                int? ovdIntLedger = item.OverdueInterestLedgerID;

                if (type == "LOAN")
                {
                    if (!item.LoanRateID.HasValue || !loanRatesMap.TryGetValue(item.LoanRateID.Value, out var lr))
                    {
                        return BadRequest($"क्रम {seqCounter}: कृपया वैध कर्ज योजना निवडा.");
                    }
                    if (!usedLoanIds.Add(lr.LoanRateID))
                    {
                        return BadRequest($"कर्ज योजना '{lr.LoanType}' एकापेक्षा जास्त वेळा जोडता येत नाही.");
                    }
                    if (string.IsNullOrWhiteSpace(header)) header = !string.IsNullOrWhiteSpace(lr.ShortName) ? lr.ShortName : lr.LoanType;
                    prinLedger ??= lr.LoanLedgerID;
                    intLedger ??= lr.InterestLedgerID;
                    recIntLedger ??= lr.ReceivableInterestLedgerID;
                    ovdIntLedger ??= lr.OverdueInterestLedgerID;

                    if (!intLedger.HasValue || !validLedgerIds.Contains(intLedger.Value))
                    {
                        return BadRequest($"'{header}' साठी वैध 'कर्ज व्याज लेजर' निवडणे आवश्यक आहे.");
                    }
                }
                else if (type == "THRIFT_SAVING")
                {
                    if (!item.SavingSchemeID.HasValue || !savingSchemesMap.TryGetValue(item.SavingSchemeID.Value, out var ss))
                    {
                        return BadRequest($"क्रम {seqCounter}: कृपया वैध संजीवनी / बचत ठेव योजना निवडा.");
                    }
                    if (string.IsNullOrWhiteSpace(header)) header = ss.SchemeName ?? "संजीवनी ठेव";
                    prinLedger ??= ss.SavingLiabilityLedgerID ?? ss.LedgerID;
                }
                else if (type == "RD")
                {
                    if (!item.RdSchemeID.HasValue || !rdSchemesMap.TryGetValue(item.RdSchemeID.Value, out var rds))
                    {
                        return BadRequest($"क्रम {seqCounter}: कृपया वैध आवर्ती ठेव (RD) योजना निवडा.");
                    }
                    if (!usedRdIds.Add(rds.RdSchemeID))
                    {
                        return BadRequest($"RD योजना '{rds.SchemeName}' एकापेक्षा जास्त वेळा जोडता येत नाही.");
                    }
                    if (string.IsNullOrWhiteSpace(header)) header = rds.SchemeName;
                    prinLedger ??= rds.RdLiabilityLedgerID;
                }
                else if (type == "SHARE")
                {
                    if (item.ShareSchemeId.HasValue && shareSchemesMap.TryGetValue(item.ShareSchemeId.Value, out var shs))
                    {
                        if (string.IsNullOrWhiteSpace(header)) header = shs.SchemeName;
                        prinLedger ??= shs.ShareCapitalLedgerID;
                    }
                    else if (string.IsNullOrWhiteSpace(header))
                    {
                        header = "शेअर्स";
                    }
                }

                if (string.IsNullOrWhiteSpace(header))
                {
                    return BadRequest($"क्रम {seqCounter}: कॉलमचे नाव भरणे आवश्यक आहे.");
                }

                if (!prinLedger.HasValue || !validLedgerIds.Contains(prinLedger.Value))
                {
                    return BadRequest($"'{header}' साठी वैध जमा (Credit/Liability) लेजर निवडणे आवश्यक आहे.");
                }

                validatedRows.Add(new DemandColumnSettingDto
                {
                    DemandColumnSettingId = item.DemandColumnSettingId,
                    SequenceOrder = seqCounter++,
                    ColumnHeaderMr = header,
                    ItemType = type,
                    LoanRateID = type == "LOAN" ? item.LoanRateID : null,
                    SavingSchemeID = type == "THRIFT_SAVING" ? item.SavingSchemeID : null,
                    RdSchemeID = type == "RD" ? item.RdSchemeID : null,
                    ShareSchemeId = type == "SHARE" ? item.ShareSchemeId : null,
                    PrincipalOrDepositLedgerID = prinLedger,
                    InterestLedgerID = type == "LOAN" ? intLedger : null,
                    ReceivableInterestLedgerID = type == "LOAN" ? recIntLedger : null,
                    OverdueInterestLedgerID = type == "LOAN" ? ovdIntLedger : null,
                    ShowBalanceColumn = type == "LOAN" && item.ShowBalanceColumn,
                    IncludeOverduePenalInterest = type == "LOAN" && item.IncludeOverduePenalInterest,
                    LoanIntraAllocationOrder = string.Equals(item.LoanIntraAllocationOrder, "PRINCIPAL_FIRST", StringComparison.OrdinalIgnoreCase)
                        ? "PRINCIPAL_FIRST"
                        : "INTEREST_FIRST",
                    IsContributionTarget = (type == "THRIFT_SAVING" || type == "LEDGER_OTHER") && item.IsContributionTarget,
                    DefaultAmount = Math.Max(0m, Math.Round(item.DefaultAmount, 2, MidpointRounding.AwayFromZero)),
                    IsActive = true
                });
            }

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var existingRows = await _context.DemandColumnSettings.ToListAsync();
                var keepIds = new HashSet<int>();
                var now = DateTime.UtcNow;

                foreach (var row in validatedRows)
                {
                    DemandColumnSetting? entity = null;
                    if (row.DemandColumnSettingId > 0)
                    {
                        entity = existingRows.FirstOrDefault(e => e.DemandColumnSettingId == row.DemandColumnSettingId);
                    }

                    if (entity == null)
                    {
                        entity = new DemandColumnSetting
                        {
                            CreatedAt = now
                        };
                        _context.DemandColumnSettings.Add(entity);
                    }

                    entity.SequenceOrder = row.SequenceOrder;
                    entity.ColumnHeaderMr = row.ColumnHeaderMr;
                    entity.ItemType = row.ItemType;
                    entity.LoanRateID = row.LoanRateID;
                    entity.SavingSchemeID = row.SavingSchemeID;
                    entity.RdSchemeID = row.RdSchemeID;
                    entity.ShareSchemeId = row.ShareSchemeId;
                    entity.PrincipalOrDepositLedgerID = row.PrincipalOrDepositLedgerID;
                    entity.InterestLedgerID = row.InterestLedgerID;
                    entity.ReceivableInterestLedgerID = row.ReceivableInterestLedgerID;
                    entity.OverdueInterestLedgerID = row.OverdueInterestLedgerID;
                    entity.ShowBalanceColumn = row.ShowBalanceColumn;
                    entity.IncludeOverduePenalInterest = row.IncludeOverduePenalInterest;
                    entity.LoanIntraAllocationOrder = row.LoanIntraAllocationOrder;
                    entity.IsContributionTarget = row.IsContributionTarget;
                    entity.DefaultAmount = row.DefaultAmount;
                    entity.IsActive = true;
                    entity.UpdatedAt = now;

                    await _context.SaveChangesAsync();
                    keepIds.Add(entity.DemandColumnSettingId);
                }

                // Soft-deactivate obsolete settings instead of deleting so saved DemandMemberColumnItems FKs remain intact
                foreach (var oldRow in existingRows.Where(e => !keepIds.Contains(e.DemandColumnSettingId)))
                {
                    bool isReferenced = await _context.DemandMemberColumnItems
                        .AsNoTracking()
                        .AnyAsync(i => i.DemandColumnSettingId == oldRow.DemandColumnSettingId);

                    if (!isReferenced)
                    {
                        _context.DemandColumnSettings.Remove(oldRow);
                    }
                    else
                    {
                        oldRow.IsActive = false;
                        oldRow.IsContributionTarget = false;
                        oldRow.SequenceOrder = 9999;
                        oldRow.UpdatedAt = now;
                    }
                }

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                var updated = await _context.DemandColumnSettings
                    .AsNoTracking()
                    .Where(s => s.IsActive)
                    .OrderBy(s => s.SequenceOrder)
                    .ThenBy(s => s.DemandColumnSettingId)
                    .ToListAsync();

                return Ok(new
                {
                    message = "डिमांड सेटिंग्ज यशस्वीरीत्या जतन केल्या आहेत!",
                    settings = updated
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return BadRequest($"डिमांड सेटिंग्ज जतन करताना त्रुटी: {ex.Message}");
            }
        }
    }

    public class SaveDemandSettingsDto
    {
        public List<DemandColumnSettingDto> Items { get; set; } = new();
    }

    public class DemandColumnSettingDto
    {
        public int DemandColumnSettingId { get; set; }
        public int SequenceOrder { get; set; }
        public string ColumnHeaderMr { get; set; } = string.Empty;
        public string ItemType { get; set; } = "LOAN";
        public int? LoanRateID { get; set; }
        public int? SavingSchemeID { get; set; }
        public int? RdSchemeID { get; set; }
        public int? ShareSchemeId { get; set; }
        public int? PrincipalOrDepositLedgerID { get; set; }
        public int? InterestLedgerID { get; set; }
        public int? ReceivableInterestLedgerID { get; set; }
        public int? OverdueInterestLedgerID { get; set; }
        public bool ShowBalanceColumn { get; set; } = true;
        public bool IncludeOverduePenalInterest { get; set; } = false;
        public string LoanIntraAllocationOrder { get; set; } = "INTEREST_FIRST";
        public bool IsContributionTarget { get; set; } = false;
        public decimal DefaultAmount { get; set; } = 0m;
        public bool IsActive { get; set; } = true;
    }
}
