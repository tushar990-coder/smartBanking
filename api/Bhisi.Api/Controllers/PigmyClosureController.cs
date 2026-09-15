using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

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
            public int TenureDays { get; set; }
            public decimal TotalDepositedAmount { get; set; }
            public bool IsPremature { get; set; }
            public decimal PrematurePenaltyRate { get; set; }
            public decimal PrematurePenaltyAmount { get; set; }
            public decimal NetPayable { get; set; }
            public bool HasActiveLoanLien { get; set; }
            public decimal TotalLoanLiability { get; set; }
            public List<ActiveLoanDto> ActiveLoans { get; set; } = new List<ActiveLoanDto>();
        }

        public class ClosureRequest
        {
            public string AccountNo { get; set; } = string.Empty;
            public int BranchId { get; set; } = 1;
            public string Narration { get; set; } = string.Empty;
            public bool ManagerOverrideConfirmed { get; set; } = false;
        }

        // GET: api/PigmyClosure/Preview/{accountNo}
        [HttpGet("Preview/{accountNo}")]
        public async Task<ActionResult<ClosurePreviewResult>> PreviewClosure(string accountNo)
        {
            var account = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .FirstOrDefaultAsync(a => a.AccountNo == accountNo);

            if (account == null) return NotFound("Account not found.");
            if (account.Status == "Closed") return BadRequest("Account is already closed.");

            bool isPremature = DateTime.Today < account.MaturityDate;
            int tenureDays = Math.Max(0, (int)(DateTime.Today - account.OpeningDate).TotalDays);

            // Premature Penalty Slab calculation:
            // < 90 days: 2.0% deduction
            // 90 - 179 days: 1.0% deduction
            // >= 180 days (premature): 0.5% deduction
            // Matured: 0% deduction
            decimal penaltyRate = 0m;
            if (isPremature && account.TotalDepositedAmount > 0)
            {
                if (tenureDays < 90) penaltyRate = 2.0m;
                else if (tenureDays < 180) penaltyRate = 1.0m;
                else penaltyRate = 0.5m;
            }

            decimal penaltyAmount = Math.Round(account.TotalDepositedAmount * (penaltyRate / 100m), 2);
            decimal netPayable = Math.Max(0, account.TotalDepositedAmount - penaltyAmount);

            // Active Loan / Lien Check for this customer/member
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
                TenureDays = tenureDays,
                TotalDepositedAmount = account.TotalDepositedAmount,
                IsPremature = isPremature,
                PrematurePenaltyRate = penaltyRate,
                PrematurePenaltyAmount = penaltyAmount,
                NetPayable = netPayable,
                HasActiveLoanLien = hasActiveLoanLien,
                TotalLoanLiability = totalLoanLiability,
                ActiveLoans = activeLoans
            });
        }

        // POST: api/PigmyClosure/Close
        [HttpPost("Close")]
        public async Task<IActionResult> CloseAccount([FromBody] ClosureRequest request)
        {
            var account = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Include(a => a.PigmyScheme)
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

            // 2. Compute Premature Penalty & Net Payout
            bool isPremature = DateTime.Today < account.MaturityDate;
            int tenureDays = Math.Max(0, (int)(DateTime.Today - account.OpeningDate).TotalDays);

            decimal penaltyRate = 0m;
            if (isPremature && account.TotalDepositedAmount > 0)
            {
                if (tenureDays < 90) penaltyRate = 2.0m;
                else if (tenureDays < 180) penaltyRate = 1.0m;
                else penaltyRate = 0.5m;
            }

            decimal penaltyAmount = Math.Round(account.TotalDepositedAmount * (penaltyRate / 100m), 2);
            decimal netPayable = Math.Max(0, account.TotalDepositedAmount - penaltyAmount);

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

                int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.BranchId, "PIGMY");
                var cashLedger = await _context.Ledgers.FindAsync(branchCashId);
                if (cashLedger == null)
                {
                    cashLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Assets") ?? await _context.Ledgers.FirstAsync();
                }

                var todayStr = DateTime.Now.ToString("yyyyMMdd");
                var lastVoucher = await _context.Vouchers.OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync();
                int nextSeq = (lastVoucher?.VoucherID ?? 0) + 1;

                string typeLabel = isPremature ? "Premature " : "";
                string overrideNotice = request.ManagerOverrideConfirmed ? " [Manager Override Active Loan Lien]" : "";
                string penaltyNotice = penaltyAmount > 0 ? $" (Penalty: ₹{penaltyAmount:N2} @ {penaltyRate}%)" : "";

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

                // If premature penalty applied, credit Penalty Income GL
                if (penaltyAmount > 0)
                {
                    var penaltyLedger = await _context.Ledgers.FirstOrDefaultAsync(l => 
                        l.LedgerName.Contains("पिग्मी दंड") || 
                        l.LedgerName.Contains("दंड") || 
                        l.LedgerName.Contains("Penalty") || 
                        (l.AccountType == "Income" && l.LedgerName.Contains("विविध")));

                    int penaltyLedgerId = penaltyLedger?.LedgerID ?? cashLedger.LedgerID;

                    voucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = penaltyLedgerId,
                        CustomerID = account.CustomerID,
                        DrCr = "Cr",
                        Amount = penaltyAmount
                    });
                }

                var voucher = new Voucher
                {
                    BranchID = request.BranchId,
                    VoucherNo = $"VCH-CLO-{todayStr}-{nextSeq:D4}",
                    VoucherDate = DateTime.Today,
                    VoucherType = "Payment",
                    TotalAmount = account.TotalDepositedAmount,
                    Narration = $"{typeLabel}Pigmy Closure Payout for A/c {account.AccountNo} - {account.Customer?.FirstName}.{penaltyNotice}{overrideNotice} {request.Narration}".Trim(),
                    CreatedBy = 1,
                    VoucherDetails = voucherDetails
                };

                _context.Vouchers.Add(voucher);

                // Record Pigmy Transaction (Withdrawal/Payout)
                var closureTx = new PigmyTransaction
                {
                    PigmyAccountID = account.PigmyAccountID,
                    TransactionDate = DateTime.Today,
                    ValueDate = DateTime.Today,
                    TransactionType = "WITHDRAWAL",
                    DrAmount = account.TotalDepositedAmount,
                    CrAmount = 0,
                    BalanceAmount = 0,
                    Narration = $"{typeLabel}Pigmy Account Closure Payout - Vch: {voucher.VoucherNo}{penaltyNotice}",
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
                    voucherNo = voucher.VoucherNo,
                    totalDeposited = account.TotalDepositedAmount,
                    penaltyAmount = penaltyAmount,
                    netPayable = netPayable
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "खाते बंद करताना सर्व्हर त्रुटी आली: " + ex.Message);
            }
        }
    }
}
