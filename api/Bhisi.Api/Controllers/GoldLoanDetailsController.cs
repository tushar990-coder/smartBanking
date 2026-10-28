using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GoldLoanDetailsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public GoldLoanDetailsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/GoldLoanDetails/ByLoanAccount/5
        [HttpGet("ByLoanAccount/{loanAccountId}")]
        public async Task<ActionResult<IEnumerable<GoldLoanDetail>>> GetGoldDetailsForLoan(int loanAccountId)
        {
            var loanAcc = await _context.LoanAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.LoanAccountID == loanAccountId);

            int? linkedAppId = loanAcc?.LoanApplicationID;

            var list = await _context.GoldLoanDetails
                .Where(g => g.LoanAccountID == loanAccountId ||
                            (linkedAppId.HasValue && linkedAppId.Value > 0 && g.LoanApplicationID == linkedAppId.Value))
                .OrderBy(g => g.GoldLoanDetailID)
                .ToListAsync();

            // Auto-heal missing LoanAccountID on application-level rows when LoanAccount exists
            if (loanAcc != null && list.Any(g => !g.LoanAccountID.HasValue || g.LoanAccountID.Value <= 0))
            {
                foreach (var row in list)
                {
                    if (!row.LoanAccountID.HasValue || row.LoanAccountID.Value <= 0)
                    {
                        row.LoanAccountID = loanAccountId;
                    }
                }
                await _context.SaveChangesAsync();
            }

            return list;
        }

        // GET: api/GoldLoanDetails/ByLoanApplication/5
        [HttpGet("ByLoanApplication/{loanApplicationId}")]
        public async Task<ActionResult<IEnumerable<GoldLoanDetail>>> GetGoldDetailsForApplication(int loanApplicationId)
        {
            var app = await _context.LoanApplications
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.LoanApplicationID == loanApplicationId);

            var linkedAcc = await _context.LoanAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.LoanApplicationID == loanApplicationId ||
                    (app != null && !string.IsNullOrEmpty(app.LoanAccountNo) && l.LoanAccountNo == app.LoanAccountNo));

            int? linkedAccId = linkedAcc?.LoanAccountID;

            return await _context.GoldLoanDetails
                .Where(g => g.LoanApplicationID == loanApplicationId ||
                            (linkedAccId.HasValue && linkedAccId.Value > 0 && g.LoanAccountID == linkedAccId.Value))
                .OrderBy(g => g.GoldLoanDetailID)
                .ToListAsync();
        }

        public class SaveApplicationGoldDetailDto
        {
            public long? GoldLoanDetailID { get; set; }
            public string? OrnamentName { get; set; }
            public int? Quantity { get; set; }
            public decimal? GrossWeight { get; set; }
            public decimal? NetWeight { get; set; }
            public decimal? Purity { get; set; }
            public decimal? GoldRatePerGram { get; set; }
            public decimal? EstimatedValue { get; set; }
            public string? ImagePath { get; set; }
            public string? ValuerName { get; set; }
            public decimal? ValuerValuation { get; set; }
            public string? ValuationReceiptNo { get; set; }
            public DateTime? ValuationDate { get; set; }
            public string? Remarks { get; set; }
        }

        // POST: api/GoldLoanDetails/SaveApplicationGoldDetails/5
        [HttpPost("SaveApplicationGoldDetails/{applicationId}")]
        public async Task<IActionResult> SaveApplicationGoldDetails(int applicationId, [FromBody] List<SaveApplicationGoldDetailDto> items)
        {
            try
            {
                var app = await _context.LoanApplications.FindAsync(applicationId);
                if (app == null) return NotFound("कर्ज अर्ज सापडला नाही.");

                var linkedAcc = await _context.LoanAccounts
                    .FirstOrDefaultAsync(l => l.LoanApplicationID == applicationId ||
                        (!string.IsNullOrEmpty(app.LoanAccountNo) && l.LoanAccountNo == app.LoanAccountNo));

                int? linkedAccountId = linkedAcc?.LoanAccountID;

                var existing = await _context.GoldLoanDetails
                    .Where(g => g.LoanApplicationID == applicationId ||
                                (linkedAccountId.HasValue && linkedAccountId.Value > 0 && g.LoanAccountID == linkedAccountId.Value))
                    .ToListAsync();

                if (!linkedAccountId.HasValue)
                {
                    linkedAccountId = existing.FirstOrDefault(g => g.LoanAccountID.HasValue && g.LoanAccountID.Value > 0)?.LoanAccountID;
                }

                if (existing.Any())
                {
                    _context.GoldLoanDetails.RemoveRange(existing);
                }

                decimal totalValuerVal = 0m;
                decimal totalEstVal = 0m;

                if (items != null && items.Any())
                {
                    foreach (var item in items)
                    {
                        decimal net = item.NetWeight ?? 0;
                        decimal gross = (item.GrossWeight.HasValue && item.GrossWeight.Value > 0) ? item.GrossWeight.Value : net;
                        decimal purity = (item.Purity.HasValue && item.Purity.Value > 0) ? item.Purity.Value : 22;
                        decimal rate = item.GoldRatePerGram ?? 0;

                        decimal purityFactor = 22m / 24m;
                        if (purity > 0 && purity <= 24) purityFactor = purity / 24m;
                        else if (purity > 24 && purity <= 100) purityFactor = purity / 100m;

                        decimal calculatedValuation = Math.Round(net * purityFactor * rate, 2);
                        decimal estVal = (item.EstimatedValue.HasValue && item.EstimatedValue.Value > 0)
                            ? item.EstimatedValue.Value
                            : calculatedValuation;
                        decimal valuerVal = (item.ValuerValuation.HasValue && item.ValuerValuation.Value > 0)
                            ? item.ValuerValuation.Value
                            : estVal;

                        totalEstVal += estVal;
                        totalValuerVal += valuerVal;

                        var newRecord = new GoldLoanDetail
                        {
                            LoanApplicationID = applicationId,
                            LoanAccountID = linkedAccountId,
                            OrnamentName = string.IsNullOrWhiteSpace(item.OrnamentName) ? "सुवर्ण अलंकार" : item.OrnamentName.Trim(),
                            Quantity = (item.Quantity.HasValue && item.Quantity.Value > 0) ? item.Quantity.Value : 1,
                            GrossWeight = gross,
                            NetWeight = net,
                            Purity = purity,
                            GoldRatePerGram = rate,
                            EstimatedValue = estVal,
                            ImagePath = string.IsNullOrWhiteSpace(item.ImagePath) ? null : item.ImagePath,
                            ValuerName = string.IsNullOrWhiteSpace(item.ValuerName) ? null : item.ValuerName.Trim(),
                            ValuerValuation = valuerVal,
                            ValuationReceiptNo = string.IsNullOrWhiteSpace(item.ValuationReceiptNo) ? null : item.ValuationReceiptNo.Trim(),
                            ValuationDate = item.ValuationDate ?? DateTime.Today,
                            Remarks = string.IsNullOrWhiteSpace(item.Remarks) ? null : item.Remarks
                        };
                        _context.GoldLoanDetails.Add(newRecord);
                    }

                    // Sync linked LoanAccount security metadata if application was edited post-disbursement
                    if (linkedAcc != null)
                    {
                        if (!string.IsNullOrWhiteSpace(app.SecurityDetails))
                        {
                            linkedAcc.SecurityDetails = app.SecurityDetails;
                        }
                        decimal effectiveSecVal = totalValuerVal > 0 ? totalValuerVal : totalEstVal;
                        if (effectiveSecVal > 0)
                        {
                            linkedAcc.SecurityValue = effectiveSecVal;
                        }
                    }
                }

                await _context.SaveChangesAsync();
                return Ok(new { success = true, count = items?.Count ?? 0 });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "दागिन्यांचे तपशील जतन करताना त्रुटी आली: " + ex.Message });
            }
        }

        // GET: api/GoldLoanDetails/5
        [HttpGet("{id}")]
        public async Task<ActionResult<GoldLoanDetail>> GetGoldLoanDetail(int id)
        {
            var goldLoanDetail = await _context.GoldLoanDetails.FindAsync(id);

            if (goldLoanDetail == null)
            {
                return NotFound();
            }

            return goldLoanDetail;
        }

        // POST: api/GoldLoanDetails
        [HttpPost]
        public async Task<ActionResult<GoldLoanDetail>> PostGoldLoanDetail(GoldLoanDetail goldLoanDetail)
        {
            goldLoanDetail.GoldLoanDetailID = 0;

            if (goldLoanDetail.LoanAccountID.HasValue && goldLoanDetail.LoanAccountID.Value > 0 && !goldLoanDetail.LoanApplicationID.HasValue)
            {
                var linkedAcc = await _context.LoanAccounts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(l => l.LoanAccountID == goldLoanDetail.LoanAccountID.Value);
                if (linkedAcc?.LoanApplicationID != null)
                {
                    goldLoanDetail.LoanApplicationID = linkedAcc.LoanApplicationID;
                }
            }

            // Auto-calculate EstimatedValue using Karat purity if not specified
            if (goldLoanDetail.EstimatedValue <= 0)
            {
                decimal purityFactor = 22m / 24m;
                if (goldLoanDetail.Purity > 0 && goldLoanDetail.Purity <= 24) purityFactor = goldLoanDetail.Purity / 24m;
                else if (goldLoanDetail.Purity > 24 && goldLoanDetail.Purity <= 100) purityFactor = goldLoanDetail.Purity / 100m;

                goldLoanDetail.EstimatedValue = Math.Round(goldLoanDetail.NetWeight * purityFactor * goldLoanDetail.GoldRatePerGram, 2);
            }

            if (goldLoanDetail.ValuerValuation <= 0)
            {
                goldLoanDetail.ValuerValuation = goldLoanDetail.EstimatedValue;
            }

            _context.GoldLoanDetails.Add(goldLoanDetail);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetGoldLoanDetail), new { id = goldLoanDetail.GoldLoanDetailID }, goldLoanDetail);
        }

        // PUT: api/GoldLoanDetails/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutGoldLoanDetail(int id, GoldLoanDetail goldLoanDetail)
        {
            if (id != goldLoanDetail.GoldLoanDetailID)
            {
                return BadRequest();
            }

            if (goldLoanDetail.LoanAccountID.HasValue && goldLoanDetail.LoanAccountID.Value > 0 && !goldLoanDetail.LoanApplicationID.HasValue)
            {
                var linkedAcc = await _context.LoanAccounts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(l => l.LoanAccountID == goldLoanDetail.LoanAccountID.Value);
                if (linkedAcc?.LoanApplicationID != null)
                {
                    goldLoanDetail.LoanApplicationID = linkedAcc.LoanApplicationID;
                }
            }

            _context.Entry(goldLoanDetail).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!GoldLoanDetailExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // DELETE: api/GoldLoanDetails/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteGoldLoanDetail(int id)
        {
            var goldLoanDetail = await _context.GoldLoanDetails.FindAsync(id);
            if (goldLoanDetail == null)
            {
                return NotFound();
            }

            _context.GoldLoanDetails.Remove(goldLoanDetail);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool GoldLoanDetailExists(int id)
        {
            return _context.GoldLoanDetails.Any(e => e.GoldLoanDetailID == id);
        }
    }
}
