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

        public class ClosurePreviewResult
        {
            public int PigmyAccountId { get; set; }
            public string AccountNo { get; set; } = string.Empty;
            public string MemberName { get; set; } = string.Empty;
            public DateTime OpeningDate { get; set; }
            public DateTime MaturityDate { get; set; }
            public decimal TotalDepositedAmount { get; set; }
            public decimal NetPayable { get; set; }
            public bool IsPremature { get; set; }
        }

        // GET: api/PigmyClosure/Preview/{accountNo}
        [HttpGet("Preview/{accountNo}")]
        public async Task<ActionResult<ClosurePreviewResult>> PreviewClosure(string accountNo)
        {
            var account = await _context.PigmyAccounts
                .Include(a => a.Member)
                .FirstOrDefaultAsync(a => a.AccountNo == accountNo);

            if (account == null) return NotFound("Account not found.");
            if (account.Status == "Closed") return BadRequest("Account is already closed.");

            bool isPremature = DateTime.Today < account.MaturityDate;
            
            // Standard policy: pay out exactly what is in TotalDepositedAmount (Principal + previously posted Interest)
            decimal netPayable = account.TotalDepositedAmount;

            // In a more complex scenario, we would calculate partial-month interest here
            // or deduct 2% penalty if isPremature is true.
            // As per instructions, assuming 0% penalty for now.

            return Ok(new ClosurePreviewResult
            {
                PigmyAccountId = account.PigmyAccountID,
                AccountNo = account.AccountNo,
                MemberName = account.Member != null ? account.Member.FirstName + " " + account.Member.LastName : "",
                OpeningDate = account.OpeningDate,
                MaturityDate = account.MaturityDate,
                TotalDepositedAmount = account.TotalDepositedAmount,
                NetPayable = netPayable,
                IsPremature = isPremature
            });
        }

        public class ClosureRequest
        {
            public string AccountNo { get; set; } = string.Empty;
            public int BranchId { get; set; } = 1;
            public string Narration { get; set; } = string.Empty;
        }

        // POST: api/PigmyClosure/Close
        [HttpPost("Close")]
        public async Task<IActionResult> CloseAccount([FromBody] ClosureRequest request)
        {
            var account = await _context.PigmyAccounts
                .Include(a => a.Member)
                .Include(a => a.PigmyScheme)
                .FirstOrDefaultAsync(a => a.AccountNo == request.AccountNo);

            if (account == null) return NotFound("Account not found.");
            if (account.Status == "Closed") return BadRequest("Account is already closed.");

            decimal netPayable = account.TotalDepositedAmount;
            if (netPayable <= 0)
            {
                // Account has zero balance, just close it without voucher
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

                string typeLabel = DateTime.Today < account.MaturityDate ? "Premature " : "";
                
                var voucher = new Voucher
                {
                    BranchID = request.BranchId,
                    VoucherNo = $"VCH-CLO-{todayStr}-{nextSeq:D4}",
                    VoucherDate = DateTime.Today,
                    VoucherType = "Payment",
                    TotalAmount = netPayable,
                    Narration = $"{typeLabel}Pigmy Closure Payout for A/c {account.AccountNo} - {account.Member?.FirstName}. {request.Narration}",
                    CreatedBy = 1,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        // Liability reduced -> Debit
                        new VoucherDetail { LedgerID = liabilityLedger.LedgerID, DrCr = "Dr", Amount = netPayable },
                        // Cash goes out -> Credit
                        new VoucherDetail { LedgerID = cashLedger.LedgerID, DrCr = "Cr", Amount = netPayable }
                    }
                };

                _context.Vouchers.Add(voucher);

                // Record Pigmy Transaction (Withdrawal/Payout) for ledger history
                var closureTx = new PigmyTransaction
                {
                    PigmyAccountID = account.PigmyAccountID,
                    TransactionDate = DateTime.Today,
                    ValueDate = DateTime.Today,
                    TransactionType = "WITHDRAWAL",
                    DrAmount = netPayable,
                    CrAmount = 0,
                    BalanceAmount = 0,
                    Narration = $"{typeLabel}Pigmy Account Closure Payout - Vch: {voucher.VoucherNo}",
                    MakerId = 1,
                    PostedOn = DateTime.Now
                };
                _context.PigmyTransactions.Add(closureTx);
                
                // Set account status to Closed
                account.Status = "Closed";
                account.TotalDepositedAmount = 0; // Balance becomes 0 after payout

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "Account successfully closed and payout voucher generated.", voucherNo = voucher.VoucherNo, amountPaid = netPayable });
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "Internal Server Error during closure.");
            }
        }
    }
}
