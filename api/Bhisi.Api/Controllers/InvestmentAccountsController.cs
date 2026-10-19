using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Filters;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
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
            return Ok(new { nextAccountNo = nextNo });
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
            // 1. Identify active financial year
            int activeFyId = await _context.FinancialYears
                .Where(fy => fy.IsActive)
                .Select(fy => fy.FinancialYearID)
                .FirstOrDefaultAsync();

            if (activeFyId == 0)
            {
                activeFyId = await _context.FinancialYears
                    .OrderByDescending(fy => fy.FinancialYearID)
                    .Select(fy => fy.FinancialYearID)
                    .FirstOrDefaultAsync();
            }

            if (activeFyId == 0)
            {
                return;
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

            // 8. Synchronize consolidated OpeningBalance on Ledgers table
            foreach (var ledgerId in allSchemeLedgerIds)
            {
                var ledger = await _context.Ledgers.FindAsync(ledgerId);
                if (ledger != null)
                {
                    decimal totalDr = await _context.BranchLedgerOpeningBalances
                        .Where(b => b.LedgerID == ledgerId && b.FinancialYearID == activeFyId && b.OpeningBalanceType == "Dr")
                        .SumAsync(b => b.OpeningBalance);

                    if (totalDr > 0 || ledger.OpeningBalance > 0)
                    {
                        ledger.OpeningBalance = totalDr;
                        ledger.OpeningBalanceType = "Dr";
                    }
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

        private async Task<InvestmentVoucherMapping> GetVoucherMappingForBranch(int branchId, string investmentType = "", int? schemeId = null)
        {
            // 1. Check branch-specific mapping
            var mapping = await _context.InvestmentVoucherMappings
                .FirstOrDefaultAsync(m => m.BranchID == branchId && (string.IsNullOrEmpty(investmentType) || m.InvestmentType == investmentType));

            if (mapping == null)
            {
                mapping = await _context.InvestmentVoucherMappings
                    .FirstOrDefaultAsync(m => m.BranchID == branchId);
            }

            // 2. Fallback to Head Office (Branch 1) mapping
            if (mapping == null)
            {
                mapping = await _context.InvestmentVoucherMappings
                    .FirstOrDefaultAsync(m => m.BranchID == 1 && (string.IsNullOrEmpty(investmentType) || m.InvestmentType == investmentType));
                if (mapping == null)
                {
                    mapping = await _context.InvestmentVoucherMappings
                        .FirstOrDefaultAsync(m => m.BranchID == 1);
                }
            }

            // 3. Fallback to any existing mapping in the system
            if (mapping == null)
            {
                mapping = await _context.InvestmentVoucherMappings.FirstOrDefaultAsync();
            }

            // 4. If scheme has direct GL configuration, synthesize or override mapping
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                var scheme = await _context.InvestmentSchemes.FindAsync(schemeId.Value);
                if (scheme != null)
                {
                    if (mapping == null && (scheme.InvestmentAssetLedgerID.HasValue || scheme.InterestIncomeLedgerID.HasValue))
                    {
                        mapping = new InvestmentVoucherMapping
                        {
                            BranchID = branchId,
                            InvestmentType = scheme.InvestmentType,
                            InvestmentLedgerID = scheme.InvestmentAssetLedgerID ?? 1,
                            InterestIncomeLedgerID = scheme.InterestIncomeLedgerID ?? 1,
                            InterestReceivableLedgerID = scheme.InterestReceivableLedgerID ?? 1
                        };
                    }
                    else if (mapping != null)
                    {
                        if (scheme.InvestmentAssetLedgerID.HasValue && scheme.InvestmentAssetLedgerID.Value > 0)
                        {
                            mapping.InvestmentLedgerID = scheme.InvestmentAssetLedgerID.Value;
                        }
                        if (scheme.InterestIncomeLedgerID.HasValue && scheme.InterestIncomeLedgerID.Value > 0)
                        {
                            mapping.InterestIncomeLedgerID = scheme.InterestIncomeLedgerID.Value;
                        }
                        if (scheme.InterestReceivableLedgerID.HasValue && scheme.InterestReceivableLedgerID.Value > 0)
                        {
                            mapping.InterestReceivableLedgerID = scheme.InterestReceivableLedgerID.Value;
                        }
                    }
                }
            }

            // 5. If STILL null (fresh system), synthesize auto-discovered ledgers so voucher is NEVER dropped!
            if (mapping == null)
            {
                var invLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("गुंतवणूक") || l.LedgerName.Contains("Investment"));
                var intIncLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("गुंतवणूक व्याज") || (l.LedgerName.Contains("व्याज") && l.AccountType == "Income"));
                var intRecLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("येणे व्याज") || l.LedgerName.Contains("Receivable"));

                mapping = new InvestmentVoucherMapping
                {
                    BranchID = branchId,
                    InvestmentType = "Deposit",
                    InvestmentLedgerID = invLedger?.LedgerID ?? 1,
                    InterestIncomeLedgerID = intIncLedger?.LedgerID ?? 1,
                    InterestReceivableLedgerID = intRecLedger?.LedgerID ?? 1
                };
            }

            return mapping;
        }

        // GET: api/InvestmentAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetInvestmentAccounts([FromQuery] int? branchId, [FromQuery] string? status)
        {
            var query = _context.InvestmentAccounts
                .Include(a => a.InvestmentInstitution)
                .Include(a => a.InvestmentScheme)
                .Include(a => a.Branch)
                .AsQueryable();

            if (branchId.HasValue)
            {
                query = query.Where(a => a.BranchID == branchId.Value);
            }
            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(a => a.Status == status);
            }

            var accounts = await query
                .OrderByDescending(a => a.InvestmentDate)
                .Select(a => new {
                    a.InvestmentAccountID,
                    a.BranchID,
                    BranchName = a.Branch != null ? a.Branch.BranchName : "",
                    a.InvestmentInstitutionID,
                    InstitutionName = a.InvestmentInstitution != null ? a.InvestmentInstitution.InstitutionName : "",
                    a.SchemeID,
                    SchemeName = a.InvestmentScheme != null ? a.InvestmentScheme.SchemeName : "",
                    SchemeCode = a.InvestmentScheme != null ? a.InvestmentScheme.SchemeCode : "",
                    a.InvestmentNo,
                    a.OldInvestmentNo,
                    a.DepositReceiptNo,
                    a.InvestmentDate,
                    a.PrincipalAmount,
                    a.InterestRate,
                    a.MaturityDate,
                    a.ExpectedMaturityAmount,
                    a.AccruedInterestTillMigration,
                    a.BookValue,
                    a.IsLegacyAccount,
                    a.NomineeName,
                    a.NomineeRelation,
                    a.Remarks,
                    a.Status
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // GET: api/InvestmentAccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetInvestmentAccount(int id)
        {
            var a = await _context.InvestmentAccounts
                .Include(x => x.InvestmentInstitution)
                .Include(x => x.InvestmentScheme)
                .Include(x => x.Branch)
                .FirstOrDefaultAsync(x => x.InvestmentAccountID == id);

            if (a == null)
            {
                return NotFound();
            }

            return Ok(new {
                a.InvestmentAccountID,
                a.BranchID,
                BranchName = a.Branch != null ? a.Branch.BranchName : "",
                a.InvestmentInstitutionID,
                InstitutionName = a.InvestmentInstitution != null ? a.InvestmentInstitution.InstitutionName : "",
                a.SchemeID,
                SchemeName = a.InvestmentScheme != null ? a.InvestmentScheme.SchemeName : "",
                a.InvestmentNo,
                a.OldInvestmentNo,
                a.DepositReceiptNo,
                a.InvestmentDate,
                a.PrincipalAmount,
                a.InterestRate,
                a.MaturityDate,
                a.ExpectedMaturityAmount,
                a.AccruedInterestTillMigration,
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
                            VoucherNo = $"JV-INV-OP-{account.InvestmentNo}",
                            VoucherDate = account.InvestmentDate,
                            VoucherType = "Journal",
                            Narration = $"गुंतवणूक खाते उघडले - {account.InvestmentNo}",
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
                            LedgerID = await GetDefaultCashBankLedgerId(account.BranchID), // Branch-specific Cash/Bank
                            DrCr = "Cr",
                            Amount = account.PrincipalAmount
                        };

                        _context.VoucherDetails.Add(debDetail);
                        _context.VoucherDetails.Add(credDetail);
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
                        var parts = invNo.Split('-');
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
        public async Task<ActionResult> ProcessMaturity([FromBody] InvestmentMaturity maturity)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.InvestmentAccounts.FindAsync(maturity.InvestmentAccountID);
                if (account == null) return NotFound("गुंतवणूक खाते सापडले नाही.");
                if (account.Status != "Active") return BadRequest("हे खाते Active नाही.");

                maturity.TotalReceived = maturity.PrincipalReceived + maturity.InterestReceived;

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null)
                {
                    maturity.FinancialYearID = fy.FinancialYearID;
                }
                maturity.BranchID = account.BranchID;

                // Create voucher
                var mapping = await GetVoucherMappingForBranch(account.BranchID, "", account.SchemeID);

                if (mapping != null)
                {
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"JV-INV-MAT-{account.InvestmentNo}",
                        VoucherDate = maturity.MaturityDate,
                        VoucherType = "Journal",
                        Narration = $"गुंतवणूक मुदतपूर्ती - {account.InvestmentNo}",
                        TotalAmount = maturity.TotalReceived,
                        CreatedBy = maturity.CreatedBy,
                        CreatedOn = DateTime.Now
                    };

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var d1 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = await GetDefaultCashBankLedgerId(account.BranchID), // Branch-specific Bank/Cash
                        DrCr = "Dr",
                        Amount = maturity.TotalReceived
                    };

                    var d2 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InvestmentLedgerID,
                        DrCr = "Cr",
                        Amount = maturity.PrincipalReceived
                    };

                    var d3 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestIncomeLedgerID,
                        DrCr = "Cr",
                        Amount = maturity.InterestReceived
                    };

                    _context.VoucherDetails.Add(d1);
                    _context.VoucherDetails.Add(d2);
                    _context.VoucherDetails.Add(d3);
                    await _context.SaveChangesAsync();
                    maturity.VoucherID = voucher.VoucherID;
                }

                _context.InvestmentMaturities.Add(maturity);
                account.Status = "Matured";
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "गुंतवणूक मुदतपूर्ती यशस्वी!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"मुदतपूर्ती त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/PrematureWithdraw - Premature Withdrawal
        [HttpPost("PrematureWithdraw")]
        public async Task<ActionResult> PrematureWithdraw([FromBody] InvestmentPrematureWithdrawal withdrawal)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.InvestmentAccounts.FindAsync(withdrawal.InvestmentAccountID);
                if (account == null) return NotFound("गुंतवणूक खाते सापडले नाही.");
                if (account.Status != "Active") return BadRequest("हे खाते Active नाही.");

                withdrawal.NetPayout = withdrawal.PrincipalPaid + withdrawal.InterestPaid - withdrawal.PenaltyAmount;

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null) withdrawal.FinancialYearID = fy.FinancialYearID;
                withdrawal.BranchID = account.BranchID;

                var mapping = await GetVoucherMappingForBranch(account.BranchID, "", account.SchemeID);

                if (mapping != null)
                {
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"JV-INV-PRE-{account.InvestmentNo}",
                        VoucherDate = withdrawal.WithdrawalDate,
                        VoucherType = "Journal",
                        Narration = $"गुंतवणूक मुदतपूर्व बंद - {account.InvestmentNo}",
                        TotalAmount = withdrawal.NetPayout,
                        CreatedBy = withdrawal.CreatedBy,
                        CreatedOn = DateTime.Now
                    };

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var d1 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = await GetDefaultCashBankLedgerId(account.BranchID), // Branch-specific Bank/Cash
                        DrCr = "Dr",
                        Amount = withdrawal.NetPayout
                    };

                    var d2 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InvestmentLedgerID,
                        DrCr = "Cr",
                        Amount = withdrawal.PrincipalPaid
                    };

                    _context.VoucherDetails.Add(d1);
                    _context.VoucherDetails.Add(d2);

                    if (withdrawal.InterestPaid > 0)
                    {
                        var d3 = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = mapping.InterestIncomeLedgerID,
                            DrCr = "Cr",
                            Amount = withdrawal.InterestPaid
                        };
                        _context.VoucherDetails.Add(d3);
                    }

                    await _context.SaveChangesAsync();
                    withdrawal.VoucherID = voucher.VoucherID;
                }

                _context.InvestmentPrematureWithdrawals.Add(withdrawal);
                account.Status = "Closed";
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "मुदतपूर्व काढणे यशस्वी!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"मुदतपूर्व काढणे त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/Renew - Renewal
        [HttpPost("Renew")]
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

                // Create new account
                var newAccount = new InvestmentAccount
                {
                    BranchID = oldAccount.BranchID,
                    InvestmentInstitutionID = oldAccount.InvestmentInstitutionID,
                    SchemeID = request.NewSchemeID > 0 ? request.NewSchemeID : oldAccount.SchemeID,
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
                    RenewalDate = request.RenewalDate
                };

                _context.InvestmentRenewals.Add(renewal);
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

        // POST: api/InvestmentAccounts/AccrualPosting - Interest Accrual
        [HttpPost("AccrualPosting")]
        public async Task<ActionResult> PostAccrual([FromBody] AccrualPostingRequest request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var query = _context.InvestmentAccounts.Where(a => a.Status == "Active");
                if (!request.AllBranches && request.BranchID > 0)
                {
                    query = query.Where(a => a.BranchID == request.BranchID);
                }

                var activeAccounts = await query.ToListAsync();
                if (!activeAccounts.Any())
                {
                    return BadRequest(request.AllBranches || request.BranchID <= 0 
                        ? "संस्थेत कोणतीही Active गुंतवणूक खाती नाहीत." 
                        : "या शाखेत Active गुंतवणूक खाती नाहीत.");
                }

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                int fyId = fy?.FinancialYearID ?? 1;

                var accountsByBranch = activeAccounts.GroupBy(a => a.BranchID).ToList();
                int totalProcessed = 0;
                decimal grandTotalInterest = 0;
                var skippedBranches = new List<string>();

                foreach (var branchGroup in accountsByBranch)
                {
                    int bId = branchGroup.Key;
                    var branchEntity = await _context.Branches.FindAsync(bId);
                    string bName = branchEntity?.BranchName ?? $"शाखा {bId}";

                    // Check duplicate for this branch
                    var existingAccrual = await _context.InvestmentInterestAccruals
                        .AnyAsync(a => a.BranchID == bId && a.AccrualDate.Month == request.AccrualDate.Month && a.AccrualDate.Year == request.AccrualDate.Year);

                    if (existingAccrual)
                    {
                        if (!request.AllBranches && request.BranchID > 0)
                        {
                            return BadRequest($"या शाखेसाठी ({bName}) या महिन्याची व्याज तरतूद आधीच केली आहे.");
                        }
                        skippedBranches.Add(bName);
                        continue;
                    }

                    var mapping = await GetVoucherMappingForBranch(bId);
                    decimal branchTotalInterest = 0;
                    var branchAccruals = new List<InvestmentInterestAccrual>();

                    foreach (var account in branchGroup)
                    {
                        decimal monthlyInterest = Math.Round(account.PrincipalAmount * account.InterestRate / 1200, 2);
                        branchTotalInterest += monthlyInterest;

                        branchAccruals.Add(new InvestmentInterestAccrual
                        {
                            InstitutionID = account.InstitutionID,
                            BranchID = bId,
                            FinancialYearID = fyId,
                            InvestmentAccountID = account.InvestmentAccountID,
                            AccrualDate = request.AccrualDate,
                            InterestAmount = monthlyInterest,
                            IsPosted = true
                        });
                    }

                    // Create consolidated voucher for this branch
                    if (mapping != null && branchTotalInterest > 0)
                    {
                        var branchCode = branchEntity?.BranchCode ?? $"{bId:D3}";
                        var voucher = new Voucher
                        {
                            BranchID = bId,
                            VoucherNo = $"JV-INV-ACC-{branchCode}-{request.AccrualDate:yyyyMMdd}",
                            VoucherDate = request.AccrualDate,
                            VoucherType = "Journal",
                            Narration = $"गुंतवणूक व्याज तरतूद ({bName}) - {request.AccrualDate:MMM yyyy}",
                            TotalAmount = branchTotalInterest,
                            CreatedOn = DateTime.Now
                        };

                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        var d1 = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = mapping.InterestReceivableLedgerID,
                            DrCr = "Dr",
                            Amount = branchTotalInterest
                        };

                        var d2 = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = mapping.InterestIncomeLedgerID,
                            DrCr = "Cr",
                            Amount = branchTotalInterest
                        };

                        _context.VoucherDetails.Add(d1);
                        _context.VoucherDetails.Add(d2);
                        await _context.SaveChangesAsync();

                        foreach (var accrual in branchAccruals)
                        {
                            accrual.VoucherID = voucher.VoucherID;
                        }
                    }

                    _context.InvestmentInterestAccruals.AddRange(branchAccruals);
                    await _context.SaveChangesAsync();

                    totalProcessed += branchGroup.Count();
                    grandTotalInterest += branchTotalInterest;
                }

                if (totalProcessed == 0 && skippedBranches.Any())
                {
                    return BadRequest($"निवडलेल्या शाखांसाठी ({string.Join(", ", skippedBranches)}) या महिन्याची व्याज तरतूद आधीच झालेली आहे.");
                }

                await transaction.CommitAsync();
                string skippedMsg = skippedBranches.Any() ? $" (आधीच नोंद झालेली शाखा वगळली: {string.Join(", ", skippedBranches)})" : "";
                return Ok(new { 
                    message = $"व्याज तरतूद यशस्वी!{skippedMsg}",
                    accountsProcessed = totalProcessed,
                    totalInterest = grandTotalInterest 
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"व्याज तरतूद त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/InterestReceipt - Record Interest Receipt
        [HttpPost("InterestReceipt")]
        public async Task<ActionResult> RecordInterestReceipt([FromBody] InvestmentInterestReceipt receipt)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.InvestmentAccounts.FindAsync(receipt.InvestmentAccountID);
                if (account == null) return NotFound("गुंतवणूक खाते सापडले नाही.");

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null) receipt.FinancialYearID = fy.FinancialYearID;
                receipt.BranchID = account.BranchID;

                var mapping = await GetVoucherMappingForBranch(account.BranchID, "", account.SchemeID);

                if (mapping != null)
                {
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"REC-INV-INT-{account.InvestmentNo}",
                        VoucherDate = receipt.ReceiptDate,
                        VoucherType = "Receipt",
                        Narration = $"गुंतवणूक व्याज प्राप्ती - {account.InvestmentNo}",
                        TotalAmount = receipt.ReceivedAmount,
                        CreatedBy = receipt.CreatedBy,
                        CreatedOn = DateTime.Now
                    };

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var d1 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = await GetDefaultCashBankLedgerId(account.BranchID), // Branch-specific Bank/Cash
                        DrCr = "Dr",
                        Amount = receipt.ReceivedAmount
                    };

                    var d2 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestReceivableLedgerID,
                        DrCr = "Cr",
                        Amount = receipt.ReceivedAmount
                    };

                    _context.VoucherDetails.Add(d1);
                    _context.VoucherDetails.Add(d2);
                    await _context.SaveChangesAsync();
                    receipt.VoucherID = voucher.VoucherID;
                }

                _context.InvestmentInterestReceipts.Add(receipt);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "व्याज प्राप्ती नोंद यशस्वी!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"व्याज प्राप्ती त्रुटी: {ex.Message}");
            }
        }

        // GET: api/InvestmentAccounts/Accruals?accountId=1
        [HttpGet("Accruals")]
        public async Task<ActionResult> GetAccruals([FromQuery] int? accountId, [FromQuery] int? branchId)
        {
            var query = _context.InvestmentInterestAccruals
                .Include(a => a.InvestmentAccount)
                .AsQueryable();

            if (accountId.HasValue) query = query.Where(a => a.InvestmentAccountID == accountId.Value);
            if (branchId.HasValue) query = query.Where(a => a.BranchID == branchId.Value);

            var accruals = await query
                .OrderByDescending(a => a.AccrualDate)
                .Select(a => new {
                    a.AccrualID,
                    a.InvestmentAccountID,
                    InvestmentNo = a.InvestmentAccount != null ? a.InvestmentAccount.InvestmentNo : "",
                    a.AccrualDate,
                    a.InterestAmount,
                    a.VoucherID,
                    a.IsPosted
                })
                .ToListAsync();

            return Ok(accruals);
        }

        // GET: api/InvestmentAccounts/Receipts?accountId=1
        [HttpGet("Receipts")]
        public async Task<ActionResult> GetReceipts([FromQuery] int? accountId, [FromQuery] int? branchId)
        {
            var query = _context.InvestmentInterestReceipts
                .Include(r => r.InvestmentAccount)
                .AsQueryable();

            if (accountId.HasValue) query = query.Where(r => r.InvestmentAccountID == accountId.Value);
            if (branchId.HasValue) query = query.Where(r => r.BranchID == branchId.Value);

            var receipts = await query
                .OrderByDescending(r => r.ReceiptDate)
                .Select(r => new {
                    r.ReceiptID,
                    r.InvestmentAccountID,
                    InvestmentNo = r.InvestmentAccount != null ? r.InvestmentAccount.InvestmentNo : "",
                    r.ReceiptDate,
                    r.ReceivedAmount,
                    r.VoucherID
                })
                .ToListAsync();

            return Ok(receipts);
        }

        // GET: api/InvestmentAccounts/Dashboard?branchId=1
        [HttpGet("Dashboard")]
        public async Task<ActionResult> GetDashboard([FromQuery] int? branchId)
        {
            var query = _context.InvestmentAccounts.AsQueryable();
            if (branchId.HasValue) query = query.Where(a => a.BranchID == branchId.Value);

            var activeAccounts = await query.Where(a => a.Status == "Active").ToListAsync();
            var totalInvestment = activeAccounts.Sum(a => a.PrincipalAmount);
            var totalBookValue = activeAccounts.Sum(a => a.BookValue);
            
            var totalAccruedInterest = await _context.InvestmentInterestAccruals
                .Where(a => activeAccounts.Select(ac => ac.InvestmentAccountID).Contains(a.InvestmentAccountID))
                .SumAsync(a => a.InterestAmount);

            var totalReceivedInterest = await _context.InvestmentInterestReceipts
                .Where(r => activeAccounts.Select(ac => ac.InvestmentAccountID).Contains(r.InvestmentAccountID))
                .SumAsync(r => r.ReceivedAmount);

            var maturityDueCount = activeAccounts.Count(a => a.MaturityDate <= DateTime.Today.AddMonths(3));
            var maturityDueAmount = activeAccounts.Where(a => a.MaturityDate <= DateTime.Today.AddMonths(3)).Sum(a => a.ExpectedMaturityAmount);

            return Ok(new {
                totalActiveAccounts = activeAccounts.Count,
                totalInvestment,
                totalBookValue,
                interestReceivable = totalAccruedInterest - totalReceivedInterest,
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
    public class RenewalRequest
    {
        public int OldInvestmentAccountID { get; set; }
        public int NewSchemeID { get; set; }
        public string RenewalType { get; set; } = "PrincipalOnly";
        public decimal RenewalAmount { get; set; }
        public DateTime RenewalDate { get; set; }
        public decimal NewInterestRate { get; set; }
    }

    public class AccrualPostingRequest
    {
        public int BranchID { get; set; }
        public DateTime AccrualDate { get; set; }
        public bool AllBranches { get; set; } = false;
    }
}
