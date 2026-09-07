using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RdAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RdAccountsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/RdAccounts/next-account-no
        [HttpGet("next-account-no")]
        public async Task<ActionResult<string>> GetNextAccountNo([FromQuery] int branchId = 1)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            string branchPrefix = branch != null ? branch.BranchCode : "BR";

            var seq = await _context.RdAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && s.ProductType == "RD");

            int nextSeq = (seq?.CurrentValue ?? 0) + 1;
            string nextAccountNo = $"{branchPrefix}-{branchId:D3}-RD-{nextSeq:D6}";
            return Content(nextAccountNo, "text/plain");
        }

        [HttpGet("next-account-no/{branchId}")]
        public async Task<ActionResult<string>> GetNextAccountNoForBranch(int branchId)
        {
            return await GetNextAccountNo(branchId);
        }

        // GET: api/RdAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetRdAccounts([FromQuery] int? branchId, [FromQuery] int? customerId = null, [FromQuery] int? memberId = null)
        {
            var query = _context.RdAccounts
                .Include(r => r.Customer)
                    .ThenInclude(c => c!.MemberProfile)
                .Include(r => r.RdScheme)
                .Include(r => r.Branch)
                .AsQueryable();

            if (branchId.HasValue)
            {
                query = query.Where(r => r.BranchID == branchId.Value);
            }
            if (customerId.HasValue && customerId.Value > 0)
            {
                query = query.Where(r => r.CustomerID == customerId.Value);
            }
            else if (memberId.HasValue && memberId.Value > 0)
            {
                query = query.Where(r => r.Customer != null && r.Customer.MemberProfile != null && r.Customer.MemberProfile.MemberID == memberId.Value);
            }

            var accounts = await query
                .OrderByDescending(r => r.OpeningDate)
                .Select(r => new {
                    r.RdAccountID,
                    r.BranchID,
                    BranchName = r.Branch != null ? r.Branch.BranchName : "",
                    r.CustomerID,
                    MemberID = r.Customer != null && r.Customer.MemberProfile != null ? (int?)r.Customer.MemberProfile.MemberID : null,
                    CIFNo = r.Customer != null ? r.Customer.CIFNo : "",
                    CustomerName = r.Customer != null 
                        ? (r.Customer.FirstName + " " + r.Customer.LastName).Trim() 
                        : "",
                    MemberName = r.Customer != null 
                        ? (r.Customer.FirstName + " " + r.Customer.LastName).Trim() 
                        : "",
                    MemberCode = r.Customer != null && r.Customer.MemberProfile != null ? r.Customer.MemberProfile.MemberCode : "",
                    r.RdSchemeID,
                    SchemeName = r.RdScheme != null ? r.RdScheme.SchemeName : "",
                    SchemeCode = r.RdScheme != null ? r.RdScheme.SchemeCode : "",
                    r.AccountNo,
                    r.OpeningDate,
                    r.InstallmentAmount,
                    r.DurationMonths,
                    r.InterestRate,
                    r.MaturityDate,
                    r.MaturityAmount,
                    r.TotalPaidInstallments,
                    r.TotalDepositedAmount,
                    r.IsLegacyAccount,
                    r.LegacyAccruedInt,
                    r.Status,
                    r.AccountType,
                    r.JointCustomerID,
                    r.GuardianName,
                    r.GuardianRelation,
                    r.PaymentMode,
                    r.SavingAccountID,
                    r.MaturityInstruction,
                    r.AgentID,
                    r.PassbookNo,
                    r.NomineeName,
                    r.NomineeRelation,
                    r.Remarks
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // GET: api/RdAccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetRdAccount(int id)
        {
            var r = await _context.RdAccounts
                .Include(x => x.Customer)
                    .ThenInclude(c => c!.MemberProfile)
                .Include(x => x.RdScheme)
                .Include(x => x.Branch)
                .FirstOrDefaultAsync(x => x.RdAccountID == id);

            if (r == null)
            {
                return NotFound();
            }

            // Get payment history details
            var history = await _context.RdTransactions
                .Where(t => t.RdAccountID == id)
                .OrderBy(t => t.TransactionDate)
                .Select(t => new {
                    t.RdTransactionID,
                    t.TransactionDate,
                    t.TransactionType,
                    t.InstallmentNo,
                    t.DebitCredit,
                    t.PrincipalAmount,
                    t.PenaltyAmount,
                    t.InterestAmount
                })
                .ToListAsync();

            return Ok(new {
                AccountDetails = new {
                    r.RdAccountID,
                    r.BranchID,
                    BranchName = r.Branch != null ? r.Branch.BranchName : "",
                    r.CustomerID,
                    CIFNo = r.Customer != null ? r.Customer.CIFNo : "",
                    CustomerName = r.Customer != null ? (r.Customer.FirstName + " " + r.Customer.LastName).Trim() : "",
                    MemberID = r.Customer != null && r.Customer.MemberProfile != null ? (int?)r.Customer.MemberProfile.MemberID : null,
                    MemberName = r.Customer != null ? (r.Customer.FirstName + " " + r.Customer.LastName).Trim() : "",
                    MemberCode = r.Customer != null && r.Customer.MemberProfile != null ? r.Customer.MemberProfile.MemberCode : "",
                    r.RdSchemeID,
                    SchemeName = r.RdScheme != null ? r.RdScheme.SchemeName : "",
                    SchemeCode = r.RdScheme != null ? r.RdScheme.SchemeCode : "",
                    r.AccountNo,
                    r.OpeningDate,
                    r.InstallmentAmount,
                    r.DurationMonths,
                    r.InterestRate,
                    r.MaturityDate,
                    r.MaturityAmount,
                    r.TotalPaidInstallments,
                    r.TotalDepositedAmount,
                    r.IsLegacyAccount,
                    r.LegacyAccruedInt,
                    r.Status,
                    r.AccountType,
                    r.JointCustomerID,
                    r.GuardianName,
                    r.GuardianRelation,
                    r.PaymentMode,
                    r.SavingAccountID,
                    r.MaturityInstruction,
                    r.AgentID,
                    r.PassbookNo,
                    r.NomineeName,
                    r.NomineeRelation,
                    r.Remarks
                },
                History = history
            });
        }

        // Helper to resolve/create Ledgers dynamically
        private async Task<Ledger> GetOrCreateLedgerAsync(string ledgerName, string groupName, string type)
        {
            var ledger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName == ledgerName);
            if (ledger == null)
            {
                var group = await _context.AccountGroups.FirstOrDefaultAsync(g => g.GroupName == groupName);
                int gId = group?.GroupID ?? 1;

                ledger = new Ledger
                {
                    LedgerName = ledgerName,
                    GroupID = gId,
                    OpeningBalance = 0,
                    OpeningBalanceType = type,
                    IsActive = true
                };
                _context.Ledgers.Add(ledger);
                await _context.SaveChangesAsync();
            }
            return ledger;
        }

        private async Task<Ledger> GetLiabilityLedgerAsync(RdScheme? scheme)
        {
            if (scheme?.RdLiabilityLedgerID.HasValue == true)
            {
                var l = await _context.Ledgers.FindAsync(scheme.RdLiabilityLedgerID.Value);
                if (l != null) return l;
            }
            return await GetOrCreateLedgerAsync("१३ मेंबर आरडी ठेव", "ठेवी", "Cr");
        }

        private async Task<Ledger> GetExpenseLedgerAsync(RdScheme? scheme)
        {
            if (scheme?.InterestExpenseLedgerID.HasValue == true)
            {
                var l = await _context.Ledgers.FindAsync(scheme.InterestExpenseLedgerID.Value);
                if (l != null) return l;
            }
            return await GetOrCreateLedgerAsync("१३४ आरडी ठेवीवरील व्याज", "ठेवीवरील व्याज", "Dr");
        }

        private async Task<Ledger> GetPayableLedgerAsync(RdScheme? scheme)
        {
            if (scheme?.InterestPayableLedgerID.HasValue == true)
            {
                var l = await _context.Ledgers.FindAsync(scheme.InterestPayableLedgerID.Value);
                if (l != null) return l;
            }
            return await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("२३ देणे सभासद ठेव व्याज") || l.LedgerName.ToLower().Contains("interest payable"))
                   ?? await GetOrCreateLedgerAsync("२३ देणे सभासद ठेव व्याज", "देणे व्याज", "Cr");
        }

        private async Task<Ledger> GetPenaltyLedgerAsync(RdScheme? scheme)
        {
            if (scheme?.PenaltyIncomeLedgerID.HasValue == true)
            {
                var l = await _context.Ledgers.FindAsync(scheme.PenaltyIncomeLedgerID.Value);
                if (l != null) return l;
            }
            return await GetOrCreateLedgerAsync("४६ आरडी दंड आकारणी", "इतर किरकोळ खर्च", "Cr");
        }

        // POST: api/RdAccounts (New Account Opening)
        [HttpPost]
        public async Task<ActionResult<RdAccount>> PostRdAccount(RdAccount account)
        {
            // Resolve Customer & Member
            if (account.CustomerID <= 0)
            {
                return BadRequest("कृपया खातेदाराची (CustomerID) निवड करा.");
            }

            var customer = await _context.Customers.FindAsync(account.CustomerID);
            if (customer == null) return BadRequest("निवडलेला ग्राहक सिस्टीममध्ये अस्तित्वात नाही.");
            if (customer.Status != "Active") return BadRequest($"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन आवर्ती ठेव (RD) खाते उघडता येत नाही. केवळ सक्रिय (Active) ग्राहकांचीच ठेव स्वीकारली जाऊ शकते.");

            var member = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
            int? linkedMemberId = member?.MemberID;

            var scheme = await _context.RdSchemes.FindAsync(account.RdSchemeID);
            if (scheme == null)
            {
                return BadRequest("Invalid RD Scheme.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // Generate Auto Account No
                    var branch = await _context.Branches.FindAsync(account.BranchID);
                    string branchPrefix = branch != null ? branch.BranchCode : "BR";

                    var seq = await _context.RdAccountSequences
                        .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "RD");
                    
                    if (seq == null)
                    {
                        seq = new RdAccountSequence { BranchID = account.BranchID, ProductType = "RD", CurrentValue = 0 };
                        _context.RdAccountSequences.Add(seq);
                    }
                    
                    seq.CurrentValue += 1;
                    await _context.SaveChangesAsync();

                    account.AccountNo = $"{branchPrefix}-{account.BranchID:D3}-RD-{seq.CurrentValue:D6}";

                    // Calculations
                    account.InstallmentAmount = scheme.InstallmentAmount;
                    account.DurationMonths = scheme.DurationMonths;
                    account.InterestRate = scheme.InterestRate;
                    account.MaturityDate = account.OpeningDate.AddMonths(scheme.DurationMonths);

                    // IBA Quarterly Compounding Formula for RD Maturity Amount
                    double p = (double)scheme.InstallmentAmount;
                    double r = (double)scheme.InterestRate;
                    int n = scheme.DurationMonths;

                    double totalMaturity = 0;
                    for (int k = 1; k <= n; k++)
                    {
                        int monthsInBank = n - k + 1;
                        double factor = Math.Pow(1.0 + (r / 400.0), monthsInBank / 3.0);
                        totalMaturity += p * factor;
                    }

                    account.MaturityAmount = Math.Round((decimal)totalMaturity);

                    account.TotalPaidInstallments = 1; // Pay first installment on open
                    account.TotalDepositedAmount = scheme.InstallmentAmount;
                    account.Status = "Active";
                    account.IsLegacyAccount = false;
                    account.LegacyAccruedInt = 0;
                    account.FinancialYearID = (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID ?? 1;

                    _context.RdAccounts.Add(account);
                    await _context.SaveChangesAsync();

                    // Auto-debit from Saving Account if PaymentMode == AutoDebit_Saving
                    if (account.PaymentMode == "AutoDebit_Saving" && account.SavingAccountID.HasValue && account.SavingAccountID.Value > 0)
                    {
                        var sbAcc = await _context.SavingAccountMasters.FindAsync(account.SavingAccountID.Value);
                        if (sbAcc != null && sbAcc.CurrentBalance >= account.InstallmentAmount)
                        {
                            sbAcc.CurrentBalance -= account.InstallmentAmount;
                            _context.SavingTransactions.Add(new SavingTransaction
                            {
                                SavingAccountID = sbAcc.SavingAccountID,
                                CustomerID = sbAcc.CustomerID,
                                TransactionDate = account.OpeningDate,
                                TransactionType = "Withdrawal",
                                PaymentMode = "Transfer",
                                Amount = account.InstallmentAmount,
                                BalanceAfterTxn = sbAcc.CurrentBalance,
                                Narration = $"आरडी खाते हप्ता क्र. १ ऑटो-डेबिट: {account.AccountNo}",
                                CreatedBy = account.CreatedBy
                            });
                        }
                    }

                    // Accounting
                    var rdLiabilityLedger = await GetLiabilityLedgerAsync(scheme);
                    int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "RD");
                    var cashLedger = await _context.Ledgers.FindAsync(branchCashId);

                    if (rdLiabilityLedger != null && cashLedger != null)
                    {
                        var (vStatus, appBy, appOn) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, account.InstallmentAmount, account.CreatedBy);
                        var voucher = new Voucher
                        {
                            BranchID = account.BranchID,
                            VoucherNo = $"JV-RD-OP-{account.AccountNo}",
                            VoucherDate = account.OpeningDate,
                            VoucherType = "Receipt",
                            Status = vStatus,
                            ApprovedBy = appBy,
                            ApprovedOn = appOn,
                            TotalAmount = account.InstallmentAmount,
                            Narration = account.PaymentMode == "AutoDebit_Saving" 
                                ? $"नवीन आरडी खाते हप्ता क्र. १ (बचत खात्यातून ऑटो-डेबिट): {account.AccountNo}" 
                                : $"नवीन आरडी खाते हप्ता क्र. १ भरून उघडले: {account.AccountNo}",
                            CreatedBy = account.CreatedBy,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();


                        // Dr Cash / Saving, Cr RD Liability
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = cashLedger.LedgerID, DrCr = "Dr", Amount = account.InstallmentAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Cr", Amount = account.InstallmentAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        
                        await _context.SaveChangesAsync();

                        // Log Transaction Detail
                        var tx = new RdTransaction
                        {
                            BranchID = account.BranchID,
                            RdAccountID = account.RdAccountID,
                            VoucherID = voucher.VoucherID,
                            TransactionDate = account.OpeningDate,
                            TransactionType = "Installment",
                            InstallmentNo = 1,
                            DebitCredit = "Cr",
                            PrincipalAmount = account.InstallmentAmount,
                            PenaltyAmount = 0,
                            InterestAmount = 0,
                            CreatedBy = account.CreatedBy
                        };
                        _context.RdTransactions.Add(tx);
                        await _context.SaveChangesAsync();
                    }

                    await transaction.CommitAsync();
                    return CreatedAtAction("GetRdAccount", new { id = account.RdAccountID }, account);
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    string msg = ex.Message + (ex.InnerException != null ? " | " + ex.InnerException.Message : "");
                    return BadRequest("नवीन आरडी खाते उघडताना त्रुटी आली: " + msg);
                }
            }
        }

        // POST: api/RdAccounts/Migrate
        [HttpPost("Migrate")]
        public async Task<ActionResult<RdAccount>> MigrateRdAccount(RdAccount account)
        {
            if (account.CustomerID <= 0)
            {
                return BadRequest("कृपया खातेदाराची (CustomerID) निवड करा.");
            }
            var customer = await _context.Customers.FindAsync(account.CustomerID);
            if (customer == null) return BadRequest("निवडलेला ग्राहक सिस्टीममध्ये अस्तित्वात नाही.");
            if (customer.Status != "Active") return BadRequest($"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे जुने आवर्ती ठेव (RD) खाते मायग्रेट करता येत नाही.");

            if (account.InstallmentAmount <= 0)
            {
                return BadRequest("Invalid installment amount.");
            }

            if (string.IsNullOrWhiteSpace(account.AccountNo) || account.AccountNo == "AUTO")
            {
                var branch = await _context.Branches.FindAsync(account.BranchID);
                string branchPrefix = branch != null ? branch.BranchCode : "BR";

                var seq = await _context.RdAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "RD");
                
                if (seq == null)
                {
                    seq = new RdAccountSequence { BranchID = account.BranchID, ProductType = "RD", CurrentValue = 0 };
                    _context.RdAccountSequences.Add(seq);
                }
                
                seq.CurrentValue += 1;
                await _context.SaveChangesAsync();

                account.AccountNo = $"{branchPrefix}-{account.BranchID:D3}-RD-{seq.CurrentValue:D6}";
            }

            account.IsLegacyAccount = true;
            account.Status = "Active";
            account.FinancialYearID = (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID ?? 1;

            _context.RdAccounts.Add(account);
            await _context.SaveChangesAsync();

            // Insert initial migration transaction mapping log
            var dummyVoucher = await _context.Vouchers.FirstOrDefaultAsync() ?? new Voucher { VoucherID = 1, VoucherNo = "DUMMY", VoucherType = "Journal" };

            var tx = new RdTransaction
            {
                BranchID = account.BranchID,
                RdAccountID = account.RdAccountID,
                VoucherID = dummyVoucher.VoucherID,
                TransactionDate = account.OpeningDate,
                TransactionType = "Installment",
                InstallmentNo = account.TotalPaidInstallments,
                DebitCredit = "Cr",
                PrincipalAmount = account.TotalDepositedAmount,
                PenaltyAmount = 0,
                InterestAmount = 0,
                CreatedBy = account.CreatedBy
            };
            _context.RdTransactions.Add(tx);

            if (account.LegacyAccruedInt > 0)
            {
                var intTx = new RdTransaction
                {
                    BranchID = account.BranchID,
                    RdAccountID = account.RdAccountID,
                    VoucherID = dummyVoucher.VoucherID,
                    TransactionDate = account.OpeningDate,
                    TransactionType = "Accrual",
                    DebitCredit = "Cr",
                    PrincipalAmount = 0,
                    PenaltyAmount = 0,
                    InterestAmount = account.LegacyAccruedInt,
                    CreatedBy = account.CreatedBy
                };
                _context.RdTransactions.Add(intTx);
            }

            await _context.SaveChangesAsync();
            return Ok(account);
        }

        // DELETE: api/RdAccounts/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRdAccount(int id)
        {
            var account = await _context.RdAccounts
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (account == null)
            {
                return NotFound(new { message = "आरडी खाते सापडले नाही." });
            }

            var transactions = await _context.RdTransactions.Where(t => t.RdAccountID == id).ToListAsync();
            if (transactions.Any(t => t.TransactionType != "Installment" && t.TransactionType != "Accrual" && t.TransactionType != "Opening"))
            {
                return BadRequest(new { message = "हे खाते डिलीट करता येणार नाही कारण या खात्यावर नंतरचे व्यवहार झाले आहेत." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (transactions.Any())
                {
                    _context.RdTransactions.RemoveRange(transactions);
                }

                var accruals = await _context.RdInterestAccruals.Where(a => a.RdAccountID == id).ToListAsync();
                if (accruals.Any())
                {
                    _context.RdInterestAccruals.RemoveRange(accruals);
                }

                // Check and rollback sequence if this was the latest account
                var seq = await _context.RdAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "RD");
                if (seq != null)
                {
                    var remainingMaxSeq = await _context.RdAccounts
                        .Where(a => a.BranchID == account.BranchID && a.RdAccountID != id)
                        .Select(a => a.AccountNo)
                        .ToListAsync();

                    int maxNum = 0;
                    foreach (var accNo in remainingMaxSeq)
                    {
                        var parts = accNo.Split('-');
                        if (parts.Length > 0 && int.TryParse(parts.Last(), out int parsed))
                        {
                            if (parsed > maxNum) maxNum = parsed;
                        }
                    }
                    seq.CurrentValue = maxNum;
                    _context.RdAccountSequences.Update(seq);
                }

                _context.RdAccounts.Remove(account);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "आरडी खाते यशस्वीरीत्या डिलीट केले." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = $"खाते डिलीट करताना त्रुटी आली: {ex.Message}" });
            }
        }

        // POST: api/RdAccounts/5/CollectInstallment
        [HttpPost("{id}/CollectInstallment")]
        public async Task<IActionResult> CollectInstallment(int id, [FromQuery] int count, [FromQuery] decimal penaltyAmount, [FromQuery] string payMode = "Cash")
        {
            var account = await _context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (account == null || account.Status == "Closed")
            {
                return BadRequest("Account is closed or invalid.");
            }

            int currentPaid = account.TotalPaidInstallments;
            int totalDuration = account.DurationMonths;

            if (currentPaid + count > totalDuration)
            {
                return BadRequest($"हप्ते कमाल मर्यादा संपली आहे. केवळ {totalDuration - currentPaid} हप्ते भरता येतील.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    decimal totalInstallmentPrincipal = account.InstallmentAmount * count;
                    decimal totalReceived = totalInstallmentPrincipal + penaltyAmount;

                    // Update account state
                    account.TotalPaidInstallments += count;
                    account.TotalDepositedAmount += totalInstallmentPrincipal;
                    if (account.TotalPaidInstallments >= totalDuration)
                    {
                        account.Status = "Matured";
                    }
                    await _context.SaveChangesAsync();

                    // Accounting Vouchers
                    var rdLiabilityLedger = await GetLiabilityLedgerAsync(account.RdScheme);
                    int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "RD");
                    var cashLedger = await _context.Ledgers.FindAsync(branchCashId);
                    var penaltyLedger = await GetPenaltyLedgerAsync(account.RdScheme);

                    var (vStatusColl, appByColl, appOnColl) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, totalReceived, 1);
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"JV-RD-COLL-{account.AccountNo}-{currentPaid + 1}",
                        VoucherDate = DateTime.Today,
                        VoucherType = "Receipt",
                        Status = vStatusColl,
                        ApprovedBy = appByColl,
                        ApprovedOn = appOnColl,
                        TotalAmount = totalReceived,
                        Narration = $"आरडी हप्ता भरणा (RD Collection) - हप्ता क्र. {currentPaid + 1} ते {currentPaid + count}, दंड: ₹{penaltyAmount}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();


                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;

                    // Dr Cash / Bank
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = cashLedger?.LedgerID ?? 1, DrCr = "Dr", Amount = totalReceived, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                    
                    // Cr RD Liability
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Cr", Amount = totalInstallmentPrincipal, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                    // Cr Penalty Income
                    if (penaltyAmount > 0 && penaltyLedger != null)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = penaltyLedger.LedgerID, DrCr = "Cr", Amount = penaltyAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                    }
                    await _context.SaveChangesAsync();

                    // Log transactions
                    for (int i = 1; i <= count; i++)
                    {
                        var tx = new RdTransaction
                        {
                            BranchID = account.BranchID,
                            RdAccountID = account.RdAccountID,
                            VoucherID = voucher.VoucherID,
                            TransactionDate = DateTime.Now,
                            TransactionType = "Installment",
                            InstallmentNo = currentPaid + i,
                            DebitCredit = "Cr",
                            PrincipalAmount = account.InstallmentAmount,
                            PenaltyAmount = i == count ? penaltyAmount : 0, // Apply penalty on the batch closure
                            InterestAmount = 0,
                            CreatedBy = 1
                        };
                        _context.RdTransactions.Add(tx);
                    }
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { Message = "हप्ते यशस्वीरित्या जमा झाले!", NewTotalPaid = account.TotalPaidInstallments, Status = account.Status });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("हप्ते भरताना त्रुटी आली: " + ex.Message);
                }
            }
        }

        // POST: api/RdAccounts/AccrueInterest
        [HttpPost("AccrueInterest")]
        public async Task<IActionResult> AccrueInterest([FromQuery] int branchId, [FromQuery] DateTime accrualDate)
        {
            var activeAccounts = await _context.RdAccounts
                .Include(r => r.RdScheme)
                .Where(r => r.BranchID == branchId && (r.Status == "Active" || r.Status == "Matured"))
                .ToListAsync();

            if (!activeAccounts.Any())
            {
                return Ok("No active RD accounts found for interest provision.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    decimal totalProvisionAmount = 0;
                    var defaultScheme = activeAccounts.FirstOrDefault()?.RdScheme;
                    var expenseLedger = await GetExpenseLedgerAsync(defaultScheme);
                    var payableLedger = await GetPayableLedgerAsync(defaultScheme);

                    if (expenseLedger == null || payableLedger == null)
                    {
                        return BadRequest("Required ledgers not found.");
                    }

                    var voucher = new Voucher
                    {
                        BranchID = branchId,
                        VoucherNo = $"JV-RD-PROV-{accrualDate:yyyyMMdd}",
                        VoucherDate = accrualDate,
                        VoucherType = "Journal",
                        TotalAmount = 0,
                        Narration = $"आरडी व्याज तरतूद (RD Interest Provision): {accrualDate:dd/MM/yyyy}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    foreach (var acc in activeAccounts)
                    {
                        // Standard calculation: monthly interest on cumulative balance
                        // Interest = (Deposited Principal * Rate * 90) / 36500 (Quarterly approximation)
                        var lastAccrual = await _context.RdInterestAccruals
                            .Where(a => a.RdAccountID == acc.RdAccountID)
                            .OrderByDescending(a => a.AccrualDate)
                            .FirstOrDefaultAsync();

                        DateTime fromDate = lastAccrual?.AccrualDate ?? acc.OpeningDate;
                        int days = (accrualDate - fromDate).Days;
                        if (days <= 0) continue;

                        decimal quarterlyInt = Math.Round((acc.TotalDepositedAmount * acc.InterestRate * days) / 36500.0m, 2);

                        if (quarterlyInt > 0)
                        {
                            totalProvisionAmount += quarterlyInt;

                            _context.RdInterestAccruals.Add(new RdInterestAccrual
                            {
                                BranchID = branchId,
                                RdAccountID = acc.RdAccountID,
                                VoucherID = voucher.VoucherID,
                                AccrualDate = accrualDate,
                                InterestAmount = quarterlyInt,
                                IsPosted = true
                            });

                            _context.RdTransactions.Add(new RdTransaction
                            {
                                BranchID = branchId,
                                RdAccountID = acc.RdAccountID,
                                VoucherID = voucher.VoucherID,
                                TransactionDate = accrualDate,
                                TransactionType = "Accrual",
                                DebitCredit = "Cr",
                                PrincipalAmount = 0,
                                PenaltyAmount = 0,
                                InterestAmount = quarterlyInt
                            });
                        }
                    }

                    if (totalProvisionAmount > 0)
                    {
                        voucher.TotalAmount = totalProvisionAmount;
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = totalProvisionAmount });
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Cr", Amount = totalProvisionAmount });
                        
                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        return Ok($"Successfully provisioned RD interest: ₹{totalProvisionAmount:F2}");
                    }
                    else
                    {
                        await transaction.RollbackAsync();
                        return Ok("No interest to provision.");
                    }
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to process provision: " + ex.Message);
                }
            }
        }

        // POST: api/RdAccounts/5/MaturedClose
        [HttpPost("{id}/MaturedClose")]
        public async Task<IActionResult> MaturedClose(int id)
        {
            var account = await _context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (account == null || account.Status == "Closed")
            {
                return BadRequest("Account is closed or invalid.");
            }

            // Sum accrued interest
            var accruedInt = await _context.RdTransactions
                .Where(t => t.RdAccountID == id && t.TransactionType == "Accrual")
                .SumAsync(t => t.InterestAmount) + account.LegacyAccruedInt;

            decimal totalPayout = account.TotalDepositedAmount + accruedInt;

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    account.Status = "Closed";
                    await _context.SaveChangesAsync();

                    var rdLiabilityLedger = await GetLiabilityLedgerAsync(account.RdScheme);
                    var payableLedger = await GetPayableLedgerAsync(account.RdScheme);
                    int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "RD");
                    var cashLedger = await _context.Ledgers.FindAsync(branchCashId);

                    if (rdLiabilityLedger == null || cashLedger == null)
                    {
                        return BadRequest("Required ledgers not found.");
                    }

                    // Create Voucher
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"JV-RD-CLOSE-{account.AccountNo}",
                        VoucherDate = DateTime.Today,
                        VoucherType = "Payment",
                        TotalAmount = totalPayout,
                        Narration = $"आरडी मुदतपूर्ती पेआउट (RD Maturity Close): {account.AccountNo}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;

                    // Dr RD Liability
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.TotalDepositedAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                    
                    // Dr Interest Payable
                    if (payableLedger != null && accruedInt > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = accruedInt, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                    }

                    // Cr Cash
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = cashLedger.LedgerID, DrCr = "Cr", Amount = totalPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                    // Log closed transaction details
                    _context.RdTransactions.Add(new RdTransaction
                    {
                        BranchID = account.BranchID,
                        RdAccountID = account.RdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = DateTime.Now,
                        TransactionType = "Payout",
                        DebitCredit = "Dr",
                        PrincipalAmount = account.TotalDepositedAmount,
                        PenaltyAmount = 0,
                        InterestAmount = accruedInt
                    });

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok($"Maturity process completed. Total payout: ₹{totalPayout:F2}");
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to mature close: " + ex.Message);
                }
            }
        }

        // POST: api/RdAccounts/5/PrematureClose
        [HttpPost("{id}/PrematureClose")]
        public async Task<IActionResult> PrematureClose(int id, [FromQuery] DateTime closureDate, [FromQuery] decimal? customPrematureRate)
        {
            var account = await _context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (account == null || account.Status == "Closed")
            {
                return BadRequest("Account is closed or invalid.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Calculate actual months held
                    int actualMonths = ((closureDate.Year - account.OpeningDate.Year) * 12) + closureDate.Month - account.OpeningDate.Month;
                    if (actualMonths <= 0) actualMonths = 1;

                    // 2. Revised Interest Rate (Scheme Premature Penalty Rate or Custom Rate override)
                    decimal penaltyRate = account.RdScheme?.PrematurePenaltyRate ?? 1.00m;
                    decimal prematureRate = customPrematureRate ?? (account.InterestRate - penaltyRate);
                    if (prematureRate < 0) prematureRate = 0;

                    // 3. Recalculate interest
                    double r = (double)prematureRate;
                    double p = (double)account.InstallmentAmount;
                    int n = actualMonths;
                    double totalPrematureMat = 0;
                    for (int k = 1; k <= n; k++)
                    {
                        int monthsInBank = n - k + 1;
                        double factor = Math.Pow(1.0 + (r / 400.0), monthsInBank / 3.0);
                        totalPrematureMat += p * factor;
                    }
                    decimal totalDepositSoFar = account.InstallmentAmount * actualMonths;
                    decimal recalculatedInterest = Math.Max(0, Math.Round((decimal)totalPrematureMat - totalDepositSoFar));

                        var alreadyAccruedInt = await _context.RdTransactions
                            .Where(t => t.RdAccountID == id && t.TransactionType == "Accrual")
                            .SumAsync(t => t.InterestAmount) + account.LegacyAccruedInt;

                    // 5. Final payout & Accounting calculation
                    decimal extraInterest = 0;
                    decimal clawbackAmount = 0;
                    decimal netPayout = account.TotalDepositedAmount + recalculatedInterest;

                    if (alreadyAccruedInt > recalculatedInterest)
                    {
                        clawbackAmount = alreadyAccruedInt - recalculatedInterest;
                    }
                    else
                    {
                        extraInterest = recalculatedInterest - alreadyAccruedInt;
                    }

                    account.Status = "Closed";
                    await _context.SaveChangesAsync();

                    var rdLiabilityLedger = await GetLiabilityLedgerAsync(account.RdScheme);
                    var payableLedger = await GetPayableLedgerAsync(account.RdScheme);
                    int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "RD");
                    var cashLedger = await _context.Ledgers.FindAsync(branchCashId)
                        ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Cash In Hand")
                        ?? await GetOrCreateLedgerAsync("५१ हातातील रोख शिल्लक", "रोख व बँक शिल्लक", "Dr");

                    if (rdLiabilityLedger == null || cashLedger == null)
                    {
                        return BadRequest("Required ledgers not found.");
                    }

                    // Create Voucher
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"JV-RD-PRECLOSE-{account.AccountNo}",
                        VoucherDate = closureDate,
                        VoucherType = "Payment",
                        TotalAmount = netPayout,
                        Narration = $"आरडी मुदतपूर्व बंद (Premature Close) - Rate: {prematureRate}%, Recalc Int: ₹{recalculatedInterest}, Clawback: ₹{clawbackAmount}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;

                    // Dr RD Liability
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.TotalDepositedAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                    // Dr Interest Payable (Clearing previously accrued interest)
                    if (payableLedger != null && alreadyAccruedInt > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = alreadyAccruedInt, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                    }

                    // Dr Interest Expense (For any new unaccrued interest paid out)
                    if (extraInterest > 0)
                    {
                        var expenseLedger = await GetExpenseLedgerAsync(account.RdScheme);
                        if (expenseLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = extraInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }
                    }

                    // Cr Cash
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = cashLedger.LedgerID, DrCr = "Cr", Amount = netPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                    // Cr Interest Expense / Clawback Income (If accrued was higher than recalculated)
                    if (clawbackAmount > 0)
                    {
                        var clawbackLedger = await GetExpenseLedgerAsync(account.RdScheme);
                        if (clawbackLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = clawbackLedger.LedgerID, DrCr = "Cr", Amount = clawbackAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }
                    }

                    // Log closed transaction details
                    _context.RdTransactions.Add(new RdTransaction
                    {
                        BranchID = account.BranchID,
                        RdAccountID = account.RdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = closureDate,
                        TransactionType = "Premature_Close",
                        DebitCredit = "Dr",
                        PrincipalAmount = account.TotalDepositedAmount,
                        PenaltyAmount = 0,
                        InterestAmount = recalculatedInterest
                    });

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { Message = "RD Prematurely Closed", RecalcInt = recalculatedInterest, Clawback = clawbackAmount, NetPayout = netPayout });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to premature close: " + ex.Message);
                }
            }
        }

        // POST: api/RdAccounts/5/Renew
        [HttpPost("{id}/Renew")]
        public async Task<IActionResult> Renew(int id, [FromQuery] int targetSchemeId)
        {
            var oldAccount = await _context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (oldAccount == null || oldAccount.Status == "Closed")
            {
                return BadRequest("Legacy account is closed or invalid.");
            }

            var fdScheme = await _context.FdSchemes.FindAsync(targetSchemeId);
            if (fdScheme == null)
            {
                return BadRequest("Invalid target FD scheme.");
            }

            decimal accruedInt = await _context.RdTransactions
                .Where(t => t.RdAccountID == id && t.TransactionType == "Accrual")
                .SumAsync(t => t.InterestAmount) + oldAccount.LegacyAccruedInt;

            decimal totalMaturityAmount = oldAccount.TotalDepositedAmount + accruedInt;

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    int resolvedCustId = oldAccount.CustomerID;
                    if (resolvedCustId <= 0)
                    {
                        return BadRequest("आरडी खातेदाराचा वैध ग्राहक (Customer / CIF) सापडला नाही.");
                    }

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == resolvedCustId);
                    int? linkedMemberId = linkedMember?.MemberID;

                    // 1. Close old account
                    oldAccount.Status = "Matured";
                    await _context.SaveChangesAsync();

                    var rdLiabilityLedger = await GetLiabilityLedgerAsync(oldAccount.RdScheme);
                    Ledger? fdLiabilityLedger = null;
                    if (fdScheme.FdLiabilityLedgerID.HasValue)
                    {
                        fdLiabilityLedger = await _context.Ledgers.FindAsync(fdScheme.FdLiabilityLedgerID.Value);
                    }
                    if (fdLiabilityLedger == null)
                    {
                        fdLiabilityLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("मुदत ठेव") || l.LedgerName.ToLower().Contains("fixed deposit"))
                            ?? await GetOrCreateLedgerAsync("१२ मुदत ठेव", "ठेवी", "Cr");
                    }
                    var payableLedger = await GetPayableLedgerAsync(oldAccount.RdScheme);

                    if (rdLiabilityLedger == null || fdLiabilityLedger == null)
                    {
                        return BadRequest("Required ledgers not found.");
                    }

                    // 2. Generate new FD account sequence
                    var branch = await _context.Branches.FindAsync(oldAccount.BranchID);
                    string branchPrefix = branch != null ? branch.BranchCode : "BR";

                    var seq = await _context.FdAccountSequences
                        .FirstOrDefaultAsync(s => s.BranchID == oldAccount.BranchID && s.ProductType == "FD");
                    
                    if (seq == null)
                    {
                        seq = new FdAccountSequence { BranchID = oldAccount.BranchID, ProductType = "FD", CurrentValue = 0 };
                        _context.FdAccountSequences.Add(seq);
                    }
                    seq.CurrentValue += 1;
                    await _context.SaveChangesAsync();

                    var newFd = new FdAccount
                    {
                        InstitutionID = oldAccount.InstitutionID,
                        BranchID = oldAccount.BranchID,
                        FinancialYearID = oldAccount.FinancialYearID,
                        CustomerID = resolvedCustId,
                        FdSchemeID = targetSchemeId,
                        AccountNo = $"{branchPrefix}-{oldAccount.BranchID:D3}-FD-{seq.CurrentValue:D6}",
                        OpeningDate = DateTime.Today,
                        DepositAmount = totalMaturityAmount,
                        InterestRate = fdScheme.InterestRate,
                        MaturityDate = DateTime.Today.AddMonths(fdScheme.DurationMonths),
                        Status = "Active",
                        NomineeName = oldAccount.NomineeName,
                        NomineeRelation = oldAccount.NomineeRelation,
                        Remarks = $"आरडी नूतनीकरण (Renewed from RD): {oldAccount.AccountNo}"
                    };

                    // Maturity Calculations
                    decimal p = totalMaturityAmount;
                    decimal r = fdScheme.InterestRate;
                    decimal t = (decimal)fdScheme.DurationMonths / 12.0m;

                    if (fdScheme.InterestType == "Cumulative")
                    {
                        newFd.MaturityAmount = Math.Round(p * (decimal)Math.Pow((double)(1 + (r / 400m)), (double)(t * 4)), 2);
                    }
                    else
                    {
                        newFd.MaturityAmount = Math.Round(p + (p * r * t / 100m), 2);
                    }

                    _context.FdAccounts.Add(newFd);
                    await _context.SaveChangesAsync();

                    // Voucher
                    var voucher = new Voucher
                    {
                        BranchID = oldAccount.BranchID,
                        VoucherNo = $"JV-RD-REN-{newFd.AccountNo}",
                        VoucherDate = DateTime.Today,
                        VoucherType = "Journal",
                        TotalAmount = totalMaturityAmount,
                        Narration = $"आरडी मुदतपूर्ती रक्कम एफडी खात्यावर नूतनीकरण केली: {oldAccount.AccountNo} -> {newFd.AccountNo}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    // Dr RD Liability
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = oldAccount.TotalDepositedAmount, CustomerID = resolvedCustId, MemberID = linkedMemberId });
                    
                    // Dr Interest Payable
                    if (payableLedger != null && accruedInt > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = accruedInt, CustomerID = resolvedCustId, MemberID = linkedMemberId });
                    }

                    // Cr FD Liability
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Cr", Amount = totalMaturityAmount, CustomerID = resolvedCustId, MemberID = linkedMemberId });

                    // Log transactions
                    _context.RdTransactions.Add(new RdTransaction
                    {
                        BranchID = oldAccount.BranchID,
                        RdAccountID = oldAccount.RdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = DateTime.Now,
                        TransactionType = "Renewal",
                        DebitCredit = "Dr",
                        PrincipalAmount = oldAccount.TotalDepositedAmount,
                        PenaltyAmount = 0,
                        InterestAmount = accruedInt
                    });

                    _context.FdTransactions.Add(new FdTransaction
                    {
                        BranchID = newFd.BranchID,
                        FdAccountID = newFd.FdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = DateTime.Now,
                        TransactionType = "Opening",
                        DebitCredit = "Cr",
                        Amount = totalMaturityAmount
                    });

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { Message = "RD renewed to FD successfully", FdAccountNo = newFd.AccountNo });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to process renewal: " + ex.Message);
                }
            }
        }
    }
}
