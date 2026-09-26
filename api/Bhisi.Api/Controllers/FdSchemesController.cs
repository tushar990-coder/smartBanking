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
    public class FdSchemesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FdSchemesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/FdSchemes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FdScheme>>> GetFdSchemes([FromQuery] int? branchId)
        {
            // In Core Banking, FD Schemes are Sanstha-Wide board policies applicable across all branches
            return await _context.FdSchemes
                .Include(s => s.Slabs.OrderBy(sl => sl.FromDays))
                .Include(s => s.FdLiabilityLedger)
                .Include(s => s.InterestExpenseLedger)
                .Include(s => s.InterestPayableLedger)
                .Include(s => s.PrematurePenaltyLedger)
                .OrderByDescending(s => s.EffectiveDate)
                .ToListAsync();
        }

        // GET: api/FdSchemes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<FdScheme>> GetFdScheme(int id)
        {
            var fdScheme = await _context.FdSchemes
                .Include(s => s.Slabs.OrderBy(sl => sl.FromDays))
                .Include(s => s.FdLiabilityLedger)
                .Include(s => s.InterestExpenseLedger)
                .Include(s => s.InterestPayableLedger)
                .Include(s => s.PrematurePenaltyLedger)
                .FirstOrDefaultAsync(s => s.FdSchemeID == id);

            if (fdScheme == null)
            {
                return NotFound();
            }
            return fdScheme;
        }

        // GET: api/FdSchemes/NextCode
        [HttpGet("NextCode")]
        public async Task<ActionResult<object>> GetNextSchemeCode()
        {
            var codes = await _context.FdSchemes.Select(s => s.SchemeCode).ToListAsync();
            var existingNumbers = new HashSet<int>();
            foreach (var code in codes)
            {
                if (!string.IsNullOrWhiteSpace(code))
                {
                    var digits = new string(code.Where(char.IsDigit).ToArray());
                    if (int.TryParse(digits, out int num) && num > 0)
                    {
                        existingNumbers.Add(num);
                    }
                }
            }
            int nextNum = 1;
            while (existingNumbers.Contains(nextNum))
            {
                nextNum++;
            }
            return Ok(new { nextCode = $"FD{nextNum:D3}" });
        }

        // POST: api/FdSchemes
        [HttpPost]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<ActionResult<FdScheme>> PostFdScheme(FdScheme fdScheme)
        {
            if (string.IsNullOrWhiteSpace(fdScheme.SchemeCode))
            {
                var codes = await _context.FdSchemes.Select(s => s.SchemeCode).ToListAsync();
                var existingNumbers = new HashSet<int>();
                foreach (var code in codes)
                {
                    if (!string.IsNullOrWhiteSpace(code))
                    {
                        var digits = new string(code.Where(char.IsDigit).ToArray());
                        if (int.TryParse(digits, out int num) && num > 0)
                        {
                            existingNumbers.Add(num);
                        }
                    }
                }
                int nextNum = 1;
                while (existingNumbers.Contains(nextNum))
                {
                    nextNum++;
                }
                fdScheme.SchemeCode = $"FD{nextNum:D3}";
            }
            else
            {
                fdScheme.SchemeCode = fdScheme.SchemeCode.Trim();
            }

            if (fdScheme.PrematurePenaltyLedgerID.HasValue && fdScheme.PrematurePenaltyLedgerID.Value <= 0) fdScheme.PrematurePenaltyLedgerID = null;

            // Validate Mandatory Core Banking GL Ledgers
            var ledgerValidation = await ValidateSchemeLedgersEngineAsync(fdScheme);
            if (!ledgerValidation.IsValid)
            {
                return BadRequest(ledgerValidation.ErrorMessage);
            }

            fdScheme.FdLiabilityLedger = null;
            fdScheme.InterestExpenseLedger = null;
            fdScheme.InterestPayableLedger = null;
            fdScheme.PrematurePenaltyLedger = null;
            fdScheme.Branch = null;
            fdScheme.IsActive = true;
            fdScheme.CreatedDate = DateTime.Now;

            // Handle incoming Slabs
            var incomingSlabs = fdScheme.Slabs?.ToList() ?? new List<FdSchemeInterestSlab>();
            fdScheme.Slabs = new List<FdSchemeInterestSlab>();

            if (fdScheme.SchemeDurationModel == "Slab")
            {
                var validation = ValidateSlabsEngine(incomingSlabs, fdScheme.SchemeDurationModel);
                if (!validation.IsValid)
                {
                    return BadRequest(validation.ErrorMessage);
                }
                fdScheme.MinDurationDays = validation.MinDays;
                fdScheme.MaxDurationDays = validation.MaxDays;
                incomingSlabs = incomingSlabs.OrderBy(s => s.FromDays).ToList();
            }

            _context.FdSchemes.Add(fdScheme);
            await _context.SaveChangesAsync();

            if (incomingSlabs.Any())
            {
                foreach (var slab in incomingSlabs)
                {
                    slab.SlabID = 0;
                    slab.FdSchemeID = fdScheme.FdSchemeID;
                    slab.CreatedAt = DateTime.UtcNow;
                    _context.FdSchemeInterestSlabs.Add(slab);
                }
                await _context.SaveChangesAsync();
            }

            return CreatedAtAction("GetFdScheme", new { id = fdScheme.FdSchemeID }, fdScheme);
        }

        // PUT: api/FdSchemes/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> PutFdScheme(int id, FdScheme fdScheme)
        {
            if (id != fdScheme.FdSchemeID)
            {
                return BadRequest("Scheme ID mismatch.");
            }

            var existingScheme = await _context.FdSchemes
                .Include(s => s.Slabs)
                .FirstOrDefaultAsync(s => s.FdSchemeID == id);

            if (existingScheme == null)
            {
                return NotFound();
            }

            // Validate Mandatory Core Banking GL Ledgers
            var ledgerValidation = await ValidateSchemeLedgersEngineAsync(fdScheme);
            if (!ledgerValidation.IsValid)
            {
                return BadRequest(ledgerValidation.ErrorMessage);
            }

            // Update Scheme fields
            existingScheme.SchemeName = fdScheme.SchemeName;
            existingScheme.DurationMonths = fdScheme.DurationMonths;
            existingScheme.DurationType = string.IsNullOrWhiteSpace(fdScheme.DurationType) ? "Months" : fdScheme.DurationType;
            existingScheme.SchemeDurationModel = string.IsNullOrWhiteSpace(fdScheme.SchemeDurationModel) ? "Fixed" : fdScheme.SchemeDurationModel;
            existingScheme.MinDurationDays = fdScheme.MinDurationDays;
            existingScheme.MaxDurationDays = fdScheme.MaxDurationDays;
            existingScheme.InterestRate = fdScheme.InterestRate;
            existingScheme.SeniorCitizenInterestRate = fdScheme.SeniorCitizenInterestRate;
            existingScheme.InterestType = fdScheme.InterestType;
            existingScheme.InterestPostingMethod = fdScheme.InterestPostingMethod;
            existingScheme.InterestCompoundingFrequency = fdScheme.InterestCompoundingFrequency;
            existingScheme.MinimumAmount = fdScheme.MinimumAmount;
            existingScheme.MaximumAmount = fdScheme.MaximumAmount;
            existingScheme.PrematureInterestRate = fdScheme.PrematureInterestRate;
            existingScheme.EffectiveDate = fdScheme.EffectiveDate;
            existingScheme.IsActive = fdScheme.IsActive;
            existingScheme.AllowOverdueInterest = fdScheme.AllowOverdueInterest;
            existingScheme.OverdueInterestRate = fdScheme.OverdueInterestRate;
            existingScheme.OverdueGraceDays = fdScheme.OverdueGraceDays;
            existingScheme.OverdueRenewalPolicy = string.IsNullOrWhiteSpace(fdScheme.OverdueRenewalPolicy) ? "ClosureDate" : fdScheme.OverdueRenewalPolicy;
            existingScheme.ModifiedDate = DateTime.Now;

            existingScheme.FdLiabilityLedgerID = fdScheme.FdLiabilityLedgerID;
            existingScheme.InterestExpenseLedgerID = fdScheme.InterestExpenseLedgerID;
            existingScheme.InterestPayableLedgerID = fdScheme.InterestPayableLedgerID;
            existingScheme.PrematurePenaltyLedgerID = (fdScheme.PrematurePenaltyLedgerID.HasValue && fdScheme.PrematurePenaltyLedgerID.Value > 0) ? fdScheme.PrematurePenaltyLedgerID : null;

            // Slabs Synchronization
            var incomingSlabs = fdScheme.Slabs?.ToList() ?? new List<FdSchemeInterestSlab>();

            if (fdScheme.SchemeDurationModel == "Slab")
            {
                var validation = ValidateSlabsEngine(incomingSlabs, fdScheme.SchemeDurationModel);
                if (!validation.IsValid)
                {
                    return BadRequest(validation.ErrorMessage);
                }
                existingScheme.MinDurationDays = validation.MinDays;
                existingScheme.MaxDurationDays = validation.MaxDays;
                incomingSlabs = incomingSlabs.OrderBy(s => s.FromDays).ToList();
            }
            
            // 1. Remove deleted slabs
            var incomingSlabIds = incomingSlabs.Where(s => s.SlabID > 0).Select(s => s.SlabID).ToHashSet();
            var slabsToRemove = existingScheme.Slabs.Where(s => !incomingSlabIds.Contains(s.SlabID)).ToList();
            foreach (var slab in slabsToRemove)
            {
                _context.FdSchemeInterestSlabs.Remove(slab);
            }

            // 2. Update existing & Add new
            foreach (var incoming in incomingSlabs)
            {
                if (incoming.SlabID > 0)
                {
                    var existingSlab = existingScheme.Slabs.FirstOrDefault(s => s.SlabID == incoming.SlabID);
                    if (existingSlab != null)
                    {
                        existingSlab.FromDays = incoming.FromDays;
                        existingSlab.ToDays = incoming.ToDays;
                        existingSlab.InterestRate = incoming.InterestRate;
                        existingSlab.SeniorCitizenRate = incoming.SeniorCitizenRate;
                        existingSlab.PrematureRate = incoming.PrematureRate;
                        existingSlab.IsActive = incoming.IsActive;
                    }
                }
                else
                {
                    incoming.FdSchemeID = existingScheme.FdSchemeID;
                    incoming.CreatedAt = DateTime.UtcNow;
                    _context.FdSchemeInterestSlabs.Add(incoming);
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/FdSchemes/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> DeleteFdScheme(int id)
        {
            var fdScheme = await _context.FdSchemes
                .Include(s => s.Slabs)
                .FirstOrDefaultAsync(s => s.FdSchemeID == id);

            if (fdScheme == null)
            {
                return NotFound();
            }

            // Check if any accounts exist under this scheme
            bool hasAccounts = await _context.FdAccounts.AnyAsync(a => a.FdSchemeID == id);
            if (hasAccounts)
            {
                return BadRequest("ही योजना हटवता येणार नाही कारण या योजनेखाली आधीच काही खाती उघडलेली आहेत.");
            }

            _context.FdSchemes.Remove(fdScheme);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/FdSchemes/CalculateMaturity
        [HttpPost("CalculateMaturity")]
        public async Task<ActionResult<object>> CalculateMaturity([FromBody] FdMaturityCalculationRequest request)
        {
            if (request == null || request.FdSchemeID <= 0)
            {
                return BadRequest("Invalid scheme calculation request.");
            }

            var scheme = await _context.FdSchemes
                .Include(s => s.Slabs.Where(sl => sl.IsActive))
                .FirstOrDefaultAsync(s => s.FdSchemeID == request.FdSchemeID);

            if (scheme == null)
            {
                return NotFound("Scheme not found.");
            }

            var opDate = request.OpeningDate != default ? request.OpeningDate : DateTime.Today;
            string durType = !string.IsNullOrWhiteSpace(request.DurationType) ? request.DurationType : (scheme.DurationType ?? "Months");
            int durVal = request.DurationValue > 0 ? request.DurationValue : (scheme.DurationMonths > 0 ? scheme.DurationMonths : 12);
            int totalDays;
            if (durType.Equals("Days", StringComparison.OrdinalIgnoreCase)) totalDays = durVal;
            else if (durType.Equals("Years", StringComparison.OrdinalIgnoreCase)) totalDays = (int)(opDate.AddYears(durVal) - opDate).TotalDays;
            else totalDays = (int)(opDate.AddMonths(durVal) - opDate).TotalDays;

            if (scheme.SchemeDurationModel == "Slab")
            {
                var matched = scheme.Slabs?.FirstOrDefault(s => totalDays >= s.FromDays && totalDays <= s.ToDays && s.IsActive);
                if (matched == null)
                {
                    return BadRequest($"निवडलेला कालावधी ({totalDays} दिवस) योजनेच्या कोणत्याही मंजूर स्लॅबमध्ये बसत नाही (योजना मर्यादा: {scheme.MinDurationDays ?? 1} ते {scheme.MaxDurationDays ?? 0} दिवस).");
                }
            }

            var result = CalculateFdMaturityEngine(scheme, request);
            return Ok(result);
        }
        private async Task<(bool IsValid, string? ErrorMessage)> ValidateSchemeLedgersEngineAsync(FdScheme scheme)
        {
            if (!scheme.FdLiabilityLedgerID.HasValue || scheme.FdLiabilityLedgerID.Value <= 0)
            {
                return (false, "मुदत ठेव दायित्व लेजर (FD Liability Ledger) निवडणे अनिवार्य आहे.");
            }

            if (!scheme.InterestPayableLedgerID.HasValue || scheme.InterestPayableLedgerID.Value <= 0)
            {
                return (false, "देय व्याज लेजर (Interest Payable Ledger) निवडणे अनिवार्य आहे.");
            }

            if (!scheme.InterestExpenseLedgerID.HasValue || scheme.InterestExpenseLedgerID.Value <= 0)
            {
                return (false, "व्याज खर्च लेजर (Interest Expense Ledger) निवडणे अनिवार्य आहे.");
            }

            var ledgerIds = new List<int>
            {
                scheme.FdLiabilityLedgerID.Value,
                scheme.InterestPayableLedgerID.Value,
                scheme.InterestExpenseLedgerID.Value
            };

            if (scheme.PrematurePenaltyLedgerID.HasValue && scheme.PrematurePenaltyLedgerID.Value > 0)
            {
                ledgerIds.Add(scheme.PrematurePenaltyLedgerID.Value);
            }

            var ledgers = await _context.Ledgers
                .Where(l => ledgerIds.Contains(l.LedgerID))
                .ToDictionaryAsync(l => l.LedgerID);

            if (!ledgers.TryGetValue(scheme.FdLiabilityLedgerID.Value, out var liabLedger) || !liabLedger.IsActive)
            {
                return (false, "निवडलेले मुदत ठेव दायित्व लेजर (FD Liability Ledger) अस्तित्वात नाही किंवा निष्क्रिय (Inactive) आहे.");
            }

            if (!ledgers.TryGetValue(scheme.InterestPayableLedgerID.Value, out var payLedger) || !payLedger.IsActive)
            {
                return (false, "निवडलेले देय व्याज लेजर (Interest Payable Ledger) अस्तित्वात नाही किंवा निष्क्रिय (Inactive) आहे.");
            }

            if (!ledgers.TryGetValue(scheme.InterestExpenseLedgerID.Value, out var expLedger) || !expLedger.IsActive)
            {
                return (false, "निवडलेले व्याज खर्च लेजर (Interest Expense Ledger) अस्तित्वात नाही किंवा निष्क्रिय (Inactive) आहे.");
            }

            if (scheme.PrematurePenaltyLedgerID.HasValue && scheme.PrematurePenaltyLedgerID.Value > 0)
            {
                if (!ledgers.TryGetValue(scheme.PrematurePenaltyLedgerID.Value, out var penLedger) || !penLedger.IsActive)
                {
                    return (false, "निवडलेले मुदतपूर्व दंड लेजर (Premature Penalty Ledger) अस्तित्वात नाही किंवा निष्क्रिय (Inactive) आहे.");
                }
            }

            return (true, null);
        }

        private static (bool IsValid, string? ErrorMessage, int? MinDays, int? MaxDays) ValidateSlabsEngine(
            List<FdSchemeInterestSlab> incomingSlabs, 
            string schemeDurationModel)
        {
            if (schemeDurationModel != "Slab")
            {
                return (true, null, null, null);
            }

            if (incomingSlabs == null || !incomingSlabs.Any())
            {
                return (false, "कालावधी स्लॅब पद्धतीसाठी (Slab Model) किमान १ स्लॅब जोडणे अनिवार्य आहे.", null, null);
            }

            // 1. Sort by FromDays ascending
            var sorted = incomingSlabs.OrderBy(s => s.FromDays).ToList();

            for (int i = 0; i < sorted.Count; i++)
            {
                var s = sorted[i];

                // Validate Day ranges
                if (s.FromDays <= 0 || s.ToDays <= 0)
                {
                    return (false, $"स्लॅब क्र. {i + 1}: कालावधी दिवस ० पेक्षा जास्त असणे आवश्यक आहे (From: {s.FromDays}, To: {s.ToDays}).", null, null);
                }

                if (s.FromDays > s.ToDays)
                {
                    return (false, $"स्लॅब क्र. {i + 1}: सुरुवातीचे दिवस ({s.FromDays}) हे शेवटच्या दिवसांपेक्षा ({s.ToDays}) लहान किंवा बरोबर असणे आवश्यक आहे.", null, null);
                }

                // Validate Interest Rates
                if (s.InterestRate <= 0 || s.InterestRate > 30)
                {
                    return (false, $"स्लॅब क्र. {i + 1}: सामान्य व्याजदर ०% पेक्षा जास्त आणि ३०% पेक्षा कमी असावा (दिला: {s.InterestRate}%).", null, null);
                }

                if (s.SeniorCitizenRate < s.InterestRate)
                {
                    return (false, $"स्लॅब क्र. {i + 1}: ज्येष्ठ नागरिक व्याजदर ({s.SeniorCitizenRate}%) हा नियमित व्याजदरापेक्षा ({s.InterestRate}%) कमी असू शकत नाही.", null, null);
                }

                if (s.PrematureRate > s.InterestRate)
                {
                    return (false, $"स्लॅब क्र. {i + 1}: मुदतपूर्व कपात दर ({s.PrematureRate}%) हा नियमित व्याजदरापेक्षा ({s.InterestRate}%) जास्त असू शकत नाही.", null, null);
                }

                // Continuity and Overlap check against previous slab
                if (i > 0)
                {
                    var prev = sorted[i - 1];

                    // Overlap check
                    if (s.FromDays <= prev.ToDays)
                    {
                        return (false, $"स्लॅब क्र. {i} (दिवस {prev.FromDays}-{prev.ToDays}) आणि स्लॅब क्र. {i + 1} (दिवस {s.FromDays}-{s.ToDays}) मध्ये दिवसांचे ओव्हरलॅप (Overlap) आहे. कृपया दिवस स्वतंत्र ठेवावेत.", null, null);
                    }

                    // Gap check
                    if (s.FromDays != prev.ToDays + 1)
                    {
                        return (false, $"स्लॅब क्र. {i} आणि स्लॅब क्र. {i + 1} मध्ये दिवसांची खंडितता (Gap) आहे. दिवस {prev.ToDays + 1} ते {s.FromDays - 1} सुटलेले आहेत. स्लॅब सलग (Continuous) असणे आवश्यक आहे.", null, null);
                    }
                }
            }

            int minDays = sorted.First().FromDays;
            int maxDays = sorted.Last().ToDays;

            return (true, null, minDays, maxDays);
        }

        private static FdMaturityCalculationResult CalculateFdMaturityEngine(FdScheme scheme, FdMaturityCalculationRequest request)
        {
            var opDate = request.OpeningDate != default ? request.OpeningDate : DateTime.Today;
            string durType = !string.IsNullOrWhiteSpace(request.DurationType) ? request.DurationType : (scheme.DurationType ?? "Months");
            int durVal = request.DurationValue > 0 ? request.DurationValue : (scheme.DurationMonths > 0 ? scheme.DurationMonths : 12);

            DateTime maturityDate;
            int totalDays;

            if (durType.Equals("Days", StringComparison.OrdinalIgnoreCase))
            {
                totalDays = durVal;
                maturityDate = opDate.AddDays(totalDays);
            }
            else if (durType.Equals("Years", StringComparison.OrdinalIgnoreCase))
            {
                maturityDate = opDate.AddYears(durVal);
                totalDays = (int)(maturityDate - opDate).TotalDays;
            }
            else // Months
            {
                maturityDate = opDate.AddMonths(durVal);
                totalDays = (int)(maturityDate - opDate).TotalDays;
            }

            // Determine Applicable Interest Rate
            decimal appliedRate;
            FdSchemeInterestSlab? matchedSlab = null;

            if (scheme.SchemeDurationModel == "Slab" && scheme.Slabs != null && scheme.Slabs.Any())
            {
                matchedSlab = scheme.Slabs.FirstOrDefault(s => totalDays >= s.FromDays && totalDays <= s.ToDays && s.IsActive);
                if (matchedSlab != null)
                {
                    appliedRate = request.IsSeniorCitizen ? matchedSlab.SeniorCitizenRate : matchedSlab.InterestRate;
                }
                else
                {
                    appliedRate = request.IsSeniorCitizen ? scheme.SeniorCitizenInterestRate : scheme.InterestRate;
                }
            }
            else
            {
                appliedRate = request.IsSeniorCitizen ? scheme.SeniorCitizenInterestRate : scheme.InterestRate;
            }

            // Calculate Maturity Amount
            decimal principal = request.DepositAmount;
            decimal matAmount = 0;
            decimal t = (decimal)totalDays / 365m;

            if (principal > 0 && totalDays > 0)
            {
                string type = scheme.InterestType ?? "Simple";
                if (type.Equals("Cumulative", StringComparison.OrdinalIgnoreCase))
                {
                    double n = 4; // Quarterly standard
                    if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;
                    if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                    if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;

                    double r = (double)appliedRate / (n * 100.0);
                    double timeInYears = (double)totalDays / 365.0;
                    double compound = (double)principal * Math.Pow(1.0 + r, n * timeInYears);
                    matAmount = (decimal)compound;
                }
                else if (type.Equals("MIS", StringComparison.OrdinalIgnoreCase) || type.Equals("Monthly Interest", StringComparison.OrdinalIgnoreCase))
                {
                    matAmount = principal;
                }
                else // Simple Interest
                {
                    matAmount = principal + ((principal * appliedRate * (decimal)totalDays) / (365m * 100m));
                }
            }

            long roundedMaturity = (long)Math.Round(matAmount, MidpointRounding.AwayFromZero);
            long interestAmount = roundedMaturity >= (long)principal ? roundedMaturity - (long)principal : 0;

            return new FdMaturityCalculationResult
            {
                FdSchemeID = scheme.FdSchemeID,
                SchemeName = scheme.SchemeName,
                DurationType = durType,
                DurationValue = durVal,
                DurationInDays = totalDays,
                InterestRate = appliedRate,
                OpeningDate = opDate,
                MaturityDate = maturityDate,
                DepositAmount = principal,
                MaturityAmount = roundedMaturity,
                InterestAmount = interestAmount,
                MatchedSlabID = matchedSlab?.SlabID
            };
        }

        private bool FdSchemeExists(int id)
        {
            return _context.FdSchemes.Any(e => e.FdSchemeID == id);
        }
    }

    public class FdMaturityCalculationRequest
    {
        public int FdSchemeID { get; set; }
        public DateTime OpeningDate { get; set; } = DateTime.Today;
        public decimal DepositAmount { get; set; }
        public string DurationType { get; set; } = "Months"; // Days, Months, Years
        public int DurationValue { get; set; } = 12;
        public bool IsSeniorCitizen { get; set; } = false;
    }

    public class FdMaturityCalculationResult
    {
        public int FdSchemeID { get; set; }
        public string SchemeName { get; set; } = string.Empty;
        public string DurationType { get; set; } = "Months";
        public int DurationValue { get; set; }
        public int DurationInDays { get; set; }
        public decimal InterestRate { get; set; }
        public DateTime OpeningDate { get; set; }
        public DateTime MaturityDate { get; set; }
        public decimal DepositAmount { get; set; }
        public decimal MaturityAmount { get; set; }
        public decimal InterestAmount { get; set; }
        public int? MatchedSlabID { get; set; }
    }
}
