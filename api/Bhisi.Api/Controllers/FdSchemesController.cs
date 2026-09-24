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

            if (fdScheme.FdLiabilityLedgerID.HasValue && fdScheme.FdLiabilityLedgerID.Value <= 0) fdScheme.FdLiabilityLedgerID = null;
            if (fdScheme.InterestExpenseLedgerID.HasValue && fdScheme.InterestExpenseLedgerID.Value <= 0) fdScheme.InterestExpenseLedgerID = null;
            if (fdScheme.InterestPayableLedgerID.HasValue && fdScheme.InterestPayableLedgerID.Value <= 0) fdScheme.InterestPayableLedgerID = null;
            if (fdScheme.PrematurePenaltyLedgerID.HasValue && fdScheme.PrematurePenaltyLedgerID.Value <= 0) fdScheme.PrematurePenaltyLedgerID = null;

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
            existingScheme.ModifiedDate = DateTime.Now;

            existingScheme.FdLiabilityLedgerID = (fdScheme.FdLiabilityLedgerID.HasValue && fdScheme.FdLiabilityLedgerID.Value > 0) ? fdScheme.FdLiabilityLedgerID : null;
            existingScheme.InterestExpenseLedgerID = (fdScheme.InterestExpenseLedgerID.HasValue && fdScheme.InterestExpenseLedgerID.Value > 0) ? fdScheme.InterestExpenseLedgerID : null;
            existingScheme.InterestPayableLedgerID = (fdScheme.InterestPayableLedgerID.HasValue && fdScheme.InterestPayableLedgerID.Value > 0) ? fdScheme.InterestPayableLedgerID : null;
            existingScheme.PrematurePenaltyLedgerID = (fdScheme.PrematurePenaltyLedgerID.HasValue && fdScheme.PrematurePenaltyLedgerID.Value > 0) ? fdScheme.PrematurePenaltyLedgerID : null;

            // Slabs Synchronization
            var incomingSlabs = fdScheme.Slabs?.ToList() ?? new List<FdSchemeInterestSlab>();
            
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

            var result = CalculateFdMaturityEngine(scheme, request);
            return Ok(result);
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
