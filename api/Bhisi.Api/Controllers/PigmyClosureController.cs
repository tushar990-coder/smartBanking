using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Helpers;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PigmyClosureController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PigmyClosureController(AppDbContext context)
        {
            _context = context;
        }

        public class ActiveLoanDto
        {
            public int LoanAccountId { get; set; }
            public string LoanAccountNo { get; set; } = string.Empty;
            public string LoanType { get; set; } = string.Empty;
            public decimal PrincipalBalance { get; set; }
            public decimal OverdueInterest { get; set; }
            public decimal TotalOutstanding { get; set; }
        }

        public class ClosurePreviewResult
        {
            public int PigmyAccountId { get; set; }
            public string AccountNo { get; set; } = string.Empty;
            public string MemberName { get; set; } = string.Empty;
            public string CIFNo { get; set; } = string.Empty;
            public DateTime OpeningDate { get; set; }
            public DateTime MaturityDate { get; set; }
            public DateTime CycleStartDate { get; set; }
            public int CurrentCycleNumber { get; set; } = 1;
            public int TenureDaysInCycle { get; set; }
            public decimal TenureMonthsInCycle { get; set; }
            public decimal TotalDepositedAmount { get; set; }
            public decimal TotalWithdrawnAmount { get; set; }
            public bool IsPremature { get; set; }
            public decimal PrematurePenaltyRate { get; set; }
            public decimal PrematurePenaltyAmount { get; set; }
            public decimal PrematureInterestRate { get; set; }
            public decimal PrematureInterestAmount { get; set; }
            public decimal NetPayable { get; set; }
            public string PolicyNote { get; set; } = string.Empty;
            public bool HasActiveLoanLien { get; set; }
            public decimal TotalLoanLiability { get; set; }
            public List<ActiveLoanDto> ActiveLoans { get; set; } = new List<ActiveLoanDto>();
        }

        public class ClosureRequest
        {
            public string AccountNo { get; set; } = string.Empty;
            public int BranchId { get; set; } = 1;
            public DateTime? ClosureDate { get; set; }
            public string Narration { get; set; } = string.Empty;
            public bool ManagerOverrideConfirmed { get; set; } = false;
        }

        public class WithdrawalPreviewResult
        {
            public int PigmyAccountId { get; set; }
            public string AccountNo { get; set; } = string.Empty;
            public string MemberName { get; set; } = string.Empty;
            public string CIFNo { get; set; } = string.Empty;
            public decimal CurrentBalance { get; set; }
            public decimal RequestedAmount { get; set; }
            public int CurrentCycleNumber { get; set; }
            public DateTime CycleStartDate { get; set; }
            public int ElapsedDays { get; set; }
            public decimal ElapsedMonths { get; set; }
            public decimal AppliedPenaltyRate { get; set; }
            public decimal AppliedPenaltyAmount { get; set; }
            public decimal AppliedInterestRate { get; set; }
            public decimal AppliedInterestAmount { get; set; }
            public decimal NetPaidAmount { get; set; }
            public decimal RemainingBalance { get; set; }
            public string PolicyNote { get; set; } = string.Empty;
            public DateTime NextCycleStartDate { get; set; }
            public DateTime FixedMaturityDate { get; set; }
            public bool HasActiveLoanLien { get; set; }
            public decimal TotalLoanLiability { get; set; }
            public List<ActiveLoanDto> ActiveLoans { get; set; } = new List<ActiveLoanDto>();
        }

        public class WithdrawalRequest
        {
            public string AccountNo { get; set; } = string.Empty;
            public decimal Amount { get; set; }
            public int BranchId { get; set; } = 1;
            public DateTime? WithdrawalDate { get; set; }
            public string Narration { get; set; } = string.Empty;
            public bool ManagerOverrideConfirmed { get; set; } = false;
        }

        private static (PigmySchemeInterestSlab? slab, decimal penaltyRate, decimal interestRate, string note) GetApplicableSlab(
            PigmyScheme? scheme,
            int elapsedDays,
            bool isPremature)
        {
            if (scheme?.Slabs != null && scheme.Slabs.Any())
            {
                var sorted = scheme.Slabs.OrderBy(s => s.FromDays).ToList();
                var match = sorted.FirstOrDefault(s =>
                    elapsedDays >= s.FromDays &&
                    elapsedDays <= s.ToDays);

                if (match == null && elapsedDays >= sorted.Last().FromDays)
                {
                    match = sorted.Last();
                }

                if (match != null)
                {
                    decimal pen = Convert.ToDecimal(match.PenaltyRate);
                    decimal intr = Convert.ToDecimal(match.InterestRate);
                    string desc = match.SlabDescription ?? $"{match.FromDays} ते {match.ToDays} दिवस";
                    return (match, pen, intr, desc);
                }
            }

            // Graceful fallback for legacy/old schemes with no child slab rows:
            // Dynamically uses the scheme's own saved rates from PigmySchemes table!
            decimal penRate = scheme?.PenaltyInterestRate ?? 2.0m;
            decimal premRate = scheme?.PrematureInterestRate ?? 5.5m;
            decimal fullRate = scheme?.InterestRate ?? 6.5m;

            if (isPremature)
            {
                if (elapsedDays <= 90) return (null, penRate, 0.0m, $"० ते ९० दिवस ({penRate}% दंड आकारणी)");
                if (elapsedDays <= 180) return (null, 0.0m, 0.0m, "९१ ते १८० दिवस (मुद्दल परत, ०% व्याज)");
                return (null, 0.0m, premRate, $"१८१ ते ३३५ दिवस ({premRate}% अकाली व्याज)");
            }
            return (null, 0.0m, fullRate, $"३३६ ते ३६५ दिवस ({fullRate}% पूर्ण व्याज)");
        }

        // GET: api/PigmyClosure/Preview/{accountNo}
        [HttpGet("Preview/{accountNo}")]
        public async Task<ActionResult<ClosurePreviewResult>> PreviewClosure(string accountNo)
        {
            var account = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Include(a => a.PigmyScheme)
                    .ThenInclude(s => s!.Slabs)
                .FirstOrDefaultAsync(a => a.AccountNo == accountNo);

            if (account == null) return NotFound("Account not found.");
            if (account.Status == "Closed") return BadRequest("Account is already closed.");

            bool isPremature = DateTime.Today < account.MaturityDate;
            DateTime cycleStart = account.EffectiveStartDate ?? account.OpeningDate;
            int tenureDaysInCycle = Math.Max(0, (int)(DateTime.Today - cycleStart).TotalDays);
            decimal tenureMonthsInCycle = Math.Round((decimal)tenureDaysInCycle / 30.416m, 2);

            var (appliedSlab, penaltyRate, interestRate, policyNote) = GetApplicableSlab(account.PigmyScheme, tenureDaysInCycle, isPremature);

            decimal penaltyAmount = Math.Round(account.TotalDepositedAmount * (penaltyRate / 100m), 2);
            decimal interestAmount = Math.Round(account.TotalDepositedAmount * (interestRate / 100m), 2);
            decimal netPayable = Math.Max(0, account.TotalDepositedAmount - penaltyAmount + interestAmount);

            // Active Loan / Lien Check
            var memberId = await _context.Members
                .Where(m => m.CustomerID == account.CustomerID)
                .Select(m => (int?)m.MemberID)
                .FirstOrDefaultAsync();

            var activeLoans = await _context.LoanAccounts
                .Include(l => l.LoanRate)
                .Where(l => (l.CustomerID == account.CustomerID || (memberId.HasValue && l.MemberID == memberId.Value))
                            && l.Status != "Closed" && (l.PrincipalBalance > 0 || l.OverdueInterestBalance > 0 || l.InterestBalance > 0))
                .Select(l => new ActiveLoanDto
                {
                    LoanAccountId = l.LoanAccountID,
                    LoanAccountNo = l.LoanAccountNo ?? "",
                    LoanType = l.LoanRate != null ? l.LoanRate.LoanType : "कर्ज खाते",
                    PrincipalBalance = l.PrincipalBalance,
                    OverdueInterest = l.OverdueInterestBalance + l.InterestBalance,
                    TotalOutstanding = l.PrincipalBalance + l.OverdueInterestBalance + l.InterestBalance
                })
                .ToListAsync();

            bool hasActiveLoanLien = activeLoans.Any(l => l.TotalOutstanding > 0);
            decimal totalLoanLiability = activeLoans.Sum(l => l.TotalOutstanding);

            return Ok(new ClosurePreviewResult
            {
                PigmyAccountId = account.PigmyAccountID,
                AccountNo = account.AccountNo,
                MemberName = account.Customer != null ? (account.Customer.FirstName + " " + (account.Customer.LastName ?? "")).Trim() : "",
                CIFNo = account.Customer?.CIFNo ?? "",
                OpeningDate = account.OpeningDate,
                MaturityDate = account.MaturityDate,
                CycleStartDate = cycleStart,
                CurrentCycleNumber = account.CurrentCycleNumber,
                TenureDaysInCycle = tenureDaysInCycle,
                TenureMonthsInCycle = tenureMonthsInCycle,
                TotalDepositedAmount = account.TotalDepositedAmount,
                TotalWithdrawnAmount = account.TotalWithdrawnAmount,
                IsPremature = isPremature,
                PrematurePenaltyRate = penaltyRate,
                PrematurePenaltyAmount = penaltyAmount,
                PrematureInterestRate = interestRate,
                PrematureInterestAmount = interestAmount,
                NetPayable = netPayable,
                PolicyNote = policyNote,
                HasActiveLoanLien = hasActiveLoanLien,
                TotalLoanLiability = totalLoanLiability,
                ActiveLoans = activeLoans
            });
        }

        // GET: api/PigmyClosure/PreviewWithdrawal/{accountNo}?amount=5000
        [HttpGet("PreviewWithdrawal/{accountNo}")]
        public async Task<ActionResult<WithdrawalPreviewResult>> PreviewWithdrawal(string accountNo, [FromQuery] decimal amount)
        {
            if (amount <= 0)
            {
                return BadRequest("कृपया वैध विड्रॉल रक्कम प्रविष्ट करा (Amount must be > 0).");
            }

            var account = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Include(a => a.PigmyScheme)
                    .ThenInclude(s => s!.Slabs)
                .FirstOrDefaultAsync(a => a.AccountNo == accountNo);

            if (account == null) return NotFound("Account not found.");
            if (account.Status == "Closed") return BadRequest("Account is already closed.");
            if (amount > account.TotalDepositedAmount)
            {
                return BadRequest($"खात्यातील जमा शिल्लक ₹{account.TotalDepositedAmount:N2} पेक्षा जास्त रक्कम काढता येणार नाही.");
            }

            DateTime cycleStart = account.EffectiveStartDate ?? account.OpeningDate;
            int elapsedDays = Math.Max(0, (int)(DateTime.Today - cycleStart).TotalDays);
            decimal elapsedMonths = Math.Round((decimal)elapsedDays / 30.416m, 2);

            bool isPremature = DateTime.Today < account.MaturityDate;
            var (appliedSlab, penaltyRate, interestRate, policyNote) = GetApplicableSlab(account.PigmyScheme, elapsedDays, isPremature);

            decimal penaltyAmount = Math.Round(amount * (penaltyRate / 100m), 2);
            decimal interestAmount = Math.Round(amount * (interestRate / 100m), 2);
            decimal netPaid = Math.Max(0, amount - penaltyAmount + interestAmount);
            decimal remainingBalance = Math.Max(0, account.TotalDepositedAmount - amount);

            // Active Loan / Lien Check
            var memberId = await _context.Members
                .Where(m => m.CustomerID == account.CustomerID)
                .Select(m => (int?)m.MemberID)
                .FirstOrDefaultAsync();

            var activeLoans = await _context.LoanAccounts
                .Include(l => l.LoanRate)
                .Where(l => (l.CustomerID == account.CustomerID || (memberId.HasValue && l.MemberID == memberId.Value))
                            && l.Status != "Closed" && (l.PrincipalBalance > 0 || l.OverdueInterestBalance > 0 || l.InterestBalance > 0))
                .Select(l => new ActiveLoanDto
                {
                    LoanAccountId = l.LoanAccountID,
                    LoanAccountNo = l.LoanAccountNo ?? "",
                    LoanType = l.LoanRate != null ? l.LoanRate.LoanType : "कर्ज खाते",
                    PrincipalBalance = l.PrincipalBalance,
                    OverdueInterest = l.OverdueInterestBalance + l.InterestBalance,
                    TotalOutstanding = l.PrincipalBalance + l.OverdueInterestBalance + l.InterestBalance
                })
                .ToListAsync();

            bool hasActiveLoanLien = activeLoans.Any(l => l.TotalOutstanding > 0);
            decimal totalLoanLiability = activeLoans.Sum(l => l.TotalOutstanding);

            return Ok(new WithdrawalPreviewResult
            {
                PigmyAccountId = account.PigmyAccountID,
                AccountNo = account.AccountNo,
                MemberName = account.Customer != null ? (account.Customer.FirstName + " " + (account.Customer.LastName ?? "")).Trim() : "",
                CIFNo = account.Customer?.CIFNo ?? "",
                CurrentBalance = account.TotalDepositedAmount,
                RequestedAmount = amount,
                CurrentCycleNumber = account.CurrentCycleNumber,
                CycleStartDate = cycleStart,
                ElapsedDays = elapsedDays,
                ElapsedMonths = elapsedMonths,
                AppliedPenaltyRate = penaltyRate,
                AppliedPenaltyAmount = penaltyAmount,
                AppliedInterestRate = interestRate,
                AppliedInterestAmount = interestAmount,
                NetPaidAmount = netPaid,
                RemainingBalance = remainingBalance,
                PolicyNote = policyNote,
                NextCycleStartDate = DateTime.Today, // 🌟 Day 1 Reset
                FixedMaturityDate = account.MaturityDate, // 🌟 Fixed Expiry
                HasActiveLoanLien = hasActiveLoanLien,
                TotalLoanLiability = totalLoanLiability,
                ActiveLoans = activeLoans
            });
        }

        // POST: api/PigmyClosure/Withdraw
        [HttpPost("Withdraw")]
        public async Task<IActionResult> WithdrawAmount([FromBody] WithdrawalRequest request)
        {
            if (request.Amount <= 0)
            {
                return BadRequest("कृपया वैध विड्रॉल रक्कम प्रविष्ट करा (Amount must be > 0).");
            }

            var account = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Include(a => a.PigmyScheme)
                    .ThenInclude(s => s!.Slabs)
                .FirstOrDefaultAsync(a => a.AccountNo == request.AccountNo);

            if (account == null) return NotFound("Account not found.");
            if (account.Status == "Closed") return BadRequest("Account is already closed.");
            if (request.Amount > account.TotalDepositedAmount)
            {
                return BadRequest($"खात्यातील जमा शिल्लक ₹{account.TotalDepositedAmount:N2} पेक्षा जास्त रक्कम काढता येणार नाही.");
            }

            // 1. Verify Active Loan / Lien Protection
            var memberId = await _context.Members
                .Where(m => m.CustomerID == account.CustomerID)
                .Select(m => (int?)m.MemberID)
                .FirstOrDefaultAsync();

            var activeLoans = await _context.LoanAccounts
                .Where(l => (l.CustomerID == account.CustomerID || (memberId.HasValue && l.MemberID == memberId.Value))
                            && l.Status != "Closed" && (l.PrincipalBalance > 0 || l.OverdueInterestBalance > 0 || l.InterestBalance > 0))
                .Select(l => new ActiveLoanDto
                {
                    LoanAccountId = l.LoanAccountID,
                    LoanAccountNo = l.LoanAccountNo ?? "",
                    PrincipalBalance = l.PrincipalBalance,
                    OverdueInterest = l.OverdueInterestBalance + l.InterestBalance,
                    TotalOutstanding = l.PrincipalBalance + l.OverdueInterestBalance + l.InterestBalance
                })
                .ToListAsync();

            bool hasActiveLoanLien = activeLoans.Any(l => l.TotalOutstanding > 0);
            decimal totalLoanLiability = activeLoans.Sum(l => l.TotalOutstanding);

            if (hasActiveLoanLien && !request.ManagerOverrideConfirmed)
            {
                return BadRequest(new
                {
                    error = "ACTIVE_LOAN_LIEN",
                    message = $"सदर खातेदाराकडे एकूण ₹{totalLoanLiability:N2} चे सक्रिय कर्ज थकीत आहे. विड्रॉल करण्यापूर्वी कर्ज खाते तपासावे किंवा विशेष व्यवस्थापक संमती (Manager Override) आवश्यक आहे.",
                    activeLoans = activeLoans
                });
            }

            if (account.IsLienMarked)
            {
                decimal lienAmt = account.LienAmount ?? account.TotalDepositedAmount;
                decimal freeBalance = Math.Max(0, account.TotalDepositedAmount - lienAmt);
                if (request.Amount > freeBalance)
                {
                    return BadRequest(new
                    {
                        error = "ACCOUNT_LIEN_MARKED",
                        message = $"सदर पिग्मी खात्यावर कर्ज खाते क्र. '{account.LienLoanAccountNo ?? "अज्ञात"}' चा तारण बोजा (Lien: ₹{lienAmt:N2}) नोंदवला आहे. बोजा वजा जाता उपलब्ध रक्कम ₹{freeBalance:N2} आहे, त्यामुळे ₹{request.Amount:N2} विड्रॉल करता येणार नाही."
                    });
                }
            }

            DateTime cycleStart = account.EffectiveStartDate ?? account.OpeningDate;
            int elapsedDays = Math.Max(0, (int)(DateTime.Today - cycleStart).TotalDays);
            decimal elapsedMonths = Math.Round((decimal)elapsedDays / 30.416m, 2);

            bool isPremature = DateTime.Today < account.MaturityDate;
            var (appliedSlab, penaltyRate, interestRate, policyNote) = GetApplicableSlab(account.PigmyScheme, elapsedDays, isPremature);

            decimal penaltyAmount = Math.Round(request.Amount * (penaltyRate / 100m), 2);
            decimal interestAmount = Math.Round(request.Amount * (interestRate / 100m), 2);
            decimal netPaid = Math.Max(0, request.Amount - penaltyAmount + interestAmount);
            decimal newBalance = Math.Max(0, account.TotalDepositedAmount - request.Amount);

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // GL Ledgers
                Ledger? liabilityLedger = null;
                if (account.PigmyScheme?.PigmyLiabilityLedgerID.HasValue == true && account.PigmyScheme.PigmyLiabilityLedgerID > 0)
                {
                    liabilityLedger = await _context.Ledgers.FindAsync(account.PigmyScheme.PigmyLiabilityLedgerID);
                }
                if (liabilityLedger == null)
                {
                    liabilityLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("Pigmy Deposit"))
                        ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy"))
                        ?? await _context.Ledgers.FirstAsync();
                }

                int userBranchId = User.GetOperatingBranchId();
                int counterBranchId = userBranchId > 0 ? userBranchId : (request.BranchId > 0 ? request.BranchId : (account.BranchID > 0 ? account.BranchID : 1));
                int homeBranchId = account.BranchID > 0 ? account.BranchID : 1;
                bool isCrossBranchTxn = (counterBranchId != homeBranchId);

                int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, counterBranchId, "PIGMY");
                var cashLedger = await _context.Ledgers.FindAsync(branchCashId)
                    ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Assets")
                    ?? await _context.Ledgers.FirstAsync();

                DateTime effDate = request.WithdrawalDate?.Date ?? DateTime.Today;
                var todayStr = effDate.ToString("yyyyMMdd");
                var lastVoucher = await _context.Vouchers.OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync();
                int nextSeq = (lastVoucher?.VoucherID ?? 0) + 1;

                string penaltyNotice = penaltyAmount > 0 ? $" (दंड: ₹{penaltyAmount:N2} @ {penaltyRate}%)" : "";

                int penaltyLedgerId = cashLedger.LedgerID;
                if (penaltyAmount > 0)
                {
                    var penaltyLedger = await _context.Ledgers.FirstOrDefaultAsync(l =>
                        l.LedgerName.Contains("पिग्मी दंड") ||
                        l.LedgerName.Contains("दंड") ||
                        l.LedgerName.Contains("Penalty") ||
                        (l.AccountType == "Income" && l.LedgerName.Contains("विविध")));

                    penaltyLedgerId = penaltyLedger?.LedgerID ?? cashLedger.LedgerID;
                }

                int expenseLedgerId = account.PigmyScheme?.InterestExpenseLedgerID ?? liabilityLedger.LedgerID;
                string finalVoucherNo;

                if (!isCrossBranchTxn)
                {
                    // Standard Single-Branch Voucher
                    var voucherDetails = new List<VoucherDetail>
                    {
                        // Debit Liability with requested gross amount
                        new VoucherDetail
                        {
                            LedgerID = liabilityLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            DrCr = "Dr",
                            Amount = request.Amount
                        },
                        // Credit Cash with net paid
                        new VoucherDetail
                        {
                            LedgerID = cashLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            DrCr = "Cr",
                            Amount = netPaid
                        }
                    };

                    if (penaltyAmount > 0)
                    {
                        voucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = penaltyLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Cr",
                            Amount = penaltyAmount
                        });
                    }

                    if (interestAmount > 0)
                    {
                        voucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = expenseLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Dr",
                            Amount = interestAmount
                        });
                    }

                    var voucher = new Voucher
                    {
                        BranchID = homeBranchId,
                        VoucherNo = $"VCH-WDR-{todayStr}-{nextSeq:D4}",
                        VoucherDate = effDate,
                        VoucherType = "Payment",
                        TotalAmount = request.Amount + interestAmount,
                        Narration = $"पिग्मी अंशतः विड्रॉल (सायकल #{account.CurrentCycleNumber}) खाते {account.AccountNo} - {account.Customer?.FirstName}. {penaltyNotice} {request.Narration}".Trim(),
                        CreatedBy = 1,
                        VoucherDetails = voucherDetails
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();
                    finalVoucherNo = voucher.VoucherNo;
                }
                else
                {
                    // CBS Dual-Voucher IBT Engine for Cross-Branch Pigmy Withdrawal
                    int ibtLedgerId = await Helpers.IbtLedgerHelper.GetIbtLedgerIdAsync(_context, counterBranchId, homeBranchId);

                    // 1. Counter Voucher (Branch A, Payment): Dr IBT, Cr Cash
                    var counterVoucher = new Voucher
                    {
                        BranchID = counterBranchId,
                        VoucherNo = $"PV-{counterBranchId}-{todayStr}-PIGMY-WDR-{nextSeq:D4}",
                        VoucherDate = effDate,
                        VoucherType = "Payment",
                        TotalAmount = netPaid,
                        Narration = $"[आंतर-शाखा पिग्मी विड्रॉल] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) साठी काऊंटरवर रोख परतावा अदा. {penaltyNotice} {request.Narration}".Trim(),
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now,
                        IsIbtVoucher = true,
                        TargetBranchID = homeBranchId
                    };
                    _context.Vouchers.Add(counterVoucher);
                    await _context.SaveChangesAsync();

                    // Dr IBT
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = counterVoucher.VoucherID,
                        LedgerID = ibtLedgerId,
                        CustomerID = account.CustomerID,
                        DrCr = "Dr",
                        Amount = netPaid
                    });
                    // Cr Cash
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = counterVoucher.VoucherID,
                        LedgerID = cashLedger.LedgerID,
                        CustomerID = account.CustomerID,
                        DrCr = "Cr",
                        Amount = netPaid
                    });

                    // 2. Home Branch Voucher (Branch B, Journal): Dr Pigmy Liability, Dr Interest Expense, Cr Penalty, Cr IBT
                    var homeVoucher = new Voucher
                    {
                        BranchID = homeBranchId,
                        VoucherNo = $"JV-PIGMY-WDR-{todayStr}-{nextSeq:D4}",
                        VoucherDate = effDate,
                        VoucherType = "Journal",
                        TotalAmount = request.Amount + interestAmount,
                        Narration = $"[आंतर-शाखा पिग्मी विड्रॉल] काऊंटर शाखा #{counterBranchId} वरून विड्रॉल अदा (सायकल #{account.CurrentCycleNumber}, खाते: {account.AccountNo}). {penaltyNotice} {request.Narration}".Trim(),
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now,
                        IsIbtVoucher = true,
                        TargetBranchID = counterBranchId,
                        RelatedVoucherID = counterVoucher.VoucherID
                    };
                    _context.Vouchers.Add(homeVoucher);
                    await _context.SaveChangesAsync();

                    counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                    // Dr Pigmy Liability
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = homeVoucher.VoucherID,
                        LedgerID = liabilityLedger.LedgerID,
                        CustomerID = account.CustomerID,
                        DrCr = "Dr",
                        Amount = request.Amount
                    });

                    // Dr Interest Expense
                    if (interestAmount > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = expenseLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Dr",
                            Amount = interestAmount
                        });
                    }

                    // Cr Penalty Income
                    if (penaltyAmount > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = penaltyLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Cr",
                            Amount = penaltyAmount
                        });
                    }

                    // Cr IBT
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = homeVoucher.VoucherID,
                        LedgerID = ibtLedgerId,
                        CustomerID = account.CustomerID,
                        DrCr = "Cr",
                        Amount = netPaid
                    });

                    finalVoucherNo = counterVoucher.VoucherNo;
                }

                // Record Audit in PigmyWithdrawals
                var withdrawalRecord = new PigmyWithdrawal
                {
                    PigmyAccountID = account.PigmyAccountID,
                    WithdrawalDate = effDate,
                    CycleNumber = account.CurrentCycleNumber,
                    CycleStartSnapshot = cycleStart,
                    ElapsedDays = elapsedDays,
                    ElapsedMonths = elapsedMonths,
                    RequestedAmount = request.Amount,
                    AppliedSlabID = appliedSlab?.SlabID,
                    PenaltyRate = penaltyRate,
                    PenaltyAmount = penaltyAmount,
                    InterestRate = interestRate,
                    InterestAmount = interestAmount,
                    NetPaidAmount = netPaid,
                    RemainingBalance = newBalance,
                    VoucherNo = finalVoucherNo,
                    Narration = request.Narration,
                    CreatedBy = 1,
                    CreatedDate = DateTime.UtcNow
                };
                _context.PigmyWithdrawals.Add(withdrawalRecord);

                // Record PigmyTransaction for Passbook
                int oldCycle = account.CurrentCycleNumber;
                int newCycle = oldCycle + 1;
                var txNarration = $"अंशतः विड्रॉल ₹{request.Amount:N2} (सायकल #{oldCycle} पूर्ण) | उर्वरित शिल्लक ₹{newBalance:N2} (नवीन सायकल #{newCycle} सुरू: {effDate:dd/MM/yyyy})";
                var pigmyTx = new PigmyTransaction
                {
                    PigmyAccountID = account.PigmyAccountID,
                    TransactionDate = effDate,
                    ValueDate = effDate,
                    TransactionType = "WITHDRAWAL",
                    DrAmount = request.Amount,
                    CrAmount = 0,
                    BalanceAmount = newBalance,
                    Narration = txNarration,
                    MakerId = 1,
                    PostedOn = DateTime.Now
                };
                _context.PigmyTransactions.Add(pigmyTx);

                // 🌟 Update PigmyAccount with THE DAY 1 RESET
                account.TotalDepositedAmount = newBalance;
                account.TotalWithdrawnAmount += request.Amount;
                account.LastWithdrawalDate = effDate;
                account.EffectiveStartDate = effDate; // Reset to Day 1
                account.CurrentCycleNumber = newCycle;      // Move to next cycle

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"विड्रॉल यशस्वी! उर्वरित शिल्लक ₹{newBalance:N2} साठी सायकल #{newCycle} (Day 1) सुरू झाली आहे.",
                    voucherNo = finalVoucherNo,
                    withdrawnAmount = request.Amount,
                    penaltyAmount = penaltyAmount,
                    interestAmount = interestAmount,
                    netPaid = netPaid,
                    remainingBalance = newBalance,
                    newCycleNumber = newCycle,
                    effectiveStartDate = account.EffectiveStartDate?.ToString("yyyy-MM-dd"),
                    fixedMaturityDate = account.MaturityDate.ToString("yyyy-MM-dd")
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "विड्रॉल प्रक्रिया पूर्ण करताना त्रुटी आली: " + ex.Message);
            }
        }

        // GET: api/PigmyClosure/WithdrawalsHistory/{accountNo}
        [HttpGet("WithdrawalsHistory/{accountNo}")]
        public async Task<ActionResult<IEnumerable<object>>> GetWithdrawalsHistory(string accountNo)
        {
            var account = await _context.PigmyAccounts.FirstOrDefaultAsync(a => a.AccountNo == accountNo);
            if (account == null) return NotFound("Account not found.");

            var history = await _context.PigmyWithdrawals
                .Include(w => w.AppliedSlab)
                .Where(w => w.PigmyAccountID == account.PigmyAccountID)
                .OrderByDescending(w => w.WithdrawalDate)
                .Select(w => new
                {
                    w.WithdrawalID,
                    w.WithdrawalDate,
                    w.CycleNumber,
                    w.CycleStartSnapshot,
                    w.ElapsedDays,
                    w.ElapsedMonths,
                    w.RequestedAmount,
                    w.PenaltyRate,
                    w.PenaltyAmount,
                    w.InterestRate,
                    w.InterestAmount,
                    w.NetPaidAmount,
                    w.RemainingBalance,
                    w.VoucherNo,
                    w.Narration,
                    SlabDescription = w.AppliedSlab != null ? w.AppliedSlab.SlabDescription : ""
                })
                .ToListAsync();

            return Ok(history);
        }

        // POST: api/PigmyClosure/Close
        [HttpPost("Close")]
        public async Task<IActionResult> CloseAccount([FromBody] ClosureRequest request)
        {
            var account = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Include(a => a.PigmyScheme)
                    .ThenInclude(s => s!.Slabs)
                .FirstOrDefaultAsync(a => a.AccountNo == request.AccountNo);

            if (account == null) return NotFound("Account not found.");
            if (account.Status == "Closed") return BadRequest("Account is already closed.");

            // 1. Verify Active Loan / Lien Protection
            var memberId = await _context.Members
                .Where(m => m.CustomerID == account.CustomerID)
                .Select(m => (int?)m.MemberID)
                .FirstOrDefaultAsync();

            var activeLoans = await _context.LoanAccounts
                .Where(l => (l.CustomerID == account.CustomerID || (memberId.HasValue && l.MemberID == memberId.Value))
                            && l.Status != "Closed" && (l.PrincipalBalance > 0 || l.OverdueInterestBalance > 0 || l.InterestBalance > 0))
                .Select(l => new ActiveLoanDto
                {
                    LoanAccountId = l.LoanAccountID,
                    LoanAccountNo = l.LoanAccountNo ?? "",
                    PrincipalBalance = l.PrincipalBalance,
                    OverdueInterest = l.OverdueInterestBalance + l.InterestBalance,
                    TotalOutstanding = l.PrincipalBalance + l.OverdueInterestBalance + l.InterestBalance
                })
                .ToListAsync();

            bool hasActiveLoanLien = activeLoans.Any(l => l.TotalOutstanding > 0);
            decimal totalLoanLiability = activeLoans.Sum(l => l.TotalOutstanding);

            if (hasActiveLoanLien && !request.ManagerOverrideConfirmed)
            {
                return BadRequest(new
                {
                    error = "ACTIVE_LOAN_LIEN",
                    message = $"सदर खातेदाराकडे एकूण ₹{totalLoanLiability:N2} चे सक्रिय कर्ज थकीत आहे. कर्ज वसुली सुरक्षेसाठी (Lien Protection) हे पिग्मी खाते बंद करण्यापूर्वी कर्ज खाते तपासावे किंवा विशेष व्यवस्थापक संमती (Manager Override) आवश्यक आहे.",
                    activeLoans = activeLoans
                });
            }

            if (account.IsLienMarked)
            {
                return BadRequest(new
                {
                    error = "ACCOUNT_LIEN_MARKED",
                    message = $"सदर पिग्मी खात्यावर कर्ज खाते क्र. '{account.LienLoanAccountNo ?? "अज्ञात"}' चा तारण बोजा (Lien: ₹{account.LienAmount ?? account.TotalDepositedAmount:N2}) नोंदवला आहे. कर्ज खाते पूर्ण नील केल्याशिवाय हे पिग्मी खाते बंद करता येत नाही."
                });
            }

            // 2. Compute Final Cycle Tenure & Dynamic Slab Outcome (Option B: Fixed Expiry Date)
            DateTime effClosureDate = request.ClosureDate?.Date ?? DateTime.Today;
            bool isPremature = effClosureDate < account.MaturityDate;
            DateTime cycleStart = account.EffectiveStartDate ?? account.OpeningDate;
            int tenureDaysInCycle = Math.Max(0, (int)(effClosureDate - cycleStart).TotalDays);
            decimal tenureMonthsInCycle = Math.Round((decimal)tenureDaysInCycle / 30.416m, 2);

            var (appliedSlab, penaltyRate, interestRate, policyNote) = GetApplicableSlab(account.PigmyScheme, tenureDaysInCycle, isPremature);

            decimal penaltyAmount = Math.Round(account.TotalDepositedAmount * (penaltyRate / 100m), 2);
            decimal interestAmount = Math.Round(account.TotalDepositedAmount * (interestRate / 100m), 2);
            decimal netPayable = Math.Max(0, account.TotalDepositedAmount - penaltyAmount + interestAmount);

            if (account.TotalDepositedAmount <= 0)
            {
                account.Status = "Closed";
                await _context.SaveChangesAsync();
                return Ok(new { message = "Account closed. Zero balance, no payout required." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                Ledger? liabilityLedger = null;
                if (account.PigmyScheme?.PigmyLiabilityLedgerID.HasValue == true && account.PigmyScheme.PigmyLiabilityLedgerID > 0)
                {
                    liabilityLedger = await _context.Ledgers.FindAsync(account.PigmyScheme.PigmyLiabilityLedgerID);
                }

                if (liabilityLedger == null)
                {
                    liabilityLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("Pigmy Deposit"))
                        ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy"))
                        ?? await _context.Ledgers.FirstAsync();
                }

                int userBranchId = User.GetOperatingBranchId();
                int counterBranchId = userBranchId > 0 ? userBranchId : (request.BranchId > 0 ? request.BranchId : (account.BranchID > 0 ? account.BranchID : 1));
                int homeBranchId = account.BranchID > 0 ? account.BranchID : 1;
                bool isCrossBranchTxn = (counterBranchId != homeBranchId);

                int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, counterBranchId, "PIGMY");
                var cashLedger = await _context.Ledgers.FindAsync(branchCashId);
                if (cashLedger == null)
                {
                    cashLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Assets") ?? await _context.Ledgers.FirstAsync();
                }

                var todayStr = effClosureDate.ToString("yyyyMMdd");
                var lastVoucher = await _context.Vouchers.OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync();
                int nextSeq = (lastVoucher?.VoucherID ?? 0) + 1;

                string typeLabel = isPremature ? "Premature " : "Maturity ";
                string overrideNotice = request.ManagerOverrideConfirmed ? " [Manager Override Active Loan Lien]" : "";
                string penaltyNotice = penaltyAmount > 0 ? $" (दंड: ₹{penaltyAmount:N2} @ {penaltyRate}%)" : "";
                string interestNotice = interestAmount > 0 ? $" (व्याज: ₹{interestAmount:N2} @ {interestRate}%)" : "";

                int penaltyLedgerId = cashLedger.LedgerID;
                if (penaltyAmount > 0)
                {
                    var penaltyLedger = await _context.Ledgers.FirstOrDefaultAsync(l => 
                        l.LedgerName.Contains("पिग्मी दंड") || 
                        l.LedgerName.Contains("दंड") || 
                        l.LedgerName.Contains("Penalty") || 
                        (l.AccountType == "Income" && l.LedgerName.Contains("विविध")));

                    penaltyLedgerId = penaltyLedger?.LedgerID ?? cashLedger.LedgerID;
                }

                int expenseLedgerId = account.PigmyScheme?.InterestExpenseLedgerID ?? liabilityLedger.LedgerID;
                string finalVoucherNo;

                if (!isCrossBranchTxn)
                {
                    // Standard Single-Branch Voucher
                    var voucherDetails = new List<VoucherDetail>
                    {
                        // Full liability debited
                        new VoucherDetail 
                        { 
                            LedgerID = liabilityLedger.LedgerID, 
                            CustomerID = account.CustomerID, 
                            DrCr = "Dr", 
                            Amount = account.TotalDepositedAmount 
                        },
                        // Net payout cash credited
                        new VoucherDetail 
                        { 
                            LedgerID = cashLedger.LedgerID, 
                            CustomerID = account.CustomerID, 
                            DrCr = "Cr", 
                            Amount = netPayable 
                        }
                    };

                    if (penaltyAmount > 0)
                    {
                        voucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = penaltyLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Cr",
                            Amount = penaltyAmount
                        });
                    }

                    if (interestAmount > 0)
                    {
                        voucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = expenseLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Dr",
                            Amount = interestAmount
                        });
                    }

                    var voucher = new Voucher
                    {
                        BranchID = homeBranchId,
                        VoucherNo = $"VCH-CLO-{todayStr}-{nextSeq:D4}",
                        VoucherDate = effClosureDate,
                        VoucherType = "Payment",
                        TotalAmount = account.TotalDepositedAmount + interestAmount,
                        Narration = $"{typeLabel}Pigmy Closure for A/c {account.AccountNo} - {account.Customer?.FirstName}. (सायकल #{account.CurrentCycleNumber}, {tenureMonthsInCycle:N1}M){penaltyNotice}{interestNotice}{overrideNotice} {request.Narration}".Trim(),
                        CreatedBy = 1,
                        VoucherDetails = voucherDetails
                    };

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();
                    finalVoucherNo = voucher.VoucherNo;
                }
                else
                {
                    // CBS Dual-Voucher IBT Engine for Cross-Branch Pigmy Closure
                    int ibtLedgerId = await Helpers.IbtLedgerHelper.GetIbtLedgerIdAsync(_context, counterBranchId, homeBranchId);

                    // 1. Counter Voucher (Branch A, Payment): Dr IBT, Cr Cash
                    var counterVoucher = new Voucher
                    {
                        BranchID = counterBranchId,
                        VoucherNo = $"PV-{counterBranchId}-{todayStr}-PIGMY-CLO-{nextSeq:D4}",
                        VoucherDate = effClosureDate,
                        VoucherType = "Payment",
                        TotalAmount = netPayable,
                        Narration = $"[आंतर-शाखा पिग्मी क्लोजर] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) साठी काऊंटरवर रोख परतावा अदा. {penaltyNotice}{interestNotice}{overrideNotice} {request.Narration}".Trim(),
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now,
                        IsIbtVoucher = true,
                        TargetBranchID = homeBranchId
                    };
                    _context.Vouchers.Add(counterVoucher);
                    await _context.SaveChangesAsync();

                    // Dr IBT
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = counterVoucher.VoucherID,
                        LedgerID = ibtLedgerId,
                        CustomerID = account.CustomerID,
                        DrCr = "Dr",
                        Amount = netPayable
                    });
                    // Cr Cash
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = counterVoucher.VoucherID,
                        LedgerID = cashLedger.LedgerID,
                        CustomerID = account.CustomerID,
                        DrCr = "Cr",
                        Amount = netPayable
                    });

                    // 2. Home Branch Voucher (Branch B, Journal): Dr Pigmy Liability, Dr Interest Expense, Cr Penalty, Cr IBT
                    var homeVoucher = new Voucher
                    {
                        BranchID = homeBranchId,
                        VoucherNo = $"JV-PIGMY-CLO-{todayStr}-{nextSeq:D4}",
                        VoucherDate = effClosureDate,
                        VoucherType = "Journal",
                        TotalAmount = account.TotalDepositedAmount + interestAmount,
                        Narration = $"[आंतर-शाखा पिग्मी क्लोजर] काऊंटर शाखा #{counterBranchId} वरून परतावा अदा ({typeLabel}खाते: {account.AccountNo}). {penaltyNotice}{interestNotice}{overrideNotice} {request.Narration}".Trim(),
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now,
                        IsIbtVoucher = true,
                        TargetBranchID = counterBranchId,
                        RelatedVoucherID = counterVoucher.VoucherID
                    };
                    _context.Vouchers.Add(homeVoucher);
                    await _context.SaveChangesAsync();

                    counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                    // Dr Pigmy Liability
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = homeVoucher.VoucherID,
                        LedgerID = liabilityLedger.LedgerID,
                        CustomerID = account.CustomerID,
                        DrCr = "Dr",
                        Amount = account.TotalDepositedAmount
                    });

                    // Dr Interest Expense
                    if (interestAmount > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = expenseLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Dr",
                            Amount = interestAmount
                        });
                    }

                    // Cr Penalty Income
                    if (penaltyAmount > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = penaltyLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Cr",
                            Amount = penaltyAmount
                        });
                    }

                    // Cr IBT
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = homeVoucher.VoucherID,
                        LedgerID = ibtLedgerId,
                        CustomerID = account.CustomerID,
                        DrCr = "Cr",
                        Amount = netPayable
                    });

                    finalVoucherNo = counterVoucher.VoucherNo;
                }

                // Record Pigmy Transaction (Withdrawal/Payout)
                var closureTx = new PigmyTransaction
                {
                    PigmyAccountID = account.PigmyAccountID,
                    TransactionDate = effClosureDate,
                    ValueDate = effClosureDate,
                    TransactionType = "WITHDRAWAL",
                    DrAmount = account.TotalDepositedAmount,
                    CrAmount = 0,
                    BalanceAmount = 0,
                    Narration = $"{typeLabel}Pigmy Account Closure Payout - Vch: {finalVoucherNo}{penaltyNotice}{interestNotice}",
                    MakerId = 1,
                    PostedOn = DateTime.Now
                };
                _context.PigmyTransactions.Add(closureTx);

                // Set account status to Closed
                account.Status = "Closed";
                account.TotalDepositedAmount = 0;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = "खाते यशस्वीरीत्या बंद करण्यात आले आणि परतावा व्हाउचर जनरेट झाले.",
                    voucherNo = finalVoucherNo,
                    totalDeposited = account.TotalDepositedAmount,
                    penaltyAmount = penaltyAmount,
                    interestAmount = interestAmount,
                    netPayable = netPayable,
                    policyNote = policyNote
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "खाते बंद करताना सर्व्हर त्रुटी आली: " + ex.Message);
            }
        }

        // GET: api/PigmyClosure/by-voucher/{voucherId}
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<IActionResult> GetClosureByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = $"व्हाउचर क्र. {voucherId} सिस्टीममध्ये सापडले नाही." });
            }

            PigmyAccount? account = null;
            PigmyWithdrawal? withdrawal = null;

            // 1. Try finding in PigmyWithdrawals by VoucherNo
            if (!string.IsNullOrEmpty(voucher.VoucherNo))
            {
                withdrawal = await _context.PigmyWithdrawals
                    .Include(w => w.PigmyAccount)
                        .ThenInclude(a => a!.Customer)
                    .Include(w => w.PigmyAccount)
                        .ThenInclude(a => a!.PigmyScheme)
                    .FirstOrDefaultAsync(w => w.VoucherNo == voucher.VoucherNo);

                if (withdrawal != null)
                {
                    account = withdrawal.PigmyAccount;
                }
            }

            // 2. Try parsing AccountNo from Narration (e.g., "खाते 1234", "A/c 1234", "account 1234")
            if (account == null && !string.IsNullOrEmpty(voucher.Narration))
            {
                var match = System.Text.RegularExpressions.Regex.Match(
                    voucher.Narration, 
                    @"(?:A\/c|खाते|Account)\s+([A-Za-z0-9\-]+)", 
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase
                );
                if (match.Success)
                {
                    string accCandidate = match.Groups[1].Value.Trim();
                    account = await _context.PigmyAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.PigmyScheme)
                        .FirstOrDefaultAsync(a => a.AccountNo == accCandidate);
                }
            }

            // 3. Fallback to Customer ID from VoucherDetails
            if (account == null)
            {
                var custId = voucher.VoucherDetails.FirstOrDefault(vd => vd.CustomerID.HasValue && vd.CustomerID.Value > 0)?.CustomerID;
                if (custId.HasValue)
                {
                    account = await _context.PigmyAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.PigmyScheme)
                        .Where(a => a.CustomerID == custId.Value)
                        .OrderByDescending(a => a.PigmyAccountID)
                        .FirstOrDefaultAsync();
                }
            }

            if (account == null)
            {
                return NotFound(new { message = $"सदर पिग्मी व्हाउचरशी (ID: {voucherId}) संबंधित खाते सापडले नाही." });
            }

            string closureType = (voucher.VoucherNo?.StartsWith("VCH-WDR-") == true || voucher.Narration?.Contains("विड्रॉल") == true)
                ? "Withdrawal"
                : "Closure";

            return Ok(new
            {
                pigmyAccount = new
                {
                    account.PigmyAccountID,
                    account.AccountNo,
                    account.CustomerID,
                    CustomerName = account.Customer != null ? (account.Customer.FirstName + " " + account.Customer.LastName).Trim() : "",
                    CIFNo = account.Customer?.CIFNo ?? "",
                    account.CurrentCycleNumber,
                    account.OpeningDate,
                    account.MaturityDate,
                    account.TotalDepositedAmount,
                    account.Status,
                    SchemeName = account.PigmyScheme?.SchemeName ?? ""
                },
                closureDetails = new
                {
                    ClosureDate = withdrawal?.WithdrawalDate ?? voucher.VoucherDate,
                    ClosureType = closureType,
                    RequestedAmount = withdrawal?.RequestedAmount ?? voucher.TotalAmount,
                    PenaltyAmount = withdrawal?.PenaltyAmount ?? 0,
                    InterestAmount = withdrawal?.InterestAmount ?? 0,
                    NetPayable = voucher.TotalAmount,
                    Narration = voucher.Narration
                },
                voucher = new
                {
                    voucher.VoucherID,
                    voucher.VoucherNo,
                    voucher.VoucherDate,
                    voucher.VoucherType,
                    voucher.TotalAmount,
                    voucher.Status,
                    voucher.Narration,
                    voucher.ApprovedBy,
                    voucher.ApprovedOn,
                    CanPass = voucher.Status == "Unapproved" || voucher.Status == "Draft" || voucher.Status == "Pending"
                }
            });
        }
    }
}
