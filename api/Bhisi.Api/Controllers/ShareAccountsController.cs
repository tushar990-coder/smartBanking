using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using System.Security.Claims;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ShareAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ShareAccountsController(AppDbContext context)
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

        // GET: api/ShareAccounts/Member/5 or api/ShareAccounts/ByMember/5
        [HttpGet("Member/{memberId}")]
        [HttpGet("ByMember/{memberId}")]
        public async Task<IActionResult> GetMemberShareAccount(int memberId)
        {
            var account = await _context.ShareAccounts
                .Where(s => s.MemberId == memberId)
                .Select(s => new
                {
                    s.ShareAccountId,
                    s.MemberId,
                    s.AccountNo,
                    s.TotalShareCount,
                    s.TotalShareAmount,
                    s.OpeningDate,
                    s.DividendPayableBalance,
                    s.Status
                })
                .FirstOrDefaultAsync();

            if (account == null)
            {
                return NotFound("No share account found for this member.");
            }

            return Ok(account);
        }

        // GET: api/ShareAccounts/Shareholders
        [HttpGet("Shareholders")]
        public async Task<IActionResult> GetShareholders([FromQuery] int? branchId)
        {
            var query = _context.ShareAccounts
                .Include(s => s.Member)
                .Include(s => s.Certificates)
                .Where(s => s.TotalShareCount > 0);

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(s => s.Member != null && s.Member.BranchID == branchId.Value);
            }

            var shareholders = await query
                .OrderBy(s => s.Member != null ? s.Member.MemberCode : "")
                .Select(s => new
                {
                    s.ShareAccountId,
                    s.AccountNo,
                    s.MemberId,
                    MemberCode = s.Member != null ? s.Member.MemberCode : "",
                    CIFNo = s.Member != null ? s.Member.CIFNo : "",
                    LegacyMemberNo = s.Member != null ? s.Member.LegacyMemberNo : "",
                    FirstName = s.Member != null ? s.Member.FirstName : "",
                    MiddleName = s.Member != null ? s.Member.MiddleName : "",
                    LastName = s.Member != null ? s.Member.LastName : "",
                    FullName = s.Member != null ? $"{s.Member.FirstName} {s.Member.MiddleName} {s.Member.LastName}".Replace("  ", " ").Trim() : "",
                    MobileNo = s.Member != null ? s.Member.MobileNo : "",
                    Village = s.Member != null ? s.Member.Village : "",
                    Address = s.Member != null ? s.Member.Address : "",
                    s.TotalShareCount,
                    s.TotalShareAmount,
                    s.OpeningDate,
                    s.DividendPayableBalance,
                    s.Status,
                    LatestCertificateNo = s.Certificates != null && s.Certificates.Any() 
                        ? s.Certificates.OrderByDescending(c => c.CertificateId).Select(c => c.CertificateNo).FirstOrDefault() 
                        : ""
                })
                .ToListAsync();

            return Ok(shareholders);
        }

        public class AllotmentRequest
        {
            public int MemberId { get; set; }
            public string? LegacyMemberNo { get; set; }
            public int NumberOfShares { get; set; }
            public decimal? FaceValue { get; set; } = 100M;
            public decimal? AdmissionFee { get; set; } = 0;
            public decimal? BuildingFund { get; set; } = 0;
            public int BranchId { get; set; } = 1;
            public string Narration { get; set; } = "Share Allotment";
            public string PaymentMode { get; set; } = "Cash"; // "Cash", "Transfer", "Bank", "LedgerTransfer"
            public int? SavingAccountId { get; set; }
            public int? BankLedgerId { get; set; }
            public int? SourceLedgerId { get; set; }
            public int? CashLedgerId { get; set; }
            public string? ChequeNo { get; set; }
            public int? ShareSchemeId { get; set; }
        }

        // POST: api/ShareAccounts/Allot
        [HttpPost("Allot")]
        public async Task<IActionResult> AllotShares([FromBody] AllotmentRequest request)
        {
            if (request.NumberOfShares <= 0) return BadRequest("Number of shares must be greater than zero.");

            decimal faceValue = request.FaceValue.HasValue && request.FaceValue.Value > 0 ? request.FaceValue.Value : 100M;
            decimal shareCapitalAmount = request.NumberOfShares * faceValue;
            decimal admissionFee = request.AdmissionFee.HasValue && request.AdmissionFee.Value > 0 ? request.AdmissionFee.Value : 0;
            decimal buildingFund = request.BuildingFund.HasValue && request.BuildingFund.Value > 0 ? request.BuildingFund.Value : 0;
            decimal totalAmount = shareCapitalAmount + admissionFee + buildingFund;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Ensure member exists
                var member = await _context.Members.FindAsync(request.MemberId);
                if (member == null) return NotFound("Member not found.");

                // Update Old ID (LegacyMemberNo) if entered by user
                if (!string.IsNullOrWhiteSpace(request.LegacyMemberNo))
                {
                    member.LegacyMemberNo = request.LegacyMemberNo.Trim();
                    _context.Entry(member).State = EntityState.Modified;
                }

                // Assign official Member Code (MEM0001 format) upon Share Allotment if missing
                if (string.IsNullOrWhiteSpace(member.MemberCode) || member.MemberCode.StartsWith("TEMP", StringComparison.OrdinalIgnoreCase))
                {
                    var existingCodes = await _context.Members
                        .AsNoTracking()
                        .Where(m => !string.IsNullOrEmpty(m.MemberCode))
                        .Select(m => m.MemberCode)
                        .ToListAsync();

                    int maxCodeNum = 0;
                    foreach (var code in existingCodes)
                    {
                        if (string.IsNullOrEmpty(code)) continue;
                        var trimmed = code.Trim();
                        if (trimmed.StartsWith("MEM", StringComparison.OrdinalIgnoreCase))
                        {
                            var digits = new string(trimmed.Substring(3).Where(char.IsDigit).ToArray());
                            if (int.TryParse(digits, out int num) && num > maxCodeNum) maxCodeNum = num;
                        }
                    }

                    int nextNum = maxCodeNum + 1;
                    string candidateCode = $"MEM{nextNum:D4}";
                    while (existingCodes.Any(c => string.Equals(c, candidateCode, StringComparison.OrdinalIgnoreCase)))
                    {
                        nextNum++;
                        candidateCode = $"MEM{nextNum:D4}";
                    }

                    member.MemberCode = candidateCode;
                    member.MembershipType = "Regular";
                    _context.Entry(member).State = EntityState.Modified;
                }

                // 1. Get or Create ShareAccount
                var account = await _context.ShareAccounts
                    .FirstOrDefaultAsync(s => s.MemberId == request.MemberId);

                if (account == null)
                {
                    int nextSeq = await _context.ShareAccounts.CountAsync() + 1;
                    account = new ShareAccount
                    {
                        MemberId = request.MemberId,
                        CustomerID = member.CustomerID ?? member.MemberID,
                        AccountNo = $"SH-{nextSeq:D4}",
                        TotalShareCount = 0,
                        TotalShareAmount = 0
                    };
                    _context.ShareAccounts.Add(account);
                    await _context.SaveChangesAsync(); // Save to get ShareAccountId
                }

                // 2. Determine Share Range
                int maxShareNo = await _context.ShareCertificates.MaxAsync(c => (int?)c.ToShareNo) ?? 0;
                int startShareNo = maxShareNo + 1;
                int endShareNo = maxShareNo + request.NumberOfShares;

                int certCount = await _context.ShareCertificates.CountAsync() + 1;
                string certNo = $"CERT-{DateTime.Today.Year}-{certCount:D5}";

                // 3. Create ShareCertificate
                var certificate = new ShareCertificate
                {
                    ShareAccountId = account.ShareAccountId,
                    CustomerID = member.CustomerID ?? (account.Member != null ? account.Member.CustomerID ?? account.MemberId : member.MemberID),
                    CertificateNo = certNo,
                    FromShareNo = startShareNo,
                    ToShareNo = endShareNo,
                    NumberOfShares = request.NumberOfShares,
                    FaceValue = faceValue
                };
                _context.ShareCertificates.Add(certificate);

                // 4. Create Voucher (Resolved dynamically via ShareSchemeMaster & ShareLedgerHelper)
                var shareCapitalLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context, request.ShareSchemeId);

                // Process Payment Mode (Cash, Transfer, Bank)
                SavingAccountMaster? savingAccount = null;
                if (request.PaymentMode == "Transfer")
                {
                    if (!request.SavingAccountId.HasValue)
                    {
                        return BadRequest("हस्तांतरणासाठी सभासदाचे बचत खाते निवडणे आवश्यक आहे.");
                    }

                    savingAccount = await _context.SavingAccountMasters.FindAsync(request.SavingAccountId.Value);
                    if (savingAccount == null || savingAccount.MemberID != request.MemberId)
                    {
                        return BadRequest("निवडलेले बचत खाते अमान्य किंवा या सभासदाचे नाही.");
                    }

                    if (savingAccount.Status == "Closed" || savingAccount.Status == "Frozen" || savingAccount.Status == "Dormant")
                    {
                        return BadRequest($"बचत खाते {savingAccount.Status} (फ्रीझ/सुप्त) असल्याने यातून हस्तांतरण करता येणार नाही.");
                    }

                    decimal availableBalance = savingAccount.CurrentBalance - savingAccount.LienAmount - savingAccount.MinimumBalance;
                    if (availableBalance < totalAmount)
                    {
                        return BadRequest($"बचत खात्यामध्ये अपुरी शिल्लक आहे. (उपलब्ध शिल्लक: ₹{availableBalance:N2}, आवश्यक रक्कम: ₹{totalAmount:N2})");
                    }

                    // Deduct from saving account
                    savingAccount.CurrentBalance -= totalAmount;
                    _context.Entry(savingAccount).State = EntityState.Modified;

                    // Create SavingTransaction Withdrawal
                    var (userId, _, _) = GetCurrentUserContext();
                    var savingTxn = new SavingTransaction
                    {
                        SavingAccountID = savingAccount.SavingAccountID,
                        CustomerID = savingAccount.CustomerID,
                        TransactionDate = DateTime.Today,
                        TransactionType = "Withdrawal",
                        PaymentMode = "Transfer",
                        Amount = totalAmount,
                        BalanceAfterTxn = savingAccount.CurrentBalance,
                        Narration = $"शेअर खरेदी (Share Purchase) - Cert: {certNo}",
                        CreatedBy = userId,
                        CreatedOn = DateTime.Now
                    };
                    _context.SavingTransactions.Add(savingTxn);
                }

                // 4. Determine Debit Ledger for Voucher
                int debitLedgerId;
                if (request.PaymentMode == "Transfer" && savingAccount != null)
                {
                    debitLedgerId = savingAccount.LedgerID;
                }
                else if (request.PaymentMode == "Bank" && request.BankLedgerId.HasValue)
                {
                    debitLedgerId = request.BankLedgerId.Value;
                }
                else if ((request.PaymentMode == "LedgerTransfer" || request.PaymentMode == "Cash") && request.SourceLedgerId.HasValue && request.SourceLedgerId.Value > 0)
                {
                    debitLedgerId = request.SourceLedgerId.Value;
                }
                else if (request.CashLedgerId.HasValue && request.CashLedgerId.Value > 0)
                {
                    debitLedgerId = request.CashLedgerId.Value;
                }
                else
                {
                    debitLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.BranchId, "SHARE");
                }

                var voucherDate = DateTime.Today;
                int vchCount = await _context.Vouchers.CountAsync() + 1;

                var (actionUserId, _, _) = GetCurrentUserContext();
                
                // Build dynamic multi-split voucher details (Share Capital + Entrance Fee + Building Fund)
                var voucherDetailsList = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = debitLedgerId, DrCr = "Dr", Amount = totalAmount },
                    new VoucherDetail { LedgerID = shareCapitalLedger.LedgerID, DrCr = "Cr", Amount = shareCapitalAmount }
                };

                if (admissionFee > 0)
                {
                    var entranceFeeLedger = await Helpers.ShareLedgerHelper.GetEntranceFeeLedgerAsync(_context, request.ShareSchemeId);
                    voucherDetailsList.Add(new VoucherDetail { LedgerID = entranceFeeLedger.LedgerID, DrCr = "Cr", Amount = admissionFee });
                }

                if (buildingFund > 0)
                {
                    var buildingFundLedger = await Helpers.ShareLedgerHelper.GetBuildingFundLedgerAsync(_context, request.ShareSchemeId);
                    voucherDetailsList.Add(new VoucherDetail { LedgerID = buildingFundLedger.LedgerID, DrCr = "Cr", Amount = buildingFund });
                }

                var voucher = new Voucher
                {
                    BranchID = request.BranchId,
                    VoucherNo = $"VCH-SHR-{voucherDate:yyyyMMdd}-{vchCount:D4}",
                    VoucherDate = voucherDate,
                    VoucherType = (request.PaymentMode == "Transfer" || request.PaymentMode == "LedgerTransfer") ? "Journal" : "Receipt",
                    TotalAmount = totalAmount,
                    Narration = $"Share Allotment ({request.PaymentMode}) for {member.FirstName} {member.LastName}. Cert: {certNo}. {request.Narration}",
                    Status = "Approved",
                    CreatedBy = actionUserId,
                    VoucherDetails = voucherDetailsList
                };
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync(); // Get VoucherId

                // 5. Create ShareTransaction
                var shareTxn = new ShareTransaction
                {
                    ShareAccountId = account.ShareAccountId,
                    CustomerID = member.CustomerID ?? (account.Member != null ? account.Member.CustomerID ?? account.MemberId : member.MemberID),
                    TransactionType = "Allotment",
                    NumberOfShares = request.NumberOfShares,
                    Amount = shareCapitalAmount,
                    Narration = request.Narration,
                    VoucherId = voucher.VoucherID
                };
                _context.ShareTransactions.Add(shareTxn);

                // 6. Update ShareAccount Totals
                account.TotalShareCount += request.NumberOfShares;
                account.TotalShareAmount += shareCapitalAmount;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new 
                { 
                    message = "Shares successfully allotted.", 
                    certificateNo = certNo,
                    accountNo = account.AccountNo,
                    voucherNo = voucher.VoucherNo
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        public class WithdrawalRequest
        {
            public int MemberId { get; set; }
            public int NumberOfShares { get; set; }
            public int BranchId { get; set; } = 1;
            public string Narration { get; set; } = "Share Withdrawal";
            public string PaymentMode { get; set; } = "Cash"; // "Cash", "Transfer", "Bank", "LedgerTransfer"
            public int? SavingAccountId { get; set; }
            public int? BankLedgerId { get; set; }
            public int? SourceLedgerId { get; set; }
            public int? CashLedgerId { get; set; }
            public string? ChequeNo { get; set; }
        }

        // POST: api/ShareAccounts/Withdraw
        [HttpPost("Withdraw")]
        public async Task<IActionResult> WithdrawShares([FromBody] WithdrawalRequest request)
        {
            if (request.NumberOfShares <= 0) return BadRequest("Number of shares must be greater than zero.");

            decimal faceValue = 100M;
            decimal totalAmount = request.NumberOfShares * faceValue;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var member = await _context.Members.FindAsync(request.MemberId);
                if (member == null) return NotFound("Member not found.");

                var account = await _context.ShareAccounts
                    .Include(s => s.Certificates)
                    .FirstOrDefaultAsync(s => s.MemberId == request.MemberId);

                if (account == null) return NotFound("Share account not found for this member.");

                if (account.TotalShareCount < request.NumberOfShares)
                {
                    return BadRequest($"Insufficient shares. Available: {account.TotalShareCount}");
                }

                // Create Voucher (Resolved dynamically via ShareSchemeMaster & ShareLedgerHelper)
                var shareCapitalLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);

                // Process Payment Mode (Cash, Transfer, Bank)
                SavingAccountMaster? savingAccount = null;
                if (request.PaymentMode == "Transfer")
                {
                    if (!request.SavingAccountId.HasValue)
                    {
                        return BadRequest("हस्तांतरणासाठी सभासदाचे बचत खाते निवडणे आवश्यक आहे.");
                    }

                    savingAccount = await _context.SavingAccountMasters.FindAsync(request.SavingAccountId.Value);
                    if (savingAccount == null || savingAccount.MemberID != request.MemberId)
                    {
                        return BadRequest("निवडलेले बचत खाते अमान्य किंवा या सभासदाचे नाही.");
                    }

                    if (savingAccount.Status == "Closed" || savingAccount.Status == "Frozen")
                    {
                        return BadRequest($"बचत खाते {savingAccount.Status} असल्याने यावर रक्कम जमा करता येणार नाही.");
                    }

                    // Deposit refund amount into saving account
                    savingAccount.CurrentBalance += totalAmount;
                    _context.Entry(savingAccount).State = EntityState.Modified;

                    // Create SavingTransaction Deposit
                    var (userId, _, _) = GetCurrentUserContext();
                    var savingTxn = new SavingTransaction
                    {
                        SavingAccountID = savingAccount.SavingAccountID,
                        CustomerID = savingAccount.CustomerID,
                        TransactionDate = DateTime.Today,
                        TransactionType = "Deposit",
                        PaymentMode = "Transfer",
                        Amount = totalAmount,
                        BalanceAfterTxn = savingAccount.CurrentBalance,
                        Narration = $"शेअर परतावा जमा (Share Refund Transfer)",
                        CreatedBy = userId,
                        CreatedOn = DateTime.Now
                    };
                    _context.SavingTransactions.Add(savingTxn);
                }

                // Determine Credit Ledger for Voucher
                int creditLedgerId;
                if (request.PaymentMode == "Transfer" && savingAccount != null)
                {
                    creditLedgerId = savingAccount.LedgerID;
                }
                else if (request.PaymentMode == "Bank" && request.BankLedgerId.HasValue)
                {
                    creditLedgerId = request.BankLedgerId.Value;
                }
                else if ((request.PaymentMode == "LedgerTransfer" || request.PaymentMode == "Cash") && request.SourceLedgerId.HasValue && request.SourceLedgerId.Value > 0)
                {
                    creditLedgerId = request.SourceLedgerId.Value;
                }
                else if (request.CashLedgerId.HasValue && request.CashLedgerId.Value > 0)
                {
                    creditLedgerId = request.CashLedgerId.Value;
                }
                else
                {
                    creditLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.BranchId, "SHARE");
                }

                var voucherDate = DateTime.Today;
                int vchCount = await _context.Vouchers.CountAsync() + 1;

                var (actionUserId, _, _) = GetCurrentUserContext();
                var voucher = new Voucher
                {
                    BranchID = request.BranchId,
                    VoucherNo = $"VCH-SHR-WD-{voucherDate:yyyyMMdd}-{vchCount:D4}",
                    VoucherDate = voucherDate,
                    VoucherType = (request.PaymentMode == "Transfer" || request.PaymentMode == "LedgerTransfer") ? "Journal" : "Payment",
                    TotalAmount = totalAmount,
                    Narration = $"Share Withdrawal ({request.PaymentMode}) for {member.FirstName} {member.LastName}. {request.Narration}",
                    Status = "Approved",
                    CreatedBy = actionUserId,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        // Share Capital decreases -> Debit
                        new VoucherDetail { LedgerID = shareCapitalLedger.LedgerID, DrCr = "Dr", Amount = totalAmount },
                        // Cash / Saving / Bank -> Credit
                        new VoucherDetail { LedgerID = creditLedgerId, DrCr = "Cr", Amount = totalAmount }
                    }
                };
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // Create Transaction
                var shareTxn = new ShareTransaction
                {
                    ShareAccountId = account.ShareAccountId,
                    CustomerID = member.CustomerID ?? (account.Member != null ? account.Member.CustomerID ?? account.MemberId : member.MemberID),
                    TransactionType = "Withdrawal",
                    NumberOfShares = request.NumberOfShares,
                    Amount = totalAmount, // or -totalAmount depending on convention
                    Narration = request.Narration,
                    VoucherId = voucher.VoucherID
                };
                _context.ShareTransactions.Add(shareTxn);

                // Update Account Totals
                account.TotalShareCount -= request.NumberOfShares;
                account.TotalShareAmount -= totalAmount;

                // Handle Certificates (Simplified: Just mark some as Surrendered if they match, or don't manage certificate granularly for now)
                // For a robust system, we would ask WHICH certificates are being surrendered.
                // Here we simply decrease the total balance.
                
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new 
                { 
                    message = "Shares successfully withdrawn.", 
                    accountNo = account.AccountNo,
                    voucherNo = voucher.VoucherNo
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        public class ShareOpeningBalanceDto
        {
            public int ShareAccountId { get; set; }
            public int CertificateId { get; set; }
            public int MemberId { get; set; }
            public string AccountNo { get; set; } = string.Empty;
            public string MemberNo { get; set; } = string.Empty;
            public string? LegacyMemberNo { get; set; }
            public string MemberName { get; set; } = string.Empty;
            public string CIFNo { get; set; } = string.Empty;
            public DateTime OpeningDate { get; set; }
            public int ShareQuantity { get; set; }
            public decimal FaceValue { get; set; }
            public decimal ShareAmount { get; set; }
            public decimal DividendPayable { get; set; }
            public string? CertificateNo { get; set; }
            public long FromShareNo { get; set; }
            public long ToShareNo { get; set; }
        }

        // GET: api/ShareAccounts/OpeningBalance
        [AllowAnonymous]
        [HttpGet("OpeningBalance")]
        public async Task<IActionResult> GetOpeningBalances()
        {
            try
            {
                var accounts = await _context.ShareAccounts
                    .Include(s => s.Member)
                    .Include(s => s.Certificates)
                    .Include(s => s.Transactions)
                    .Where(s => s.TotalShareCount > 0)
                    .ToListAsync();

                var balances = new List<ShareOpeningBalanceDto>();

                foreach (var s in accounts)
                {
                    string memberNo = !string.IsNullOrWhiteSpace(s.Member?.MemberCode)
                        ? s.Member.MemberCode.Trim()
                        : $"MEM{s.MemberId:D4}";

                    var opCerts = s.Certificates?
                        .Where(c => c.Status == "OpeningBalance" || string.IsNullOrEmpty(c.Status) || c.Status == "Active")
                        .OrderBy(c => c.CertificateId)
                        .ToList() ?? new List<ShareCertificate>();

                    // If account has certificates, list EACH certificate so user can see, edit, and delete any duplicate/individual entry
                    if (opCerts.Any())
                    {
                        for (int i = 0; i < opCerts.Count; i++)
                        {
                            var cert = opCerts[i];
                            int shareQuantity = cert.NumberOfShares;
                            decimal faceValue = cert.FaceValue > 0 ? cert.FaceValue : 100M;
                            decimal shareAmount = shareQuantity * faceValue;
                            DateTime openingDate = cert.IssueDate != DateTime.MinValue && cert.IssueDate.Year > 1900
                                ? cert.IssueDate
                                : s.OpeningDate;

                            // Attach dividend payable to the primary entry of the account
                            decimal divPayable = (i == 0) ? s.DividendPayableBalance : 0;

                            balances.Add(new ShareOpeningBalanceDto
                            {
                                ShareAccountId = s.ShareAccountId,
                                CertificateId = cert.CertificateId,
                                MemberId = s.MemberId,
                                AccountNo = s.AccountNo,
                                MemberNo = memberNo,
                                LegacyMemberNo = s.Member?.LegacyMemberNo,
                                MemberName = $"{s.Member?.FirstName} {s.Member?.LastName}".Trim(),
                                CIFNo = s.Member?.CIFNo ?? "",
                                OpeningDate = openingDate,
                                ShareQuantity = shareQuantity,
                                FaceValue = faceValue,
                                ShareAmount = shareAmount,
                                DividendPayable = divPayable,
                                CertificateNo = cert.CertificateNo,
                                FromShareNo = cert.FromShareNo,
                                ToShareNo = cert.ToShareNo
                            });
                        }
                    }
                    else
                    {
                        // Fallback for direct / legacy accounts without certificates
                        var opTxns = s.Transactions?
                            .Where(t => t.TransactionType == "OpeningBalance")
                            .OrderBy(t => t.TransactionId)
                            .ToList() ?? new List<ShareTransaction>();

                        if (opTxns.Any())
                        {
                            for (int i = 0; i < opTxns.Count; i++)
                            {
                                var txn = opTxns[i];
                                int shareQuantity = txn.NumberOfShares;
                                decimal shareAmount = txn.Amount;
                                decimal faceValue = shareQuantity > 0 ? shareAmount / shareQuantity : 100M;
                                DateTime openingDate = txn.TransactionDate;
                                decimal divPayable = (i == 0) ? s.DividendPayableBalance : 0;

                                balances.Add(new ShareOpeningBalanceDto
                                {
                                    ShareAccountId = s.ShareAccountId,
                                    CertificateId = 0,
                                    MemberId = s.MemberId,
                                    AccountNo = s.AccountNo,
                                    MemberNo = memberNo,
                                    LegacyMemberNo = s.Member?.LegacyMemberNo,
                                    MemberName = $"{s.Member?.FirstName} {s.Member?.LastName}".Trim(),
                                    CIFNo = s.Member?.CIFNo ?? "",
                                    OpeningDate = openingDate,
                                    ShareQuantity = shareQuantity,
                                    FaceValue = faceValue,
                                    ShareAmount = shareAmount,
                                    DividendPayable = divPayable,
                                    CertificateNo = s.AccountNo,
                                    FromShareNo = 0,
                                    ToShareNo = 0
                                });
                            }
                        }
                        else
                        {
                            balances.Add(new ShareOpeningBalanceDto
                            {
                                ShareAccountId = s.ShareAccountId,
                                CertificateId = 0,
                                MemberId = s.MemberId,
                                AccountNo = s.AccountNo,
                                MemberNo = memberNo,
                                LegacyMemberNo = s.Member?.LegacyMemberNo,
                                MemberName = $"{s.Member?.FirstName} {s.Member?.LastName}".Trim(),
                                CIFNo = s.Member?.CIFNo ?? "",
                                OpeningDate = s.OpeningDate,
                                ShareQuantity = s.TotalShareCount,
                                FaceValue = s.TotalShareCount > 0 ? s.TotalShareAmount / s.TotalShareCount : 100M,
                                ShareAmount = s.TotalShareAmount,
                                DividendPayable = s.DividendPayableBalance,
                                CertificateNo = s.AccountNo,
                                FromShareNo = 0,
                                ToShareNo = 0
                            });
                        }
                    }
                }

                return Ok(balances);
            }
            catch (Exception ex)
            {
                // Return empty list safely on initial/empty database state rather than throwing 500 error
                return Ok(new List<ShareOpeningBalanceDto>());
            }
        }

        public class ShareOpeningBalanceRequest
        {
            public int? CertificateId { get; set; }
            public int MemberId { get; set; }
            public int? ShareSchemeId { get; set; }
            public string? LegacyMemberNo { get; set; }
            public DateTime OpeningDate { get; set; }
            public int ShareQuantity { get; set; }
            public decimal FaceValue { get; set; }
            public decimal DividendPayable { get; set; }
            public int FromShareNo { get; set; }
            public int ToShareNo { get; set; }
            public string? CertificateNo { get; set; }
            public int? LedgerId { get; set; }
            public int? DividendPayableLedgerId { get; set; }
        }

        [AllowAnonymous]
        [HttpGet("NextShareConfig")]
        public async Task<IActionResult> GetNextShareConfig()
        {
            try
            {
                var nextCertCount = await _context.ShareCertificates.CountAsync() + 1;
                var maxToShareNo = await _context.ShareCertificates.MaxAsync(c => (int?)c.ToShareNo) ?? 0;
                var nextFromShareNo = maxToShareNo + 1;

                var shareholderCodes = await _context.Members
                    .AsNoTracking()
                    .Where(m => !string.IsNullOrEmpty(m.MemberCode) && 
                               _context.ShareAccounts.Any(sa => sa.MemberId == m.MemberID))
                    .Select(m => m.MemberCode)
                    .ToListAsync();

                int maxCodeNum = 0;
                foreach (var code in shareholderCodes)
                {
                    if (string.IsNullOrEmpty(code)) continue;
                    var trimmed = code.Trim();
                    if (trimmed.StartsWith("MEM", StringComparison.OrdinalIgnoreCase))
                    {
                        var digits = new string(trimmed.Substring(3).Where(char.IsDigit).ToArray());
                        if (int.TryParse(digits, out int num) && num > maxCodeNum) maxCodeNum = num;
                    }
                }

                if (maxCodeNum == 0)
                {
                    maxCodeNum = await _context.ShareAccounts.CountAsync();
                }

                int nextNum = maxCodeNum + 1;
                string nextMemberCode = $"MEM{nextNum:D4}";
                var allMemberCodes = await _context.Members
                    .AsNoTracking()
                    .Where(m => !string.IsNullOrEmpty(m.MemberCode))
                    .Select(m => m.MemberCode)
                    .ToListAsync();

                var codeSet = new HashSet<string>(allMemberCodes.Where(c => !string.IsNullOrWhiteSpace(c))!, StringComparer.OrdinalIgnoreCase);
                while (codeSet.Contains(nextMemberCode))
                {
                    nextNum++;
                    nextMemberCode = $"MEM{nextNum:D4}";
                }

                var lastCert = await _context.ShareCertificates
                    .OrderByDescending(c => c.CertificateId)
                    .Select(c => c.CertificateNo)
                    .FirstOrDefaultAsync();

                string nextCertStr = $"CERT-{nextCertCount:D4}";
                if (!string.IsNullOrEmpty(lastCert))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(lastCert, @"^(.*?)(0*)(\d+)$");
                    if (match.Success)
                    {
                        string prefix = match.Groups[1].Value;
                        int padLen = match.Groups[2].Value.Length + match.Groups[3].Value.Length;
                        nextCertStr = $"{prefix}{nextCertCount.ToString($"D{padLen}")}";
                    }
                }

                return Ok(new
                {
                    nextCertificateNo = nextCertStr,
                    nextFromShareNo = nextFromShareNo,
                    nextMemberCode = nextMemberCode
                });
            }
            catch (Exception ex)
            {
                return Ok(new
                {
                    nextCertificateNo = "CERT-0001",
                    nextFromShareNo = 1,
                    nextMemberCode = "MEM0001"
                });
            }
        }

        // POST: api/ShareAccounts/OpeningBalance
        [AllowAnonymous]
        [HttpPost("OpeningBalance")]
        public async Task<IActionResult> CreateOpeningBalance([FromBody] ShareOpeningBalanceRequest request)
        {
            if (request.ShareQuantity <= 0) return BadRequest("Share quantity must be greater than zero.");
            if (request.FaceValue <= 0) return BadRequest("Face value must be greater than zero.");
            if (!request.LedgerId.HasValue || request.LedgerId.Value <= 0)
            {
                return BadRequest("कृपया शेअर भांडवल लेजर (Capital Ledger) निवडा. लेजर निवडल्याशिवाय शेअर ओपनिंग बॅलन्स सेव्ह करता येत नाही.");
            }

            decimal totalAmount = request.ShareQuantity * request.FaceValue;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var member = await _context.Members.FindAsync(request.MemberId);
                if (member == null)
                {
                    var cust = await _context.Customers.FindAsync(request.MemberId);
                    if (cust != null)
                    {
                        member = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == cust.CustomerID);
                        if (member == null)
                        {
                            member = new Member
                            {
                                BranchID = cust.BranchID,
                                CustomerID = cust.CustomerID,
                                CIFNo = cust.CIFNo,
                                OldMemberCode = cust.LegacyCustomerNo,
                                LegacyMemberNo = request.LegacyMemberNo ?? cust.LegacyCustomerNo,
                                FirstName = cust.FirstName,
                                MiddleName = cust.MiddleName,
                                LastName = cust.LastName,
                                NickName = cust.NickName,
                                FirstNameEng = cust.FirstNameEng,
                                MiddleNameEng = cust.MiddleNameEng,
                                LastNameEng = cust.LastNameEng,
                                Address = cust.Address,
                                AddressEng = cust.AddressEng,
                                Village = cust.Village,
                                Taluka = cust.Taluka,
                                District = cust.District,
                                MobileNo = cust.MobileNo,
                                AadhaarNo = cust.AadhaarNo,
                                PANNo = cust.PANNo,
                                Gender = cust.Gender,
                                BirthDate = cust.BirthDate,
                                Occupation = cust.Occupation,
                                CasteCategory = cust.CasteCategory,
                                Caste = cust.Caste,
                                Email = cust.Email,
                                JoiningDate = request.OpeningDate,
                                MembershipType = "Regular",
                                Status = "Active"
                            };
                            _context.Members.Add(member);
                            await _context.SaveChangesAsync();
                        }
                        request.MemberId = member.MemberID;
                    }
                }
                if (member == null) return NotFound("Member not found.");

                // Update Old ID (LegacyMemberNo) if entered by user with strict duplicate prevention
                if (!string.IsNullOrWhiteSpace(request.LegacyMemberNo))
                {
                    var trimmedLegacyNo = request.LegacyMemberNo.Trim();
                    var existingLegacyMember = await _context.Members
                        .AsNoTracking()
                        .FirstOrDefaultAsync(m => m.MemberID != member.MemberID && !m.IsDeleted &&
                            (m.LegacyMemberNo == trimmedLegacyNo || m.OldMemberCode == trimmedLegacyNo));
                    if (existingLegacyMember != null)
                    {
                        return BadRequest($"हा जुना सभासद आयडी ({trimmedLegacyNo}) आधीच सभासद '{existingLegacyMember.FirstName} {existingLegacyMember.LastName}' (कोड: {existingLegacyMember.MemberCode ?? existingLegacyMember.MemberID.ToString()}) साठी नोंदवला आहे.");
                    }
                    member.LegacyMemberNo = trimmedLegacyNo;
                    member.OldMemberCode = trimmedLegacyNo;
                    _context.Entry(member).State = EntityState.Modified;
                }

                // Assign official Member Code (MEM0001 format) upon Share Opening Balance if missing
                if (string.IsNullOrWhiteSpace(member.MemberCode) || member.MemberCode.StartsWith("TEMP", StringComparison.OrdinalIgnoreCase))
                {
                    var existingCodes = await _context.Members
                        .AsNoTracking()
                        .Where(m => !string.IsNullOrEmpty(m.MemberCode))
                        .Select(m => m.MemberCode)
                        .ToListAsync();

                    int maxCodeNum = 0;
                    foreach (var code in existingCodes)
                    {
                        if (string.IsNullOrEmpty(code)) continue;
                        var trimmed = code.Trim();
                        if (trimmed.StartsWith("MEM", StringComparison.OrdinalIgnoreCase))
                        {
                            var digits = new string(trimmed.Substring(3).Where(char.IsDigit).ToArray());
                            if (int.TryParse(digits, out int num) && num > maxCodeNum) maxCodeNum = num;
                        }
                    }

                    int nextNum = maxCodeNum + 1;
                    string candidateCode = $"MEM{nextNum:D4}";
                    while (existingCodes.Any(c => string.Equals(c, candidateCode, StringComparison.OrdinalIgnoreCase)))
                    {
                        nextNum++;
                        candidateCode = $"MEM{nextNum:D4}";
                    }

                    member.MemberCode = candidateCode;
                    member.MembershipType = "Regular";
                    _context.Entry(member).State = EntityState.Modified;
                }

                // Check if account already exists
                var account = await _context.ShareAccounts
                    .Include(s => s.Certificates)
                    .Include(s => s.Transactions)
                    .FirstOrDefaultAsync(s => s.MemberId == request.MemberId);

                if (account == null)
                {
                    int nextSeq = await _context.ShareAccounts.CountAsync() + 1;
                    account = new ShareAccount
                    {
                        MemberId = request.MemberId,
                        CustomerID = member.CustomerID ?? member.MemberID,
                        AccountNo = $"SH-{nextSeq:D4}",
                        TotalShareCount = request.ShareQuantity,
                        TotalShareAmount = totalAmount,
                        DividendPayableBalance = request.DividendPayable,
                        OpeningDate = request.OpeningDate,
                        Status = "Active"
                    };
                    _context.ShareAccounts.Add(account);
                    await _context.SaveChangesAsync();
                }

                // Auto-generate CertificateNo if empty
                var certNo = string.IsNullOrWhiteSpace(request.CertificateNo) 
                    ? $"CERT-{(await _context.ShareCertificates.CountAsync() + 1):D4}" 
                    : request.CertificateNo.Trim();

                // Auto-generate Share Nos if not provided
                int fromShareNo = request.FromShareNo;
                int toShareNo = request.ToShareNo;

                if (fromShareNo <= 0)
                {
                    var maxToShareNo = await _context.ShareCertificates.MaxAsync(c => (int?)c.ToShareNo) ?? 0;
                    fromShareNo = maxToShareNo + 1;
                    toShareNo = fromShareNo + request.ShareQuantity - 1;
                }

                // Check if an opening certificate with this certificate number or ID already exists on this account
                ShareCertificate? cert = null;
                if (request.CertificateId.HasValue && request.CertificateId.Value > 0)
                {
                    cert = await _context.ShareCertificates.FindAsync(request.CertificateId.Value);
                }
                if (cert == null && !string.IsNullOrWhiteSpace(certNo))
                {
                    cert = account.Certificates?.FirstOrDefault(c => c.CertificateNo == certNo);
                }

                if (cert == null)
                {
                    cert = new ShareCertificate
                    {
                        ShareAccountId = account.ShareAccountId,
                        CustomerID = member.CustomerID ?? (account.Member != null ? account.Member.CustomerID ?? account.MemberId : member.MemberID),
                        CertificateNo = certNo,
                        NumberOfShares = request.ShareQuantity,
                        FaceValue = request.FaceValue,
                        FromShareNo = fromShareNo,
                        ToShareNo = toShareNo,
                        Status = "OpeningBalance",
                        CreatedDate = DateTime.Now
                    };
                    _context.ShareCertificates.Add(cert);

                    var shareTxn = new ShareTransaction
                    {
                        ShareAccountId = account.ShareAccountId,
                        CustomerID = member.CustomerID ?? (account.Member != null ? account.Member.CustomerID ?? account.MemberId : member.MemberID),
                        TransactionType = "OpeningBalance",
                        TransactionDate = request.OpeningDate,
                        NumberOfShares = request.ShareQuantity,
                        Amount = totalAmount,
                        Narration = $"Opening Balance - Cert: {certNo}"
                    };
                    _context.ShareTransactions.Add(shareTxn);
                }
                else
                {
                    cert.NumberOfShares = request.ShareQuantity;
                    cert.FaceValue = request.FaceValue;
                    cert.FromShareNo = fromShareNo;
                    cert.ToShareNo = toShareNo;
                    cert.CertificateNo = certNo;
                    cert.Status = "OpeningBalance";
                    _context.ShareCertificates.Update(cert);

                    var matchingTxn = account.Transactions?.FirstOrDefault(t => t.TransactionType == "OpeningBalance");
                    if (matchingTxn != null)
                    {
                        matchingTxn.NumberOfShares = request.ShareQuantity;
                        matchingTxn.Amount = totalAmount;
                        matchingTxn.TransactionDate = request.OpeningDate;
                        _context.ShareTransactions.Update(matchingTxn);
                    }
                }

                await _context.SaveChangesAsync();

                // Re-calculate account total shares from certificates
                var allCerts = await _context.ShareCertificates
                    .Where(c => c.ShareAccountId == account.ShareAccountId && (c.Status == "OpeningBalance" || c.Status == "Active" || string.IsNullOrEmpty(c.Status)))
                    .ToListAsync();

                account.TotalShareCount = allCerts.Sum(c => c.NumberOfShares);
                account.TotalShareAmount = allCerts.Sum(c => c.NumberOfShares * c.FaceValue);
                account.DividendPayableBalance = request.DividendPayable;
                account.OpeningDate = request.OpeningDate;
                _context.ShareAccounts.Update(account);

                // Reconcile MemberOpeningBalances for Share Capital
                Ledger? shareCapitalLedger = null;
                if (request.LedgerId.HasValue && request.LedgerId.Value > 0)
                {
                    shareCapitalLedger = await _context.Ledgers.FindAsync(request.LedgerId.Value);
                }
                if (shareCapitalLedger == null)
                {
                    shareCapitalLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context, request.ShareSchemeId);
                }

                if (shareCapitalLedger != null)
                {
                    var shareMobs = await _context.MemberOpeningBalances
                        .Where(m => m.MemberID == request.MemberId && m.LedgerID == shareCapitalLedger.LedgerID)
                        .ToListAsync();

                    if (!shareMobs.Any())
                    {
                        _context.MemberOpeningBalances.Add(new MemberOpeningBalance
                        {
                            MemberID = request.MemberId,
                            LedgerID = shareCapitalLedger.LedgerID,
                            Amount = account.TotalShareAmount,
                            BalanceType = "Cr",
                            CreatedOn = DateTime.Now
                        });
                    }
                    else
                    {
                        var primaryMob = shareMobs.First();
                        primaryMob.Amount = account.TotalShareAmount;
                        primaryMob.BalanceType = "Cr";
                        _context.MemberOpeningBalances.Update(primaryMob);

                        if (shareMobs.Count > 1)
                        {
                            _context.MemberOpeningBalances.RemoveRange(shareMobs.Skip(1));
                        }
                    }

                    await _context.SaveChangesAsync();

                    // Recalculate Share Capital Ledger Total
                    var totalObDr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == shareCapitalLedger.LedgerID && m.BalanceType == "Dr").SumAsync(m => m.Amount);
                    var totalObCr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == shareCapitalLedger.LedgerID && m.BalanceType == "Cr").SumAsync(m => m.Amount);
                    shareCapitalLedger.OpeningBalance = Math.Abs(totalObCr - totalObDr);
                    shareCapitalLedger.OpeningBalanceType = totalObCr >= totalObDr ? "Cr" : "Dr";
                    _context.Ledgers.Update(shareCapitalLedger);
                }

                // Reconcile Dividend Payable
                Ledger? dividendLedger = null;
                if (request.DividendPayableLedgerId.HasValue && request.DividendPayableLedgerId.Value > 0)
                {
                    dividendLedger = await _context.Ledgers.FindAsync(request.DividendPayableLedgerId.Value);
                }
                if (dividendLedger == null)
                {
                    dividendLedger = await Helpers.ShareLedgerHelper.GetDividendPayableLedgerAsync(_context, request.ShareSchemeId);
                }

                if (dividendLedger != null)
                {
                    var divMobs = await _context.MemberOpeningBalances
                        .Where(m => m.MemberID == request.MemberId && m.LedgerID == dividendLedger.LedgerID)
                        .ToListAsync();

                    if (request.DividendPayable > 0)
                    {
                        if (!divMobs.Any())
                        {
                            _context.MemberOpeningBalances.Add(new MemberOpeningBalance
                            {
                                MemberID = request.MemberId,
                                LedgerID = dividendLedger.LedgerID,
                                Amount = request.DividendPayable,
                                BalanceType = "Cr",
                                CreatedOn = DateTime.Now
                            });
                        }
                        else
                        {
                            var primaryDivMob = divMobs.First();
                            primaryDivMob.Amount = request.DividendPayable;
                            primaryDivMob.BalanceType = "Cr";
                            _context.MemberOpeningBalances.Update(primaryDivMob);

                            if (divMobs.Count > 1)
                            {
                                _context.MemberOpeningBalances.RemoveRange(divMobs.Skip(1));
                            }
                        }
                    }
                    else if (divMobs.Any())
                    {
                        _context.MemberOpeningBalances.RemoveRange(divMobs);
                    }

                    await _context.SaveChangesAsync();

                    var divTotalObDr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == dividendLedger.LedgerID && m.BalanceType == "Dr").SumAsync(m => m.Amount);
                    var divTotalObCr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == dividendLedger.LedgerID && m.BalanceType == "Cr").SumAsync(m => m.Amount);
                    dividendLedger.OpeningBalance = Math.Abs(divTotalObCr - divTotalObDr);
                    dividendLedger.OpeningBalanceType = divTotalObCr >= divTotalObDr ? "Cr" : "Dr";
                    _context.Ledgers.Update(dividendLedger);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { message = "Opening balance saved successfully.", accountId = account.ShareAccountId });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        public class BulkShareOpeningBalanceRequest
        {
            public List<ShareOpeningBalanceRequest> Records { get; set; } = new List<ShareOpeningBalanceRequest>();
            public int? DefaultLedgerId { get; set; }
        }

        // POST: api/ShareAccounts/BulkOpeningBalance
        [AllowAnonymous]
        [HttpPost("BulkOpeningBalance")]
        public async Task<IActionResult> CreateBulkOpeningBalance([FromBody] BulkShareOpeningBalanceRequest bulkRequest)
        {
            if (bulkRequest?.Records == null || bulkRequest.Records.Count == 0)
            {
                return BadRequest("कोणतीही नोंद पाठवली नाही (No records provided).");
            }

            var validRecords = bulkRequest.Records
                .Where(r => r.MemberId > 0 && r.ShareQuantity > 0 && r.FaceValue > 0)
                .ToList();

            if (validRecords.Count == 0)
            {
                return BadRequest("कृपया किमान एका वैध सभासदाची माहिती भरा (At least one valid record is required).");
            }

            if (!bulkRequest.DefaultLedgerId.HasValue || bulkRequest.DefaultLedgerId.Value <= 0)
            {
                if (validRecords.All(r => !r.LedgerId.HasValue || r.LedgerId.Value <= 0))
                {
                    return BadRequest("कृपया शेअर भांडवल लेजर (Capital Ledger) निवडा. लेजर निवडल्याशिवाय शेअर ओपनिंग बॅलन्स सेव्ह करता येत नाही.");
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var shareCapitalLedger = bulkRequest.DefaultLedgerId.HasValue 
                    ? await _context.Ledgers.FindAsync(bulkRequest.DefaultLedgerId.Value)
                    : await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);

                int processedCount = 0;
                var createdAccountIds = new List<int>();

                // Pre-load all members involved
                var memberIds = validRecords.Select(r => r.MemberId).Distinct().ToList();
                var membersDict = await _context.Members.Where(m => memberIds.Contains(m.MemberID)).ToDictionaryAsync(m => m.MemberID);

                foreach (var request in validRecords)
                {
                    if (!membersDict.TryGetValue(request.MemberId, out var member))
                    {
                        continue;
                    }

                    int resolvedCustomerId = member.CustomerID ?? 1;

                    if (!string.IsNullOrWhiteSpace(request.LegacyMemberNo))
                    {
                        member.LegacyMemberNo = request.LegacyMemberNo.Trim();
                        _context.Members.Update(member);
                    }

                    var account = await _context.ShareAccounts
                        .Include(a => a.Certificates)
                        .Include(a => a.Transactions)
                        .FirstOrDefaultAsync(s => s.MemberId == request.MemberId);

                    decimal currentCertAmount = request.ShareQuantity * request.FaceValue;
                    string certNo = !string.IsNullOrWhiteSpace(request.CertificateNo)
                        ? request.CertificateNo.Trim()
                        : $"SC{request.MemberId:D4}";

                    if (account == null)
                    {
                        account = new ShareAccount
                        {
                            MemberId = request.MemberId,
                            CustomerID = resolvedCustomerId,
                            AccountNo = $"SA{request.MemberId:D4}",
                            OpeningDate = request.OpeningDate,
                            TotalShareCount = request.ShareQuantity,
                            TotalShareAmount = currentCertAmount,
                            DividendPayableBalance = request.DividendPayable,
                            Status = "Active"
                        };
                        _context.ShareAccounts.Add(account);
                        await _context.SaveChangesAsync();

                        var cert = new ShareCertificate
                        {
                            ShareAccountId = account.ShareAccountId,
                            CustomerID = resolvedCustomerId,
                            CertificateNo = certNo,
                            FromShareNo = request.FromShareNo > 0 ? request.FromShareNo : 1,
                            ToShareNo = request.ToShareNo > 0 ? request.ToShareNo : request.ShareQuantity,
                            NumberOfShares = request.ShareQuantity,
                            FaceValue = request.FaceValue,
                            IssueDate = request.OpeningDate,
                            Status = "OpeningBalance",
                            CreatedBy = 1,
                            CreatedDate = DateTime.UtcNow
                        };
                        _context.ShareCertificates.Add(cert);

                        var txn = new ShareTransaction
                        {
                            ShareAccountId = account.ShareAccountId,
                            CustomerID = resolvedCustomerId,
                            TransactionDate = request.OpeningDate,
                            TransactionType = "OpeningBalance",
                            NumberOfShares = request.ShareQuantity,
                            Amount = currentCertAmount,
                            Narration = "शेअर आरंभी शिल्लक (Bulk Opening Balance)"
                        };
                        _context.ShareTransactions.Add(txn);
                    }
                    else
                    {
                        account.CustomerID = resolvedCustomerId;
                        ShareCertificate? cert = null;
                        if (request.CertificateId.HasValue && request.CertificateId.Value > 0)
                        {
                            cert = account.Certificates?.FirstOrDefault(c => c.CertificateId == request.CertificateId.Value);
                        }
                        if (cert == null)
                        {
                            cert = account.Certificates?.FirstOrDefault(c => c.CertificateNo == certNo);
                        }

                        if (cert == null)
                        {
                            cert = new ShareCertificate
                            {
                                ShareAccountId = account.ShareAccountId,
                                CustomerID = resolvedCustomerId,
                                CertificateNo = certNo,
                                FromShareNo = request.FromShareNo > 0 ? request.FromShareNo : 1,
                                ToShareNo = request.ToShareNo > 0 ? request.ToShareNo : request.ShareQuantity,
                                NumberOfShares = request.ShareQuantity,
                                FaceValue = request.FaceValue,
                                IssueDate = request.OpeningDate,
                                Status = "OpeningBalance",
                                CreatedBy = 1,
                                CreatedDate = DateTime.UtcNow
                            };
                            _context.ShareCertificates.Add(cert);

                            var txn = new ShareTransaction
                            {
                                ShareAccountId = account.ShareAccountId,
                                CustomerID = resolvedCustomerId,
                                TransactionDate = request.OpeningDate,
                                TransactionType = "OpeningBalance",
                                NumberOfShares = request.ShareQuantity,
                                Amount = currentCertAmount,
                                Narration = "शेअर आरंभी शिल्लक (Bulk Opening Balance)"
                            };
                            _context.ShareTransactions.Add(txn);
                        }
                        else
                        {
                            cert.CustomerID = resolvedCustomerId;
                            cert.CertificateNo = certNo;
                            cert.FromShareNo = request.FromShareNo > 0 ? request.FromShareNo : cert.FromShareNo;
                            cert.ToShareNo = request.ToShareNo > 0 ? request.ToShareNo : cert.ToShareNo;
                            cert.NumberOfShares = request.ShareQuantity;
                            cert.FaceValue = request.FaceValue;
                            cert.IssueDate = request.OpeningDate;
                            cert.Status = "OpeningBalance";
                            cert.ModifiedDate = DateTime.UtcNow;
                            _context.ShareCertificates.Update(cert);
                        }

                        await _context.SaveChangesAsync();

                        // Recalculate totals
                        var validCerts = await _context.ShareCertificates
                            .Where(c => c.ShareAccountId == account.ShareAccountId && (c.Status == "OpeningBalance" || c.Status == "Active" || string.IsNullOrEmpty(c.Status)))
                            .ToListAsync();

                        account.TotalShareCount = validCerts.Sum(c => c.NumberOfShares);
                        account.TotalShareAmount = validCerts.Sum(c => c.NumberOfShares * c.FaceValue);
                        account.DividendPayableBalance = request.DividendPayable;
                        _context.ShareAccounts.Update(account);
                    }

                    await _context.SaveChangesAsync();

                    // Reconcile MemberOpeningBalances for Share Capital
                    if (shareCapitalLedger != null)
                    {
                        var shareMobs = await _context.MemberOpeningBalances
                            .Where(m => m.MemberID == member.MemberID && m.LedgerID == shareCapitalLedger.LedgerID)
                            .ToListAsync();

                        var primaryMob = shareMobs.FirstOrDefault();
                        if (primaryMob == null)
                        {
                            _context.MemberOpeningBalances.Add(new MemberOpeningBalance
                            {
                                MemberID = member.MemberID,
                                LedgerID = shareCapitalLedger.LedgerID,
                                Amount = account.TotalShareAmount,
                                BalanceType = "Cr",
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            });
                        }
                        else
                        {
                            primaryMob.Amount = account.TotalShareAmount;
                            primaryMob.BalanceType = "Cr";
                            _context.MemberOpeningBalances.Update(primaryMob);
                            if (shareMobs.Count > 1)
                            {
                                _context.MemberOpeningBalances.RemoveRange(shareMobs.Skip(1));
                            }
                        }
                    }

                    processedCount++;
                    createdAccountIds.Add(account.ShareAccountId);
                }

                await _context.SaveChangesAsync();

                // Recalculate Share Capital Ledger Opening Balance
                if (shareCapitalLedger != null)
                {
                    var totalObDr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == shareCapitalLedger.LedgerID && m.BalanceType == "Dr").SumAsync(m => m.Amount);
                    var totalObCr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == shareCapitalLedger.LedgerID && m.BalanceType == "Cr").SumAsync(m => m.Amount);
                    shareCapitalLedger.OpeningBalance = Math.Abs(totalObCr - totalObDr);
                    shareCapitalLedger.OpeningBalanceType = totalObCr >= totalObDr ? "Cr" : "Dr";
                    _context.Ledgers.Update(shareCapitalLedger);
                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();
                return Ok(new { 
                    message = $"एकूण {processedCount} सभासदांचे शेअर ओपनिंग बॅलन्स यशस्वीरित्या सेव्ह झाले!",
                    count = processedCount,
                    accountIds = createdAccountIds 
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"बल्क सेव्ह करताना त्रुटी: {ex.Message}");
            }
        }

        // PUT: api/ShareAccounts/OpeningBalance/5
        [AllowAnonymous]
        [HttpPut("OpeningBalance/{id}")]
        public async Task<IActionResult> UpdateOpeningBalance(int id, [FromBody] ShareOpeningBalanceRequest request)
        {
            if (request.ShareQuantity <= 0) return BadRequest("Share quantity must be greater than zero.");
            if (request.FaceValue <= 0) return BadRequest("Face value must be greater than zero.");

            decimal newTotalAmount = request.ShareQuantity * request.FaceValue;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.ShareAccounts
                    .Include(s => s.Transactions)
                    .Include(s => s.Certificates)
                    .FirstOrDefaultAsync(s => s.ShareAccountId == id);

                if (account == null) return NotFound("Share account not found.");

                var member = await _context.Members.FindAsync(account.MemberId);
                if (member != null && !string.IsNullOrWhiteSpace(request.LegacyMemberNo))
                {
                    member.LegacyMemberNo = request.LegacyMemberNo.Trim();
                    _context.Entry(member).State = EntityState.Modified;
                }

                // Find certificate to update
                ShareCertificate? cert = null;
                if (request.CertificateId.HasValue && request.CertificateId.Value > 0)
                {
                    cert = account.Certificates?.FirstOrDefault(c => c.CertificateId == request.CertificateId.Value);
                }
                if (cert == null)
                {
                    cert = account.Certificates?.FirstOrDefault(c => c.Status == "OpeningBalance") 
                        ?? account.Certificates?.FirstOrDefault();
                }

                if (cert != null)
                {
                    cert.NumberOfShares = request.ShareQuantity;
                    cert.FaceValue = request.FaceValue;
                    if (request.FromShareNo > 0) cert.FromShareNo = request.FromShareNo;
                    if (request.ToShareNo > 0) cert.ToShareNo = request.ToShareNo;
                    else cert.ToShareNo = cert.FromShareNo + request.ShareQuantity - 1;
                    if (!string.IsNullOrWhiteSpace(request.CertificateNo)) cert.CertificateNo = request.CertificateNo.Trim();
                    cert.Status = "OpeningBalance";
                    _context.ShareCertificates.Update(cert);
                }

                var txn = account.Transactions?.FirstOrDefault(t => t.TransactionType == "OpeningBalance");
                if (txn != null)
                {
                    txn.NumberOfShares = request.ShareQuantity;
                    txn.Amount = newTotalAmount;
                    txn.TransactionDate = request.OpeningDate;
                    _context.ShareTransactions.Update(txn);
                }

                await _context.SaveChangesAsync();

                // Re-sum account totals
                var allCerts = await _context.ShareCertificates
                    .Where(c => c.ShareAccountId == account.ShareAccountId && (c.Status == "OpeningBalance" || c.Status == "Active" || string.IsNullOrEmpty(c.Status)))
                    .ToListAsync();

                account.TotalShareCount = allCerts.Any() ? allCerts.Sum(c => c.NumberOfShares) : request.ShareQuantity;
                account.TotalShareAmount = allCerts.Any() ? allCerts.Sum(c => c.NumberOfShares * c.FaceValue) : newTotalAmount;
                account.DividendPayableBalance = request.DividendPayable;
                account.OpeningDate = request.OpeningDate;
                _context.ShareAccounts.Update(account);

                // 1. Reconcile Share Capital Ledger and MemberOpeningBalances
                Ledger? shareCapitalLedger = null;
                if (request.LedgerId.HasValue && request.LedgerId.Value > 0)
                {
                    shareCapitalLedger = await _context.Ledgers.FindAsync(request.LedgerId.Value);
                }
                if (shareCapitalLedger == null)
                {
                    shareCapitalLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context, request.ShareSchemeId);
                }

                if (shareCapitalLedger != null)
                {
                    var mobs = await _context.MemberOpeningBalances
                        .Where(m => m.MemberID == account.MemberId && m.LedgerID == shareCapitalLedger.LedgerID)
                        .ToListAsync();

                    if (!mobs.Any())
                    {
                        _context.MemberOpeningBalances.Add(new MemberOpeningBalance
                        {
                            MemberID = account.MemberId,
                            LedgerID = shareCapitalLedger.LedgerID,
                            Amount = account.TotalShareAmount,
                            BalanceType = "Cr",
                            CreatedOn = DateTime.Now
                        });
                    }
                    else
                    {
                        var primaryMob = mobs.First();
                        primaryMob.Amount = account.TotalShareAmount;
                        primaryMob.BalanceType = "Cr";
                        _context.MemberOpeningBalances.Update(primaryMob);

                        if (mobs.Count > 1)
                        {
                            _context.MemberOpeningBalances.RemoveRange(mobs.Skip(1));
                        }
                    }

                    await _context.SaveChangesAsync();

                    var totalObDr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == shareCapitalLedger.LedgerID && m.BalanceType == "Dr").SumAsync(m => m.Amount);
                    var totalObCr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == shareCapitalLedger.LedgerID && m.BalanceType == "Cr").SumAsync(m => m.Amount);
                    shareCapitalLedger.OpeningBalance = Math.Abs(totalObCr - totalObDr);
                    shareCapitalLedger.OpeningBalanceType = totalObCr >= totalObDr ? "Cr" : "Dr";
                    _context.Ledgers.Update(shareCapitalLedger);
                }

                // 2. Reconcile Dividend Payable Ledger and MemberOpeningBalances
                Ledger? dividendLedger = null;
                if (request.DividendPayableLedgerId.HasValue && request.DividendPayableLedgerId.Value > 0)
                {
                    dividendLedger = await _context.Ledgers.FindAsync(request.DividendPayableLedgerId.Value);
                }
                if (dividendLedger == null)
                {
                    dividendLedger = await Helpers.ShareLedgerHelper.GetDividendPayableLedgerAsync(_context, request.ShareSchemeId);
                }

                if (dividendLedger != null)
                {
                    var divMobs = await _context.MemberOpeningBalances
                        .Where(m => m.MemberID == account.MemberId && m.LedgerID == dividendLedger.LedgerID)
                        .ToListAsync();

                    if (request.DividendPayable > 0)
                    {
                        if (!divMobs.Any())
                        {
                            _context.MemberOpeningBalances.Add(new MemberOpeningBalance
                            {
                                MemberID = account.MemberId,
                                LedgerID = dividendLedger.LedgerID,
                                Amount = request.DividendPayable,
                                BalanceType = "Cr",
                                CreatedOn = DateTime.Now
                            });
                        }
                        else
                        {
                            var primaryDivMob = divMobs.First();
                            primaryDivMob.Amount = request.DividendPayable;
                            primaryDivMob.BalanceType = "Cr";
                            _context.MemberOpeningBalances.Update(primaryDivMob);

                            if (divMobs.Count > 1)
                            {
                                _context.MemberOpeningBalances.RemoveRange(divMobs.Skip(1));
                            }
                        }
                    }
                    else if (divMobs.Any())
                    {
                        _context.MemberOpeningBalances.RemoveRange(divMobs);
                    }

                    await _context.SaveChangesAsync();

                    var divTotalObDr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == dividendLedger.LedgerID && m.BalanceType == "Dr").SumAsync(m => m.Amount);
                    var divTotalObCr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == dividendLedger.LedgerID && m.BalanceType == "Cr").SumAsync(m => m.Amount);
                    dividendLedger.OpeningBalance = Math.Abs(divTotalObCr - divTotalObDr);
                    dividendLedger.OpeningBalanceType = divTotalObCr >= divTotalObDr ? "Cr" : "Dr";
                    _context.Ledgers.Update(dividendLedger);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "शेअर ओपनिंग बॅलन्स यशस्वीरित्या अपडेट केला! (Opening balance updated successfully.)" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // DELETE: api/ShareAccounts/OpeningBalance/{id}
        // DELETE: api/ShareAccounts/OpeningBalance/Certificate/{certId}
        [AllowAnonymous]
        [HttpDelete("OpeningBalance/{id}")]
        [HttpDelete("OpeningBalance/Certificate/{certId}")]
        public async Task<IActionResult> DeleteOpeningBalance(int? id, int? certId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                ShareAccount? account = null;
                ShareCertificate? targetCert = null;

                if (certId.HasValue && certId.Value > 0)
                {
                    targetCert = await _context.ShareCertificates.FindAsync(certId.Value);
                    if (targetCert != null)
                    {
                        account = await _context.ShareAccounts
                            .Include(a => a.Transactions)
                            .Include(a => a.Certificates)
                            .FirstOrDefaultAsync(a => a.ShareAccountId == targetCert.ShareAccountId);
                    }
                }

                if (account == null && id.HasValue && id.Value > 0)
                {
                    account = await _context.ShareAccounts
                        .Include(a => a.Transactions)
                        .Include(a => a.Certificates)
                        .FirstOrDefaultAsync(a => a.ShareAccountId == id.Value);
                }

                if (account == null) return NotFound("Share account / certificate not found.");

                // If deleting a specific certificate
                if (targetCert != null && account.Certificates != null && account.Certificates.Count > 1)
                {
                    int certShares = targetCert.NumberOfShares;
                    decimal certAmount = certShares * targetCert.FaceValue;

                    _context.ShareCertificates.Remove(targetCert);

                    // Remove matching opening transaction if exists
                    var matchingTxn = account.Transactions?
                        .FirstOrDefault(t => t.TransactionType == "OpeningBalance" && t.NumberOfShares == certShares);
                    if (matchingTxn != null)
                    {
                        _context.ShareTransactions.Remove(matchingTxn);
                    }

                    account.TotalShareCount = Math.Max(0, account.TotalShareCount - certShares);
                    account.TotalShareAmount = Math.Max(0, account.TotalShareAmount - certAmount);
                    _context.ShareAccounts.Update(account);

                    await _context.SaveChangesAsync();

                    // Reconcile MemberOpeningBalances to new account amount
                    var mobs = await _context.MemberOpeningBalances
                        .Include(m => m.Ledger)
                        .Where(m => m.MemberID == account.MemberId && m.Ledger != null &&
                                    (m.Ledger.AccountType == "Share Capital" || 
                                     m.Ledger.LedgerName.Contains("भाग") || 
                                     m.Ledger.LedgerName.Contains("शेअर्स") ||
                                     m.Ledger.LedgerName.ToLower().Contains("share")))
                        .ToListAsync();

                    foreach (var mob in mobs)
                    {
                        mob.Amount = account.TotalShareAmount;
                        if (mob.Amount <= 0) _context.MemberOpeningBalances.Remove(mob);
                        else _context.MemberOpeningBalances.Update(mob);

                        var ledger = mob.Ledger ?? await _context.Ledgers.FindAsync(mob.LedgerID);
                        if (ledger != null)
                        {
                            var totalObDr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == ledger.LedgerID && m.BalanceType == "Dr").SumAsync(m => m.Amount);
                            var totalObCr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == ledger.LedgerID && m.BalanceType == "Cr").SumAsync(m => m.Amount);
                            ledger.OpeningBalance = Math.Abs(totalObCr - totalObDr);
                            ledger.OpeningBalanceType = totalObCr >= totalObDr ? "Cr" : "Dr";
                            _context.Ledgers.Update(ledger);
                        }
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    return Ok(new { message = "प्रमाणपत्र यशस्वीरित्या डिलीट केले! (Certificate deleted successfully.)" });
                }

                // Otherwise, delete the entire account opening balance
                var shareCapitalMobs = await _context.MemberOpeningBalances
                    .Include(m => m.Ledger)
                    .Where(m => m.MemberID == account.MemberId && m.Ledger != null &&
                                (m.Ledger.AccountType == "Share Capital" || 
                                 m.Ledger.LedgerName.Contains("भाग") || 
                                 m.Ledger.LedgerName.Contains("शेअर्स") ||
                                 m.Ledger.LedgerName.ToLower().Contains("share")))
                    .ToListAsync();

                foreach (var mob in shareCapitalMobs)
                {
                    var ledger = mob.Ledger ?? await _context.Ledgers.FindAsync(mob.LedgerID);
                    _context.MemberOpeningBalances.Remove(mob);
                    if (ledger != null)
                    {
                        var totalObDr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == ledger.LedgerID && m.MemberOpeningBalanceID != mob.MemberOpeningBalanceID && m.BalanceType == "Dr").SumAsync(m => m.Amount);
                        var totalObCr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == ledger.LedgerID && m.MemberOpeningBalanceID != mob.MemberOpeningBalanceID && m.BalanceType == "Cr").SumAsync(m => m.Amount);
                        ledger.OpeningBalance = Math.Abs(totalObCr - totalObDr);
                        ledger.OpeningBalanceType = totalObCr >= totalObDr ? "Cr" : "Dr";
                        _context.Ledgers.Update(ledger);
                    }
                }

                var divMobs = await _context.MemberOpeningBalances
                    .Include(m => m.Ledger)
                    .Where(m => m.MemberID == account.MemberId && m.Ledger != null &&
                                (m.Ledger.AccountType == "Dividend Payable" || 
                                 m.Ledger.LedgerName.Contains("लाभांश") || 
                                 m.Ledger.LedgerName.ToLower().Contains("dividend")))
                    .ToListAsync();

                foreach (var divMob in divMobs)
                {
                    var ledger = divMob.Ledger ?? await _context.Ledgers.FindAsync(divMob.LedgerID);
                    _context.MemberOpeningBalances.Remove(divMob);
                    if (ledger != null)
                    {
                        var totalObDr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == ledger.LedgerID && m.MemberOpeningBalanceID != divMob.MemberOpeningBalanceID && m.BalanceType == "Dr").SumAsync(m => m.Amount);
                        var totalObCr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == ledger.LedgerID && m.MemberOpeningBalanceID != divMob.MemberOpeningBalanceID && m.BalanceType == "Cr").SumAsync(m => m.Amount);
                        ledger.OpeningBalance = Math.Abs(totalObCr - totalObDr);
                        ledger.OpeningBalanceType = totalObCr >= totalObDr ? "Cr" : "Dr";
                        _context.Ledgers.Update(ledger);
                    }
                }

                if (account.Transactions != null && account.Transactions.Any())
                {
                    _context.ShareTransactions.RemoveRange(account.Transactions);
                }
                if (account.Certificates != null && account.Certificates.Any())
                {
                    _context.ShareCertificates.RemoveRange(account.Certificates);
                }
                _context.ShareAccounts.Remove(account);

                await _context.SaveChangesAsync();

                // Rollback / Cleanup of Member record & MemberCode so next code/ID decrements by -1
                int targetMemberId = account.MemberId;
                var member = await _context.Members.FindAsync(targetMemberId);
                if (member != null)
                {
                    var mobIdsToDelete = shareCapitalMobs.Select(m => m.MemberOpeningBalanceID)
                        .Concat(divMobs.Select(d => d.MemberOpeningBalanceID))
                        .ToList();

                    bool hasOtherShares = await _context.ShareAccounts.AnyAsync(s => s.ShareAccountId != account.ShareAccountId && s.MemberId == targetMemberId);
                    bool hasLoans = await _context.LoanAccounts.AnyAsync(l => l.MemberID == targetMemberId || l.CoMemberID == targetMemberId || l.CoMember2ID == targetMemberId || l.Guarantor1MemberID == targetMemberId || l.Guarantor2MemberID == targetMemberId);
                    bool hasLoanApps = await _context.LoanApplications.AnyAsync(l => l.MemberID == targetMemberId || l.CoMemberID == targetMemberId || l.Guarantor1MemberID == targetMemberId || l.Guarantor2MemberID == targetMemberId);
                    bool hasSavings = await _context.SavingAccountMasters.AnyAsync(s => s.MemberID == targetMemberId);
                    bool hasFds = await _context.FdAccounts.AnyAsync(f => f.MemberID == targetMemberId);
                    bool hasRds = await _context.RdAccounts.AnyAsync(r => r.MemberID == targetMemberId);
                    bool hasPigmies = await _context.PigmyAccounts.AnyAsync(p => p.MemberID == targetMemberId);
                    bool hasLockers = await _context.LockerAllotments.AnyAsync(l => l.MemberID == targetMemberId);
                    bool hasJoint = await _context.JointMembers.AnyAsync(j => j.PrimaryMemberID == targetMemberId);
                    bool hasCommittee = await _context.CommitteeMembers.AnyAsync(c => c.MemberID == targetMemberId);
                    bool hasOtherMobs = await _context.MemberOpeningBalances.AnyAsync(m => m.MemberID == targetMemberId && !mobIdsToDelete.Contains(m.MemberOpeningBalanceID));

                    if (!hasOtherShares && !hasLoans && !hasLoanApps && !hasSavings && !hasFds && !hasRds && !hasPigmies && !hasLockers && !hasJoint && !hasCommittee && !hasOtherMobs)
                    {
                        // Safe to completely remove the uncommitted member record, restoring customer to pure CIF
                        _context.Members.Remove(member);
                    }
                    else if (!hasOtherShares)
                    {
                        // Has other accounts (e.g. saving), but no longer a shareholder. Free up the MemberCode sequence
                        member.MemberCode = null;
                        member.MembershipType = "Nominal";
                        member.LegacyMemberNo = null;
                        member.OldMemberCode = null;
                        _context.Members.Update(member);
                    }

                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();

                return Ok(new { message = "शेअर ओपनिंग बॅलन्स यशस्वीरित्या डिलीट केला व सभासद कोड पूर्ववत रोलबॅक केला! (Opening balance deleted and member code rolled back successfully.)" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        public class SyncShareBalancesRequest
        {
            public int LedgerId { get; set; }
        }

        [AllowAnonymous]
        [HttpPost("SyncImportedBalances")]
        public async Task<IActionResult> SyncImportedBalances([FromBody] SyncShareBalancesRequest request)
        {
            if (request.LedgerId <= 0) return BadRequest("Invalid ledger ID.");

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var shareAccounts = await _context.ShareAccounts
                    .Include(s => s.Transactions)
                    .Include(s => s.Certificates)
                    .Where(s => s.TotalShareCount > 0)
                    .ToListAsync();

                // Reconcile each account's certificates & transactions
                int reconciledCount = 0;
                foreach (var acc in shareAccounts)
                {
                    var opCerts = acc.Certificates?
                        .Where(c => c.Status == "OpeningBalance" || c.Status == "Active" || string.IsNullOrEmpty(c.Status))
                        .ToList() ?? new List<ShareCertificate>();

                    decimal trueOpAmount;
                    int trueOpShares;

                    if (opCerts.Any())
                    {
                        trueOpShares = opCerts.Sum(c => c.NumberOfShares);
                        trueOpAmount = opCerts.Sum(c => c.NumberOfShares * c.FaceValue);
                    }
                    else
                    {
                        var opTxns = acc.Transactions?
                            .Where(t => t.TransactionType == "OpeningBalance")
                            .ToList() ?? new List<ShareTransaction>();

                        trueOpShares = opTxns.Any() ? opTxns.Sum(t => t.NumberOfShares) : acc.TotalShareCount;
                        trueOpAmount = opTxns.Any() ? opTxns.Sum(t => t.Amount) : acc.TotalShareAmount;
                    }

                    if (trueOpAmount <= 0) continue;

                    acc.TotalShareCount = trueOpShares;
                    acc.TotalShareAmount = trueOpAmount;
                    _context.ShareAccounts.Update(acc);

                    // Reconcile MemberOpeningBalances for Share Capital Ledger
                    var existingMobs = await _context.MemberOpeningBalances
                        .Where(m => m.MemberID == acc.MemberId && m.LedgerID == request.LedgerId)
                        .ToListAsync();

                    if (!existingMobs.Any())
                    {
                        _context.MemberOpeningBalances.Add(new MemberOpeningBalance
                        {
                            MemberID = acc.MemberId,
                            LedgerID = request.LedgerId,
                            Amount = trueOpAmount,
                            BalanceType = "Cr",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        });
                    }
                    else
                    {
                        var primaryMob = existingMobs.First();
                        primaryMob.Amount = trueOpAmount;
                        primaryMob.BalanceType = "Cr";
                        _context.MemberOpeningBalances.Update(primaryMob);

                        if (existingMobs.Count > 1)
                        {
                            _context.MemberOpeningBalances.RemoveRange(existingMobs.Skip(1));
                        }
                    }

                    reconciledCount++;
                }

                // Remove orphan MemberOpeningBalances for Share Capital ledger where member has no active share account
                var activeMemberIds = shareAccounts.Select(s => s.MemberId).ToHashSet();
                var orphanMobs = await _context.MemberOpeningBalances
                    .Where(m => m.LedgerID == request.LedgerId && !activeMemberIds.Contains(m.MemberID))
                    .ToListAsync();
                if (orphanMobs.Any())
                {
                    _context.MemberOpeningBalances.RemoveRange(orphanMobs);
                }

                await _context.SaveChangesAsync();

                // Recalculate Share Capital Ledger Opening Balance
                var ledger = await _context.Ledgers.FindAsync(request.LedgerId);
                if (ledger != null)
                {
                    var totalObDr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == request.LedgerId && m.BalanceType == "Dr").SumAsync(m => m.Amount);
                    var totalObCr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == request.LedgerId && m.BalanceType == "Cr").SumAsync(m => m.Amount);
                    ledger.OpeningBalance = Math.Abs(totalObCr - totalObDr);
                    ledger.OpeningBalanceType = totalObCr >= totalObDr ? "Cr" : "Dr";
                    _context.Ledgers.Update(ledger);
                }

                // Reconcile Dividend Payable Ledger
                Ledger? dividendLedger = await Helpers.ShareLedgerHelper.GetDividendPayableLedgerAsync(_context);
                if (dividendLedger != null)
                {
                    foreach (var acc in shareAccounts)
                    {
                        var divMobs = await _context.MemberOpeningBalances
                            .Where(m => m.MemberID == acc.MemberId && m.LedgerID == dividendLedger.LedgerID)
                            .ToListAsync();

                        if (acc.DividendPayableBalance > 0)
                        {
                            if (!divMobs.Any())
                            {
                                _context.MemberOpeningBalances.Add(new MemberOpeningBalance
                                {
                                    MemberID = acc.MemberId,
                                    LedgerID = dividendLedger.LedgerID,
                                    Amount = acc.DividendPayableBalance,
                                    BalanceType = "Cr",
                                    CreatedBy = 1,
                                    CreatedOn = DateTime.Now
                                });
                            }
                            else
                            {
                                var primaryDivMob = divMobs.First();
                                primaryDivMob.Amount = acc.DividendPayableBalance;
                                primaryDivMob.BalanceType = "Cr";
                                _context.MemberOpeningBalances.Update(primaryDivMob);

                                if (divMobs.Count > 1)
                                {
                                    _context.MemberOpeningBalances.RemoveRange(divMobs.Skip(1));
                                }
                            }
                        }
                        else if (divMobs.Any())
                        {
                            _context.MemberOpeningBalances.RemoveRange(divMobs);
                        }
                    }

                    await _context.SaveChangesAsync();

                    var divTotalObDr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == dividendLedger.LedgerID && m.BalanceType == "Dr").SumAsync(m => m.Amount);
                    var divTotalObCr = await _context.MemberOpeningBalances.Where(m => m.LedgerID == dividendLedger.LedgerID && m.BalanceType == "Cr").SumAsync(m => m.Amount);
                    dividendLedger.OpeningBalance = Math.Abs(divTotalObCr - divTotalObDr);
                    dividendLedger.OpeningBalanceType = divTotalObCr >= divTotalObDr ? "Cr" : "Dr";
                    _context.Ledgers.Update(dividendLedger);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = $"सर्व {reconciledCount} शेअर्स खाती आणि लेजर शिल्लक यशस्वीरित्या सिंक व अचूक जुळवणी (Reconciled) झाली!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // POST: api/ShareAccounts/ResequenceMemberCodes
        // POST: api/ShareAccounts/ResequenceMemberCodes
        [AllowAnonymous]
        [HttpPost("ResequenceMemberCodes")]
        public async Task<IActionResult> ResequenceMemberCodes([FromQuery] string orderBy = "CertificateNo")
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Ensure required ANSI settings for filtered indexes
                await _context.Database.ExecuteSqlRawAsync("SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;");

                // Step 1: Temporarily assign unique TMP codes to ALL members in Members table to guarantee zero collision
                await _context.Database.ExecuteSqlRawAsync(@"
                    UPDATE Members 
                    SET MemberCode = 'TMP_' + CAST(MemberID AS VARCHAR(10)) + '_' + SUBSTRING(CONVERT(VARCHAR(40), NEWID()), 1, 8);
                ");

                // Step 2: Sequence all active shareholding members strictly 1 to N (MEM0001..MEM0216)
                string orderByClause = orderBy.Equals("LegacyNo", StringComparison.OrdinalIgnoreCase)
                    ? "TRY_CAST(m.LegacyMemberNo AS INT) ASC, sa.ShareAccountId ASC"
                    : "TRY_CAST(REPLACE(REPLACE(COALESCE(sc.CertificateNo, ''), 'CERT-', ''), 'CERT', '') AS INT) ASC, TRY_CAST(m.LegacyMemberNo AS INT) ASC, sa.ShareAccountId ASC";

                string resequenceSql = $@"
                    ;WITH RankedShareholders AS (
                        SELECT 
                            sa.MemberId,
                            ROW_NUMBER() OVER (
                                ORDER BY {orderByClause}
                            ) as SeqNo
                        FROM ShareAccounts sa
                        INNER JOIN Members m ON sa.MemberId = m.MemberID
                        LEFT JOIN ShareCertificates sc ON sc.ShareAccountId = sa.ShareAccountId
                        WHERE sa.TotalShareCount > 0
                    )
                    UPDATE m
                    SET 
                        m.MemberCode = 'MEM' + RIGHT('0000' + CAST(r.SeqNo AS VARCHAR(10)), 4),
                        m.MembershipType = 'Regular'
                    FROM Members m
                    INNER JOIN RankedShareholders r ON m.MemberID = r.MemberId;
                ";
                await _context.Database.ExecuteSqlRawAsync(resequenceSql);

                // Step 3: Update ShareAccounts AccountNo to match new MemberCode (SA-MEM0001...)
                await _context.Database.ExecuteSqlRawAsync(@"
                    UPDATE sa
                    SET sa.AccountNo = 'SA-' + m.MemberCode
                    FROM ShareAccounts sa
                    INNER JOIN Members m ON sa.MemberId = m.MemberID
                    WHERE sa.TotalShareCount > 0;
                ");

                // Step 4: Sequence remaining non-shareholding members starting from after the last shareholder (MEM0217+)
                await _context.Database.ExecuteSqlRawAsync(@"
                    DECLARE @TotalShareholders INT = (SELECT COUNT(DISTINCT MemberId) FROM ShareAccounts WHERE TotalShareCount > 0);

                    ;WITH RankedNonShareholders AS (
                        SELECT 
                            m.MemberID,
                            @TotalShareholders + ROW_NUMBER() OVER (ORDER BY m.MemberID ASC) as SeqNo
                        FROM Members m
                        WHERE m.MemberID NOT IN (SELECT MemberId FROM ShareAccounts WHERE TotalShareCount > 0)
                    )
                    UPDATE m
                    SET m.MemberCode = 'MEM' + RIGHT('0000' + CAST(r.SeqNo AS VARCHAR(10)), 4)
                    FROM Members m
                    INNER JOIN RankedNonShareholders r ON m.MemberID = r.MemberID;
                ");

                await transaction.CommitAsync();

                var totalShareholders = await _context.ShareAccounts.Where(s => s.TotalShareCount > 0).Select(s => s.MemberId).Distinct().CountAsync();

                return Ok(new { 
                    message = $"यशस्वी! सर्व {totalShareholders} शेअर्स सभासदांचे कोड सलग (MEM0001 ते MEM{totalShareholders:D4}) गॅप-मुक्त रीसेट करण्यात आले आहेत.",
                    totalUpdated = totalShareholders
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"री-नंबरिंग करताना त्रुटी आली: {ex.Message}");
            }
        }

        public class ShareTransferRequest
        {
            public int FromMemberId { get; set; }
            public int ToMemberId { get; set; }
            public int NumberOfShares { get; set; }
            public int BranchId { get; set; } = 1;
            public string? ResolutionNo { get; set; }
            public DateTime? ResolutionDate { get; set; }
            public decimal TransferFee { get; set; } = 0M;
            public string FeePaymentMode { get; set; } = "None"; // "Cash", "Saving", "None"
            public int? SavingAccountId { get; set; }
            public string Narration { get; set; } = "Share Transfer between members";
        }

        // POST: api/ShareAccounts/Transfer
        [HttpPost("Transfer")]
        public async Task<IActionResult> TransferShares([FromBody] ShareTransferRequest request)
        {
            if (request.FromMemberId <= 0 || request.ToMemberId <= 0)
                return BadRequest("देणारा व घेणारा सभासद निवडणे आवश्यक आहे.");

            if (request.FromMemberId == request.ToMemberId)
                return BadRequest("एकाच सभासदाच्या नावावर शेअर हस्तांतरण करता येत नाही. कृपया वेगळा सभासद निवडा.");

            if (request.NumberOfShares <= 0)
                return BadRequest("हस्तांतरित करावयाच्या शेअर्सची संख्या किमान १ असणे आवश्यक आहे.");

            decimal faceValue = 100M;
            decimal totalAmount = request.NumberOfShares * faceValue;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var fromMember = await _context.Members.FindAsync(request.FromMemberId);
                var toMember = await _context.Members.FindAsync(request.ToMemberId);

                if (fromMember == null) return NotFound("देणारा सभासद (Transferor) सिस्टीममध्ये सापडला नाही.");
                if (toMember == null) return NotFound("घेणारा सभासद (Transferee) सिस्टीममध्ये सापडला नाही.");

                var fromAccount = await _context.ShareAccounts
                    .Include(s => s.Certificates)
                    .FirstOrDefaultAsync(s => s.MemberId == request.FromMemberId);

                if (fromAccount == null || fromAccount.TotalShareCount < request.NumberOfShares)
                {
                    return BadRequest($"देणाऱ्या सभासदाकडे ({fromMember.FirstName} {fromMember.LastName}) पुरेसे शेअर्स उपलब्ध नाहीत. चालू शेअर्स: {fromAccount?.TotalShareCount ?? 0}");
                }

                // Get or create ToShareAccount
                var toAccount = await _context.ShareAccounts
                    .Include(s => s.Certificates)
                    .FirstOrDefaultAsync(s => s.MemberId == request.ToMemberId);

                if (toAccount == null)
                {
                    // Generate code for toMember if missing
                    if (string.IsNullOrWhiteSpace(toMember.MemberCode) || toMember.MemberCode.StartsWith("TEMP", StringComparison.OrdinalIgnoreCase))
                    {
                        var existingCodes = await _context.Members
                            .AsNoTracking()
                            .Where(m => !string.IsNullOrEmpty(m.MemberCode))
                            .Select(m => m.MemberCode)
                            .ToListAsync();

                        int maxCodeNum = 0;
                        foreach (var code in existingCodes)
                        {
                            if (string.IsNullOrEmpty(code)) continue;
                            var trimmed = code.Trim();
                            if (trimmed.StartsWith("MEM", StringComparison.OrdinalIgnoreCase))
                            {
                                var digits = new string(trimmed.Substring(3).Where(char.IsDigit).ToArray());
                                if (int.TryParse(digits, out int num) && num > maxCodeNum) maxCodeNum = num;
                            }
                        }

                        int nextNum = maxCodeNum + 1;
                        string candidateCode = $"MEM{nextNum:D4}";
                        while (existingCodes.Any(c => string.Equals(c, candidateCode, StringComparison.OrdinalIgnoreCase)))
                        {
                            nextNum++;
                            candidateCode = $"MEM{nextNum:D4}";
                        }

                        toMember.MemberCode = candidateCode;
                        toMember.MembershipType = "Regular";
                        _context.Entry(toMember).State = EntityState.Modified;
                    }

                    toAccount = new ShareAccount
                    {
                        MemberId = request.ToMemberId,
                        CustomerID = toMember.CustomerID ?? toMember.MemberID,
                        AccountNo = $"SA-{(string.IsNullOrWhiteSpace(toMember.MemberCode) ? toMember.MemberID.ToString() : toMember.MemberCode.Trim())}",
                        OpeningDate = DateTime.Today,
                        TotalShareCount = 0,
                        TotalShareAmount = 0m,
                        DividendPayableBalance = 0m,
                        Status = "Active"
                    };
                    _context.ShareAccounts.Add(toAccount);
                    await _context.SaveChangesAsync();
                }

                // 1. Resolve Share Capital Ledger (via ShareSchemeMaster & ShareLedgerHelper)
                var shareCapitalLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);

                // 2. Create Journal Voucher for Transfer
                var voucherDate = DateTime.Today;
                int vchCount = await _context.Vouchers.CountAsync() + 1;
                string vchNo = $"VCH-SHR-TRF-{voucherDate:yyyyMMdd}-{vchCount:D4}";

                var (actionUserId, _, _) = GetCurrentUserContext();
                var jvVoucher = new Voucher
                {
                    BranchID = request.BranchId,
                    VoucherNo = vchNo,
                    VoucherDate = voucherDate,
                    VoucherType = "Journal",
                    TotalAmount = totalAmount,
                    Narration = $"Share Transfer of {request.NumberOfShares} shares from {fromMember.FirstName} {fromMember.LastName} ({fromMember.MemberCode}) to {toMember.FirstName} {toMember.LastName} ({toMember.MemberCode}). ठराव क्र: {request.ResolutionNo ?? "-"} दि. {request.ResolutionDate?.ToString("dd/MM/yyyy") ?? "-"}. {request.Narration}".Trim(),
                    Status = "Approved",
                    CreatedBy = actionUserId,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        // Debit Transferor (Member A's shares reduce)
                        new VoucherDetail { LedgerID = shareCapitalLedger.LedgerID, DrCr = "Dr", Amount = totalAmount, MemberID = request.FromMemberId },
                        // Credit Transferee (Member B's shares increase)
                        new VoucherDetail { LedgerID = shareCapitalLedger.LedgerID, DrCr = "Cr", Amount = totalAmount, MemberID = request.ToMemberId }
                    }
                };
                _context.Vouchers.Add(jvVoucher);
                await _context.SaveChangesAsync();

                // 3. Process Transfer Fee if applicable
                string? feeVoucherNo = null;
                if (request.TransferFee > 0 && request.FeePaymentMode != "None")
                {
                    var feeIncomeLedger = await Helpers.ShareLedgerHelper.GetShareTransferFeeLedgerAsync(_context);
                    int feeIncomeLedgerId = feeIncomeLedger.LedgerID;

                    int feeDebitLedgerId;
                    if (request.FeePaymentMode == "Saving" && request.SavingAccountId.HasValue)
                    {
                        var savingAcc = await _context.SavingAccountMasters.FindAsync(request.SavingAccountId.Value);
                        if (savingAcc != null && savingAcc.CurrentBalance >= request.TransferFee)
                        {
                            savingAcc.CurrentBalance -= request.TransferFee;
                            _context.Entry(savingAcc).State = EntityState.Modified;
                            feeDebitLedgerId = savingAcc.LedgerID;

                            _context.SavingTransactions.Add(new SavingTransaction
                            {
                                SavingAccountID = savingAcc.SavingAccountID,
                                CustomerID = savingAcc.CustomerID,
                                TransactionDate = DateTime.Today,
                                TransactionType = "Withdrawal",
                                PaymentMode = "Transfer",
                                Amount = request.TransferFee,
                                BalanceAfterTxn = savingAcc.CurrentBalance,
                                Narration = $"शेअर हस्तांतरण फी कपात (Share Transfer Fee)",
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            });
                        }
                        else
                        {
                            feeDebitLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.BranchId, "SHARE");
                        }
                    }
                    else
                    {
                        feeDebitLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.BranchId, "SHARE");
                    }

                    int feeCount = await _context.Vouchers.CountAsync() + 1;
                    feeVoucherNo = $"VCH-SHR-FEE-{voucherDate:yyyyMMdd}-{feeCount:D4}";
                    var feeVoucher = new Voucher
                    {
                        BranchID = request.BranchId,
                        VoucherNo = feeVoucherNo,
                        VoucherDate = voucherDate,
                        VoucherType = request.FeePaymentMode == "Cash" ? "Receipt" : "Journal",
                        TotalAmount = request.TransferFee,
                        Narration = $"Share Transfer Fee for transfer of {request.NumberOfShares} shares from {fromMember.FirstName} {fromMember.LastName} to {toMember.FirstName} {toMember.LastName}",
                        Status = "Approved",
                        CreatedBy = actionUserId,
                        VoucherDetails = new List<VoucherDetail>
                        {
                            new VoucherDetail { LedgerID = feeDebitLedgerId, DrCr = "Dr", Amount = request.TransferFee, MemberID = request.FromMemberId },
                            new VoucherDetail { LedgerID = feeIncomeLedgerId, DrCr = "Cr", Amount = request.TransferFee, MemberID = request.FromMemberId }
                        }
                    };
                    _context.Vouchers.Add(feeVoucher);
                    await _context.SaveChangesAsync();
                }

                // 4. Update Balances
                fromAccount.TotalShareCount -= request.NumberOfShares;
                fromAccount.TotalShareAmount -= totalAmount;
                _context.Entry(fromAccount).State = EntityState.Modified;

                toAccount.TotalShareCount += request.NumberOfShares;
                toAccount.TotalShareAmount += totalAmount;
                _context.Entry(toAccount).State = EntityState.Modified;

                // 5. Transfer Certificates & Serials
                int nextCertCount = await _context.ShareCertificates.CountAsync() + 1;
                string newCertNo = $"CERT-TRF-{voucherDate.Year}-{nextCertCount:D5}";

                // Identify serial range from fromAccount active certificates
                int sharesRemaining = request.NumberOfShares;
                var fromActiveCerts = (fromAccount.Certificates ?? new List<ShareCertificate>())
                    .Where(c => c.Status == "Active")
                    .OrderBy(c => c.CertificateId)
                    .ToList();

                long assignedFromShareNo = 0;
                long assignedToShareNo = 0;

                if (fromActiveCerts.Any())
                {
                    foreach (var cert in fromActiveCerts)
                    {
                        if (sharesRemaining <= 0) break;

                        if (cert.NumberOfShares <= sharesRemaining)
                        {
                            if (assignedFromShareNo == 0) assignedFromShareNo = cert.FromShareNo;
                            assignedToShareNo = cert.ToShareNo;

                            cert.Status = "Transferred";
                            cert.CancellationReason = $"Transferred to {toMember.FirstName} {toMember.LastName} ({toMember.MemberCode})";
                            cert.ModifiedDate = DateTime.UtcNow;
                            _context.Entry(cert).State = EntityState.Modified;

                            sharesRemaining -= cert.NumberOfShares;
                        }
                        else
                        {
                            // Partial transfer from this certificate
                            if (assignedFromShareNo == 0) assignedFromShareNo = cert.FromShareNo;
                            assignedToShareNo = cert.FromShareNo + sharesRemaining - 1;

                            // Update original cert to retain remaining
                            cert.FromShareNo = assignedToShareNo + 1;
                            cert.NumberOfShares -= sharesRemaining;
                            cert.ModifiedDate = DateTime.UtcNow;
                            _context.Entry(cert).State = EntityState.Modified;

                            sharesRemaining = 0;
                            break;
                        }
                    }
                }

                if (assignedFromShareNo == 0 || assignedToShareNo == 0)
                {
                    // Fallback to auto-sequential share numbers
                    long maxToShare = await _context.ShareCertificates.MaxAsync(c => (long?)c.ToShareNo) ?? 0;
                    assignedFromShareNo = maxToShare + 1;
                    assignedToShareNo = assignedFromShareNo + request.NumberOfShares - 1;
                }

                var newCert = new ShareCertificate
                {
                    ShareAccountId = toAccount.ShareAccountId,
                    CustomerID = toMember.CustomerID ?? toMember.MemberID,
                    CertificateNo = newCertNo,
                    IssueDate = voucherDate,
                    FromShareNo = assignedFromShareNo,
                    ToShareNo = assignedToShareNo,
                    NumberOfShares = request.NumberOfShares,
                    FaceValue = faceValue,
                    Status = "Active",
                    CreatedBy = 1,
                    CreatedDate = DateTime.UtcNow
                };
                _context.ShareCertificates.Add(newCert);

                // 6. Record Share Transactions
                var txnOut = new ShareTransaction
                {
                    ShareAccountId = fromAccount.ShareAccountId,
                    CustomerID = fromMember.CustomerID ?? fromMember.MemberID,
                    TransactionDate = voucherDate,
                    TransactionType = "Transfer-Out",
                    NumberOfShares = request.NumberOfShares,
                    Amount = totalAmount,
                    Narration = $"शेअर हस्तांतरण -> {toMember.FirstName} {toMember.LastName} ({toMember.MemberCode}). ठराव: {request.ResolutionNo ?? "-"}",
                    VoucherId = jvVoucher.VoucherID
                };
                _context.ShareTransactions.Add(txnOut);

                var txnIn = new ShareTransaction
                {
                    ShareAccountId = toAccount.ShareAccountId,
                    CustomerID = toMember.CustomerID ?? toMember.MemberID,
                    TransactionDate = voucherDate,
                    TransactionType = "Transfer-In",
                    NumberOfShares = request.NumberOfShares,
                    Amount = totalAmount,
                    Narration = $"शेअर हस्तांतरण <- {fromMember.FirstName} {fromMember.LastName} ({fromMember.MemberCode}). ठराव: {request.ResolutionNo ?? "-"}",
                    VoucherId = jvVoucher.VoucherID
                };
                _context.ShareTransactions.Add(txnIn);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = "शेअर्स यशस्वीरित्या हस्तांतरित करण्यात आले!",
                    voucherNo = vchNo,
                    feeVoucherNo = feeVoucherNo,
                    certificateNo = newCertNo,
                    fromShareNo = assignedFromShareNo,
                    toShareNo = assignedToShareNo,
                    fromMemberName = $"{fromMember.FirstName} {fromMember.LastName}",
                    toMemberName = $"{toMember.FirstName} {toMember.LastName}",
                    numberOfShares = request.NumberOfShares,
                    totalAmount = totalAmount
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"हस्तांतरण प्रक्रिया अयशस्वी: {ex.Message}");
            }
        }

        // GET: api/ShareAccounts/TransferHistory
        [HttpGet("TransferHistory")]
        public async Task<IActionResult> GetTransferHistory()
        {
            var transfers = await _context.ShareTransactions
                .Include(t => t.ShareAccount)
                    .ThenInclude(s => s!.Member)
                .Include(t => t.Voucher)
                .Where(t => t.TransactionType == "Transfer-Out" || t.TransactionType == "Transfer-In")
                .OrderByDescending(t => t.TransactionDate)
                .ThenByDescending(t => t.TransactionId)
                .Take(100)
                .Select(t => new
                {
                    t.TransactionId,
                    t.TransactionDate,
                    t.TransactionType,
                    t.NumberOfShares,
                    t.Amount,
                    t.Narration,
                    VoucherNo = t.Voucher != null ? t.Voucher.VoucherNo : null,
                    MemberId = t.ShareAccount != null ? t.ShareAccount.MemberId : 0,
                    MemberName = t.ShareAccount != null && t.ShareAccount.Member != null ? $"{t.ShareAccount.Member.FirstName} {t.ShareAccount.Member.LastName}" : "अज्ञात",
                    MemberCode = t.ShareAccount != null && t.ShareAccount.Member != null ? t.ShareAccount.Member.MemberCode : ""
                })
                .ToListAsync();

            return Ok(transfers);
        }
        // POST: api/ShareAccounts/CancelTransfer/5
        [HttpPost("CancelTransfer/{transactionId}")]
        public async Task<IActionResult> CancelTransfer(int transactionId)
        {
            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var targetTxn = await _context.ShareTransactions
                    .Include(t => t.ShareAccount)
                        .ThenInclude(s => s!.Member)
                    .Include(t => t.Voucher)
                    .FirstOrDefaultAsync(t => t.TransactionId == transactionId);

                if (targetTxn == null) return NotFound("हस्तांतरण नोंद सापडली नाही.");

                if (targetTxn.TransactionType != "Transfer-Out" && targetTxn.TransactionType != "Transfer-In")
                {
                    return BadRequest("फक्त शेअर हस्तांतरण नोंदीच रद्द करता येतात.");
                }

                // Find both paired transactions by VoucherId or timestamp/amount
                List<ShareTransaction> pairedTxns;
                if (targetTxn.VoucherId.HasValue)
                {
                    pairedTxns = await _context.ShareTransactions
                        .Include(t => t.ShareAccount)
                            .ThenInclude(s => s!.Member)
                        .Where(t => t.VoucherId == targetTxn.VoucherId.Value)
                        .ToListAsync();
                }
                else
                {
                    pairedTxns = new List<ShareTransaction> { targetTxn };
                }

                var outTxn = pairedTxns.FirstOrDefault(t => t.TransactionType == "Transfer-Out");
                var inTxn = pairedTxns.FirstOrDefault(t => t.TransactionType == "Transfer-In");

                if (outTxn != null && inTxn != null)
                {
                    var fromAccount = await _context.ShareAccounts.FindAsync(outTxn.ShareAccountId);
                    var toAccount = await _context.ShareAccounts.FindAsync(inTxn.ShareAccountId);

                    if (fromAccount == null || toAccount == null)
                    {
                        return BadRequest("संबंधित शेअर खाती सापडली नाहीत.");
                    }

                    // Check if transferee still has enough shares
                    if (toAccount.TotalShareCount < inTxn.NumberOfShares)
                    {
                        return BadRequest($"घेणाऱ्या सभासदाच्या खात्यावर पुरेसे शेअर्स उपलब्ध नसल्याने (चालू शेअर्स: {toAccount.TotalShareCount}) हे हस्तांतरण रद्द करता येत नाही.");
                    }

                    // 1. Revert Share Account Balances
                    fromAccount.TotalShareCount += outTxn.NumberOfShares;
                    fromAccount.TotalShareAmount += outTxn.Amount;
                    _context.Entry(fromAccount).State = EntityState.Modified;

                    toAccount.TotalShareCount -= inTxn.NumberOfShares;
                    toAccount.TotalShareAmount -= inTxn.Amount;
                    _context.Entry(toAccount).State = EntityState.Modified;

                    // 2. Revert Share Certificates
                    var transfereeCerts = await _context.ShareCertificates
                        .Where(c => c.ShareAccountId == toAccount.ShareAccountId && c.Status == "Active" && c.NumberOfShares == inTxn.NumberOfShares)
                        .OrderByDescending(c => c.CertificateId)
                        .ToListAsync();

                    if (transfereeCerts.Any())
                    {
                        var certToCancel = transfereeCerts.First();
                        certToCancel.Status = "Cancelled";
                        certToCancel.CancellationReason = $"Transfer Reversal: Cancelled transfer from Member ID {fromAccount.MemberId}";
                        certToCancel.ModifiedDate = DateTime.UtcNow;
                        _context.Entry(certToCancel).State = EntityState.Modified;
                    }

                    // Restore Transferor's certificate if any marked as Transferred
                    var transferorCerts = await _context.ShareCertificates
                        .Where(c => c.ShareAccountId == fromAccount.ShareAccountId && c.Status == "Transferred")
                        .OrderByDescending(c => c.CertificateId)
                        .ToListAsync();

                    if (transferorCerts.Any())
                    {
                        var certToRestore = transferorCerts.First();
                        certToRestore.Status = "Active";
                        certToRestore.CancellationReason = null;
                        certToRestore.ModifiedDate = DateTime.UtcNow;
                        _context.Entry(certToRestore).State = EntityState.Modified;
                    }

                    // 3. Cancel Journal Voucher
                    if (targetTxn.VoucherId.HasValue)
                    {
                        var jv = await _context.Vouchers.FindAsync(targetTxn.VoucherId.Value);
                        if (jv != null)
                        {
                            jv.Status = "Cancelled";
                            jv.Narration = $"[CANCELLED / REVERSED] {jv.Narration}";
                            _context.Entry(jv).State = EntityState.Modified;
                        }
                    }

                    // 4. Remove or mark Transactions
                    _context.ShareTransactions.RemoveRange(pairedTxns);
                }
                else
                {
                    // Fallback for single transaction
                    var acc = await _context.ShareAccounts.FindAsync(targetTxn.ShareAccountId);
                    if (acc != null)
                    {
                        if (targetTxn.TransactionType == "Transfer-Out")
                        {
                            acc.TotalShareCount += targetTxn.NumberOfShares;
                            acc.TotalShareAmount += targetTxn.Amount;
                        }
                        else if (targetTxn.TransactionType == "Transfer-In")
                        {
                            acc.TotalShareCount -= targetTxn.NumberOfShares;
                            acc.TotalShareAmount -= targetTxn.Amount;
                        }
                        _context.Entry(acc).State = EntityState.Modified;
                    }
                    _context.ShareTransactions.Remove(targetTxn);
                }

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new { message = "शेअर हस्तांतरण नोंद यशस्वीरित्या रद्द (Reversed) करण्यात आली आहे!" });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"रद्दीकरण प्रक्रिया अयशस्वी: {ex.Message}");
            }
        }

        // GET: api/ShareAccounts/Transactions/Member/5 or api/ShareAccounts/TransactionsByMember/5
        [HttpGet("Transactions/Member/{memberId}")]
        [HttpGet("TransactionsByMember/{memberId}")]
        public async Task<IActionResult> GetMemberTransactions(int memberId)
        {
            var account = await _context.ShareAccounts.FirstOrDefaultAsync(s => s.MemberId == memberId);
            if (account == null)
            {
                return Ok(new List<object>());
            }

            var transactions = await _context.ShareTransactions
                .Include(t => t.Voucher)
                    .ThenInclude(v => v!.VoucherDetails)
                        .ThenInclude(vd => vd.Ledger)
                .Where(t => t.ShareAccountId == account.ShareAccountId)
                .OrderByDescending(t => t.TransactionDate)
                .ThenByDescending(t => t.TransactionId)
                .Select(t => new
                {
                    t.TransactionId,
                    t.ShareAccountId,
                    t.TransactionDate,
                    t.TransactionType,
                    t.NumberOfShares,
                    t.Amount,
                    t.Narration,
                    t.VoucherId,
                    VoucherNo = t.Voucher != null ? t.Voucher.VoucherNo : null,
                    VoucherType = t.Voucher != null ? t.Voucher.VoucherType : null,
                    VoucherStatus = t.Voucher != null ? t.Voucher.Status : null,
                    PaymentMode = t.Voucher != null && t.Voucher.VoucherDetails != null && t.Voucher.VoucherDetails.Any(vd => vd.DrCr == "Dr" && vd.Ledger != null)
                        ? t.Voucher.VoucherDetails.First(vd => vd.DrCr == "Dr").Ledger!.LedgerName
                        : "रोख"
                })
                .ToListAsync();

            return Ok(transactions);
        }

        // GET: api/ShareAccounts/AllTransactions
        [HttpGet("AllTransactions")]
        public async Task<IActionResult> GetAllTransactions([FromQuery] int? branchId, [FromQuery] string? type, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            var query = _context.ShareTransactions
                .Include(t => t.ShareAccount)
                    .ThenInclude(s => s!.Member)
                .Include(t => t.Voucher)
                .Where(t => t.TransactionType != "OpeningBalance")
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(t => t.ShareAccount != null && t.ShareAccount.Member != null && t.ShareAccount.Member.BranchID == branchId.Value);
            }

            if (!string.IsNullOrWhiteSpace(type) && type != "All")
            {
                query = query.Where(t => t.TransactionType == type);
            }

            if (fromDate.HasValue)
            {
                query = query.Where(t => t.TransactionDate >= fromDate.Value.Date);
            }

            if (toDate.HasValue)
            {
                query = query.Where(t => t.TransactionDate <= toDate.Value.Date);
            }

            var transactions = await query
                .OrderByDescending(t => t.TransactionDate)
                .ThenByDescending(t => t.TransactionId)
                .Take(250)
                .Select(t => new
                {
                    t.TransactionId,
                    t.ShareAccountId,
                    MemberId = t.ShareAccount != null ? t.ShareAccount.MemberId : 0,
                    MemberCode = t.ShareAccount != null && t.ShareAccount.Member != null ? t.ShareAccount.Member.MemberCode : "",
                    MemberName = t.ShareAccount != null && t.ShareAccount.Member != null ? $"{t.ShareAccount.Member.FirstName} {t.ShareAccount.Member.LastName}" : "अज्ञात",
                    AccountNo = t.ShareAccount != null ? t.ShareAccount.AccountNo : "",
                    t.TransactionDate,
                    t.TransactionType,
                    t.NumberOfShares,
                    t.Amount,
                    t.Narration,
                    t.VoucherId,
                    VoucherNo = t.Voucher != null ? t.Voucher.VoucherNo : null,
                    VoucherStatus = t.Voucher != null ? t.Voucher.Status : null
                })
                .ToListAsync();

            return Ok(transactions);
        }

        public class CancelAllotmentRequest
        {
            public string Reason { get; set; } = string.Empty;
        }

        // POST: api/ShareAccounts/CancelAllotment/5
        [HttpPost("CancelAllotment/{transactionId}")]
        public async Task<IActionResult> CancelAllotment(int transactionId, [FromBody] CancelAllotmentRequest request)
        {
            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var txn = await _context.ShareTransactions
                    .Include(t => t.ShareAccount)
                        .ThenInclude(s => s!.Member)
                    .Include(t => t.Voucher)
                        .ThenInclude(v => v!.VoucherDetails)
                    .FirstOrDefaultAsync(t => t.TransactionId == transactionId);

                if (txn == null) return NotFound("शेअर व्यवहार नोंद सापडली नाही.");

                if (txn.TransactionType != "Allotment")
                {
                    return BadRequest("फक्त शेअर वाटप (Allotment) नोंदीच या पर्यायातून रद्द करता येतात.");
                }

                var account = txn.ShareAccount;
                if (account == null)
                {
                    account = await _context.ShareAccounts.FindAsync(txn.ShareAccountId);
                }

                if (account == null)
                {
                    return BadRequest("संबंधित शेअर खाते सापडले नाही.");
                }

                if (account.TotalShareCount < txn.NumberOfShares)
                {
                    return BadRequest($"सभासदाच्या खात्यावर चालू शेअर्स {account.TotalShareCount} आहेत, जे रद्द करावयाच्या {txn.NumberOfShares} शेअर्सपेक्षा कमी असल्याने हे वाटप रद्द करता येत नाही.");
                }

                // 1. Rollback Share Account Totals
                account.TotalShareCount -= txn.NumberOfShares;
                account.TotalShareAmount -= txn.Amount;
                _context.Entry(account).State = EntityState.Modified;

                // 2. Find and Cancel matching Share Certificate
                var certs = await _context.ShareCertificates
                    .Where(c => c.ShareAccountId == account.ShareAccountId && c.Status == "Active" && c.NumberOfShares == txn.NumberOfShares)
                    .OrderByDescending(c => c.CertificateId)
                    .ToListAsync();

                if (certs.Any())
                {
                    var certToCancel = certs.First();
                    certToCancel.Status = "Cancelled";
                    certToCancel.CancellationReason = $"Allotment Cancelled: {request.Reason}";
                    certToCancel.ModifiedDate = DateTime.UtcNow;
                    _context.Entry(certToCancel).State = EntityState.Modified;
                }

                // 3. Cancel or Reverse Accounting Voucher
                if (txn.VoucherId.HasValue)
                {
                    var vch = await _context.Vouchers
                        .Include(v => v.VoucherDetails)
                        .FirstOrDefaultAsync(v => v.VoucherID == txn.VoucherId.Value);

                    if (vch != null)
                    {
                        vch.Status = "Cancelled";
                        vch.Narration = $"[CANCELLED / REVERSED - {request.Reason}] {vch.Narration}";
                        _context.Entry(vch).State = EntityState.Modified;

                        // If it affected a Saving account (Transfer mode), refund / reverse saving balance
                        if (vch.VoucherType == "Journal")
                        {
                            var savingDr = vch.VoucherDetails.FirstOrDefault(vd => vd.DrCr == "Dr");
                            if (savingDr != null)
                            {
                                var savAcc = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.LedgerID == savingDr.LedgerID);
                                if (savAcc != null)
                                {
                                    savAcc.CurrentBalance += txn.Amount;
                                    _context.Entry(savAcc).State = EntityState.Modified;

                                    _context.SavingTransactions.Add(new SavingTransaction
                                    {
                                        SavingAccountID = savAcc.SavingAccountID,
                                        CustomerID = savAcc.CustomerID,
                                        TransactionDate = DateTime.Today,
                                        TransactionType = "Deposit",
                                        PaymentMode = "Transfer",
                                        Amount = txn.Amount,
                                        BalanceAfterTxn = savAcc.CurrentBalance,
                                        Narration = $"शेअर वाटप रद्दीकरण परतावा (Share Allotment Cancellation Reversal): {request.Reason}",
                                        CreatedBy = 1,
                                        CreatedOn = DateTime.Now
                                    });
                                }
                            }
                        }
                    }
                }

                // 4. Remove Transaction
                _context.ShareTransactions.Remove(txn);

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new { message = $"शेअर वाटप नोंद (शेअर्स: {txn.NumberOfShares}, रक्कम: ₹{txn.Amount:F2}) यशस्वीरित्या रद्द व रिव्हर्स करण्यात आली!" });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"रद्दीकरण प्रक्रिया अयशस्वी: {ex.Message}");
            }
        }

        public class UpdateTransactionRequest
        {
            public DateTime? TransactionDate { get; set; }
            public string? Narration { get; set; }
        }

        // PUT: api/ShareAccounts/UpdateTransaction/5
        [HttpPut("UpdateTransaction/{transactionId}")]
        public async Task<IActionResult> UpdateTransaction(int transactionId, [FromBody] UpdateTransactionRequest request)
        {
            try
            {
                var txn = await _context.ShareTransactions
                    .Include(t => t.Voucher)
                    .FirstOrDefaultAsync(t => t.TransactionId == transactionId);

                if (txn == null) return NotFound("शेअर व्यवहार नोंद सापडली नाही.");

                if (request.TransactionDate.HasValue)
                {
                    txn.TransactionDate = request.TransactionDate.Value.Date;
                }

                if (!string.IsNullOrWhiteSpace(request.Narration))
                {
                    txn.Narration = request.Narration.Trim();
                }

                if (txn.Voucher != null)
                {
                    if (request.TransactionDate.HasValue)
                    {
                        txn.Voucher.VoucherDate = request.TransactionDate.Value.Date;
                    }
                    if (!string.IsNullOrWhiteSpace(request.Narration))
                    {
                        var currentNarration = txn.Voucher.Narration ?? "";
                        txn.Voucher.Narration = $"{currentNarration.Split(" - Edited:")[0]} - Edited: {request.Narration}".Trim();
                    }
                    _context.Entry(txn.Voucher).State = EntityState.Modified;
                }

                _context.Entry(txn).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                return Ok(new { message = "व्यवहार तपशील यशस्वीरित्या अद्ययावत केला!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"अद्ययावत करताना त्रुटी: {ex.Message}");
            }
        }
    }
}
