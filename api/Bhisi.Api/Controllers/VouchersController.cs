using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public class VouchersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public VouchersController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Vouchers
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Voucher>>> GetVouchers([FromQuery] string? status, [FromQuery] int? page = null, [FromQuery] int? pageSize = null)
        {
            var query = _context.Vouchers.AsQueryable();
            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(v => v.Status == status);
            }

            var orderedQuery = query
                                  .Include(v => v.Branch)
                                  .Include(v => v.VoucherDetails)
                                  .ThenInclude(d => d.Ledger)
                                  .Include(v => v.VoucherDetails)
                                  .ThenInclude(d => d.Member)
                                  .OrderByDescending(v => v.VoucherDate)
                                  .ThenByDescending(v => v.VoucherID);

            if (page.HasValue || pageSize.HasValue)
            {
                int p = page ?? 1;
                int ps = pageSize ?? 50;
                if (p < 1) p = 1;
                if (ps < 1 || ps > 500) ps = 50;
                return await orderedQuery.Skip((p - 1) * ps).Take(ps).ToListAsync();
            }

            return await orderedQuery.ToListAsync();
        }

        // GET: api/Vouchers/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Voucher>> GetVoucher(int id)
        {
            var voucher = await _context.Vouchers
                                        .Include(v => v.Branch)
                                        .Include(v => v.VoucherDetails)
                                        .ThenInclude(d => d.Ledger)
                                        .Include(v => v.VoucherDetails)
                                        .ThenInclude(d => d.Member)
                                        .FirstOrDefaultAsync(v => v.VoucherID == id);

            if (voucher == null)
            {
                return NotFound();
            }

            return voucher;
        }

        // GET: api/Vouchers/next-number
        [HttpGet("next-number")]
        public async Task<ActionResult<object>> GetNextVoucherNo([FromQuery] string type, [FromQuery] int branchId = 1)
        {
            string voucherNo = await GenerateVoucherNo(branchId, type);
            return Ok(new { nextNumber = voucherNo });
        }

        private async Task<string> GenerateVoucherNo(int branchId, string voucherType)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            string branchCode = branch?.BranchCode ?? "B01";

            string typeCode = "V";
            if (voucherType == "Receipt") typeCode = "REC";
            else if (voucherType == "Payment") typeCode = "PAY";
            else if (voucherType == "Contra") typeCode = "CTR";
            else if (voucherType == "Journal") typeCode = "JNL";

            var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
            string fy = "25-26";
            if (activeYear != null)
            {
                var parts = activeYear.YearCode.Split('-');
                if (parts.Length == 2)
                {
                    string y1 = parts[0].Length >= 4 ? parts[0].Substring(parts[0].Length - 2) : parts[0];
                    string y2 = parts[1].Length >= 4 ? parts[1].Substring(parts[1].Length - 2) : parts[1];
                    fy = $"{y1}-{y2}";
                }
                else
                {
                    fy = activeYear.YearCode;
                }
            }

            // Standard Core Banking Format: BR01/25-26/REC/000001
            string prefix = $"{branchCode}/{fy}/{typeCode}/";
            string altPrefix = $"{branchCode}-{typeCode}-{fy}-";

            var existingNos = await _context.Vouchers
                .Where(v => v.BranchID == branchId && v.VoucherType == voucherType && v.VoucherNo != null)
                .Select(v => v.VoucherNo)
                .ToListAsync();

            int maxNum = 0;
            foreach (var no in existingNos)
            {
                if (string.IsNullOrWhiteSpace(no)) continue;

                string numStr = "";
                if (no.StartsWith(prefix))
                {
                    numStr = no.Substring(prefix.Length);
                }
                else if (no.StartsWith(altPrefix))
                {
                    numStr = no.Substring(altPrefix.Length);
                }
                else
                {
                    // Fallback numeric extraction from last part after '/' or '-'
                    var parts = no.Split('/', '-');
                    if (parts.Length > 0)
                    {
                        numStr = parts[^1];
                    }
                }

                if (int.TryParse(numStr, out int num))
                {
                    if (num > maxNum) maxNum = num;
                }
            }

            return $"{prefix}{(maxNum + 1):D6}";
        }

        // POST: api/Vouchers
        [HttpPost]
        public async Task<ActionResult<Voucher>> PostVoucher(Voucher voucher)
        {
            if (string.IsNullOrWhiteSpace(voucher.VoucherNo) || voucher.VoucherNo == "AUTO")
            {
                voucher.VoucherNo = await GenerateVoucherNo(voucher.BranchID, voucher.VoucherType);
            }

            // 2. Validate totals
            var totalDr = voucher.VoucherDetails.Where(d => d.DrCr == "Dr").Sum(d => d.Amount);
            var totalCr = voucher.VoucherDetails.Where(d => d.DrCr == "Cr").Sum(d => d.Amount);
            
            if (totalDr != totalCr)
            {
                return BadRequest("Total Debit must equal Total Credit.");
            }

            if (voucher.TotalAmount != totalDr)
            {
                return BadRequest("Voucher TotalAmount does not match line totals.");
            }

            // 2.5 Cross-Branch Member & Account Isolation Validation Check
            foreach (var detail in voucher.VoucherDetails)
            {
                if (detail.MemberID.HasValue && detail.MemberID.Value > 0)
                {
                    var memberBranch = await _context.Members
                        .Where(m => m.MemberID == detail.MemberID.Value)
                        .Select(m => m.BranchID)
                        .FirstOrDefaultAsync();

                    if (memberBranch > 0 && memberBranch != voucher.BranchID)
                    {
                        return BadRequest("क्रॉस-ब्रांच व्यवहार बंदी! निवडलेला सभासद वेगळ्या शाखेचा असल्यामुळे व्हाऊचर सेव्ह करता येणार नाही.");
                    }
                }
            }

            // 3. Negative Cash Balance Check
            int branchCashLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, voucher.BranchID);
            var cashLedger = await _context.Ledgers.FindAsync(branchCashLedgerId);
            if (cashLedger != null)
            {
                var cashOutflow = voucher.VoucherDetails.Where(d => d.LedgerID == branchCashLedgerId && d.DrCr == "Cr").Sum(d => d.Amount);
                
                if (cashOutflow > 0)
                {
                    decimal currentCash = cashLedger.OpeningBalanceType == "Dr" ? cashLedger.OpeningBalance : -cashLedger.OpeningBalance;
                    var approvedCashVds = await _context.VoucherDetails
                        .Include(vd => vd.Voucher)
                        .Where(vd => vd.LedgerID == branchCashLedgerId && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == voucher.BranchID)
                        .ToListAsync();

                    currentCash += approvedCashVds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                    currentCash -= approvedCashVds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

                    if (currentCash < cashOutflow)
                    {
                        return BadRequest($"शाखेत पुरेशी रोख शिल्लक उपलब्ध नाही. उपलब्ध रोख: ₹ {currentCash:N2}, आवश्यक रोख: ₹ {cashOutflow:N2}");
                    }
                }
            }

            // 4. Maker-Checker Approval Policy
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
            bool autoPost = sanstha?.AutoPostVouchers ?? true;
            decimal autoPostLimit = sanstha?.AutoPostVoucherLimit ?? 50000m;

            // Vouchers up to autoPostLimit are automatically approved; vouchers above require Manager Approval
            if (autoPost && voucher.TotalAmount <= autoPostLimit)
            {
                voucher.Status = "Approved";
                voucher.ApprovedBy = voucher.CreatedBy;
                voucher.ApprovedOn = DateTime.Now;

                // Assign day-wise and branch-wise ScrollNo
                if (!voucher.ScrollNo.HasValue || voucher.ScrollNo.Value <= 0)
                {
                    int maxScroll = await _context.Vouchers
                        .Where(v => v.BranchID == voucher.BranchID && v.VoucherDate.Date == voucher.VoucherDate.Date && v.ScrollNo != null)
                        .Select(v => (int?)v.ScrollNo)
                        .MaxAsync() ?? 0;
                    voucher.ScrollNo = maxScroll + 1;
                }
            }
            else
            {
                voucher.Status = "Pending";
                voucher.ApprovedBy = null;
                voucher.ApprovedOn = null;
            }
            voucher.RejectionReason = null;

            _context.Vouchers.Add(voucher);
            await _context.SaveChangesAsync();

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = voucher.CreatedBy > 0 ? voucher.CreatedBy : null,
                Username = "User-" + voucher.CreatedBy,
                Action = "CREATE_VOUCHER",
                EntityName = "Voucher",
                EntityID = voucher.VoucherNo,
                Details = $"Created {voucher.VoucherType} voucher #{voucher.VoucherNo} for amount ₹{voucher.TotalAmount:N2} with status {voucher.Status}",
                Timestamp = DateTime.Now
            });
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetVoucher", new { id = voucher.VoucherID }, voucher);
        }

        // PUT: api/Vouchers/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutVoucher(int id, Voucher voucher)
        {
            if (id != voucher.VoucherID)
            {
                return BadRequest();
            }

            var totalDr = voucher.VoucherDetails.Where(d => d.DrCr == "Dr").Sum(d => d.Amount);
            var totalCr = voucher.VoucherDetails.Where(d => d.DrCr == "Cr").Sum(d => d.Amount);

            if (totalDr != totalCr) return BadRequest("Total Debit must equal Total Credit.");
            if (voucher.TotalAmount != totalDr) return BadRequest("Voucher TotalAmount does not match line totals.");

            var existingVoucher = await _context.Vouchers.Include(v => v.VoucherDetails).FirstOrDefaultAsync(v => v.VoucherID == id);
            if (existingVoucher == null) return NotFound();

            // Update scalar properties
            existingVoucher.VoucherDate = voucher.VoucherDate;
            existingVoucher.VoucherType = voucher.VoucherType;
            existingVoucher.Narration = voucher.Narration;
            existingVoucher.TotalAmount = voucher.TotalAmount;

            // Update Details
            _context.VoucherDetails.RemoveRange(existingVoucher.VoucherDetails);
            
            foreach(var d in voucher.VoucherDetails) {
                d.VoucherDetailID = 0; // reset
                existingVoucher.VoucherDetails.Add(d);
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!VoucherExists(id)) return NotFound();
                else throw;
            }

            return NoContent();
        }

        // DELETE: api/Vouchers/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteVoucher(int id, [FromBody] VoucherDeleteDto dto)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                .FirstOrDefaultAsync(v => v.VoucherID == id);

            if (voucher == null) return NotFound("व्हाऊचर सापडला नाही.");

            // 1. Mandatory Reason Check
            if (dto == null || string.IsNullOrWhiteSpace(dto.Reason) || dto.Reason.Trim().Length < 10)
            {
                return BadRequest("व्हाऊचर डिलीट करण्याचे योग्य कारण (किमान १० अक्षरे) लिहिणे बंधनकारक आहे.");
            }

            bool isHOUser = dto.UserRole == "Admin" || dto.UserRole == "HO_Manager" || dto.UserRole == "HO Manager";

            // 2. Approved Voucher Deletion Policy
            if (voucher.Status == "Approved" && !isHOUser)
            {
                return BadRequest("पोस्ट झालेला व्हाऊचर डिलीट करण्याचा अधिकार फक्त मुख्य कार्यालय व्यवस्थापकाकडे (HO Manager) आहे.");
            }

            // 3. Pending Voucher Deletion Policy (Branch User limited to Today)
            if (voucher.Status == "Pending" && !isHOUser && voucher.VoucherDate.Date != DateTime.Today.Date)
            {
                return BadRequest("मागील तारखेचा प्रलंबित व्हाऊचर शाखा युजर डिलीट करू शकत नाही. फक्त आजच्या तारखेचा व्हाऊचर डिलीट करता येईल.");
            }

            // 4. Closed Business Date Lock Check
            var dayStatus = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == voucher.BranchID && b.BusinessDate.Date == voucher.VoucherDate.Date)
                .FirstOrDefaultAsync();

            if (dayStatus != null && dayStatus.IsDayClosed && !isHOUser)
            {
                return BadRequest($"तारीख {voucher.VoucherDate:dd/MM/yyyy} साठी दिवस अखेर (EOD) पूर्ण झाली आहे. बंद झालेल्या तारखेचा व्हाऊचर डिलीट करता येणार नाही.");
            }

            // 5. Clear FK references and reverse linked saving transactions if any
            var loanCollections = await _context.LoanCollections.Where(lc => lc.VoucherID == id).ToListAsync();
            foreach (var lc in loanCollections) lc.VoucherID = null;

            var loanDisbursements = await _context.LoanDisbursements.Where(ld => ld.VoucherID == id).ToListAsync();
            foreach (var ld in loanDisbursements) ld.VoucherID = null;

            if (!string.IsNullOrEmpty(voucher.VoucherNo))
            {
                await ReverseLinkedSavingTransactions(voucher.VoucherNo, dto.Reason, "DELETED");
                var savingTxs = await _context.SavingTransactions.Where(st => st.VoucherNo == voucher.VoucherNo).ToListAsync();
                foreach (var st in savingTxs) st.VoucherNo = null;
            }

            var assetPurchases = await _context.AssetPurchases.Where(ap => ap.VoucherID == id).ToListAsync();
            foreach (var ap in assetPurchases) ap.VoucherID = null;

            // 6. Immutable Security Audit Logging
            var oldVoucherJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                VoucherID = voucher.VoucherID,
                VoucherNo = voucher.VoucherNo,
                VoucherDate = voucher.VoucherDate.ToString("yyyy-MM-dd"),
                VoucherType = voucher.VoucherType,
                TotalAmount = voucher.TotalAmount,
                Status = voucher.Status,
                BranchID = voucher.BranchID,
                Narration = voucher.Narration,
                CreatedBy = voucher.CreatedBy,
                ApprovedBy = voucher.ApprovedBy,
                LineItems = voucher.VoucherDetails.Select(d => new
                {
                    d.LedgerID,
                    d.DrCr,
                    d.Amount,
                    d.MemberID
                })
            });

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = dto.UserID > 0 ? dto.UserID : null,
                Username = !string.IsNullOrWhiteSpace(dto.Username) ? dto.Username : "User-" + dto.UserID,
                Action = "VOUCHER_DELETED",
                EntityName = "Voucher",
                EntityID = voucher.VoucherNo,
                Details = $"DeletedBy: {dto.Username} ({dto.UserRole}) | Reason: {dto.Reason} | OldVoucherDetails: {oldVoucherJson}",
                Timestamp = DateTime.Now
            });

            // Perform Deletion
            if (voucher.VoucherDetails != null && voucher.VoucherDetails.Any())
            {
                _context.VoucherDetails.RemoveRange(voucher.VoucherDetails);
            }

            _context.Vouchers.Remove(voucher);

            await _context.SaveChangesAsync();
            return Ok(new { message = "व्हाऊचर यशस्वीरित्या डिलीट केला व सुरक्षा ऑडिट नोंद जतन केली." });
        }

        // GET: api/Vouchers/batch
        [HttpGet("batch")]
        public async Task<ActionResult<IEnumerable<Voucher>>> GetVouchersBatch([FromQuery] DateTime startDate, [FromQuery] DateTime endDate, [FromQuery] string type)
        {
            var query = _context.Vouchers
                                .Include(v => v.VoucherDetails)
                                .ThenInclude(d => d.Ledger)
                                .Include(v => v.VoucherDetails)
                                .ThenInclude(d => d.Member)
                                .Where(v => v.VoucherDate >= startDate && v.VoucherDate <= endDate);

            if (!string.IsNullOrEmpty(type) && type != "All")
            {
                query = query.Where(v => v.VoucherType == type);
            }

            return await query.OrderBy(v => v.VoucherDate)
                              .ThenBy(v => v.VoucherID)
                              .ToListAsync();
        }

        private bool VoucherExists(int id)
        {
            return _context.Vouchers.Any(e => e.VoucherID == id);
        }

        public class ApprovalDto
        {
            public int ApprovedBy { get; set; }
        }

        public class RejectionDto
        {
            public int RejectedBy { get; set; }
            public string Reason { get; set; } = string.Empty;
        }

        // POST: api/Vouchers/5/Approve
        [HttpPost("{id}/Approve")]
        public async Task<IActionResult> ApproveVoucher(int id, [FromBody] ApprovalDto dto)
        {
            var voucher = await _context.Vouchers.FindAsync(id);
            if (voucher == null) return NotFound();

            if (voucher.Status == "Approved") return BadRequest("Voucher is already approved.");

            if (voucher.CreatedBy > 0 && dto.ApprovedBy > 0 && voucher.CreatedBy == dto.ApprovedBy)
            {
                return BadRequest("व्हाऊचर तयार करणारा वापरकर्ता स्वतःचा व्हाऊचर स्वतः अ‍ॅप्रुव्ह करू शकत नाही (Maker-Checker Rule).");
            }

            voucher.Status = "Approved";
            voucher.ApprovedBy = dto.ApprovedBy;
            voucher.ApprovedOn = DateTime.Now;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Voucher approved successfully." });
        }

        // POST: api/Vouchers/5/Reject
        [HttpPost("{id}/Reject")]
        public async Task<IActionResult> RejectVoucher(int id, [FromBody] RejectionDto dto)
        {
            var voucher = await _context.Vouchers.FindAsync(id);
            if (voucher == null) return NotFound();

            if (voucher.Status == "Approved") return BadRequest("Cannot reject an already approved voucher.");

            voucher.Status = "Rejected";
            voucher.ApprovedBy = dto.RejectedBy; // Reused for rejected by tracking
            voucher.ApprovedOn = DateTime.Now;
            voucher.RejectionReason = dto.Reason;

            // Automatically reverse linked saving transactions if any
            await ReverseLinkedSavingTransactions(voucher.VoucherNo, dto.Reason, "REJECTED");

            await _context.SaveChangesAsync();
            return Ok(new { message = "Voucher rejected successfully and linked saving balance reversed." });
        }

        // POST: api/Vouchers/5/Cancel
        [HttpPost("{id}/Cancel")]
        public async Task<IActionResult> CancelVoucher(int id, [FromBody] RejectionDto dto)
        {
            var voucher = await _context.Vouchers.FindAsync(id);
            if (voucher == null) return NotFound();

            // Business Date Lock Check
            var dayStatus = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == voucher.BranchID && b.BusinessDate.Date == voucher.VoucherDate.Date)
                .FirstOrDefaultAsync();

            if (dayStatus != null && dayStatus.IsDayClosed)
            {
                return BadRequest($"तारीख {voucher.VoucherDate:dd/MM/yyyy} साठी दिवस अखेर (EOD) पूर्ण झाली आहे. बंद झालेल्या तारखेचे वॉउचर रद्द करता येणार नाही.");
            }

            voucher.Status = "Cancelled";
            voucher.RejectionReason = dto.Reason;

            // Automatically reverse linked saving transactions if any
            await ReverseLinkedSavingTransactions(voucher.VoucherNo, dto.Reason, "CANCELLED");

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = dto.RejectedBy > 0 ? dto.RejectedBy : null,
                Username = "User-" + dto.RejectedBy,
                Action = "CANCEL_VOUCHER",
                EntityName = "Voucher",
                EntityID = voucher.VoucherNo,
                Details = $"CANCELLED voucher #{voucher.VoucherNo} of amount ₹{voucher.TotalAmount:N2}. Reason: {dto.Reason}",
                Timestamp = DateTime.Now
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "वॉउचर यशस्वीरित्या रद्द (Cancelled) केले व संबंधित बचत खात्याची शिल्लक पूर्ववत केली." });
        }

        private async Task ReverseLinkedSavingTransactions(string? voucherNo, string reason, string actionName)
        {
            if (string.IsNullOrEmpty(voucherNo)) return;

            var savingTxs = await _context.SavingTransactions
                .Include(st => st.SavingAccount)
                .Where(st => st.VoucherNo == voucherNo)
                .ToListAsync();

            foreach (var st in savingTxs)
            {
                if (st.SavingAccount != null)
                {
                    if (st.TransactionType == "Deposit" || st.TransactionType == "Interest")
                    {
                        st.SavingAccount.CurrentBalance -= st.Amount;
                    }
                    else if (st.TransactionType == "Withdrawal" || st.TransactionType == "Charges")
                    {
                        st.SavingAccount.CurrentBalance += st.Amount;
                    }
                    _context.Entry(st.SavingAccount).State = EntityState.Modified;
                }
                st.Narration = $"[{actionName}: {reason}] " + (st.Narration ?? "");
                _context.Entry(st).State = EntityState.Modified;
            }
        }
    }

    public class VoucherDeleteDto
    {
        public string Reason { get; set; } = string.Empty;
        public int UserID { get; set; }
        public string UserRole { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
    }
}
