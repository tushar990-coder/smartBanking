using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Models;
using Bhisi.Api.Data;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VoucherPostingController : ControllerBase
    {
        private readonly AppDbContext _context;

        public VoucherPostingController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/VoucherPosting/Unposted
        [HttpGet("Unposted")]
        public async Task<ActionResult<IEnumerable<Voucher>>> GetUnpostedVouchers(
            [FromQuery] int? branchId = null,
            [FromQuery] DateTime? voucherDate = null,
            [FromQuery] bool allDates = false)
        {
            try
            {
                // 2. Also ensure all existing unposted vouchers have Status set to "Pending"
                var nullStatusVouchers = await _context.Vouchers.Where(v => string.IsNullOrEmpty(v.Status)).ToListAsync();
                if (nullStatusVouchers.Any())
                {
                    foreach (var nv in nullStatusVouchers)
                    {
                        nv.Status = "Pending";
                    }
                    await _context.SaveChangesAsync();
                }

                // 2.5 Auto-heal: Ensure all historical/migrated opening balance vouchers (<= 31/03/2026 or migration narration) are marked Approved so they never appear in pending queue
                var pendingMigrationVouchers = await _context.Vouchers
                    .Where(v => v.Status == "Pending" && (
                        v.VoucherType == "Opening" ||
                        (v.Narration != null && (
                            v.Narration.Contains("आरंभिक शिल्लक") || 
                            v.Narration.Contains("Opening Balance Migration"))) ||
                        (v.VoucherDate <= new DateTime(2026, 3, 31) && (
                            v.VoucherNo.Contains("-OP-") ||
                            v.VoucherNo.StartsWith("JV-FD-OP-") ||
                            v.VoucherNo.StartsWith("REC-FD-OP-") ||
                            v.VoucherNo.StartsWith("JV-RD-OP-") ||
                            v.VoucherNo.StartsWith("REC-RD-OP-") ||
                            v.VoucherNo.StartsWith("JV-SH-OP-") ||
                            v.VoucherNo.StartsWith("JV-INV-OP-")
                        ) &&
                         !v.VoucherNo.StartsWith("JV-FD-REN-") &&
                         !v.VoucherNo.StartsWith("PAY-FD-INT-") &&
                         !v.VoucherNo.StartsWith("JV-FD-INT-") &&
                         !v.VoucherNo.StartsWith("JV-FD-CLOSE-") &&
                         !v.VoucherNo.StartsWith("JV-FD-PRECLOSE-") &&
                         !v.VoucherNo.StartsWith("PAY-FD-CLOSE-") &&
                         !v.VoucherNo.StartsWith("PMT-FD-CLOSE-") &&
                         !v.VoucherNo.StartsWith("JV-RD-CLOSE-") &&
                         !v.VoucherNo.StartsWith("JV-RD-PRECLOSE-") &&
                         !v.VoucherNo.StartsWith("JV-RD-REN-") &&
                         !v.VoucherNo.StartsWith("JV-RD-COLL-") &&
                         !v.VoucherNo.Contains("-RD-COLL-") &&
                         !v.VoucherNo.Contains("-RD-CLOSE-") &&
                         !v.VoucherNo.Contains("-RD-PRECLOSE-"))
                    ))
                    .ToListAsync();
                if (pendingMigrationVouchers.Any())
                {
                    foreach (var mv in pendingMigrationVouchers)
                    {
                        mv.Status = "Approved";
                        mv.ApprovedBy = mv.CreatedBy > 0 ? mv.CreatedBy : 1;
                        mv.ApprovedOn = DateTime.Now;
                    }
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                // Log audit exception non-blockingly
                Console.WriteLine("Self-healing voucher audit error: " + ex.Message);
            }

            // 3. Return all pending vouchers (excluding all opening balance migration vouchers)
            var query = _context.Vouchers.AsNoTracking().AsQueryable();
            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(v => v.BranchID == branchId.Value || v.BranchID == 0);
            }

            if (!allDates && voucherDate.HasValue)
            {
                var targetDate = voucherDate.Value.Date;
                query = query.Where(v => v.VoucherDate.Date == targetDate);
            }

            return await query
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Customer)
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Member)
                        .ThenInclude(m => m!.Customer)
                .Where(v => v.Status == "Pending" && 
                            v.VoucherType != "Opening" &&
                            !(v.Narration != null && (
                                v.Narration.Contains("आरंभिक शिल्लक") || 
                                v.Narration.Contains("Opening Balance Migration"))) &&
                            !(v.VoucherDate <= new DateTime(2026, 3, 31) && (
                                v.VoucherNo.Contains("-OP-") ||
                                v.VoucherNo.StartsWith("JV-FD-OP-") ||
                                v.VoucherNo.StartsWith("REC-FD-OP-") ||
                                v.VoucherNo.StartsWith("JV-RD-OP-") ||
                                v.VoucherNo.StartsWith("REC-RD-OP-") ||
                                v.VoucherNo.StartsWith("JV-SH-OP-") ||
                                v.VoucherNo.StartsWith("JV-INV-OP-")
                            )))
                .OrderBy(v => v.VoucherDate)
                .ThenBy(v => v.VoucherID)
                .ToListAsync();
        }

        // GET: api/VoucherPosting/Approved
        [HttpGet("Approved")]
        public async Task<ActionResult<IEnumerable<Voucher>>> GetApprovedVouchers(
            [FromQuery] int? branchId = null,
            [FromQuery] DateTime? voucherDate = null,
            [FromQuery] bool allDates = false)
        {
            var query = _context.Vouchers.AsNoTracking().AsQueryable();
            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(v => v.BranchID == branchId.Value || v.BranchID == 0);
            }

            if (!allDates && voucherDate.HasValue)
            {
                var targetDate = voucherDate.Value.Date;
                query = query.Where(v => v.VoucherDate.Date == targetDate);
            }

            return await query
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Customer)
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Member)
                        .ThenInclude(m => m!.Customer)
                .Where(v => v.Status == "Approved" && 
                            v.VoucherType != "Opening" &&
                            !(v.Narration != null && (
                                v.Narration.Contains("आरंभिक शिल्लक") || 
                                v.Narration.Contains("Opening Balance Migration"))) &&
                            !(v.VoucherDate <= new DateTime(2026, 3, 31) && (
                                v.VoucherNo.Contains("-OP-") ||
                                v.VoucherNo.StartsWith("JV-FD-OP-") ||
                                v.VoucherNo.StartsWith("REC-FD-OP-") ||
                                v.VoucherNo.StartsWith("JV-RD-OP-") ||
                                v.VoucherNo.StartsWith("REC-RD-OP-") ||
                                v.VoucherNo.StartsWith("JV-SH-OP-") ||
                                v.VoucherNo.StartsWith("JV-INV-OP-")
                            )))
                .OrderBy(v => v.VoucherDate)
                .ThenBy(v => v.ScrollNo ?? 0)
                .ThenBy(v => v.VoucherID)
                .ToListAsync();
        }

        public class PostVouchersRequest
        {
            public List<int> VoucherIds { get; set; } = new List<int>();
            public int ApprovedBy { get; set; } = 1; // Default to admin
        }

        // POST: api/VoucherPosting/Post
        [HttpPost("Post")]
        public async Task<IActionResult> PostVouchers([FromBody] PostVouchersRequest request)
        {
            if (request.VoucherIds == null || !request.VoucherIds.Any())
            {
                return BadRequest("मंजुरीसाठी कोणतेही व्हाउचर निवडलेले नाही. (No vouchers selected for posting.)");
            }

            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var vouchers = await _context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => request.VoucherIds.Contains(v.VoucherID) && v.Status == "Pending")
                    .ToListAsync();

                if (!vouchers.Any())
                {
                    return NotFound("कोणतेही वैध प्रलंबित व्हाउचर्स सापडले नाहीत. (No valid pending vouchers found.)");
                }

                var postedVoucherDetails = new List<object>();

                // 1. Group vouchers by BranchID and Date to calculate day-wise and branch-wise Scroll Numbers
                var groupedByBranchAndDate = vouchers
                    .GroupBy(v => new { v.BranchID, Date = v.VoucherDate.Date })
                    .ToList();

                foreach (var group in groupedByBranchAndDate)
                {
                    int bId = group.Key.BranchID;
                    DateTime vDate = group.Key.Date;

                    // Query the maximum existing ScrollNo for this Branch and Date where voucher is already approved and has ScrollNo
                    int maxScroll = await _context.Vouchers
                        .Where(v => v.BranchID == bId && v.VoucherDate.Date == vDate && v.ScrollNo != null)
                        .Select(v => (int?)v.ScrollNo)
                        .MaxAsync() ?? 0;

                    // Sort vouchers deterministically
                    var sortedGroupVouchers = group.OrderBy(v => v.VoucherDate).ThenBy(v => v.VoucherID).ToList();

                    foreach (var voucher in sortedGroupVouchers)
                    {
                        // 1. Audit Check: Maker-Checker Segregation of Duties
                        if (voucher.CreatedBy > 0 && voucher.CreatedBy == request.ApprovedBy && request.ApprovedBy != 1)
                        {
                            await dbTransaction.RollbackAsync();
                            return BadRequest($"सुरक्षा ऑडिट त्रुटी: व्हाउचर क्र. {voucher.VoucherNo} स्वतः तयार करणाऱ्या युझरला मंजूर करण्याची परवानगी नाही (Maker-Checker Restriction).");
                        }

                        // 2. Audit Check: Double-Entry Accounting Equality (Sum of Debit MUST equal Sum of Credit)
                        decimal totalDr = voucher.VoucherDetails?.Where(d => d.DrCr == "Dr").Sum(d => d.Amount) ?? 0;
                        decimal totalCr = voucher.VoucherDetails?.Where(d => d.DrCr == "Cr").Sum(d => d.Amount) ?? 0;

                        if (Math.Abs(totalDr - totalCr) > 0.01m)
                        {
                            await dbTransaction.RollbackAsync();
                            return BadRequest($"व्हाउचर तफावत त्रुटी: व्हाउचर क्र. {voucher.VoucherNo} मध्ये नावे (Dr: ₹{totalDr:N2}) व जमा (Cr: ₹{totalCr:N2}) रक्कमेत तफावत आहे.");
                        }

                        // Assign Day-wise & Branch-wise sequential scroll number
                        if (!voucher.ScrollNo.HasValue || voucher.ScrollNo.Value <= 0)
                        {
                            maxScroll++;
                            voucher.ScrollNo = maxScroll;
                        }

                        voucher.Status = "Approved";
                        voucher.ApprovedBy = request.ApprovedBy;
                        voucher.ApprovedOn = DateTime.Now;

                        // 🌟 Synchronize Share Certificate Status upon Voucher Passing
                        var linkedShareTxns = await _context.ShareTransactions
                            .Where(st => st.VoucherId == voucher.VoucherID)
                            .ToListAsync();
                        foreach (var st in linkedShareTxns)
                        {
                            var cert = await _context.ShareCertificates
                                .FirstOrDefaultAsync(c => c.ShareAccountId == st.ShareAccountId && c.Status == "PendingApproval");
                            if (cert != null)
                            {
                                cert.Status = "Active";
                            }
                        }

                        // 🌟 Apply deferred Saving Transfer credit for Loan Disbursement ONLY upon Voucher Approval
                        var linkedDisbursements = await _context.LoanDisbursements
                            .Include(d => d.LoanAccount)
                                .ThenInclude(l => l!.Customer)
                            .Include(d => d.LoanAccount)
                                .ThenInclude(l => l!.Member)
                                    .ThenInclude(m => m!.Customer)
                            .Where(d => d.VoucherID == voucher.VoucherID)
                            .ToListAsync();

                        foreach (var linkedDisb in linkedDisbursements)
                        {
                            if (Helpers.LoanDisbursementReversalHelper.IsSavingTransferMode(linkedDisb.PaymentMode) && linkedDisb.NetAmountPaid > 0)
                            {
                                string borrowerName = linkedDisb.LoanAccount?.Customer != null
                                    ? string.Join(" ", new[] { linkedDisb.LoanAccount.Customer.FirstName, linkedDisb.LoanAccount.Customer.MiddleName, linkedDisb.LoanAccount.Customer.LastName }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim()
                                    : (linkedDisb.LoanAccount?.Member?.Customer != null
                                        ? string.Join(" ", new[] { linkedDisb.LoanAccount.Member.Customer.FirstName, linkedDisb.LoanAccount.Member.Customer.MiddleName, linkedDisb.LoanAccount.Member.Customer.LastName }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim()
                                        : "");

                                await Helpers.LoanDisbursementReversalHelper.ApplyApprovedSavingTransferCreditAsync(
                                    _context,
                                    linkedDisb,
                                    voucher,
                                    null,
                                    linkedDisb.LoanAccount?.LoanAccountNo,
                                    borrowerName);
                            }
                        }

                        postedVoucherDetails.Add(new
                        {
                            voucherId = voucher.VoucherID,
                            voucherNo = voucher.VoucherNo,
                            scrollNo = voucher.ScrollNo,
                            voucherDate = voucher.VoucherDate.ToString("yyyy-MM-dd"),
                            branchId = voucher.BranchID,
                            amount = voucher.TotalAmount
                        });
                    }
                }

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new 
                { 
                    message = $"{vouchers.Count} व्हाउचर्स दिवसानिहाय व शाखानिहाय स्क्रॉल क्रमांकासह (Scroll No.) यशस्वीरीत्या मंजूर (Pass & Post) झाले.",
                    postedCount = vouchers.Count,
                    vouchers = postedVoucherDetails
                });
            }
            catch (InvalidOperationException valEx)
            {
                await dbTransaction.RollbackAsync();
                return BadRequest(valEx.Message);
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"व्हाउचर पासिंग करताना सिस्टीम त्रुटी झाली: {ex.Message}");
            }
        }

        public class UnpassVouchersRequest
        {
            public List<int> VoucherIds { get; set; } = new List<int>();
            public string Reason { get; set; } = string.Empty;
            public int UnpassedBy { get; set; } = 1;
            public string Username { get; set; } = "Admin";
            public string UserRole { get; set; } = "Admin";
        }

        // POST: api/VoucherPosting/Unpass
        [HttpPost("Unpass")]
        public async Task<IActionResult> UnpassVouchers([FromBody] UnpassVouchersRequest request)
        {
            if (request == null || request.VoucherIds == null || !request.VoucherIds.Any())
            {
                return BadRequest("अन-पास करण्यासाठी कोणतेही व्हाउचर निवडलेले नाही. (No vouchers selected for unpass.)");
            }

            int userId = request.UnpassedBy > 0 ? request.UnpassedBy : 1;
            string username = !string.IsNullOrWhiteSpace(request.Username) ? request.Username : "User-" + userId;
            string userRole = !string.IsNullOrWhiteSpace(request.UserRole) ? request.UserRole : "Admin";
            string reason = !string.IsNullOrWhiteSpace(request.Reason) ? request.Reason.Trim() : "मंजुरी रद्द व प्रलंबित केले (Reverted to Pending)";

            bool isHOUser = userRole == "Admin" || userRole == "HO_Manager" || userRole == "HO Manager" || userRole == "Manager";

            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var vouchers = await _context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => request.VoucherIds.Contains(v.VoucherID) && v.Status == "Approved")
                    .ToListAsync();

                if (!vouchers.Any())
                {
                    return NotFound("निवडलेले कोणतेही मंजूर व्हाउचर्स सापडले नाहीत किंवा आधीच प्रलंबित आहेत. (No valid approved vouchers found to unpass.)");
                }

                int unpassedCount = 0;
                var unpassedVoucherNumbers = new List<string>();

                foreach (var voucher in vouchers)
                {
                    // 0. Safety Lock: Opening Balance Migration Vouchers cannot be unpassed
                    bool isMigrationVoucher = voucher.VoucherType == "Opening" ||
                        (voucher.Narration != null && (
                            voucher.Narration.Contains("आरंभिक शिल्लक") || 
                            voucher.Narration.Contains("Opening Balance Migration"))) ||
                        (voucher.VoucherDate <= new DateTime(2026, 3, 31) && (
                            voucher.VoucherNo.Contains("-OP-") ||
                            voucher.VoucherNo.StartsWith("JV-FD-OP-") ||
                            voucher.VoucherNo.StartsWith("REC-FD-OP-") ||
                            voucher.VoucherNo.StartsWith("JV-RD-OP-") ||
                            voucher.VoucherNo.StartsWith("REC-RD-OP-") ||
                            voucher.VoucherNo.StartsWith("JV-SH-OP-") ||
                            voucher.VoucherNo.StartsWith("JV-INV-OP-")
                        ));

                    if (isMigrationVoucher)
                    {
                        await dbTransaction.RollbackAsync();
                        return BadRequest($"सुरक्षा ऑडिट: आरंभिक शिल्लक स्थलांतर व्हाउचर क्र. {voucher.VoucherNo} अन-पास करण्यास सक्त मनाई आहे (Opening balance migration cannot be unpassed).");
                    }

                    // 1. Closed Business Date Lock Check (EOD)
                    var dayStatus = await _context.BranchDayEndStatuses
                        .Where(b => b.BranchID == voucher.BranchID && b.BusinessDate.Date == voucher.VoucherDate.Date)
                        .FirstOrDefaultAsync();

                    if (dayStatus != null && dayStatus.IsDayClosed && !isHOUser)
                    {
                        await dbTransaction.RollbackAsync();
                        return BadRequest($"व्हाउचर क्र. {voucher.VoucherNo} च्या तारखेची ({voucher.VoucherDate:dd/MM/yyyy}) दिवसअखेर (EOD) पूर्ण झाली आहे. बंद झालेल्या तारखेचा व्हाउचर अन-पास करता येणार नाही.");
                    }

                    int? oldScrollNo = voucher.ScrollNo;

                    // 2. Revert Status to Pending, reset ScrollNo and Approval fields
                    voucher.Status = "Pending";
                    voucher.ScrollNo = null;
                    voucher.ApprovedBy = null;
                    voucher.ApprovedOn = null;

                    // 🌟 Revert linked ShareCertificate Status to PendingApproval
                    var linkedUnpassShareTxns = await _context.ShareTransactions
                        .Where(st => st.VoucherId == voucher.VoucherID)
                        .ToListAsync();
                    foreach (var st in linkedUnpassShareTxns)
                    {
                        var cert = await _context.ShareCertificates
                            .FirstOrDefaultAsync(c => c.ShareAccountId == st.ShareAccountId && c.Status == "Active");
                        if (cert != null)
                        {
                            cert.Status = "PendingApproval";
                        }
                    }

                    // 🌟 Reverse Saving Transfer credit for Loan Disbursement when Unpassed back to Pending
                    bool isLoanDisbursementVoucher = await _context.LoanDisbursements
                        .AnyAsync(d => d.VoucherID == voucher.VoucherID);
                    if (isLoanDisbursementVoucher)
                    {
                        await Helpers.LoanDisbursementReversalHelper.ReverseSavingTransferCreditForVoucherAsync(_context, voucher.VoucherNo);
                    }

                    // 3. Record in AuditLogs
                    _context.AuditLogs.Add(new AuditLog
                    {
                        UserID = userId > 0 ? userId : null,
                        Username = username,
                        Action = "VOUCHER_UNPASSED_REVERT_APPROVAL",
                        EntityName = "Voucher",
                        EntityID = voucher.VoucherNo,
                        Details = $"Voucher {voucher.VoucherNo} (Old Scroll #{oldScrollNo}, Amount: ₹{voucher.TotalAmount:N2}) Unpassed by {username} ({userRole}) | Reason: {reason} | Date: {voucher.VoucherDate:yyyy-MM-dd}",
                        Timestamp = DateTime.Now
                    });

                    unpassedCount++;
                    unpassedVoucherNumbers.Add(voucher.VoucherNo);
                }

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new
                {
                    message = $"{unpassedCount} व्हाउचर्स यशस्वीरीत्या अन-पास (Unpassed) करून प्रलंबित यादीत परत पाठवण्यात आले.",
                    unpassedCount,
                    voucherNumbers = unpassedVoucherNumbers
                });
            }
            catch (InvalidOperationException valEx)
            {
                await dbTransaction.RollbackAsync();
                return BadRequest(new { message = valEx.Message });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"व्हाउचर अन-पास करताना सिस्टीम त्रुटी झाली: {ex.Message}");
            }
        }

        public class VoucherRejectDto
        {
            public string Reason { get; set; } = string.Empty;
            public int UserID { get; set; } = 1;
            public string Username { get; set; } = "Admin";
            public string UserRole { get; set; } = "Admin";
        }

        public class BulkRejectVouchersRequest
        {
            public List<int> VoucherIds { get; set; } = new List<int>();
            public string Reason { get; set; } = string.Empty;
            public int UserID { get; set; } = 1;
            public string Username { get; set; } = "Admin";
            public string UserRole { get; set; } = "Admin";
        }

        // DELETE: api/VoucherPosting/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> RejectVoucher(int id, [FromBody] VoucherRejectDto? dto)
        {
            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var voucher = await _context.Vouchers
                    .Include(v => v.VoucherDetails)
                        .ThenInclude(vd => vd.Ledger)
                    .FirstOrDefaultAsync(v => v.VoucherID == id && v.Status == "Pending");

                if (voucher == null)
                {
                    return NotFound("प्रलंबित व्हाउचर सापडले नाही किंवा आधीच प्रक्रिया पूर्ण झाली आहे. (Pending voucher not found or already processed.)");
                }

                string reason = !string.IsNullOrWhiteSpace(dto?.Reason) ? dto.Reason.Trim() : "नोंद थेट रद्द / डिलीट (Direct Deleted from Database)";

                int userId = dto?.UserID > 0 ? dto.UserID : 1;
                string username = !string.IsNullOrWhiteSpace(dto?.Username) ? dto.Username : "User-" + userId;
                string userRole = !string.IsNullOrWhiteSpace(dto?.UserRole) ? dto.UserRole : "Admin";

                bool isHOUser = userRole == "Admin" || userRole == "HO_Manager" || userRole == "HO Manager" || userRole == "Manager";

                // Closed Business Date Lock Check (EOD)
                var dayStatus = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == voucher.BranchID && b.BusinessDate.Date == voucher.VoucherDate.Date)
                    .FirstOrDefaultAsync();

                if (dayStatus != null && dayStatus.IsDayClosed && !isHOUser)
                {
                    return BadRequest($"तारीख {voucher.VoucherDate:dd/MM/yyyy} साठी दिवस अखेर (EOD) पूर्ण झाली आहे. बंद झालेल्या तारखेचा व्हाउचर डिलीट करता येणार नाही.");
                }

                await ProcessSingleVoucherDeletionAsync(voucher, reason, userId, username, userRole);

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new { message = $"व्हाउचर क्र. {voucher.VoucherNo} (₹{voucher.TotalAmount:N2}) यशस्वीरीत्या रद्द व डिलीट करण्यात आले आणि सुरक्षा ऑडिट नोंद जतन केली." });
            }
            catch (InvalidOperationException valEx)
            {
                await dbTransaction.RollbackAsync();
                return BadRequest(new { message = valEx.Message });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"व्हाउचर हटवताना सिस्टीम त्रुटी झाली: {ex.Message}");
            }
        }

        // POST: api/VoucherPosting/BulkReject
        [HttpPost("BulkReject")]
        public async Task<IActionResult> BulkRejectVouchers([FromBody] BulkRejectVouchersRequest request)
        {
            if (request == null || request.VoucherIds == null || !request.VoucherIds.Any())
            {
                return BadRequest("रद्द करण्यासाठी कोणतेही व्हाउचर निवडलेले नाही. (No vouchers selected for rejection.)");
            }

            string reason = !string.IsNullOrWhiteSpace(request.Reason) ? request.Reason.Trim() : "नोंद थेट रद्द / डिलीट (Direct Deleted from Database)";

            int userId = request.UserID > 0 ? request.UserID : 1;
            string username = !string.IsNullOrWhiteSpace(request.Username) ? request.Username : "User-" + userId;
            string userRole = !string.IsNullOrWhiteSpace(request.UserRole) ? request.UserRole : "Admin";
            bool isHOUser = userRole == "Admin" || userRole == "HO_Manager" || userRole == "HO Manager" || userRole == "Manager";

            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var vouchers = await _context.Vouchers
                    .Include(v => v.VoucherDetails)
                        .ThenInclude(vd => vd.Ledger)
                    .Where(v => request.VoucherIds.Contains(v.VoucherID) && v.Status == "Pending")
                    .ToListAsync();

                if (!vouchers.Any())
                {
                    return NotFound("निवडलेले कोणतेही प्रलंबित व्हाउचर्स सापडले नाहीत. (No valid pending vouchers found to reject.)");
                }

                int deletedCount = 0;
                var deletedVoucherNumbers = new List<string>();

                foreach (var voucher in vouchers)
                {
                    // Closed Business Date Check for each voucher
                    var dayStatus = await _context.BranchDayEndStatuses
                        .Where(b => b.BranchID == voucher.BranchID && b.BusinessDate.Date == voucher.VoucherDate.Date)
                        .FirstOrDefaultAsync();

                    if (dayStatus != null && dayStatus.IsDayClosed && !isHOUser)
                    {
                        await dbTransaction.RollbackAsync();
                        return BadRequest($"व्हाउचर क्र. {voucher.VoucherNo} च्या तारखेची ({voucher.VoucherDate:dd/MM/yyyy}) दिवस अखेर (EOD) पूर्ण झाली आहे. बंद झालेल्या तारखेचा व्हाउचर डिलीट करता येणार नाही.");
                    }

                    await ProcessSingleVoucherDeletionAsync(voucher, reason, userId, username, userRole);
                    deletedCount++;
                    deletedVoucherNumbers.Add(voucher.VoucherNo);
                }

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new
                {
                    message = $"{deletedCount} व्हाउचर्स यशस्वीरीत्या रद्द (Rejected & Deleted) करण्यात आले आणि सुरक्षा ऑडिट नोंद जतन केली.",
                    deletedCount,
                    voucherNumbers = deletedVoucherNumbers
                });
            }
            catch (InvalidOperationException valEx)
            {
                await dbTransaction.RollbackAsync();
                return BadRequest(new { message = valEx.Message });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"एकत्रित व्हाउचर्स हटवताना सिस्टीम त्रुटी झाली: {ex.Message}");
            }
        }

        private async Task ProcessSingleVoucherDeletionAsync(Voucher voucher, string reason, int userId, string username, string userRole)
        {
            int id = voucher.VoucherID;

            // 0. Loan Disbursement Full Reversal & Cleanup (Reverses Saving Credit, Shares/Certs, Deductions, Schedules, Liens, Gold Links & Empty LoanAccount)
            var linkedLoanDisbursements = await _context.LoanDisbursements
                .Include(ld => ld.Deductions)
                .Where(ld => ld.VoucherID == id)
                .ToListAsync();
            if (linkedLoanDisbursements.Any())
            {
                foreach (var ld in linkedLoanDisbursements)
                {
                    await Helpers.LoanDisbursementReversalHelper.ReverseAndDeleteDisbursementAsync(
                        _context,
                        ld,
                        voucher,
                        deleteVoucherRecord: false);
                }
                await _context.SaveChangesAsync();
            }

            // 1. Pigmy Module Unlinking
            try
            {
                var pigmyCollections = await _context.PigmyCollections.Where(pc => pc.VoucherId == id).ToListAsync();
                foreach (var pc in pigmyCollections)
                {
                    pc.VoucherId = null;
                    pc.IsVoucherGenerated = false;
                }

                var pigmyCommissions = await _context.PigmyAgentCommissions.Where(pc => pc.VoucherId == id).ToListAsync();
                foreach (var pc in pigmyCommissions) pc.VoucherId = null;

                var pigmyCashDeposits = await _context.PigmyAgentCashDeposits.Where(p => p.VoucherId == id).ToListAsync();
                if (pigmyCashDeposits.Any())
                {
                    var receiptNos = pigmyCashDeposits.Select(p => p.ReceiptNo).Where(r => !string.IsNullOrEmpty(r)).ToList();
                    if (receiptNos.Any())
                    {
                        var denoms = await _context.CashDenominations
                            .Where(cd => cd.Remarks != null && receiptNos.Any(r => cd.Remarks.Contains(r)))
                            .ToListAsync();
                        if (denoms.Any())
                        {
                            _context.CashDenominations.RemoveRange(denoms);
                        }
                    }
                    _context.PigmyAgentCashDeposits.RemoveRange(pigmyCashDeposits);
                }

                var pigmyInterestLogs = await _context.PigmyInterestLogs.Where(p => p.VoucherId == id).ToListAsync();
                foreach (var p in pigmyInterestLogs) p.VoucherId = null;
            }
            catch { }

            // 2. Shares & Dividends Module Unlinking & Balance Rollback
            try
            {
                var shareTxs = await _context.ShareTransactions.Where(st => st.VoucherId == id).ToListAsync();
                foreach (var st in shareTxs)
                {
                    var shAcc = await _context.ShareAccounts.FindAsync(st.ShareAccountId);
                    if (shAcc != null)
                    {
                        if (st.TransactionType == "Allotment")
                        {
                            shAcc.TotalShareCount = Math.Max(0, shAcc.TotalShareCount - st.NumberOfShares);
                            shAcc.TotalShareAmount = Math.Max(0, shAcc.TotalShareAmount - st.Amount);
                            _context.Entry(shAcc).State = EntityState.Modified;
                        }
                        else if (st.TransactionType == "Withdrawal")
                        {
                            shAcc.TotalShareCount += st.NumberOfShares;
                            shAcc.TotalShareAmount += st.Amount;
                            _context.Entry(shAcc).State = EntityState.Modified;
                        }
                    }

                    var pendingCerts = await _context.ShareCertificates
                        .Where(c => c.ShareAccountId == st.ShareAccountId && (c.Status == "PendingApproval" || c.NumberOfShares == st.NumberOfShares))
                        .ToListAsync();
                    foreach (var pc in pendingCerts)
                    {
                        pc.Status = "Cancelled";
                    }

                    _context.ShareTransactions.Remove(st);
                }

                var dividendDists = await _context.DividendDistributions.Where(d => d.VoucherId == id).ToListAsync();
                foreach (var d in dividendDists) d.VoucherId = null;
            }
            catch { }

            // 1b. Pigmy Withdrawals Rollback
            try
            {
                if (!string.IsNullOrEmpty(voucher.VoucherNo))
                {
                    var pigmyWithdrawals = await _context.PigmyWithdrawals.Where(w => w.VoucherNo == voucher.VoucherNo).ToListAsync();
                    foreach (var pw in pigmyWithdrawals)
                    {
                        var pAcc = await _context.PigmyAccounts.FindAsync(pw.PigmyAccountID);
                        if (pAcc != null)
                        {
                            pAcc.TotalDepositedAmount += pw.RequestedAmount;
                            if (pAcc.TotalWithdrawnAmount >= pw.RequestedAmount)
                            {
                                pAcc.TotalWithdrawnAmount -= pw.RequestedAmount;
                            }
                            if (pAcc.Status == "Closed") pAcc.Status = "Active";
                            _context.Entry(pAcc).State = EntityState.Modified;
                        }
                    }
                    if (pigmyWithdrawals.Any()) _context.PigmyWithdrawals.RemoveRange(pigmyWithdrawals);
                }
            }
            catch { }

            // 3. Loans Module Reversal & Cascade Deletion
            try
            {
                var loanCollections = await _context.LoanCollections
                    .Include(lc => lc.Fees)
                    .Where(lc => lc.VoucherID == id || lc.HomeBranchVoucherID == id)
                    .ToListAsync();

                foreach (var lc in loanCollections)
                {
                    var loanAcc = await _context.LoanAccounts.FindAsync(lc.LoanAccountID);
                    if (loanAcc != null)
                    {
                        loanAcc.PrincipalBalance += lc.PrincipalCollected;
                        loanAcc.PurePrincipalBalance = Math.Min(loanAcc.PrincipalBalance, loanAcc.PurePrincipalBalance + lc.PrincipalCollected);
                        if (lc.PenaltyInterestCollected > 0) loanAcc.OverdueInterestBalance += lc.PenaltyInterestCollected;
                        if (lc.ReceivableInterestCollected > 0) loanAcc.InterestBalance += lc.ReceivableInterestCollected;
                        if (loanAcc.Status == "Closed" && loanAcc.PrincipalBalance > 0) loanAcc.Status = "Active";

                        var remainingCollections = await _context.LoanCollections
                            .Where(c => c.LoanAccountID == loanAcc.LoanAccountID && c.LoanCollectionID != lc.LoanCollectionID)
                            .OrderByDescending(c => c.CollectionDate)
                            .ThenByDescending(c => c.LoanCollectionID)
                            .ToListAsync();

                        loanAcc.LastInstallmentPaidDate = remainingCollections.FirstOrDefault()?.CollectionDate;
                        _context.Entry(loanAcc).State = EntityState.Modified;

                        var allSchedules = await _context.LoanInstallmentSchedules
                            .Where(s => s.LoanAccountID == loanAcc.LoanAccountID)
                            .OrderBy(s => s.InstallmentNo)
                            .ToListAsync();

                        if (allSchedules.Any())
                        {
                            Services.LoanScheduleGenerator.SynchronizeSchedules(loanAcc, allSchedules, remainingCollections);
                            foreach (var schedule in allSchedules)
                            {
                                _context.Entry(schedule).State = EntityState.Modified;
                            }
                        }
                    }

                    // Strict Physical Reversal: Clean up Pigmy Account & Transactions if paid via Pigmy
                    if (lc.SourcePigmyAccountID.HasValue && lc.SourcePigmyAccountID.Value > 0)
                    {
                        decimal totalDeducted = lc.TotalAmountReceived + (lc.Fees?.Sum(f => f.Amount) ?? 0);
                        var pigmyAcc = await _context.PigmyAccounts.FindAsync(lc.SourcePigmyAccountID.Value);
                        if (pigmyAcc != null)
                        {
                            pigmyAcc.TotalDepositedAmount += totalDeducted;
                            if (pigmyAcc.TotalWithdrawnAmount >= totalDeducted)
                            {
                                pigmyAcc.TotalWithdrawnAmount -= totalDeducted;
                            }
                            if (lc.PigmyTransferType == "CLOSURE" && pigmyAcc.Status == "Closed")
                            {
                                pigmyAcc.Status = "Active";
                            }
                            _context.Entry(pigmyAcc).State = EntityState.Modified;

                            var pigmyTxns = await _context.PigmyTransactions
                                .Where(pt => pt.PigmyAccountID == pigmyAcc.PigmyAccountID && 
                                             ((!string.IsNullOrEmpty(lc.ReceiptNo) && pt.ReferenceId == lc.ReceiptNo) || 
                                              (!string.IsNullOrEmpty(lc.ReceiptNo) && pt.Narration.Contains(lc.ReceiptNo))))
                                .ToListAsync();
                            if (pigmyTxns.Any())
                            {
                                _context.PigmyTransactions.RemoveRange(pigmyTxns);
                            }
                        }
                    }
                    else if (lc.PaymentMode == "Saving Transfer" || lc.PaymentMode == "Saving")
                    {
                        SavingAccountMaster? savingAccount = null;
                        if (lc.SourceSavingAccountID.HasValue && lc.SourceSavingAccountID.Value > 0)
                        {
                            savingAccount = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == lc.SourceSavingAccountID.Value);
                        }
                        if (savingAccount == null && !string.IsNullOrEmpty(lc.TransferFromSavingAccountNo))
                        {
                            savingAccount = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.AccountNo == lc.TransferFromSavingAccountNo);
                        }
                        if (savingAccount != null)
                        {
                            decimal totalDeducted = lc.TotalAmountReceived + (lc.Fees?.Sum(f => f.Amount) ?? 0);
                            savingAccount.CurrentBalance += totalDeducted;
                            _context.Entry(savingAccount).State = EntityState.Modified;

                            var savingTxns = await _context.SavingTransactions
                                .Where(st => st.SavingAccountID == savingAccount.SavingAccountID && 
                                             !string.IsNullOrEmpty(lc.ReceiptNo) && st.Narration.Contains(lc.ReceiptNo))
                                .ToListAsync();
                            if (savingTxns.Any())
                            {
                                _context.SavingTransactions.RemoveRange(savingTxns);
                            }
                        }
                    }

                    if (lc.Fees != null && lc.Fees.Any())
                    {
                        _context.LoanCollectionFees.RemoveRange(lc.Fees);
                    }

                    _context.LoanCollections.Remove(lc);
                }

                var overdueRecoveries = await _context.OverdueRecoveryLedgers.Where(o => o.VoucherID == id).ToListAsync();
                if (overdueRecoveries.Any()) _context.OverdueRecoveryLedgers.RemoveRange(overdueRecoveries);

                var overdueInterests = await _context.OverdueInterestLedgers.Where(o => o.VoucherID == id).ToListAsync();
                if (overdueInterests.Any()) _context.OverdueInterestLedgers.RemoveRange(overdueInterests);
            }
            catch { }

            // 3.9 Recurring Deposit Installment Collection Rollback (restores RdAccount, FIFO Partial/Pending Schedules, Saving/Pigmy transfers & IBT sibling voucher)
            bool rdInstallmentRolledBack = false;
            try
            {
                rdInstallmentRolledBack = await Helpers.RdInstallmentCollectionRollbackHelper.RollbackRdInstallmentCollectionByVoucherAsync(
                    _context,
                    voucher,
                    reason,
                    userId,
                    username);
            }
            catch (InvalidOperationException rdCollEx)
            {
                throw new InvalidOperationException(rdCollEx.Message);
            }

            // 4. Savings Module Reversal & Cascade Deletion (skip FD closure/renewal/opening & RD closure/installment vouchers whose SavingTransactions are already reversed cleanly)
            try
            {
                bool isFdLinkedForSaving = rdInstallmentRolledBack || (!string.IsNullOrEmpty(voucher.VoucherNo) && (
                    Helpers.FdRenewalRollbackHelper.IsFdRenewalVoucher(voucher) ||
                    voucher.VoucherNo.Contains("-FD-CLOSE-") ||
                    voucher.VoucherNo.Contains("-FD-PRECLOSE-") ||
                    voucher.VoucherNo.Contains("-FD-OP-") ||
                    voucher.VoucherNo.StartsWith("JV-FD-") ||
                    voucher.VoucherNo.StartsWith("REC-FD-") ||
                    Helpers.RdClosureSettlementHelper.IsRdClosureOrRenewalVoucher(voucher)));

                if (!string.IsNullOrEmpty(voucher.VoucherNo) && !isFdLinkedForSaving)
                {
                    var savingTxs = await _context.SavingTransactions
                        .Where(st => st.VoucherNo == voucher.VoucherNo)
                        .ToListAsync();

                    foreach (var st in savingTxs)
                    {
                        var account = await _context.SavingAccountMasters.FindAsync(st.SavingAccountID);
                        if (account != null)
                        {
                            if (st.TransactionType == "Deposit" || st.TransactionType == "Interest")
                            {
                                account.CurrentBalance -= st.Amount;
                            }
                            else if (st.TransactionType == "Withdrawal" || st.TransactionType == "Charges")
                            {
                                account.CurrentBalance += st.Amount;
                            }
                            _context.Entry(account).State = EntityState.Modified;
                        }

                        if (st.PaymentMode == "Transfer" && st.TargetSavingAccountID.HasValue)
                        {
                            var targetAccount = await _context.SavingAccountMasters.FindAsync(st.TargetSavingAccountID.Value);
                            if (targetAccount != null)
                            {
                                if (st.TransactionType == "Withdrawal")
                                {
                                    targetAccount.CurrentBalance -= st.Amount;
                                }
                                else
                                {
                                    targetAccount.CurrentBalance += st.Amount;
                                }
                                _context.Entry(targetAccount).State = EntityState.Modified;
                            }

                            var pairedTxn = await _context.SavingTransactions
                                .FirstOrDefaultAsync(t => t.TransactionID != st.TransactionID &&
                                                          t.SavingAccountID == st.TargetSavingAccountID.Value &&
                                                          t.TargetSavingAccountID == st.SavingAccountID &&
                                                          t.TransactionDate.Date == st.TransactionDate.Date &&
                                                          t.Amount == st.Amount);
                            if (pairedTxn != null)
                            {
                                _context.SavingTransactions.Remove(pairedTxn);
                            }
                        }

                        _context.SavingTransactions.Remove(st);
                    }

                    var savingInterest = await _context.SavingInterestPostings.Where(s => s.VoucherNo == voucher.VoucherNo).ToListAsync();
                    if (savingInterest.Any()) _context.SavingInterestPostings.RemoveRange(savingInterest);

                    var savingClosings = await _context.SavingAccountClosings.Where(s => s.VoucherNo == voucher.VoucherNo).ToListAsync();
                    if (savingClosings.Any()) _context.SavingAccountClosings.RemoveRange(savingClosings);
                }
            }
            catch { }

            // 4.9 Recurring Deposit Closure / Premature Close / Renewal Rollback
            await Helpers.RdClosureSettlementHelper.RollbackRdClosureOrRenewalByVoucherAsync(_context, voucher, reason, userId, username);

            // 5. Fixed Deposit & Recurring Deposit Module Handling (Opening vs Withdrawal / Closure)
            try
            {
                bool isFdRenewal = Helpers.FdRenewalRollbackHelper.IsFdRenewalVoucher(voucher);

                bool isFdWithdrawal = !isFdRenewal && (voucher.VoucherNo.StartsWith("JV-FD-CLOSE-") || 
                                      voucher.VoucherNo.StartsWith("JV-FD-PRECLOSE-") || 
                                      voucher.VoucherNo.StartsWith("PAY-FD-CLOSE-") ||
                                      voucher.VoucherNo.StartsWith("PMT-FD-CLOSE-") ||
                                      (voucher.Narration != null && (voucher.Narration.Contains("FD Maturity Payout") || 
                                                                     voucher.Narration.Contains("मुदत ठेव पूर्ण क्लोजर") || 
                                                                     voucher.Narration.Contains("FD Premature") || 
                                                                     voucher.Narration.Contains("मुदतपूर्व परतावा"))));

                bool isFdOpening = !isFdRenewal && (voucher.VoucherNo.StartsWith("REC-FD-OP-") || 
                                   voucher.VoucherNo.StartsWith("JV-FD-OP-") || 
                                   voucher.VoucherNo.StartsWith("REC-FD-") || 
                                   voucher.VoucherNo.StartsWith("JV-FD-") || 
                                   (voucher.Narration != null && (voucher.Narration.Contains("मुदत ठेव रक्कम जमा") || 
                                                                  voucher.Narration.Contains("नवीन मुदत ठेव खाते") ||
                                                                  voucher.Narration.Contains("मुदत ठेव खाते उघडले"))));

                if (isFdRenewal)
                {
                    // === CASE 0: FD RENEWAL ROLLBACK / DELETION (14-Digit CBS & FK Safe, cleans sibling vouchers too) ===
                    var renRollback = await Helpers.FdRenewalRollbackHelper.RollbackRenewalByVoucherAsync(
                        _context,
                        voucher,
                        deletePrimaryVoucherRecord: false);

                    _context.AuditLogs.Add(new AuditLog
                    {
                        UserID = userId > 0 ? userId : null,
                        Username = !string.IsNullOrWhiteSpace(username) ? username : $"User-{userId}",
                        Action = "FD_RENEWAL_VOUCHER_DELETED",
                        EntityName = "FdAccount",
                        EntityID = renRollback.OldAccountNo ?? renRollback.NewAccountNo ?? voucher.VoucherNo,
                        Details = $"मुदत ठेव नूतनीकरण व्हाउचर {voucher.VoucherNo} (नवीन खाते: {renRollback.NewAccountNo ?? "-"}, मूळ खाते: {renRollback.OldAccountNo ?? "-"}) रद्द केले. नवीन खाते हटवले व मूळ खाते पूर्ववत (Matured/Active) केले. कारण: {reason}",
                        Timestamp = DateTime.Now,
                        Status = "Success"
                    });
                }
                else if (isFdWithdrawal && !Helpers.RdClosureSettlementHelper.IsRdClosureOrRenewalVoucher(voucher))
                {
                    // === CASE 1: WITHDRAWAL / CLOSURE DELETE ===
                    // 🛡️ Statutory Safeguard: If this closure voucher adjusted proceeds against a Loan Account,
                    // blocking direct voucher deletion prevents uncoupling the loan reduction from the voucher!
                    var linkedLoanColl = await _context.LoanCollections
                        .Include(lc => lc.LoanAccount)
                        .FirstOrDefaultAsync(lc => lc.VoucherID == id);
                    if (linkedLoanColl != null)
                    {
                        throw new InvalidOperationException($"सदर व्हाउचरमध्ये कर्ज खाते क्र. {linkedLoanColl.LoanAccount?.LoanAccountNo ?? linkedLoanColl.LoanAccountID.ToString()} मधील ₹{linkedLoanColl.TotalAmountReceived:N2} ची कर्ज वसुली वजावट समाविष्ट आहे. कर्ज खात्यातील लेजर विसंगती व तारण उल्लंघन टाळण्यासाठी हे संयुक्त व्हाउचर थेट डिलीट करता येणार नाही.");
                    }

                    // Rule: Only delete the withdrawal transaction & voucher; revert FdAccount to "Matured" or "Active".
                    // DO NOT delete FdAccount. DO NOT rollback receipt sequence counter!
                    FdAccount? fdAcc = null;

                    // 1. Direct foreign-key resolution via linked closure FdTransaction
                    var closeTx = await _context.FdTransactions
                        .FirstOrDefaultAsync(ft => ft.VoucherID == id && (ft.TransactionType == "Payout" || ft.TransactionType == "Premature_Close"));
                    if (closeTx != null)
                    {
                        fdAcc = await _context.FdAccounts.FindAsync(closeTx.FdAccountID);
                    }

                    // 2. Fallback: Parse from VoucherNo or Narration
                    string fdAccNo = "";
                    if (voucher.VoucherNo.StartsWith("JV-FD-CLOSE-"))
                        fdAccNo = voucher.VoucherNo.Substring("JV-FD-CLOSE-".Length).Trim();
                    else if (voucher.VoucherNo.StartsWith("JV-FD-PRECLOSE-"))
                        fdAccNo = voucher.VoucherNo.Substring("JV-FD-PRECLOSE-".Length).Trim();
                    else if (voucher.VoucherNo.Contains("-FD-CLOSE-"))
                        fdAccNo = voucher.VoucherNo.Substring(voucher.VoucherNo.IndexOf("-FD-CLOSE-") + "-FD-CLOSE-".Length).Trim();
                    else if (voucher.VoucherNo.Contains("-FD-PRECLOSE-"))
                        fdAccNo = voucher.VoucherNo.Substring(voucher.VoucherNo.IndexOf("-FD-PRECLOSE-") + "-FD-PRECLOSE-".Length).Trim();
                    else
                    {
                        var match = System.Text.RegularExpressions.Regex.Match(voucher.Narration ?? "", @"(?:खाते|Account|FD|खाते क्र\.?)\s*:?\s*([A-Za-z0-9-]+)");
                        if (match.Success) fdAccNo = match.Groups[1].Value.Trim();
                    }

                    if (fdAcc == null && !string.IsNullOrEmpty(fdAccNo))
                    {
                        fdAcc = await _context.FdAccounts.FirstOrDefaultAsync(f => 
                            f.AccountNo == fdAccNo || 
                            f.LegacyAccountNumber == fdAccNo || 
                            (f.LegacyAccountNumber != null && f.LegacyAccountNumber.Trim() == fdAccNo.Trim()) ||
                            f.AccountNo.EndsWith(fdAccNo));
                    }

                    // 3. Fallback: Lookup by customer in VoucherDetails
                    if (fdAcc == null)
                    {
                        var custId = voucher.VoucherDetails.FirstOrDefault(vd => vd.CustomerID.HasValue && vd.CustomerID.Value > 0)?.CustomerID;
                        if (custId.HasValue)
                        {
                            fdAcc = await _context.FdAccounts
                                .Where(f => f.CustomerID == custId.Value && f.Status == "Closed")
                                .OrderByDescending(f => f.FdAccountID)
                                .FirstOrDefaultAsync();
                        }
                    }

                    if (fdAcc != null)
                    {
                        fdAcc.Status = (fdAcc.MaturityDate.Date <= DateTime.Today.Date) ? "Matured" : "Active";
                        if (!string.IsNullOrEmpty(fdAcc.Remarks))
                        {
                            var idx = fdAcc.Remarks.IndexOf(" | बंद दिनांक:");
                            if (idx >= 0) fdAcc.Remarks = fdAcc.Remarks.Substring(0, idx).Trim();
                        }

                        // If payout was transferred to Savings account, reverse the SB credit
                        var effectiveAccNo = fdAcc.AccountNo ?? fdAccNo;
                        var sbTx = await _context.SavingTransactions
                            .FirstOrDefaultAsync(st => st.VoucherNo == voucher.VoucherNo || (st.Narration != null && (st.Narration.Contains(effectiveAccNo) || (fdAcc.LegacyAccountNumber != null && st.Narration.Contains(fdAcc.LegacyAccountNumber)))));
                        if (sbTx != null)
                        {
                            var sbAcc = await _context.SavingAccountMasters.FindAsync(sbTx.SavingAccountID);
                            if (sbAcc != null)
                            {
                                sbAcc.CurrentBalance -= sbTx.Amount;
                            }
                            _context.SavingTransactions.Remove(sbTx);
                        }

                        // Remove ONLY the closure/payout FdTransaction
                        var closeTxs = await _context.FdTransactions
                            .Where(ft => ft.VoucherID == id || (ft.FdAccountID == fdAcc.FdAccountID && (ft.TransactionType == "Payout" || ft.TransactionType == "Premature_Close")))
                            .ToListAsync();
                        if (closeTxs.Any()) _context.FdTransactions.RemoveRange(closeTxs);

                        _context.AuditLogs.Add(new AuditLog
                        {
                            UserID = userId > 0 ? userId : null,
                            Username = !string.IsNullOrWhiteSpace(username) ? username : $"User-{userId}",
                            Action = "FD_WITHDRAWAL_VOUCHER_DELETED",
                            EntityName = "FdAccount",
                            EntityID = fdAccNo,
                            Details = $"मुदत ठेव परतफेड (Withdrawal / Closure) व्हाउचर {voucher.VoucherNo} (खाते क्र. {fdAccNo}, रक्कम: ₹{voucher.TotalAmount:N2}) थेट रद्द करून हटवले. मूळ ठेव खाते पुन्हा सक्रिय (Active) केले. ठेव पावती व मूळ ठेव अबाधित ठेवली. कारण: {reason}",
                            Timestamp = DateTime.Now,
                            Status = "Success"
                        });
                    }
                }
                else if (isFdOpening)
                {
                    // === CASE 2: OPENING / DEPOSIT DELETE ===
                    // Rule: Hard-delete FdAccount and its transactions, refund SB if transfer, rollback receipt counter by -1.
                    string fdAccNo = "";
                    if (voucher.VoucherNo.StartsWith("REC-FD-OP-"))
                        fdAccNo = voucher.VoucherNo.Substring("REC-FD-OP-".Length).Trim();
                    else if (voucher.VoucherNo.StartsWith("JV-FD-OP-"))
                        fdAccNo = voucher.VoucherNo.Substring("JV-FD-OP-".Length).Trim();
                    else if (voucher.VoucherNo.StartsWith("REC-FD-"))
                        fdAccNo = voucher.VoucherNo.Substring("REC-FD-".Length).Trim();
                    else if (voucher.VoucherNo.StartsWith("JV-FD-"))
                        fdAccNo = voucher.VoucherNo.Substring("JV-FD-".Length).Trim();
                    else
                    {
                        var match = System.Text.RegularExpressions.Regex.Match(voucher.Narration ?? "", @"[A-Za-z0-9]+-[0-9]+-FD-[0-9]+");
                        if (match.Success) fdAccNo = match.Value;
                    }

                    if (!string.IsNullOrEmpty(fdAccNo))
                    {
                        var fdAcc = await _context.FdAccounts
                            .Include(a => a.Customer)
                            .FirstOrDefaultAsync(f => f.AccountNo == fdAccNo);

                        if (fdAcc != null)
                        {
                            // 🛡️ Specific Lien / Security Check: तपासा ही विशिष्ट पावती कर्जासाठी थेट तारण म्हणून नोंदवलेली आहे का?
                            string accNo = fdAcc.AccountNo ?? "";
                            string legNo = fdAcc.LegacyAccountNumber ?? "";
                            var pledgedLoan = await _context.LoanAccounts
                                .FirstOrDefaultAsync(l => l.Status == "Active" && 
                                    ((!string.IsNullOrEmpty(accNo) && l.SecurityDetails != null && l.SecurityDetails.Contains(accNo)) ||
                                     (!string.IsNullOrEmpty(legNo) && l.SecurityDetails != null && l.SecurityDetails.Contains(legNo))));

                            if (pledgedLoan != null)
                            {
                                throw new InvalidOperationException($"सदर मुदत ठेव पावती '{fdAcc.AccountNo}' कर्ज खाते क्र. {pledgedLoan.LoanAccountNo} साठी थेट तारण (Lien/Security) म्हणून नोंदवलेली आहे. त्यामुळे हे खाते व व्हाउचर नष्ट करता येणार नाही.");
                            }
                            if (fdAcc.IsLegacyAccount)
                            {
                                // 🛡️ CRITICAL SAFEGUARD: Migrated Opening Balance accounts MUST NEVER be deleted by voucher deletion!
                                // Remove only the transaction reference if linked, keep the FdAccount completely intact!
                                var migTxs = await _context.FdTransactions.Where(t => t.VoucherID == id).ToListAsync();
                                if (migTxs.Any()) _context.FdTransactions.RemoveRange(migTxs);

                                _context.AuditLogs.Add(new AuditLog
                                {
                                    UserID = userId > 0 ? userId : null,
                                    Username = !string.IsNullOrWhiteSpace(username) ? username : $"User-{userId}",
                                    Action = "FD_MIGRATION_VOUCHER_DELETED",
                                    EntityName = "FdAccount",
                                    EntityID = fdAccNo,
                                    Details = $"स्थलांतरित मुदत ठेव व्हाउचर {voucher.VoucherNo} हटवले, परंतु मूळ मुदत ठेव खाते (AccountNo: {fdAccNo}) पूर्णपणे सुरक्षित ठेवले.",
                                    Timestamp = DateTime.Now,
                                    Status = "Success"
                                });
                            }
                            else
                            {
                                int branchId = fdAcc.BranchID;
                                decimal depositAmount = fdAcc.DepositAmount;
                                string custName = fdAcc.Customer != null ? $"{fdAcc.Customer.FirstName} {fdAcc.Customer.LastName}".Trim() : "";

                                // Refund SB account if PaymentMode was Transfer
                                if ((fdAcc.PaymentMode == "Transfer" || fdAcc.PaymentMode == "Savings") && fdAcc.SavingAccountID.HasValue && fdAcc.SavingAccountID.Value > 0)
                                {
                                    var sbAcc = await _context.SavingAccountMasters.FindAsync(fdAcc.SavingAccountID.Value);
                                    if (sbAcc != null)
                                    {
                                        sbAcc.CurrentBalance += depositAmount;
                                        var sbTx = await _context.SavingTransactions
                                            .Where(st => st.SavingAccountID == sbAcc.SavingAccountID && 
                                                         (st.VoucherNo == voucher.VoucherNo || (st.Narration != null && st.Narration.Contains(fdAccNo))))
                                            .FirstOrDefaultAsync();
                                        if (sbTx != null) _context.SavingTransactions.Remove(sbTx);
                                    }
                                }

                                // Delete all FdTransactions and Accruals for this account
                                var fdTxs = await _context.FdTransactions.Where(t => t.FdAccountID == fdAcc.FdAccountID).ToListAsync();
                                if (fdTxs.Any()) _context.FdTransactions.RemoveRange(fdTxs);

                                var fdAccruals = await _context.FdInterestAccruals.Where(a => a.FdAccountID == fdAcc.FdAccountID).ToListAsync();
                                if (fdAccruals.Any()) _context.FdInterestAccruals.RemoveRange(fdAccruals);

                                // Delete FdAccount from Database
                                _context.FdAccounts.Remove(fdAcc);
                                await _context.SaveChangesAsync();

                                // Rollback FdAccountSequences by -1 (Sync to max remaining sequence in this branch)
                                var branchSeq = await _context.FdAccountSequences
                                    .FirstOrDefaultAsync(s => s.BranchID == branchId && s.ProductType == "FD");

                                int remainingMaxSeq = 0;
                                var remainingAccounts = await _context.FdAccounts
                                    .Where(f => f.BranchID == branchId)
                                    .Select(f => f.AccountNo)
                                    .ToListAsync();

                                foreach (var accStr in remainingAccounts)
                                {
                                    var lastDash = accStr.LastIndexOf('-');
                                    if (lastDash >= 0 && lastDash < accStr.Length - 1)
                                    {
                                        if (int.TryParse(accStr.Substring(lastDash + 1), out int parsedSeq))
                                        {
                                            if (parsedSeq > remainingMaxSeq) remainingMaxSeq = parsedSeq;
                                        }
                                    }
                                }

                                if (branchSeq != null)
                                {
                                    branchSeq.CurrentValue = remainingMaxSeq;
                                    await _context.SaveChangesAsync();
                                }

                                try
                                {
                                    var maxRemainingId = await _context.FdAccounts.MaxAsync(f => (int?)f.FdAccountID) ?? 0;
                                    if (fdAcc.FdAccountID >= maxRemainingId)
                                    {
                                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('FdAccounts', RESEED, {maxRemainingId});");
                                    }
                                }
                                catch { }

                                _context.AuditLogs.Add(new AuditLog
                                {
                                    UserID = userId > 0 ? userId : null,
                                    Username = !string.IsNullOrWhiteSpace(username) ? username : $"User-{userId}",
                                    Action = "FD_OPENING_VOUCHER_DELETED",
                                    EntityName = "FdAccount",
                                    EntityID = fdAccNo,
                                    Details = $"नवीन मुदत ठेव पावती व्हाउचर {voucher.VoucherNo} हटवल्यामुळे खाते क्र. {fdAccNo} (रक्कम: ₹{depositAmount:N2}, खातेदार: {custName}) नष्ट केले व पावती क्र. रोलबॅक करून {remainingMaxSeq} केला. कारण: {reason}",
                                    Timestamp = DateTime.Now,
                                    Status = "Success"
                                });
                            }
                        }
                    }
                }
                else
                {
                    // Generic FD Voucher (e.g. provision or accrual)
                    var genericFdTxs = await _context.FdTransactions.Where(ft => ft.VoucherID == id).ToListAsync();
                    if (genericFdTxs.Any()) _context.FdTransactions.RemoveRange(genericFdTxs);

                    var genericFdAccruals = await _context.FdInterestAccruals.Where(fa => fa.VoucherID == id).ToListAsync();
                    if (genericFdAccruals.Any())
                    {
                        var affectedAccIds = genericFdAccruals.Select(a => a.FdAccountID).Distinct().ToList();
                        _context.FdInterestAccruals.RemoveRange(genericFdAccruals);
                        await _context.SaveChangesAsync();

                        foreach (var accId in affectedAccIds)
                        {
                            var acc = await _context.FdAccounts.FindAsync(accId);
                            if (acc != null)
                            {
                                var prevAccrual = await _context.FdInterestAccruals
                                    .Where(a => a.FdAccountID == accId && a.VoucherID != id)
                                    .OrderByDescending(a => a.AccrualDate)
                                    .FirstOrDefaultAsync();

                                acc.LastInterestPostingDate = prevAccrual?.AccrualDate;
                            }
                        }
                    }
                }

                // Recurring Deposit Module Unlinking
                var rdTxs = await _context.RdTransactions.Where(rt => rt.VoucherID == id).ToListAsync();
                if (rdTxs.Any()) _context.RdTransactions.RemoveRange(rdTxs);

                var rdAccruals = await _context.RdInterestAccruals.Where(ra => ra.VoucherID == id).ToListAsync();
                if (rdAccruals.Any()) _context.RdInterestAccruals.RemoveRange(rdAccruals);
            }
            catch (InvalidOperationException)
            {
                throw;
            }
            catch { }

            // 6. Investments Module Unlinking
            var investRenewals = await _context.InvestmentRenewals.Where(ir => ir.VoucherID == id).ToListAsync();
            foreach (var ir in investRenewals) ir.VoucherID = null;

            var investWithdrawals = await _context.InvestmentPrematureWithdrawals.Where(ip => ip.VoucherID == id).ToListAsync();
            foreach (var ip in investWithdrawals) ip.VoucherID = null;

            var investMaturities = await _context.InvestmentMaturities.Where(im => im.VoucherID == id).ToListAsync();
            foreach (var im in investMaturities) im.VoucherID = null;

            var investReceipts = await _context.InvestmentInterestReceipts.Where(iir => iir.VoucherID == id).ToListAsync();
            foreach (var iir in investReceipts) iir.VoucherID = null;

            var investAccruals = await _context.InvestmentInterestAccruals.Where(iia => iia.VoucherID == id).ToListAsync();
            foreach (var iia in investAccruals) iia.VoucherID = null;

            // 7. Assets Module Unlinking
            var assetPurchases = await _context.AssetPurchases.Where(ap => ap.VoucherID == id).ToListAsync();
            foreach (var ap in assetPurchases) ap.VoucherID = null;

            var assetMaints = await _context.AssetMaintenances.Where(am => am.VoucherID == id).ToListAsync();
            foreach (var am in assetMaints) am.VoucherID = null;

            var assetDisposals = await _context.AssetDisposals.Where(ad => ad.VoucherID == id).ToListAsync();
            foreach (var ad in assetDisposals) ad.VoucherID = null;

            var assetDeps = await _context.AssetDepreciations.Where(ad => ad.VoucherID == id).ToListAsync();
            foreach (var ad in assetDeps) ad.VoucherID = null;

            // 8. Lockers Module Unlinking
            var lockerAllotmentDeposits = await _context.LockerAllotments.Where(l => l.DepositVoucherID == id).ToListAsync();
            foreach (var l in lockerAllotmentDeposits) l.DepositVoucherID = null;

            var lockerAllotmentRents = await _context.LockerAllotments.Where(l => l.AdvanceRentVoucherID == id).ToListAsync();
            foreach (var l in lockerAllotmentRents) l.AdvanceRentVoucherID = null;

            var lockerRents = await _context.LockerRentPostings.Where(l => l.VoucherID == id).ToListAsync();
            foreach (var l in lockerRents) l.VoucherID = null;

            var lockerSurrenders = await _context.LockerSurrenders.Where(l => l.VoucherID == id).ToListAsync();
            foreach (var l in lockerSurrenders) l.VoucherID = null;

            // 9. Demand Recovery & Section 101 Legal Module Unlinking
            var demandRecoveries = await _context.DemandRecoveries.Where(dr => dr.VoucherId == id).ToListAsync();
            foreach (var dr in demandRecoveries) dr.VoucherId = null;

            var legalExpenses = await _context.Sec101LegalExpenses.Where(le => le.VoucherId == id).ToListAsync();
            foreach (var le in legalExpenses) le.VoucherId = null;

            // 10. Immutable Core Banking Audit Trail Snapshot
            var voucherSnapshot = System.Text.Json.JsonSerializer.Serialize(new
            {
                voucher.VoucherID,
                voucher.VoucherNo,
                VoucherDate = voucher.VoucherDate.ToString("yyyy-MM-dd"),
                voucher.VoucherType,
                voucher.TotalAmount,
                voucher.Status,
                voucher.BranchID,
                voucher.Narration,
                voucher.CreatedBy,
                voucher.ScrollNo,
                LineItems = voucher.VoucherDetails.Select(d => new
                {
                    d.LedgerID,
                    LedgerName = d.Ledger?.LedgerName ?? "",
                    d.DrCr,
                    d.Amount,
                    d.CustomerID,
                    d.MemberID
                })
            });

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = userId > 0 ? userId : null,
                Username = !string.IsNullOrWhiteSpace(username) ? username : $"User-{userId}",
                Action = "VOUCHER_REJECTED_DELETED_POSTING",
                EntityName = "Voucher",
                EntityID = voucher.VoucherNo,
                Details = $"Deleted/Rejected from Voucher Posting by {username} ({userRole}) | Reason: {reason} | Snapshot: {voucherSnapshot}",
                Timestamp = DateTime.Now
            });

            // 11. Delete Voucher Details and Header Record
            if (voucher.VoucherDetails != null && voucher.VoucherDetails.Any())
            {
                _context.VoucherDetails.RemoveRange(voucher.VoucherDetails);
            }

            _context.Vouchers.Remove(voucher);
        }
    }
}
