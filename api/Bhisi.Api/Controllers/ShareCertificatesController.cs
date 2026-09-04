using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using System.Security.Claims;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ShareCertificatesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ShareCertificatesController(AppDbContext context)
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

        // GET: api/ShareCertificates
        [HttpGet]
        public async Task<IActionResult> GetAllCertificates(
            [FromQuery] int? memberId,
            [FromQuery] string? status,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] string? search)
        {
            var query = _context.ShareCertificates
                .Include(c => c.ShareAccount)
                    .ThenInclude(sa => sa!.Member)
                .Where(c => c.Status != "OpeningBalance");

            if (memberId.HasValue && memberId.Value > 0)
            {
                query = query.Where(c => c.ShareAccount != null && c.ShareAccount.MemberId == memberId.Value);
            }

            if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
            {
                query = query.Where(c => c.Status == status);
            }

            if (fromDate.HasValue)
            {
                query = query.Where(c => c.IssueDate.Date >= fromDate.Value.Date);
            }

            if (toDate.HasValue)
            {
                query = query.Where(c => c.IssueDate.Date <= toDate.Value.Date);
            }

            var list = await query
                .OrderByDescending(c => c.IssueDate)
                .ThenByDescending(c => c.CertificateId)
                .ToListAsync();

            // Fetch Joint Members for all related members in one query
            var memberIds = list
                .Where(c => c.ShareAccount != null && c.ShareAccount.MemberId > 0)
                .Select(c => c.ShareAccount!.MemberId)
                .Distinct()
                .ToList();

            var jointMembersDict = await _context.JointMembers
                .Where(j => memberIds.Contains(j.PrimaryMemberID) && j.Status == "Active")
                .GroupBy(j => j.PrimaryMemberID)
                .ToDictionaryAsync(
                    g => g.Key,
                    g => string.Join(", ", g.Select(j => $"{j.FirstName} {j.MiddleName} {j.LastName}".Trim().Replace("  ", " ") + (string.IsNullOrWhiteSpace(j.RelationWithPrimary) ? "" : $" ({j.RelationWithPrimary})")))
                );

            var result = list.Select(c =>
            {
                var member = c.ShareAccount?.Member;
                int mId = member?.MemberID ?? 0;
                string joint = jointMembersDict.ContainsKey(mId) ? jointMembersDict[mId] : "";

                return new
                {
                    c.CertificateId,
                    c.CertificateNo,
                    IssueDate = c.IssueDate.ToString("yyyy-MM-dd"),
                    MemberId = mId,
                    MemberName = $"{member?.FirstName ?? ""} {(member?.MiddleName != null ? member.MiddleName + " " : "")}{member?.LastName ?? ""}".Trim(),
                    MemberNameEng = $"{member?.FirstNameEng ?? ""} {member?.LastNameEng ?? ""}".Trim(),
                    MemberNo = member?.MemberCode ?? "",
                    AccountNo = c.ShareAccount?.AccountNo ?? "",
                    CIFNo = member?.CIFNo ?? "",
                    LegacyMemberNo = member?.LegacyMemberNo ?? member?.OldMemberCode ?? "",
                    c.FromShareNo,
                    c.ToShareNo,
                    c.NumberOfShares,
                    c.FaceValue,
                    TotalAmount = c.NumberOfShares * c.FaceValue,
                    c.Status,
                    c.PrintCount,
                    MemberAddress = member?.Address ?? member?.Village ?? "",
                    Village = member?.Village ?? "",
                    MobileNo = member?.MobileNo ?? "",
                    FatherHusbandName = member?.MiddleName ?? "",
                    JointMemberNames = joint,
                    MembershipType = member?.MembershipType ?? "Regular"
                };
            });

            if (!string.IsNullOrWhiteSpace(search))
            {
                string s = search.Trim().ToLower();
                result = result.Where(c =>
                    c.CertificateNo.ToLower().Contains(s) ||
                    c.MemberNo.ToLower().Contains(s) ||
                    c.MemberName.ToLower().Contains(s) ||
                    c.AccountNo.ToLower().Contains(s) ||
                    c.MobileNo.Contains(s) ||
                    c.Village.ToLower().Contains(s)
                );
            }

            return Ok(result.ToList());
        }

        // GET: api/ShareCertificates/Member/5 or api/ShareCertificates/ByMember/5
        [HttpGet("Member/{memberId}")]
        [HttpGet("ByMember/{memberId}")]
        public async Task<IActionResult> GetMemberCertificates(int memberId)
        {
            var account = await _context.ShareAccounts
                .FirstOrDefaultAsync(s => s.MemberId == memberId);

            if (account == null)
            {
                return Ok(new List<object>()); // Empty list if no account
            }

            var jointMembers = await _context.JointMembers
                .Where(j => j.PrimaryMemberID == memberId && j.Status == "Active")
                .ToListAsync();

            string jointMemberNames = jointMembers.Any()
                ? string.Join(", ", jointMembers.Select(j => $"{j.FirstName} {j.MiddleName} {j.LastName}".Trim().Replace("  ", " ") + (string.IsNullOrWhiteSpace(j.RelationWithPrimary) ? "" : $" ({j.RelationWithPrimary})")))
                : "";

            var certificates = await _context.ShareCertificates
                .Include(c => c.ShareAccount)
                .ThenInclude(sa => sa!.Member)
                .Where(c => c.ShareAccountId == account.ShareAccountId && c.Status != "OpeningBalance")
                .OrderByDescending(c => c.IssueDate)
                .Select(c => new
                {
                    c.CertificateId,
                    c.CertificateNo,
                    IssueDate = c.IssueDate.ToString("yyyy-MM-dd"),
                    MemberName = c.ShareAccount!.Member!.FirstName + " " + (c.ShareAccount.Member.MiddleName != null ? c.ShareAccount.Member.MiddleName + " " : "") + c.ShareAccount.Member.LastName,
                    MemberNameEng = (c.ShareAccount.Member.FirstNameEng != null ? c.ShareAccount.Member.FirstNameEng + " " : "") + (c.ShareAccount.Member.LastNameEng ?? ""),
                    MemberNo = c.ShareAccount.Member.MemberCode ?? "",
                    AccountNo = c.ShareAccount.AccountNo,
                    CIFNo = c.ShareAccount.Member.CIFNo ?? "",
                    LegacyMemberNo = c.ShareAccount.Member.LegacyMemberNo ?? c.ShareAccount.Member.OldMemberCode ?? "",
                    c.FromShareNo,
                    c.ToShareNo,
                    c.NumberOfShares,
                    c.FaceValue,
                    TotalAmount = c.NumberOfShares * c.FaceValue,
                    c.Status,
                    c.PrintCount,
                    MemberAddress = c.ShareAccount.Member.Address ?? c.ShareAccount.Member.Village ?? "",
                    Village = c.ShareAccount.Member.Village ?? "",
                    MobileNo = c.ShareAccount.Member.MobileNo ?? "",
                    FatherHusbandName = c.ShareAccount.Member.MiddleName ?? "",
                    JointMemberNames = jointMemberNames,
                    MembershipType = c.ShareAccount.Member.MembershipType ?? "Regular"
                })
                .ToListAsync();

            return Ok(certificates);
        }

        // GET: api/ShareCertificates/ByDisbursement/5
        [HttpGet("ByDisbursement/{disbursementId}")]
        public async Task<IActionResult> GetCertificateByDisbursement(int disbursementId)
        {
            var disbursement = await _context.LoanDisbursements
                .Include(d => d.LoanAccount)
                    .ThenInclude(l => l!.Member)
                .Include(d => d.Voucher)
                .FirstOrDefaultAsync(d => d.LoanDisbursementID == disbursementId);

            if (disbursement == null)
            {
                return NotFound(new { message = "कर्ज वाटप नोंद सापडली नाही." });
            }

            int memberId = disbursement.LoanAccount?.MemberID ?? 0;
            if (memberId <= 0)
            {
                return BadRequest(new { message = "या कर्ज खात्याशी संबंधित सभासद आढळला नाही." });
            }

            // Check if share deduction occurred
            decimal shareDed = disbursement.ShareDeduction;
            if (shareDed <= 0)
            {
                return BadRequest(new { message = "या कर्ज वितरणावर शेअर्स कपात (Share Deduction) झालेली नाही." });
            }

            int numShares = (int)(shareDed / 100m);
            if (numShares <= 0) numShares = 1;

            var shareAcc = await _context.ShareAccounts
                .Include(sa => sa.Member)
                .FirstOrDefaultAsync(sa => sa.MemberId == memberId);

            if (shareAcc == null)
            {
                return NotFound(new { message = "सभासदाचे शेअर्स खाते सापडले नाही." });
            }

            // Find matching ShareCertificate
            ShareCertificate? cert = null;

            // Strategy 1: Find by voucher link via ShareTransactions
            if (disbursement.VoucherID.HasValue)
            {
                var shareTx = await _context.ShareTransactions
                    .FirstOrDefaultAsync(st => st.VoucherId == disbursement.VoucherID.Value);

                if (shareTx != null)
                {
                    cert = await _context.ShareCertificates
                        .Where(c => c.ShareAccountId == shareAcc.ShareAccountId && c.NumberOfShares == shareTx.NumberOfShares)
                        .OrderByDescending(c => c.CertificateId)
                        .FirstOrDefaultAsync();
                }
            }

            // Strategy 2: Fallback to most recent certificate for this account matching shares
            if (cert == null)
            {
                cert = await _context.ShareCertificates
                    .Where(c => c.ShareAccountId == shareAcc.ShareAccountId && c.NumberOfShares == numShares)
                    .OrderByDescending(c => c.CertificateId)
                    .FirstOrDefaultAsync();
            }

            // Strategy 3: Fallback to any latest active certificate for this account
            if (cert == null)
            {
                cert = await _context.ShareCertificates
                    .Where(c => c.ShareAccountId == shareAcc.ShareAccountId && c.Status != "Cancelled")
                    .OrderByDescending(c => c.CertificateId)
                    .FirstOrDefaultAsync();
            }

            // Strategy 4: If still no certificate found (e.g. legacy data or missed cert creation), auto-generate it now!
            if (cert == null)
            {
                int nextCertCount = await _context.ShareCertificates.CountAsync() + 1;
                int maxToShareNo = await _context.ShareCertificates.MaxAsync(c => (int?)c.ToShareNo) ?? 0;
                int nextFromShareNo = maxToShareNo + 1;
                int nextToShareNo = nextFromShareNo + numShares - 1;
                string certNo = $"CERT-{disbursement.DisbursementDate.Year}-{nextCertCount:D5}";

                cert = new ShareCertificate
                {
                    ShareAccountId = shareAcc.ShareAccountId,
                    CustomerID = shareAcc.Member?.CustomerID ?? disbursement.LoanAccount?.Member?.CustomerID ?? 1,
                    CertificateNo = certNo,
                    FromShareNo = nextFromShareNo,
                    ToShareNo = nextToShareNo,
                    NumberOfShares = numShares,
                    FaceValue = 100m,
                    IssueDate = disbursement.DisbursementDate,
                    Status = "Issued",
                    PrintCount = 0
                };
                _context.ShareCertificates.Add(cert);
                await _context.SaveChangesAsync();
            }

            var member = shareAcc.Member ?? disbursement.LoanAccount?.Member;

            var jointMembers = await _context.JointMembers
                .Where(j => j.PrimaryMemberID == memberId && j.Status == "Active")
                .ToListAsync();

            string jointMemberNames = jointMembers.Any()
                ? string.Join(", ", jointMembers.Select(j => $"{j.FirstName} {j.MiddleName} {j.LastName}".Trim().Replace("  ", " ") + (string.IsNullOrWhiteSpace(j.RelationWithPrimary) ? "" : $" ({j.RelationWithPrimary})")))
                : "";

            var result = new
            {
                cert.CertificateId,
                cert.CertificateNo,
                IssueDate = cert.IssueDate.ToString("yyyy-MM-dd"),
                MemberName = $"{member?.FirstName ?? ""} {(member?.MiddleName != null ? member.MiddleName + " " : "")}{member?.LastName ?? ""}".Trim(),
                MemberNameEng = $"{member?.FirstNameEng ?? ""} {member?.LastNameEng ?? ""}".Trim(),
                MemberNo = member?.MemberCode ?? "",
                AccountNo = shareAcc.AccountNo,
                CIFNo = member?.CIFNo ?? "",
                LegacyMemberNo = member?.LegacyMemberNo ?? member?.OldMemberCode ?? "",
                cert.FromShareNo,
                cert.ToShareNo,
                cert.NumberOfShares,
                cert.FaceValue,
                TotalAmount = cert.NumberOfShares * cert.FaceValue,
                cert.Status,
                cert.PrintCount,
                MemberAddress = member?.Address ?? member?.Village ?? "",
                Village = member?.Village ?? "",
                MobileNo = member?.MobileNo ?? "",
                FatherHusbandName = member?.MiddleName ?? "",
                JointMemberNames = jointMemberNames,
                MembershipType = member?.MembershipType ?? "Regular"
            };

            return Ok(result);
        }

        public class CancelCertificateRequest
        {
            public string Reason { get; set; } = string.Empty;
            public string PaymentMode { get; set; } = "Cash"; // "Cash", "Transfer", "Bank"
            public int? SavingAccountId { get; set; }
            public int? BankLedgerId { get; set; }
            public int? CashLedgerId { get; set; }
            public int BranchId { get; set; } = 1;
        }

        // POST: api/ShareCertificates/5/cancel
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelCertificate(int id, [FromBody] CancelCertificateRequest request)
        {
            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var certificate = await _context.ShareCertificates
                    .Include(c => c.ShareAccount)
                        .ThenInclude(sa => sa!.Member)
                    .FirstOrDefaultAsync(c => c.CertificateId == id);

                if (certificate == null) return NotFound("शेअर प्रमाणपत्र सापडले नाही.");

                if (certificate.Status == "Cancelled") return BadRequest("हे प्रमाणपत्र आधीच रद्द केलेले आहे.");

                var account = certificate.ShareAccount;
                if (account == null)
                {
                    account = await _context.ShareAccounts.FindAsync(certificate.ShareAccountId);
                }

                if (account == null) return BadRequest("संबंधित शेअर खाते सापडले नाही.");

                var member = account.Member;
                if (member == null)
                {
                    member = await _context.Members.FindAsync(account.MemberId);
                }

                decimal totalAmount = certificate.NumberOfShares * certificate.FaceValue;

                // 1. Mark Certificate as Cancelled
                certificate.Status = "Cancelled";
                certificate.CancellationReason = request.Reason;
                certificate.ModifiedDate = DateTime.UtcNow;
                _context.Entry(certificate).State = EntityState.Modified;

                // 2. Rollback Share Account Balances
                account.TotalShareCount = Math.Max(0, account.TotalShareCount - certificate.NumberOfShares);
                account.TotalShareAmount = Math.Max(0, account.TotalShareAmount - totalAmount);
                _context.Entry(account).State = EntityState.Modified;

                // 3. Resolve Share Capital Ledger
                var shareCapitalLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);

                // 4. Determine Credit Ledger (Refund Source / Destination)
                int creditLedgerId;
                SavingAccountMaster? savingAccount = null;

                if (request.PaymentMode == "Transfer" && request.SavingAccountId.HasValue)
                {
                    savingAccount = await _context.SavingAccountMasters.FindAsync(request.SavingAccountId.Value);
                    if (savingAccount != null)
                    {
                        var (userId, _, _) = GetCurrentUserContext();
                        savingAccount.CurrentBalance += totalAmount;
                        _context.Entry(savingAccount).State = EntityState.Modified;

                        _context.SavingTransactions.Add(new SavingTransaction
                        {
                            SavingAccountID = savingAccount.SavingAccountID,
                            CustomerID = savingAccount.CustomerID,
                            TransactionDate = DateTime.Today,
                            TransactionType = "Deposit",
                            PaymentMode = "Transfer",
                            Amount = totalAmount,
                            BalanceAfterTxn = savingAccount.CurrentBalance,
                            Narration = $"शेअर प्रमाणपत्र रद्दीकरण परतावा जमा (Share Certificate Cancellation Reversal: {certificate.CertificateNo})",
                            CreatedBy = userId,
                            CreatedOn = DateTime.Now
                        });

                        creditLedgerId = savingAccount.LedgerID;
                    }
                    else
                    {
                        creditLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.BranchId, "SHARE");
                    }
                }
                else if (request.PaymentMode == "Bank" && request.BankLedgerId.HasValue)
                {
                    creditLedgerId = request.BankLedgerId.Value;
                }
                else if (request.CashLedgerId.HasValue && request.CashLedgerId.Value > 0)
                {
                    creditLedgerId = request.CashLedgerId.Value;
                }
                else
                {
                    creditLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.BranchId, "SHARE");
                }

                // 5. Generate Accounting Voucher in Day Book (Payment / Journal Voucher)
                var voucherDate = DateTime.Today;
                int vchCount = await _context.Vouchers.CountAsync() + 1;
                string memberNameStr = member != null ? $"{member.FirstName} {member.LastName}" : "सभासद";

                var (actionUserId, _, _) = GetCurrentUserContext();
                var voucher = new Voucher
                {
                    BranchID = request.BranchId,
                    VoucherNo = $"VCH-SHR-CNL-{voucherDate:yyyyMMdd}-{vchCount:D4}",
                    VoucherDate = voucherDate,
                    VoucherType = request.PaymentMode == "Transfer" ? "Journal" : "Payment",
                    TotalAmount = totalAmount,
                    Narration = $"शेअर प्रमाणपत्र रद्दीकरण (Share Certificate Cancellation: {certificate.CertificateNo}) - {memberNameStr} ({certificate.NumberOfShares} शेअर्स). कारण: {request.Reason}",
                    Status = "Approved",
                    CreatedBy = actionUserId,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        // Share Capital Decreases -> Debit
                        new VoucherDetail { LedgerID = shareCapitalLedger.LedgerID, DrCr = "Dr", Amount = totalAmount },
                        // Cash / Bank / Saving -> Credit
                        new VoucherDetail { LedgerID = creditLedgerId, DrCr = "Cr", Amount = totalAmount }
                    }
                };
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // 6. Create ShareTransaction Record
                var shareTxn = new ShareTransaction
                {
                    ShareAccountId = account.ShareAccountId,
                    CustomerID = member?.CustomerID ?? (account.Member != null ? account.Member.CustomerID ?? account.MemberId : 1),
                    TransactionDate = DateTime.Today,
                    TransactionType = "Withdrawal",
                    NumberOfShares = certificate.NumberOfShares,
                    Amount = totalAmount,
                    Narration = $"प्रमाणपत्र रद्दीकरण ({certificate.CertificateNo}): {request.Reason}",
                    VoucherId = voucher.VoucherID
                };
                _context.ShareTransactions.Add(shareTxn);

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new 
                { 
                    message = $"शेअर प्रमाणपत्र ({certificate.CertificateNo}) यशस्वीरित्या रद्द केले. रोजकीर्द व्हाउचर तयार झाले: {voucher.VoucherNo}",
                    voucherNo = voucher.VoucherNo,
                    amount = totalAmount
                });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"रद्दीकरण करताना त्रुटी आली: {ex.Message}");
            }
        }

        // POST: api/ShareCertificates/5/print
        [HttpPost("{id}/print")]
        public async Task<IActionResult> LogPrint(int id)
        {
            var certificate = await _context.ShareCertificates.FindAsync(id);
            if (certificate == null) return NotFound("Certificate not found.");

            certificate.PrintCount += 1;
            
            var (userId, _, _) = GetCurrentUserContext();
            var printLog = new ShareCertificatePrintHistory
            {
                CertificateId = id,
                ActionType = "Print",
                PrintedBy = userId,
                PrintedOn = DateTime.Now
            };

            _context.ShareCertificatePrintHistories.Add(printLog);
            _context.ShareCertificates.Update(certificate);
            
            await _context.SaveChangesAsync();

            return Ok(new { message = "Print logged successfully.", printCount = certificate.PrintCount });
        }

        public class UpdateCertificateRequest
        {
            public DateTime? IssueDate { get; set; }
            public string? CancellationReason { get; set; }
        }

        // PUT: api/ShareCertificates/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCertificate(int id, [FromBody] UpdateCertificateRequest request)
        {
            var certificate = await _context.ShareCertificates.FindAsync(id);
            if (certificate == null) return NotFound("Certificate not found.");

            if (request.IssueDate.HasValue)
            {
                certificate.IssueDate = request.IssueDate.Value.Date;
            }
            if (request.CancellationReason != null)
            {
                certificate.CancellationReason = request.CancellationReason.Trim();
            }
            certificate.ModifiedDate = DateTime.UtcNow;

            _context.Entry(certificate).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return Ok(new { message = "प्रमाणपत्र तपशील यशस्वीरित्या अद्ययावत केला." });
        }
    }
}
