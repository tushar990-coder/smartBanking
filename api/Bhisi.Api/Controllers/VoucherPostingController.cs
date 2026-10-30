using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Models;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VoucherPostingController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly VoucherRollbackAndDeleteService _rollbackService;

        public VoucherPostingController(
            AppDbContext context,
            VoucherRollbackAndDeleteService rollbackService)
        {
            _context = context;
            _rollbackService = rollbackService;
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
                            if (LoanDisbursementReversalHelper.IsSavingTransferMode(linkedDisb.PaymentMode) && linkedDisb.NetAmountPaid > 0)
                            {
                                string borrowerName = linkedDisb.LoanAccount?.Customer != null
                                    ? string.Join(" ", new[] { linkedDisb.LoanAccount.Customer.FirstName, linkedDisb.LoanAccount.Customer.MiddleName, linkedDisb.LoanAccount.Customer.LastName }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim()
                                    : (linkedDisb.LoanAccount?.Member?.Customer != null
                                        ? string.Join(" ", new[] { linkedDisb.LoanAccount.Member.Customer.FirstName, linkedDisb.LoanAccount.Member.Customer.MiddleName, linkedDisb.LoanAccount.Member.Customer.LastName }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim()
                                        : "");

                                await LoanDisbursementReversalHelper.ApplyApprovedSavingTransferCreditAsync(
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

            bool isHOUser = userRole == "Admin" || userRole == "SuperAdmin" || userRole == "HO_Manager" || userRole == "HO Manager" || userRole == "Manager";

            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Expand selection to include paired IBT / dual-voucher siblings so pairs never end up half-approved
                var expandedIds = new HashSet<int>(request.VoucherIds);
                var seedVouchers = await _context.Vouchers
                    .Where(v => expandedIds.Contains(v.VoucherID))
                    .Select(v => new { v.VoucherID, v.RelatedVoucherID })
                    .ToListAsync();
                foreach (var sv in seedVouchers)
                {
                    if (sv.RelatedVoucherID.HasValue && sv.RelatedVoucherID.Value > 0)
                        expandedIds.Add(sv.RelatedVoucherID.Value);
                }
                var revRelated = await _context.Vouchers
                    .Where(v => v.RelatedVoucherID.HasValue && expandedIds.Contains(v.RelatedVoucherID.Value))
                    .Select(v => v.VoucherID)
                    .ToListAsync();
                foreach (var rid in revRelated) expandedIds.Add(rid);

                var vouchers = await _context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => expandedIds.Contains(v.VoucherID) && v.Status == "Approved")
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
                        await LoanDisbursementReversalHelper.ReverseSavingTransferCreditForVoucherAsync(_context, voucher.VoucherNo);
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
        public async Task<IActionResult> RejectVoucher(
            int id,
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] VoucherRejectDto? dto = null,
            [FromQuery] string? reason = null)
        {
            string effectiveReason = !string.IsNullOrWhiteSpace(dto?.Reason)
                ? dto!.Reason.Trim()
                : (!string.IsNullOrWhiteSpace(reason)
                    ? reason.Trim()
                    : "नोंद थेट रद्द / डिलीट (Direct Deleted from Voucher Passing)");

            var reqCtx = BuildPostingDeleteContext(
                effectiveReason,
                dto?.UserID ?? 0,
                dto?.Username,
                dto?.UserRole,
                "VOUCHER_REJECTED_DELETED_POSTING");

            var result = await _rollbackService.DeleteVoucherWithRollbackAsync(id, reqCtx);
            if (!result.Success)
            {
                return StatusCode(result.HttpStatusCode, new { message = result.Message });
            }

            return Ok(new
            {
                message = result.Message,
                voucherNo = result.DeletedPrimaryVoucherNo,
                voucherNumbers = result.DeletedVoucherNos
            });
        }

        // POST: api/VoucherPosting/BulkReject
        [HttpPost("BulkReject")]
        public async Task<IActionResult> BulkRejectVouchers([FromBody] BulkRejectVouchersRequest request)
        {
            if (request == null || request.VoucherIds == null || !request.VoucherIds.Any())
            {
                return BadRequest("रद्द करण्यासाठी कोणतेही व्हाउचर निवडलेले नाही. (No vouchers selected for rejection.)");
            }

            string effectiveReason = !string.IsNullOrWhiteSpace(request.Reason)
                ? request.Reason.Trim()
                : "नोंद थेट रद्द / डिलीट (Bulk Rejected & Hard-Deleted from Voucher Passing)";

            var reqCtx = BuildPostingDeleteContext(
                effectiveReason,
                request.UserID,
                request.Username,
                request.UserRole,
                "VOUCHER_BULK_REJECTED_DELETED_POSTING");

            await using var dbTransaction = await _context.Database.BeginTransactionAsync();
            var deletedVoucherNumbers = new List<string>();

            foreach (int vId in request.VoucherIds.Distinct())
            {
                // Skip if already physically deleted as a paired/sibling voucher of an earlier item in this batch
                bool stillExists = await _context.Vouchers.AnyAsync(v => v.VoucherID == vId);
                if (!stillExists) continue;

                var res = await _rollbackService.DeleteVoucherWithRollbackAsync(vId, reqCtx);
                if (!res.Success)
                {
                    await dbTransaction.RollbackAsync();
                    return StatusCode(res.HttpStatusCode, new { message = res.Message });
                }

                foreach (var vNo in res.DeletedVoucherNos)
                {
                    if (!deletedVoucherNumbers.Contains(vNo, StringComparer.OrdinalIgnoreCase))
                    {
                        deletedVoucherNumbers.Add(vNo);
                    }
                }
            }

            if (!deletedVoucherNumbers.Any())
            {
                await dbTransaction.RollbackAsync();
                return NotFound("निवडलेले कोणतेही प्रलंबित व्हाउचर्स सापडले नाहीत.");
            }

            await dbTransaction.CommitAsync();

            return Ok(new
            {
                message = $"{deletedVoucherNumbers.Count} व्हाउचर्स आणि सर्व संलग्न सब-लेजर नोंदी डेटाबेसमधून यशस्वीरीत्या हार्ड-डिलीट करून खात्यांची मूळ स्थिती पूर्ववत करण्यात आली आहे.",
                deletedCount = deletedVoucherNumbers.Count,
                voucherNumbers = deletedVoucherNumbers
            });
        }

        private VoucherDeleteRequestContext BuildPostingDeleteContext(
            string reason,
            int dtoUserId,
            string? dtoUsername,
            string? dtoUserRole,
            string actionSource)
        {
            bool isAuthenticated = User?.Identity?.IsAuthenticated == true;
            int claimUserId = isAuthenticated ? User.GetUserId() : 0;
            int effectiveUserId = claimUserId > 0 ? claimUserId : (dtoUserId > 0 ? dtoUserId : 1);

            string claimUsername = isAuthenticated ? User.GetUsername() : string.Empty;
            string effectiveUsername = !string.IsNullOrWhiteSpace(claimUsername)
                ? claimUsername
                : (!string.IsNullOrWhiteSpace(dtoUsername) ? dtoUsername!.Trim() : $"User-{effectiveUserId}");

            string claimRole = isAuthenticated ? User.GetUserRole() : string.Empty;
            string effectiveRole = !string.IsNullOrWhiteSpace(claimRole)
                ? claimRole
                : (!string.IsNullOrWhiteSpace(dtoUserRole) ? dtoUserRole!.Trim() : "Admin");

            bool roleIsHo = effectiveRole.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
                            effectiveRole.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                            effectiveRole.Equals("SystemAdmin", StringComparison.OrdinalIgnoreCase) ||
                            effectiveRole.Equals("HeadOffice", StringComparison.OrdinalIgnoreCase) ||
                            effectiveRole.Equals("HO_Manager", StringComparison.OrdinalIgnoreCase) ||
                            effectiveRole.Equals("HO Manager", StringComparison.OrdinalIgnoreCase) ||
                            effectiveRole.Equals("Manager", StringComparison.OrdinalIgnoreCase);

            int userBranchId = isAuthenticated ? User.GetOperatingBranchId() : 0;
            bool isHoAdmin = (isAuthenticated && User.IsHeadOfficeAdmin()) || roleIsHo || userBranchId <= 0;

            return new VoucherDeleteRequestContext
            {
                UserId = effectiveUserId,
                Username = effectiveUsername,
                UserRole = effectiveRole,
                UserBranchId = userBranchId,
                IsHeadOfficeAdmin = isHoAdmin,
                Reason = reason,
                ActionSource = actionSource,
                EnforceSameBusinessDateForBranchUser = false,
                RequireMinTenCharReason = false,
                ClientIpAddress = HttpContext?.Connection?.RemoteIpAddress?.ToString()
            };
        }
    }
}
