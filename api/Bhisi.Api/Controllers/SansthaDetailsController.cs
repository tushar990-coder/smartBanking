using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SansthaDetailsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SansthaDetailsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/SansthaDetails
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<SansthaDetail>>> GetSansthaDetails()
        {
            return await _context.SansthaDetails.ToListAsync();
        }

        // GET: api/SansthaDetails/5
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<SansthaDetail>> GetSansthaDetail(int id)
        {
            var sansthaDetail = await _context.SansthaDetails.FindAsync(id);

            if (sansthaDetail == null)
            {
                return NotFound();
            }

            return sansthaDetail;
        }

        private static bool TryValidateFdRenewalReceiptPolicy(string? rawPolicy, out string normalizedPolicy, out string? errorMessage)
        {
            if (Helpers.FdRenewalPolicyHelper.TryNormalizePolicy(rawPolicy, out normalizedPolicy))
            {
                errorMessage = null;
                return true;
            }

            errorMessage = $"अवैध मुदत ठेव नूतनीकरण पावती धोरण '{rawPolicy}'. वैध पर्याय: NEW_RECEIPT, RETAIN_ORIGINAL, NEXT_LEGACY, HYBRID_CHOICE.";
            return false;
        }

        private static void ApplySansthaEditableFields(SansthaDetail target, SansthaDetail source, string normalizedPolicy)
        {
            target.SansthaName = source.SansthaName;
            target.Address = source.Address;
            target.Village = source.Village;
            target.Taluka = source.Taluka;
            target.District = source.District;
            target.State = source.State;
            target.PinCode = source.PinCode;
            target.ContactNo = source.ContactNo;
            target.Email = source.Email;
            target.RegistrationNo = source.RegistrationNo;
            target.RegistrationDate = source.RegistrationDate;
            target.GSTNo = source.GSTNo;
            target.LogoPath = source.LogoPath;
            target.AutoPostVouchers = false;
            target.AutoPostVoucherLimit = 0m;
            target.IsMobileCompulsory = source.IsMobileCompulsory;
            target.IsAadhaarCompulsory = source.IsAadhaarCompulsory;
            target.IsPanCompulsory = source.IsPanCompulsory;
            target.FdRenewalReceiptPolicy = normalizedPolicy;
            target.AllowManualReceiptNoOnRenewal = normalizedPolicy == Helpers.FdRenewalPolicyHelper.PolicyRetainOriginal
                ? false
                : source.AllowManualReceiptNoOnRenewal;

            if (source.AuthorizedShareCapital >= 0m)
            {
                target.AuthorizedShareCapital = source.AuthorizedShareCapital;
            }
            if (source.ShareFaceValue > 0m)
            {
                target.ShareFaceValue = source.ShareFaceValue;
            }
            decimal effFaceVal = target.ShareFaceValue > 0m ? target.ShareFaceValue : 100m;
            target.AuthorizedShareCount = source.AuthorizedShareCount > 0
                ? source.AuthorizedShareCount
                : (target.AuthorizedShareCapital > 0m ? (int)Math.Floor(target.AuthorizedShareCapital / effFaceVal) : 0);
        }

        // PUT: api/SansthaDetails/5
        [HttpPut("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> PutSansthaDetail(int id, SansthaDetail sansthaDetail)
        {
            try
            {
                if (!TryValidateFdRenewalReceiptPolicy(sansthaDetail.FdRenewalReceiptPolicy, out string normalizedPolicy, out string? policyError))
                {
                    return BadRequest(new { message = policyError });
                }

                var existing = await _context.SansthaDetails.FindAsync(id);
                if (existing == null)
                {
                    existing = await _context.SansthaDetails.FirstOrDefaultAsync();
                    if (existing == null)
                    {
                        sansthaDetail.AutoPostVouchers = false;
                        sansthaDetail.AutoPostVoucherLimit = 0m;
                        sansthaDetail.FdRenewalReceiptPolicy = normalizedPolicy;
                        sansthaDetail.AllowManualReceiptNoOnRenewal = normalizedPolicy == Helpers.FdRenewalPolicyHelper.PolicyRetainOriginal
                            ? false
                            : sansthaDetail.AllowManualReceiptNoOnRenewal;
                        _context.SansthaDetails.Add(sansthaDetail);
                        await _context.SaveChangesAsync();
                        return Ok(sansthaDetail);
                    }
                }

                ApplySansthaEditableFields(existing, sansthaDetail, normalizedPolicy);

                await _context.SaveChangesAsync();
                await EnsureInitialAuthorizedCapitalHistoryAsync(existing);
                return Ok(existing);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "संस्था माहिती सेव्ह करताना तांत्रिक त्रुटी आली: " + ex.Message });
            }
        }

        // POST: api/SansthaDetails
        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult<SansthaDetail>> PostSansthaDetail(SansthaDetail sansthaDetail)
        {
            try
            {
                if (!TryValidateFdRenewalReceiptPolicy(sansthaDetail.FdRenewalReceiptPolicy, out string normalizedPolicy, out string? policyError))
                {
                    return BadRequest(new { message = policyError });
                }

                var existing = await _context.SansthaDetails.FirstOrDefaultAsync();
                if (existing != null)
                {
                    ApplySansthaEditableFields(existing, sansthaDetail, normalizedPolicy);

                    await _context.SaveChangesAsync();
                    await EnsureInitialAuthorizedCapitalHistoryAsync(existing);
                    return Ok(existing);
                }

                sansthaDetail.AutoPostVouchers = false;
                sansthaDetail.AutoPostVoucherLimit = 0m;
                sansthaDetail.FdRenewalReceiptPolicy = normalizedPolicy;
                sansthaDetail.AllowManualReceiptNoOnRenewal = normalizedPolicy == Helpers.FdRenewalPolicyHelper.PolicyRetainOriginal
                    ? false
                    : sansthaDetail.AllowManualReceiptNoOnRenewal;
                _context.SansthaDetails.Add(sansthaDetail);
                await _context.SaveChangesAsync();
                await EnsureInitialAuthorizedCapitalHistoryAsync(sansthaDetail);

                return CreatedAtAction("GetSansthaDetail", new { id = sansthaDetail.SansthaID }, sansthaDetail);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "संस्था माहिती तयार करताना तांत्रिक त्रुटी आली: " + ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSansthaDetail(int id)
        {
            var sansthaDetail = await _context.SansthaDetails.FindAsync(id);
            if (sansthaDetail == null)
            {
                return NotFound();
            }

            _context.SansthaDetails.Remove(sansthaDetail);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("ToggleMigrationLock")]
        public async Task<IActionResult> ToggleMigrationLock()
        {
            var sansthaDetail = await _context.SansthaDetails.FirstOrDefaultAsync();
            if (sansthaDetail == null)
            {
                return NotFound("Sanstha details not found.");
            }

            sansthaDetail.IsMigrationLocked = !sansthaDetail.IsMigrationLocked;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Migration lock is now {(sansthaDetail.IsMigrationLocked ? "LOCKED" : "OPEN")}.", isLocked = sansthaDetail.IsMigrationLocked });
        }

        private int ResolveCurrentUserId()
        {
            var claim = User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                        ?? User?.FindFirst("UserID")?.Value;
            return int.TryParse(claim, out int uid) && uid > 0 ? uid : 1;
        }

        private async Task<decimal> ComputeCurrentPaidUpShareCapitalAsync()
        {
            decimal fromShareAccounts = await _context.ShareAccounts
                .AsNoTracking()
                .Where(s => s.Status == "Active")
                .SumAsync(s => (decimal?)s.TotalShareAmount) ?? 0m;

            if (fromShareAccounts > 0m)
            {
                return fromShareAccounts;
            }

            decimal fromShareMemberOpening = await _context.MemberOpeningBalances
                .AsNoTracking()
                .Include(m => m.Ledger)
                .Where(m => m.Ledger != null &&
                            ((m.Ledger.AccountType != null && (m.Ledger.AccountType.Contains("Share") || m.Ledger.AccountType.Contains("भाग"))) ||
                             m.Ledger.LedgerName.Contains("सभासद भाग") ||
                             m.Ledger.LedgerName.Contains("शेअर")))
                .SumAsync(m => (decimal?)m.Amount) ?? 0m;

            return fromShareMemberOpening;
        }

        private async Task EnsureInitialAuthorizedCapitalHistoryAsync(SansthaDetail sanstha)
        {
            if (sanstha.AuthorizedShareCapital <= 0m) return;
            bool hasAnyHistory = await _context.SansthaAuthorizedCapitalHistories
                .AnyAsync(h => h.SansthaID == sanstha.SansthaID);
            if (hasAnyHistory) return;

            decimal faceVal = sanstha.ShareFaceValue > 0m ? sanstha.ShareFaceValue : 100m;
            int shareCount = sanstha.AuthorizedShareCount > 0
                ? sanstha.AuthorizedShareCount
                : (int)Math.Floor(sanstha.AuthorizedShareCapital / faceVal);

            _context.SansthaAuthorizedCapitalHistories.Add(new SansthaAuthorizedCapitalHistory
            {
                SansthaID = sanstha.SansthaID,
                EffectiveDate = sanstha.RegistrationDate?.Date ?? new DateTime(DateTime.Today.Year - 1, 4, 1),
                AuthorizedCapitalAmount = sanstha.AuthorizedShareCapital,
                ShareFaceValue = faceVal,
                AuthorizedShareCount = shareCount,
                Remarks = "प्रारंभिक अधिकृत भागभांडवल नोंद (Initial Sanstha Profile)",
                CreatedBy = ResolveCurrentUserId(),
                CreatedDate = DateTime.Now
            });
            await _context.SaveChangesAsync();
        }

        private async Task SyncSansthaAuthorizedCapitalSnapshotAsync(int sansthaId)
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync(s => s.SansthaID == sansthaId)
                          ?? await _context.SansthaDetails.FirstOrDefaultAsync();
            if (sanstha == null) return;

            var latest = await _context.SansthaAuthorizedCapitalHistories
                .Where(h => h.SansthaID == sanstha.SansthaID)
                .OrderByDescending(h => h.EffectiveDate)
                .ThenByDescending(h => h.HistoryID)
                .FirstOrDefaultAsync();

            if (latest != null)
            {
                sanstha.AuthorizedShareCapital = latest.AuthorizedCapitalAmount;
                sanstha.ShareFaceValue = latest.ShareFaceValue > 0m ? latest.ShareFaceValue : 100m;
                sanstha.AuthorizedShareCount = latest.AuthorizedShareCount > 0
                    ? latest.AuthorizedShareCount
                    : (int)Math.Floor(latest.AuthorizedCapitalAmount / sanstha.ShareFaceValue);
            }
            else
            {
                sanstha.AuthorizedShareCapital = 0m;
                sanstha.AuthorizedShareCount = 0;
            }

            await _context.SaveChangesAsync();
        }

        public class AuthorizedCapitalRevisionRequest
        {
            public DateTime EffectiveDate { get; set; }
            public decimal AuthorizedCapitalAmount { get; set; }
            public decimal ShareFaceValue { get; set; } = 100m;
            public int? AuthorizedShareCount { get; set; }
            public string? ResolutionNo { get; set; }
            public string? RegistrarApprovalNo { get; set; }
            public string? Remarks { get; set; }
        }

        // GET: api/SansthaDetails/authorized-capital-history
        [HttpGet("authorized-capital-history")]
        [AllowAnonymous]
        public async Task<IActionResult> GetAuthorizedCapitalHistory()
        {
            var sanstha = await _context.SansthaDetails.AsNoTracking().FirstOrDefaultAsync();
            int sansthaId = sanstha?.SansthaID ?? 1;

            var history = await _context.SansthaAuthorizedCapitalHistories
                .AsNoTracking()
                .Where(h => h.SansthaID == sansthaId)
                .OrderByDescending(h => h.EffectiveDate)
                .ThenByDescending(h => h.HistoryID)
                .ToListAsync();

            decimal currentAuthorized = history.FirstOrDefault()?.AuthorizedCapitalAmount
                ?? sanstha?.AuthorizedShareCapital
                ?? 0m;
            decimal currentFaceVal = history.FirstOrDefault()?.ShareFaceValue
                ?? (sanstha != null && sanstha.ShareFaceValue > 0m ? sanstha.ShareFaceValue : 100m);
            int currentShares = history.FirstOrDefault()?.AuthorizedShareCount
                ?? (currentAuthorized > 0m && currentFaceVal > 0m ? (int)Math.Floor(currentAuthorized / currentFaceVal) : 0);

            decimal paidUpCapital = await ComputeCurrentPaidUpShareCapitalAsync();
            decimal remainingCapacity = Math.Max(0m, currentAuthorized - paidUpCapital);
            decimal utilizationPercent = currentAuthorized > 0m
                ? Math.Round((paidUpCapital / currentAuthorized) * 100m, 2)
                : 0m;

            return Ok(new
            {
                sansthaId,
                currentAuthorizedCapital = currentAuthorized,
                currentShareFaceValue = currentFaceVal,
                currentAuthorizedShareCount = currentShares,
                paidUpShareCapital = paidUpCapital,
                remainingCapacity,
                utilizationPercent,
                history
            });
        }

        // POST: api/SansthaDetails/authorized-capital-history
        [HttpPost("authorized-capital-history")]
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> AddAuthorizedCapitalHistory([FromBody] AuthorizedCapitalRevisionRequest req)
        {
            if (req == null || req.AuthorizedCapitalAmount <= 0m)
            {
                return BadRequest(new { message = "अधिकृत भागभांडवलाची रक्कम शून्यापेक्षा जास्त (₹ > 0) असणे आवश्यक आहे." });
            }

            decimal faceVal = req.ShareFaceValue > 0m ? req.ShareFaceValue : 100m;
            if (faceVal <= 0m)
            {
                return BadRequest(new { message = "एका शेअरचे दर्शनी मूल्य (Face Value) शून्यापेक्षा जास्त असणे आवश्यक आहे." });
            }

            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
            int sansthaId = sanstha?.SansthaID ?? 1;

            bool hasLaterRevision = await _context.SansthaAuthorizedCapitalHistories
                .AnyAsync(h => h.SansthaID == sansthaId && h.EffectiveDate.Date > req.EffectiveDate.Date);

            if (!hasLaterRevision)
            {
                decimal paidUp = await ComputeCurrentPaidUpShareCapitalAsync();
                if (paidUp > 0m && req.AuthorizedCapitalAmount < paidUp)
                {
                    return BadRequest(new
                    {
                        errorCode = "BELOW_PAID_UP_SHARE_CAPITAL",
                        message = $"अधिकृत भागभांडवल (₹{req.AuthorizedCapitalAmount:N2}) हे संस्थेच्या सध्याच्या प्रत्यक्ष वसुल भागभांडवलापेक्षा (Paid-Up Share Capital: ₹{paidUp:N2}) कमी करता येत नाही."
                    });
                }
            }

            int shareCount = req.AuthorizedShareCount.HasValue && req.AuthorizedShareCount.Value > 0
                ? req.AuthorizedShareCount.Value
                : (int)Math.Floor(req.AuthorizedCapitalAmount / faceVal);

            int uid = ResolveCurrentUserId();
            var entry = new SansthaAuthorizedCapitalHistory
            {
                SansthaID = sansthaId,
                EffectiveDate = req.EffectiveDate.Date,
                AuthorizedCapitalAmount = Math.Round(req.AuthorizedCapitalAmount, 2),
                ShareFaceValue = Math.Round(faceVal, 2),
                AuthorizedShareCount = shareCount,
                ResolutionNo = string.IsNullOrWhiteSpace(req.ResolutionNo) ? null : req.ResolutionNo.Trim(),
                RegistrarApprovalNo = string.IsNullOrWhiteSpace(req.RegistrarApprovalNo) ? null : req.RegistrarApprovalNo.Trim(),
                Remarks = string.IsNullOrWhiteSpace(req.Remarks) ? null : req.Remarks.Trim(),
                CreatedBy = uid,
                CreatedDate = DateTime.Now
            };

            _context.SansthaAuthorizedCapitalHistories.Add(entry);
            await _context.SaveChangesAsync();

            await SyncSansthaAuthorizedCapitalSnapshotAsync(sansthaId);

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = uid,
                Action = "AUTHORIZED_CAPITAL_REVISED",
                EntityName = "SansthaAuthorizedCapitalHistory",
                EntityID = entry.HistoryID.ToString(),
                Details = $"अधिकृत भागभांडवल नोंद (Effective: {entry.EffectiveDate:dd/MM/yyyy}): ₹{entry.AuthorizedCapitalAmount:N2} ({entry.AuthorizedShareCount} शेअर्स @ ₹{entry.ShareFaceValue:N2}) | ठराव: {entry.ResolutionNo ?? "-"}",
                Status = "Success",
                Timestamp = DateTime.Now
            });
            await _context.SaveChangesAsync();

            return Ok(entry);
        }

        // PUT: api/SansthaDetails/authorized-capital-history/5
        [HttpPut("authorized-capital-history/{historyId}")]
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> UpdateAuthorizedCapitalHistory(int historyId, [FromBody] AuthorizedCapitalRevisionRequest req)
        {
            var existing = await _context.SansthaAuthorizedCapitalHistories.FindAsync(historyId);
            if (existing == null)
            {
                return NotFound(new { message = "अधिकृत भागभांडवलाची निवडलेली नोंद सापडली नाही." });
            }

            if (req == null || req.AuthorizedCapitalAmount <= 0m)
            {
                return BadRequest(new { message = "अधिकृत भागभांडवलाची रक्कम शून्यापेक्षा जास्त (₹ > 0) असणे आवश्यक आहे." });
            }

            decimal faceVal = req.ShareFaceValue > 0m ? req.ShareFaceValue : 100m;

            bool hasLaterRevision = await _context.SansthaAuthorizedCapitalHistories
                .AnyAsync(h => h.SansthaID == existing.SansthaID &&
                               h.HistoryID != existing.HistoryID &&
                               h.EffectiveDate.Date > req.EffectiveDate.Date);

            if (!hasLaterRevision)
            {
                decimal paidUp = await ComputeCurrentPaidUpShareCapitalAsync();
                if (paidUp > 0m && req.AuthorizedCapitalAmount < paidUp)
                {
                    return BadRequest(new
                    {
                        errorCode = "BELOW_PAID_UP_SHARE_CAPITAL",
                        message = $"अधिकृत भागभांडवल (₹{req.AuthorizedCapitalAmount:N2}) हे संस्थेच्या सध्याच्या प्रत्यक्ष वसुल भागभांडवलापेक्षा (Paid-Up Share Capital: ₹{paidUp:N2}) कमी करता येत नाही."
                    });
                }
            }

            decimal oldAmount = existing.AuthorizedCapitalAmount;
            existing.EffectiveDate = req.EffectiveDate.Date;
            existing.AuthorizedCapitalAmount = Math.Round(req.AuthorizedCapitalAmount, 2);
            existing.ShareFaceValue = Math.Round(faceVal, 2);
            existing.AuthorizedShareCount = req.AuthorizedShareCount.HasValue && req.AuthorizedShareCount.Value > 0
                ? req.AuthorizedShareCount.Value
                : (int)Math.Floor(existing.AuthorizedCapitalAmount / existing.ShareFaceValue);
            existing.ResolutionNo = string.IsNullOrWhiteSpace(req.ResolutionNo) ? null : req.ResolutionNo.Trim();
            existing.RegistrarApprovalNo = string.IsNullOrWhiteSpace(req.RegistrarApprovalNo) ? null : req.RegistrarApprovalNo.Trim();
            existing.Remarks = string.IsNullOrWhiteSpace(req.Remarks) ? null : req.Remarks.Trim();

            await _context.SaveChangesAsync();
            await SyncSansthaAuthorizedCapitalSnapshotAsync(existing.SansthaID);

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = ResolveCurrentUserId(),
                Action = "AUTHORIZED_CAPITAL_UPDATED",
                EntityName = "SansthaAuthorizedCapitalHistory",
                EntityID = existing.HistoryID.ToString(),
                Details = $"अधिकृत भागभांडवल दुरुस्ती (Effective: {existing.EffectiveDate:dd/MM/yyyy}): ₹{oldAmount:N2} -> ₹{existing.AuthorizedCapitalAmount:N2}",
                Status = "Success",
                Timestamp = DateTime.Now
            });
            await _context.SaveChangesAsync();

            return Ok(existing);
        }

        // DELETE: api/SansthaDetails/authorized-capital-history/5
        [HttpDelete("authorized-capital-history/{historyId}")]
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> DeleteAuthorizedCapitalHistory(int historyId)
        {
            var existing = await _context.SansthaAuthorizedCapitalHistories.FindAsync(historyId);
            if (existing == null)
            {
                return NotFound(new { message = "अधिकृत भागभांडवलाची निवडलेली नोंद सापडली नाही." });
            }

            int sansthaId = existing.SansthaID;
            decimal deletedAmt = existing.AuthorizedCapitalAmount;
            DateTime deletedDate = existing.EffectiveDate;

            _context.SansthaAuthorizedCapitalHistories.Remove(existing);
            await _context.SaveChangesAsync();

            await SyncSansthaAuthorizedCapitalSnapshotAsync(sansthaId);

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = ResolveCurrentUserId(),
                Action = "AUTHORIZED_CAPITAL_DELETED",
                EntityName = "SansthaAuthorizedCapitalHistory",
                EntityID = historyId.ToString(),
                Details = $"अधिकृत भागभांडवल नोंद हटवली (Effective: {deletedDate:dd/MM/yyyy}, रक्कम: ₹{deletedAmt:N2})",
                Status = "Success",
                Timestamp = DateTime.Now
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "अधिकृत भागभांडवलाची नोंद यशस्वीरीत्या हटवली गेली आणि संस्था प्रोफाईल अपडेट झाले." });
        }

        private bool SansthaDetailExists(int id)
        {
            return _context.SansthaDetails.Any(e => e.SansthaID == id);
        }
    }
}
