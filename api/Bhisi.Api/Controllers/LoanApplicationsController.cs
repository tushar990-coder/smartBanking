using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
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
    public class LoanApplicationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LoanApplicationsController(AppDbContext context)
        {
            _context = context;
        }

        private (int userId, string username, int branchId) GetCurrentUserContext()
        {
            int userId = 1;
            string username = "System";
            int branchId = 1;

            var userClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID") ?? User.FindFirst("sub");
            if (userClaim != null && int.TryParse(userClaim.Value, out int uid)) userId = uid;

            var nameClaim = User.FindFirst(ClaimTypes.Name) ?? User.FindFirst("Username");
            if (nameClaim != null && !string.IsNullOrWhiteSpace(nameClaim.Value)) username = nameClaim.Value;

            var branchClaim = User.FindFirst("BranchID") ?? User.FindFirst("branchID");
            if (branchClaim != null && int.TryParse(branchClaim.Value, out int bid)) branchId = bid;

            return (userId, username, branchId);
        }

        // GET: api/LoanApplications/next-number
        [HttpGet("next-number")]
        public async Task<ActionResult<string>> GetNextApplicationNo()
        {
            var today = DateTime.Today;
            var year = today.Year.ToString().Substring(2, 2);
            var month = today.Month.ToString("D2");
            var prefix = $"APP-{year}{month}-";
            
            var lastApp = await _context.LoanApplications
                .Where(a => a.ApplicationNo != null && a.ApplicationNo.StartsWith(prefix))
                .OrderByDescending(a => a.ApplicationNo)
                .FirstOrDefaultAsync();

            int nextNo = 1;
            if (lastApp != null)
            {
                var parts = lastApp.ApplicationNo.Split('-');
                if (parts.Length == 3 && int.TryParse(parts[2], out int lastNo))
                {
                    nextNo = lastNo + 1;
                }
            }

            return Content($"{prefix}{nextNo:D3}", "text/plain");
        }

        // GET: api/LoanApplications
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoanApplication>>> GetLoanApplications()
        {
            try
            {
                var list = await _context.LoanApplications
                    .Include(a => a.Customer)
                    .Include(a => a.Member)
                    .Include(a => a.CoMember)
                    .Include(a => a.CoMember2)
                    .Include(a => a.CoCustomer)
                    .Include(a => a.CoCustomer2)
                    .Include(a => a.LoanRate)
                    .Include(a => a.Guarantor1Member)
                    .Include(a => a.Guarantor2Member)
                    .Include(a => a.Guarantor1Customer)
                    .Include(a => a.Guarantor2Customer)
                    .Include(a => a.RecommendedByDirector)
                    .OrderByDescending(a => a.ApplicationDate)
                    .ToListAsync();

                await EnrichApplicationDisbursementStatus(list);

                return Ok(list);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/LoanApplications/pending-disbursements
        [HttpGet("pending-disbursements")]
        public async Task<ActionResult<IEnumerable<LoanApplication>>> GetPendingDisbursements()
        {
            try
            {
                var list = await _context.LoanApplications
                    .Include(a => a.Customer)
                    .Include(a => a.Member)
                    .Include(a => a.CoMember)
                    .Include(a => a.CoMember2)
                    .Include(a => a.CoCustomer)
                    .Include(a => a.CoCustomer2)
                    .Include(a => a.LoanRate)
                    .Include(a => a.Guarantor1Member)
                    .Include(a => a.Guarantor2Member)
                    .Include(a => a.Guarantor1Customer)
                    .Include(a => a.Guarantor2Customer)
                    .Include(a => a.RecommendedByDirector)
                    .OrderByDescending(a => a.ApplicationDate)
                    .ToListAsync();

                await EnrichApplicationDisbursementStatus(list);

                var pendingList = list.Where(a => a.PendingSanctionedAmount > 0).ToList();
                return Ok(pendingList);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/LoanApplications/5
        [HttpGet("{id}")]
        public async Task<ActionResult<LoanApplication>> GetLoanApplication(int id)
        {
            var loanApplication = await _context.LoanApplications
                .Include(a => a.Customer)
                .Include(a => a.Member)
                .Include(a => a.CoMember)
                .Include(a => a.CoMember2)
                .Include(a => a.CoCustomer)
                .Include(a => a.CoCustomer2)
                .Include(a => a.LoanRate)
                .Include(a => a.Guarantor1Member)
                .Include(a => a.Guarantor2Member)
                .Include(a => a.Guarantor1Customer)
                .Include(a => a.Guarantor2Customer)
                .Include(a => a.RecommendedByDirector)
                .FirstOrDefaultAsync(m => m.LoanApplicationID == id);

            if (loanApplication == null)
            {
                return NotFound();
            }

            var singleList = new List<LoanApplication> { loanApplication };
            await EnrichApplicationDisbursementStatus(singleList);

            return loanApplication;
        }

        private async Task EnrichApplicationDisbursementStatus(List<LoanApplication> applications)
        {
            if (applications == null || !applications.Any()) return;

            var appIds = applications.Select(a => a.LoanApplicationID).ToList();

            // Find all linked loan accounts
            var linkedAccounts = await _context.LoanAccounts
                .Where(l => l.LoanApplicationID.HasValue && appIds.Contains(l.LoanApplicationID.Value))
                .ToListAsync();

            var accountIds = linkedAccounts.Select(l => l.LoanAccountID).ToList();

            // Find all disbursements for these accounts
            var disbursements = await _context.LoanDisbursements
                .Where(d => accountIds.Contains(d.LoanAccountID))
                .ToListAsync();

            foreach (var app in applications)
            {
                var linkedAcc = linkedAccounts.FirstOrDefault(l => l.LoanApplicationID == app.LoanApplicationID);
                if (linkedAcc != null)
                {
                    app.LinkedLoanAccountID = linkedAcc.LoanAccountID;
                    app.LoanAccountNo = linkedAcc.LoanAccountNo;

                    var appDisbursements = disbursements.Where(d => d.LoanAccountID == linkedAcc.LoanAccountID).ToList();
                    app.TotalDisbursedAmount = appDisbursements.Sum(d => d.DisbursementAmount);
                    app.DisbursementCount = appDisbursements.Count;
                }
                else
                {
                    app.TotalDisbursedAmount = 0;
                    app.DisbursementCount = 0;
                }

                var totalDisb = app.TotalDisbursedAmount;
                var sancAmt = app.RequestedAmount;

                if (totalDisb <= 0)
                {
                    app.PendingSanctionedAmount = sancAmt;
                    app.DisbursementStatus = "Pending";
                }
                else if (totalDisb < sancAmt)
                {
                    app.PendingSanctionedAmount = sancAmt - totalDisb;
                    app.DisbursementStatus = "Partially Disbursed";
                }
                else
                {
                    app.PendingSanctionedAmount = 0;
                    app.DisbursementStatus = "Fully Disbursed";
                }

                if (linkedAcc != null && linkedAcc.Status == "Closed")
                {
                    app.PendingSanctionedAmount = 0;
                    app.DisbursementStatus = "Closed";
                }
            }
        }

        // POST: api/LoanApplications
        [HttpPost]
        public async Task<ActionResult<LoanApplication>> PostLoanApplication(LoanApplication loanApplication)
        {
            try
            {
                // Sanitize 0 values to null for nullable foreign keys
                if (loanApplication.CoMemberID.HasValue && loanApplication.CoMemberID.Value <= 0) loanApplication.CoMemberID = null;
                if (loanApplication.CoMember2ID.HasValue && loanApplication.CoMember2ID.Value <= 0) loanApplication.CoMember2ID = null;
                if (loanApplication.CoCustomerID.HasValue && loanApplication.CoCustomerID.Value <= 0) loanApplication.CoCustomerID = null;
                if (loanApplication.CoCustomer2ID.HasValue && loanApplication.CoCustomer2ID.Value <= 0) loanApplication.CoCustomer2ID = null;
                if (loanApplication.RecommendedByDirectorID.HasValue && loanApplication.RecommendedByDirectorID.Value <= 0) loanApplication.RecommendedByDirectorID = null;
                if (loanApplication.Guarantor1MemberID.HasValue && loanApplication.Guarantor1MemberID.Value <= 0) loanApplication.Guarantor1MemberID = null;
                if (loanApplication.Guarantor2MemberID.HasValue && loanApplication.Guarantor2MemberID.Value <= 0) loanApplication.Guarantor2MemberID = null;
                if (loanApplication.Guarantor1CustomerID.HasValue && loanApplication.Guarantor1CustomerID.Value <= 0) loanApplication.Guarantor1CustomerID = null;
                if (loanApplication.Guarantor2CustomerID.HasValue && loanApplication.Guarantor2CustomerID.Value <= 0) loanApplication.Guarantor2CustomerID = null;

                // 1. Verify Primary Borrower Customer & Member Status
                Customer? customer = null;
                Member? borrower = null;

                if (loanApplication.CustomerID.HasValue && loanApplication.CustomerID.Value > 0)
                {
                    customer = await _context.Customers.FindAsync(loanApplication.CustomerID.Value);
                    if (customer == null) return BadRequest(new { message = "निवडलेला कर्जदार ग्राहक सिस्टीममध्ये अस्तित्वात नाही." });
                    if (customer.Status != "Active") return BadRequest(new { message = $"कर्जदार ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन कर्ज अर्ज करता येत नाही." });

                    borrower = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                }
                else if (loanApplication.MemberID.HasValue && loanApplication.MemberID.Value > 0)
                {
                    borrower = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == loanApplication.MemberID.Value);
                    if (borrower == null) return BadRequest(new { message = "निवडलेला कर्जदार सभासद सिस्टीममध्ये अस्तित्वात नाही." });
                    if (borrower.Status != "Active") return BadRequest(new { message = $"कर्जदार सभासदाचे स्टेटस '{borrower.Status}' असल्यामुळे नवीन कर्ज अर्ज करता येत नाही. केवळ सक्रिय (Active) सभासदांनाच कर्ज मंजूर करता येते." });

                    if (borrower.CustomerID > 0) customer = await _context.Customers.FindAsync(borrower.CustomerID);
                }
                else
                {
                    return BadRequest(new { message = "कृपया कर्जदाराची (Customer / Member) निवड करा." });
                }

                loanApplication.CustomerID = customer?.CustomerID ?? (borrower?.CustomerID > 0 ? borrower.CustomerID : null);
                loanApplication.MemberID = borrower?.MemberID;

                int targetBorrowerCustId = loanApplication.CustomerID ?? 0;
                int targetBorrowerMemId = loanApplication.MemberID ?? 0;

                // 2. Prevent Self-Guarantee & Duplicate Guarantors
                // Check Guarantor 1
                if (loanApplication.Guarantor1CustomerID.HasValue && loanApplication.Guarantor1CustomerID.Value > 0)
                {
                    if (targetBorrowerCustId > 0 && loanApplication.Guarantor1CustomerID.Value == targetBorrowerCustId)
                    {
                        return BadRequest(new { message = "कर्जदार स्वतःच स्वतःचा जामीनदार (Guarantor 1) असू शकत नाही." });
                    }
                    var gCust1 = await _context.Customers.FindAsync(loanApplication.Guarantor1CustomerID.Value);
                    if (gCust1 == null || gCust1.Status != "Active")
                    {
                        return BadRequest(new { message = "जामीनदार १ हा सक्रिय ग्राहक असणे आवश्यक आहे." });
                    }
                    if (!loanApplication.Guarantor1MemberID.HasValue || loanApplication.Guarantor1MemberID.Value <= 0)
                    {
                        var gm1 = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == gCust1.CustomerID);
                        if (gm1 != null) loanApplication.Guarantor1MemberID = gm1.MemberID;
                    }
                }
                else if (loanApplication.Guarantor1MemberID.HasValue && loanApplication.Guarantor1MemberID.Value > 0)
                {
                    if (targetBorrowerMemId > 0 && loanApplication.Guarantor1MemberID.Value == targetBorrowerMemId)
                    {
                        return BadRequest(new { message = "कर्जदार स्वतःच स्वतःचा जामीनदार (Guarantor 1) असू शकत नाही." });
                    }
                    var g1 = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == loanApplication.Guarantor1MemberID.Value);
                    if (g1 == null || g1.Status != "Active")
                    {
                        return BadRequest(new { message = "जामीनदार १ हा सक्रिय सभासद असणे आवश्यक आहे." });
                    }
                    if (g1.CustomerID > 0 && (!loanApplication.Guarantor1CustomerID.HasValue || loanApplication.Guarantor1CustomerID.Value <= 0))
                    {
                        loanApplication.Guarantor1CustomerID = g1.CustomerID;
                    }
                }

                // Check Guarantor 2
                if (loanApplication.Guarantor2CustomerID.HasValue && loanApplication.Guarantor2CustomerID.Value > 0)
                {
                    if (targetBorrowerCustId > 0 && loanApplication.Guarantor2CustomerID.Value == targetBorrowerCustId)
                    {
                        return BadRequest(new { message = "कर्जदार स्वतःच स्वतःचा जामीनदार (Guarantor 2) असू शकत नाही." });
                    }
                    if (loanApplication.Guarantor1CustomerID.HasValue && loanApplication.Guarantor2CustomerID.Value == loanApplication.Guarantor1CustomerID.Value)
                    {
                        return BadRequest(new { message = "जामीनदार १ आणि जामीनदार २ एकच व्यक्ती असू शकत नाहीत." });
                    }
                    var gCust2 = await _context.Customers.FindAsync(loanApplication.Guarantor2CustomerID.Value);
                    if (gCust2 == null || gCust2.Status != "Active")
                    {
                        return BadRequest(new { message = "जामीनदार २ हा सक्रिय ग्राहक असणे आवश्यक आहे." });
                    }
                    if (!loanApplication.Guarantor2MemberID.HasValue || loanApplication.Guarantor2MemberID.Value <= 0)
                    {
                        var gm2 = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == gCust2.CustomerID);
                        if (gm2 != null) loanApplication.Guarantor2MemberID = gm2.MemberID;
                    }
                }
                else if (loanApplication.Guarantor2MemberID.HasValue && loanApplication.Guarantor2MemberID.Value > 0)
                {
                    if (targetBorrowerMemId > 0 && loanApplication.Guarantor2MemberID.Value == targetBorrowerMemId)
                    {
                        return BadRequest(new { message = "कर्जदार स्वतःच स्वतःचा जामीनदार (Guarantor 2) असू शकत नाही." });
                    }
                    if (loanApplication.Guarantor1MemberID.HasValue && loanApplication.Guarantor2MemberID.Value == loanApplication.Guarantor1MemberID.Value)
                    {
                        return BadRequest(new { message = "जामीनदार १ आणि जामीनदार २ एकच सभासद असू शकत नाहीत." });
                    }
                    var g2 = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == loanApplication.Guarantor2MemberID.Value);
                    if (g2 == null || g2.Status != "Active")
                    {
                        return BadRequest(new { message = "जामीनदार २ हा सक्रिय सभासद असणे आवश्यक आहे." });
                    }
                    if (g2.CustomerID > 0 && (!loanApplication.Guarantor2CustomerID.HasValue || loanApplication.Guarantor2CustomerID.Value <= 0))
                    {
                        loanApplication.Guarantor2CustomerID = g2.CustomerID;
                    }
                }

                // Auto-generate ApplicationNo
                var today = DateTime.Today;
                var year = today.Year.ToString().Substring(2, 2);
                var month = today.Month.ToString("D2");
                var prefix = $"APP-{year}{month}-";
                
                var lastApp = await _context.LoanApplications
                    .Where(a => a.ApplicationNo != null && a.ApplicationNo.StartsWith(prefix))
                    .OrderByDescending(a => a.ApplicationNo)
                    .FirstOrDefaultAsync();

                int nextNo = 1;
                if (lastApp != null && !string.IsNullOrEmpty(lastApp.ApplicationNo))
                {
                    var parts = lastApp.ApplicationNo.Split('-');
                    if (parts.Length == 3 && int.TryParse(parts[2], out int lastNo))
                    {
                        nextNo = lastNo + 1;
                    }
                }

                loanApplication.ApplicationNo = $"{prefix}{nextNo:D3}";

                _context.LoanApplications.Add(loanApplication);
                await _context.SaveChangesAsync();

                return Ok(loanApplication);
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest(new { message = $"कर्ज अर्ज जतन करताना त्रुटी आली: {msg}" });
            }
        }

        // PUT: api/LoanApplications/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutLoanApplication(int id, LoanApplication loanApplication)
        {
            if (id != loanApplication.LoanApplicationID)
            {
                return BadRequest(new { message = "अवैध कर्ज अर्ज आयडी (Invalid Application ID)." });
            }

            try
            {
                // Sanitize 0 values to null for nullable foreign keys
                if (loanApplication.CoMemberID.HasValue && loanApplication.CoMemberID.Value <= 0) loanApplication.CoMemberID = null;
                if (loanApplication.CoMember2ID.HasValue && loanApplication.CoMember2ID.Value <= 0) loanApplication.CoMember2ID = null;
                if (loanApplication.CoCustomerID.HasValue && loanApplication.CoCustomerID.Value <= 0) loanApplication.CoCustomerID = null;
                if (loanApplication.CoCustomer2ID.HasValue && loanApplication.CoCustomer2ID.Value <= 0) loanApplication.CoCustomer2ID = null;
                if (loanApplication.RecommendedByDirectorID.HasValue && loanApplication.RecommendedByDirectorID.Value <= 0) loanApplication.RecommendedByDirectorID = null;
                if (loanApplication.Guarantor1MemberID.HasValue && loanApplication.Guarantor1MemberID.Value <= 0) loanApplication.Guarantor1MemberID = null;
                if (loanApplication.Guarantor2MemberID.HasValue && loanApplication.Guarantor2MemberID.Value <= 0) loanApplication.Guarantor2MemberID = null;
                if (loanApplication.Guarantor1CustomerID.HasValue && loanApplication.Guarantor1CustomerID.Value <= 0) loanApplication.Guarantor1CustomerID = null;
                if (loanApplication.Guarantor2CustomerID.HasValue && loanApplication.Guarantor2CustomerID.Value <= 0) loanApplication.Guarantor2CustomerID = null;

                _context.Entry(loanApplication).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!LoanApplicationExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest(new { message = $"कर्ज अर्ज अद्यतनित करताना त्रुटी आली: {msg}" });
            }
        }

        // DELETE: api/LoanApplications/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLoanApplication(int id)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var loanApplication = await _context.LoanApplications.FindAsync(id);
                if (loanApplication == null)
                {
                    return NotFound(new { message = "कर्ज अर्ज सापडला नाही." });
                }

                // Find linked LoanAccounts
                var linkedLoanAccounts = await _context.LoanAccounts.Where(l => l.LoanApplicationID == id).ToListAsync();

                // 1. Verify if any loan collections (EMIs) exist on these accounts
                foreach (var loanAcc in linkedLoanAccounts)
                {
                    bool hasCollections = await _context.LoanCollections.AnyAsync(c => c.LoanAccountID == loanAcc.LoanAccountID);
                    if (hasCollections)
                    {
                        return BadRequest(new { message = "या कर्ज अर्जाच्या खात्यावर कर्ज वसुली (Loan Collection / EMI) झालेली असल्यामुळे हा अर्ज डिलीट करता येत नाही. आधी कर्ज वसुली डिलीट करा." });
                    }
                }

                // 2. Cascade delete all linked Disbursements, Vouchers, Shares, and Savings
                foreach (var loanAcc in linkedLoanAccounts)
                {
                    var linkedDisbursements = await _context.LoanDisbursements
                        .Include(d => d.Deductions)
                        .Include(d => d.Voucher)
                        .ThenInclude(v => v!.VoucherDetails)
                        .Where(d => d.LoanAccountID == loanAcc.LoanAccountID)
                        .ToListAsync();

                    foreach (var disb in linkedDisbursements)
                    {
                        // Remove linked Deductions
                        if (disb.Deductions != null && disb.Deductions.Any())
                        {
                            _context.LoanDisbursementDeductions.RemoveRange(disb.Deductions);
                        }

                        // Reverse and remove Voucher, Shares, and Savings
                        if (disb.VoucherID.HasValue || disb.Voucher != null)
                        {
                            int vId = disb.VoucherID ?? disb.Voucher?.VoucherID ?? 0;
                            string? voucherNo = disb.Voucher?.VoucherNo;

                            if (vId > 0)
                            {
                                var linkedShareTxns = await _context.ShareTransactions.Where(st => st.VoucherId == vId).ToListAsync();
                                foreach (var st in linkedShareTxns)
                                {
                                    var shAcc = await _context.ShareAccounts.FindAsync(st.ShareAccountId);
                                    if (shAcc != null)
                                    {
                                        shAcc.TotalShareCount = Math.Max(0, shAcc.TotalShareCount - st.NumberOfShares);
                                        shAcc.TotalShareAmount = Math.Max(0, shAcc.TotalShareAmount - st.Amount);
                                        _context.Entry(shAcc).State = EntityState.Modified;
                                    }
                                    _context.ShareTransactions.Remove(st);
                                }

                                if (!string.IsNullOrEmpty(voucherNo))
                                {
                                    var linkedSavingTxns = await _context.SavingTransactions.Where(st => st.VoucherNo == voucherNo).ToListAsync();
                                    foreach (var st in linkedSavingTxns)
                                    {
                                        var savAcc = await _context.SavingAccountMasters.FindAsync(st.SavingAccountID);
                                        if (savAcc != null)
                                        {
                                            savAcc.CurrentBalance = Math.Max(0, savAcc.CurrentBalance - st.Amount);
                                            _context.Entry(savAcc).State = EntityState.Modified;
                                        }
                                        _context.SavingTransactions.Remove(st);
                                    }
                                }

                                if (disb.Voucher?.VoucherDetails != null && disb.Voucher.VoucherDetails.Any())
                                {
                                    _context.VoucherDetails.RemoveRange(disb.Voucher.VoucherDetails);
                                }
                                else
                                {
                                    var details = await _context.VoucherDetails.Where(vd => vd.VoucherID == vId).ToListAsync();
                                    if (details.Any()) _context.VoucherDetails.RemoveRange(details);
                                }

                                var vObj = disb.Voucher ?? await _context.Vouchers.FindAsync(vId);
                                if (vObj != null) _context.Vouchers.Remove(vObj);
                            }
                        }

                        _context.LoanDisbursements.Remove(disb);
                    }

                    // Clean up Gold Loan Details
                    var goldDetails = await _context.GoldLoanDetails.Where(g => g.LoanAccountID == loanAcc.LoanAccountID).ToListAsync();
                    if (goldDetails.Any()) _context.GoldLoanDetails.RemoveRange(goldDetails);

                    // Clean up Installment Schedules
                    var schedules = await _context.LoanInstallmentSchedules.Where(s => s.LoanAccountID == loanAcc.LoanAccountID).ToListAsync();
                    if (schedules.Any()) _context.LoanInstallmentSchedules.RemoveRange(schedules);

                    // Clean up Collateral Compliance Logs
                    var collateralLogs = await _context.CollateralComplianceLogs.Where(c => c.LoanAccountID == loanAcc.LoanAccountID).ToListAsync();
                    if (collateralLogs.Any()) _context.CollateralComplianceLogs.RemoveRange(collateralLogs);
                }

                // 3. Remove Loan Accounts and Application
                if (linkedLoanAccounts.Any())
                {
                    _context.LoanAccounts.RemoveRange(linkedLoanAccounts);
                }

                _context.LoanApplications.Remove(loanApplication);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                var msg = ex.Message + (ex.InnerException != null ? " | " + ex.InnerException.Message : "");
                return BadRequest(new { message = $"कर्ज अर्ज डिलीट करताना त्रुटी आली: {msg}" });
            }
        }

        private bool LoanApplicationExists(int id)
        {
            return _context.LoanApplications.Any(e => e.LoanApplicationID == id);
        }
    }
}
