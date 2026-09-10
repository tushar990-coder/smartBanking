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
        public async Task<ActionResult<IEnumerable<Voucher>>> GetUnpostedVouchers([FromQuery] int? branchId = null)
        {
            try
            {
                // 1. Audit & Self-Healing: Repair any PigmyCollections missing Pending Vouchers
                var unmappedCollections = await _context.PigmyCollections
                    .Include(c => c.PigmyAccount)
                    .Where(c => !c.IsVoucherGenerated || c.VoucherId == null)
                    .ToListAsync();

                if (unmappedCollections.Any())
                {
                    int defaultDrLedgerId = (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("कॅश") || l.LedgerName.Contains("Cash")))?.LedgerID ?? 1;
                    int defaultCrLedgerId = (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 2;

                    foreach (var coll in unmappedCollections)
                    {
                        int targetBranch = (coll.PigmyAccount != null && coll.PigmyAccount.BranchID > 0) ? coll.PigmyAccount.BranchID : (branchId ?? 1);
                        if (targetBranch == 0) targetBranch = 1;

                        string uniqueVoucherNo = $"PV-{targetBranch}-{coll.CollectionDate:yyyyMMdd}-AUD-{coll.CollectionId:D4}";
                        var voucher = new Voucher
                        {
                            BranchID = targetBranch,
                            VoucherNo = uniqueVoucherNo,
                            VoucherDate = coll.CollectionDate,
                            VoucherType = "Receipt",
                            Status = "Pending",
                            Narration = $"Pigmy Bulk Collection (Auto-Audited) - Rcpt: {coll.ReceiptNo}",
                            TotalAmount = coll.CollectionAmount
                        };

                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = defaultDrLedgerId,
                            CustomerID = coll.PigmyAccount?.CustomerID,
                            DrCr = "Dr",
                            Amount = coll.CollectionAmount
                        });

                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = defaultCrLedgerId,
                            CustomerID = coll.PigmyAccount?.CustomerID,
                            DrCr = "Cr",
                            Amount = coll.CollectionAmount
                        });

                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        coll.VoucherId = voucher.VoucherID;
                        coll.IsVoucherGenerated = true;
                    }
                    await _context.SaveChangesAsync();
                }

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
            }
            catch (Exception ex)
            {
                // Log audit exception non-blockingly
                Console.WriteLine("Self-healing voucher audit error: " + ex.Message);
            }

            // 3. Return all pending vouchers
            var query = _context.Vouchers.AsQueryable();
            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(v => v.BranchID == branchId.Value || v.BranchID == 0);
            }

            return await query
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Customer)
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Member)
                        .ThenInclude(m => m!.Customer)
                .Where(v => v.Status == "Pending")
                .OrderBy(v => v.VoucherDate)
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
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"व्हाउचर पासिंग करताना सिस्टीम त्रुटी झाली: {ex.Message}");
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
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"एकत्रित व्हाउचर्स हटवताना सिस्टीम त्रुटी झाली: {ex.Message}");
            }
        }

        private async Task ProcessSingleVoucherDeletionAsync(Voucher voucher, string reason, int userId, string username, string userRole)
        {
            int id = voucher.VoucherID;

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
                foreach (var p in pigmyCashDeposits) p.VoucherId = null;

                var pigmyInterestLogs = await _context.PigmyInterestLogs.Where(p => p.VoucherId == id).ToListAsync();
                foreach (var p in pigmyInterestLogs) p.VoucherId = null;
            }
            catch { }

            // 2. Shares & Dividends Module Unlinking
            try
            {
                var shareTxs = await _context.ShareTransactions.Where(st => st.VoucherId == id).ToListAsync();
                foreach (var st in shareTxs) st.VoucherId = null;

                var dividendDists = await _context.DividendDistributions.Where(d => d.VoucherId == id).ToListAsync();
                foreach (var d in dividendDists) d.VoucherId = null;
            }
            catch { }

            // 3. Loans Module Unlinking
            try
            {
                var loanCollections = await _context.LoanCollections.Where(lc => lc.VoucherID == id).ToListAsync();
                foreach (var lc in loanCollections) lc.VoucherID = null;

                var loanDisbursements = await _context.LoanDisbursements.Where(ld => ld.VoucherID == id).ToListAsync();
                foreach (var ld in loanDisbursements) ld.VoucherID = null;

                var overdueRecoveries = await _context.OverdueRecoveryLedgers.Where(o => o.VoucherID == id).ToListAsync();
                foreach (var o in overdueRecoveries) o.VoucherID = null;

                var overdueInterests = await _context.OverdueInterestLedgers.Where(o => o.VoucherID == id).ToListAsync();
                foreach (var o in overdueInterests) o.VoucherID = null;
            }
            catch { }

            // 4. Savings Module Unlinking
            try
            {
                if (!string.IsNullOrEmpty(voucher.VoucherNo))
                {
                    var savingTxs = await _context.SavingTransactions.Where(st => st.VoucherNo == voucher.VoucherNo).ToListAsync();
                    foreach (var st in savingTxs) st.VoucherNo = null;

                    var savingInterest = await _context.SavingInterestPostings.Where(s => s.VoucherNo == voucher.VoucherNo).ToListAsync();
                    foreach (var s in savingInterest) s.VoucherNo = null;

                    var savingClosings = await _context.SavingAccountClosings.Where(s => s.VoucherNo == voucher.VoucherNo).ToListAsync();
                    foreach (var s in savingClosings) s.VoucherNo = null;
                }
            }
            catch { }

            // 5. Fixed Deposit & Recurring Deposit Module Handling (Opening vs Withdrawal / Closure)
            try
            {
                bool isFdWithdrawal = voucher.VoucherNo.StartsWith("JV-FD-CLOSE-") || 
                                     voucher.VoucherNo.StartsWith("JV-FD-PRECLOSE-") || 
                                     (voucher.Narration != null && (voucher.Narration.Contains("FD Maturity Payout") || 
                                                                    voucher.Narration.Contains("मुदत ठेव पूर्ण क्लोजर") || 
                                                                    voucher.Narration.Contains("FD Premature") || 
                                                                    voucher.Narration.Contains("मुदतपूर्व परतावा")));

                bool isFdOpening = voucher.VoucherNo.StartsWith("REC-FD-OP-") || 
                                   voucher.VoucherNo.StartsWith("JV-FD-OP-") || 
                                   (voucher.Narration != null && (voucher.Narration.Contains("मुदत ठेव रक्कम जमा") || 
                                                                  voucher.Narration.Contains("नवीन मुदत ठेव खाते")));

                if (isFdWithdrawal)
                {
                    // === CASE 1: WITHDRAWAL / CLOSURE DELETE ===
                    // Rule: Only delete the withdrawal transaction & voucher; revert FdAccount to "Active".
                    // DO NOT delete FdAccount. DO NOT rollback receipt sequence counter!
                    string fdAccNo = "";
                    if (voucher.VoucherNo.StartsWith("JV-FD-CLOSE-"))
                        fdAccNo = voucher.VoucherNo.Substring("JV-FD-CLOSE-".Length).Trim();
                    else if (voucher.VoucherNo.StartsWith("JV-FD-PRECLOSE-"))
                        fdAccNo = voucher.VoucherNo.Substring("JV-FD-PRECLOSE-".Length).Trim();
                    else
                    {
                        var match = System.Text.RegularExpressions.Regex.Match(voucher.Narration ?? "", @"[A-Za-z0-9]+-[0-9]+-FD-[0-9]+");
                        if (match.Success) fdAccNo = match.Value;
                    }

                    if (!string.IsNullOrEmpty(fdAccNo))
                    {
                        var fdAcc = await _context.FdAccounts.FirstOrDefaultAsync(f => f.AccountNo == fdAccNo);
                        if (fdAcc != null)
                        {
                            fdAcc.Status = "Active";

                            // If payout was transferred to Savings account, reverse the SB credit
                            var sbTx = await _context.SavingTransactions
                                .FirstOrDefaultAsync(st => st.VoucherNo == voucher.VoucherNo || (st.Narration != null && st.Narration.Contains(fdAccNo)));
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
                            int branchId = fdAcc.BranchID;
                            decimal depositAmount = fdAcc.DepositAmount;
                            string custName = fdAcc.Customer != null ? $"{fdAcc.Customer.FirstName} {fdAcc.Customer.LastName}".Trim() : "";

                            // Refund SB account if PaymentMode was Transfer
                            if (fdAcc.PaymentMode == "Transfer" && fdAcc.SavingAccountID.HasValue && fdAcc.SavingAccountID.Value > 0)
                            {
                                var sbAcc = await _context.SavingAccountMasters.FindAsync(fdAcc.SavingAccountID.Value);
                                if (sbAcc != null)
                                {
                                    sbAcc.CurrentBalance += depositAmount;
                                    var sbTx = await _context.SavingTransactions
                                        .Where(st => st.SavingAccountID == sbAcc.SavingAccountID && st.Narration != null && st.Narration.Contains(fdAccNo))
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
                                Details = $"मुदत ठेव आरंभिक ठेव व्हाउचर {voucher.VoucherNo} (खाते क्र. {fdAccNo}, रक्कम: ₹{depositAmount:N2}, खातेदार: {custName}) थेट रद्द करून खाते डेटाबेसमधून नष्ट केले. आरंभिक ठेव पावती क्र. रोलबॅक करून {remainingMaxSeq} केला. कारण: {reason}",
                                Timestamp = DateTime.Now,
                                Status = "Success"
                            });
                        }
                    }
                }
                else
                {
                    // Generic FD Voucher (e.g. provision or accrual)
                    var genericFdTxs = await _context.FdTransactions.Where(ft => ft.VoucherID == id).ToListAsync();
                    if (genericFdTxs.Any()) _context.FdTransactions.RemoveRange(genericFdTxs);

                    var genericFdAccruals = await _context.FdInterestAccruals.Where(fa => fa.VoucherID == id).ToListAsync();
                    if (genericFdAccruals.Any()) _context.FdInterestAccruals.RemoveRange(genericFdAccruals);
                }

                // Recurring Deposit Module Unlinking
                var rdTxs = await _context.RdTransactions.Where(rt => rt.VoucherID == id).ToListAsync();
                if (rdTxs.Any()) _context.RdTransactions.RemoveRange(rdTxs);

                var rdAccruals = await _context.RdInterestAccruals.Where(ra => ra.VoucherID == id).ToListAsync();
                if (rdAccruals.Any()) _context.RdInterestAccruals.RemoveRange(rdAccruals);
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
