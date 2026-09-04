using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Filters;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class InvestmentAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public InvestmentAccountsController(AppDbContext context)
        {
            _context = context;
        }

        private async Task<int> GetDefaultCashBankLedgerId()
        {
            var bankLedger = await _context.Ledgers
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => 
                    l.AccountType == "Bank" || 
                    l.AccountType == "Cash" || 
                    l.LedgerName.Contains("Bank") || 
                    l.LedgerName.Contains("बँक") || 
                    l.LedgerName.Contains("Cash") || 
                    l.LedgerName.Contains("रोख") ||
                    (l.AccountGroup != null && (l.AccountGroup.GroupName.Contains("Bank") || l.AccountGroup.GroupName.Contains("बँक"))));
            return bankLedger?.LedgerID ?? 1;
        }

        // GET: api/InvestmentAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetInvestmentAccounts([FromQuery] int? branchId, [FromQuery] string? status)
        {
            var query = _context.InvestmentAccounts
                .Include(a => a.InvestmentInstitution)
                .Include(a => a.InvestmentScheme)
                .Include(a => a.Branch)
                .AsQueryable();

            if (branchId.HasValue)
            {
                query = query.Where(a => a.BranchID == branchId.Value);
            }
            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(a => a.Status == status);
            }

            var accounts = await query
                .OrderByDescending(a => a.InvestmentDate)
                .Select(a => new {
                    a.InvestmentAccountID,
                    a.BranchID,
                    BranchName = a.Branch != null ? a.Branch.BranchName : "",
                    a.InvestmentInstitutionID,
                    InstitutionName = a.InvestmentInstitution != null ? a.InvestmentInstitution.InstitutionName : "",
                    a.SchemeID,
                    SchemeName = a.InvestmentScheme != null ? a.InvestmentScheme.SchemeName : "",
                    SchemeCode = a.InvestmentScheme != null ? a.InvestmentScheme.SchemeCode : "",
                    a.InvestmentNo,
                    a.DepositReceiptNo,
                    a.InvestmentDate,
                    a.PrincipalAmount,
                    a.InterestRate,
                    a.MaturityDate,
                    a.ExpectedMaturityAmount,
                    a.AccruedInterestTillMigration,
                    a.BookValue,
                    a.IsLegacyAccount,
                    a.NomineeName,
                    a.NomineeRelation,
                    a.Remarks,
                    a.Status
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // GET: api/InvestmentAccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetInvestmentAccount(int id)
        {
            var a = await _context.InvestmentAccounts
                .Include(x => x.InvestmentInstitution)
                .Include(x => x.InvestmentScheme)
                .Include(x => x.Branch)
                .FirstOrDefaultAsync(x => x.InvestmentAccountID == id);

            if (a == null)
            {
                return NotFound();
            }

            return Ok(new {
                a.InvestmentAccountID,
                a.BranchID,
                BranchName = a.Branch != null ? a.Branch.BranchName : "",
                a.InvestmentInstitutionID,
                InstitutionName = a.InvestmentInstitution != null ? a.InvestmentInstitution.InstitutionName : "",
                a.SchemeID,
                SchemeName = a.InvestmentScheme != null ? a.InvestmentScheme.SchemeName : "",
                a.InvestmentNo,
                a.DepositReceiptNo,
                a.InvestmentDate,
                a.PrincipalAmount,
                a.InterestRate,
                a.MaturityDate,
                a.ExpectedMaturityAmount,
                a.AccruedInterestTillMigration,
                a.BookValue,
                a.IsLegacyAccount,
                a.NomineeName,
                a.NomineeRelation,
                a.Remarks,
                a.Status
            });
        }

        // POST: api/InvestmentAccounts - New Investment Opening
        [HttpPost]
        public async Task<ActionResult> PostInvestmentAccount([FromBody] InvestmentAccount account)
        {
            if (account.PrincipalAmount <= 0)
            {
                return BadRequest("मुद्दल रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");
            }
            if (account.InvestmentInstitutionID <= 0)
            {
                return BadRequest("कृपया बँक / संस्था निवडा.");
            }
            if (account.SchemeID <= 0)
            {
                return BadRequest("कृपया गुंतवणूक योजना निवडा.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Generate auto account number
                var seq = await _context.InvestmentAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "INV");

                if (seq == null)
                {
                    seq = new InvestmentAccountSequence { BranchID = account.BranchID, ProductType = "INV", CurrentValue = 0 };
                    _context.InvestmentAccountSequences.Add(seq);
                    await _context.SaveChangesAsync();
                }

                seq.CurrentValue += 1;
                
                Bhisi.Api.Models.Branch? branchEntity = await _context.Branches.FindAsync(account.BranchID);
                string branchCode = branchEntity?.BranchCode ?? "001";
                account.InvestmentNo = $"{branchCode}-INV-{seq.CurrentValue:D6}";

                // Calculate maturity amount if not provided
                if (account.ExpectedMaturityAmount == 0)
                {
                    var scheme = await _context.InvestmentSchemes.FindAsync(account.SchemeID);
                    if (scheme != null)
                    {
                        account.InterestRate = scheme.InterestRate;
                        account.MaturityDate = account.InvestmentDate.AddMonths(scheme.DurationMonths);
                        
                        if (scheme.InterestCalculationMethod == "Simple")
                        {
                            decimal interest = account.PrincipalAmount * scheme.InterestRate * scheme.DurationMonths / (12 * 100);
                            account.ExpectedMaturityAmount = account.PrincipalAmount + interest;
                        }
                        else // Cumulative (compounding quarterly)
                        {
                            double P = (double)account.PrincipalAmount;
                            double r = (double)scheme.InterestRate / 100;
                            int n = 4; // quarterly compounding
                            double t = scheme.DurationMonths / 12.0;
                            double maturityAmt = P * Math.Pow(1 + r / n, n * t);
                            account.ExpectedMaturityAmount = Math.Round((decimal)maturityAmt, 2);
                        }
                    }
                }

                // Set BookValue
                if (account.BookValue == 0)
                {
                    account.BookValue = account.PrincipalAmount + account.AccruedInterestTillMigration;
                }

                // Get active financial year
                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null) account.FinancialYearID = fy.FinancialYearID;

                _context.InvestmentAccounts.Add(account);
                await _context.SaveChangesAsync();

                // Create voucher entry if not legacy
                if (!account.IsLegacyAccount)
                {
                    var mapping = await _context.InvestmentVoucherMappings
                        .FirstOrDefaultAsync(m => m.BranchID == account.BranchID);

                    if (mapping != null)
                    {
                        var voucher = new Voucher
                        {
                            BranchID = account.BranchID,
                            VoucherNo = $"JV-INV-OP-{account.InvestmentNo}",
                            VoucherDate = account.InvestmentDate,
                            VoucherType = "Journal",
                            Narration = $"गुंतवणूक खाते उघडले - {account.InvestmentNo}",
                            TotalAmount = account.PrincipalAmount,
                            CreatedBy = account.CreatedBy,
                            CreatedOn = DateTime.Now
                        };

                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        var debDetail = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = mapping.InvestmentLedgerID,
                            DrCr = "Dr",
                            Amount = account.PrincipalAmount
                        };

                        var credDetail = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = await GetDefaultCashBankLedgerId(), // Cash/Bank
                            DrCr = "Cr",
                            Amount = account.PrincipalAmount
                        };

                        _context.VoucherDetails.Add(debDetail);
                        _context.VoucherDetails.Add(credDetail);
                        await _context.SaveChangesAsync();
                    }
                }

                await transaction.CommitAsync();
                return Ok(new { message = "गुंतवणूक खाते यशस्वीरीत्या उघडले!", account.InvestmentAccountID, account.InvestmentNo });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"गुंतवणूक खाते उघडताना त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/Migrate - Opening Balance Migration
        [HttpPost("Migrate")]
        [MigrationLockFilter]
        public async Task<ActionResult> MigrateInvestmentAccount([FromBody] InvestmentAccount account)
        {
            if (account.PrincipalAmount <= 0)
            {
                return BadRequest("मुद्दल रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");
            }
            if (account.InvestmentInstitutionID <= 0)
            {
                return BadRequest("कृपया बँक / संस्था निवडा.");
            }
            if (account.SchemeID <= 0)
            {
                return BadRequest("कृपया गुंतवणूक योजना निवडा.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Generate auto account number
                var seq = await _context.InvestmentAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "INV");

                if (seq == null)
                {
                    seq = new InvestmentAccountSequence { BranchID = account.BranchID, ProductType = "INV", CurrentValue = 0 };
                    _context.InvestmentAccountSequences.Add(seq);
                    await _context.SaveChangesAsync();
                }

                seq.CurrentValue += 1;
                Bhisi.Api.Models.Branch? branchEntity = await _context.Branches.FindAsync(account.BranchID);
                string branchCode = branchEntity?.BranchCode ?? "001";
                account.InvestmentNo = $"{branchCode}-INV-{seq.CurrentValue:D6}";
                account.IsLegacyAccount = true;
                account.BookValue = account.PrincipalAmount + account.AccruedInterestTillMigration;

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null) account.FinancialYearID = fy.FinancialYearID;

                _context.InvestmentAccounts.Add(account);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "गुंतवणूक स्थलांतर यशस्वी!", account.InvestmentAccountID, account.InvestmentNo });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"गुंतवणूक स्थलांतर त्रुटी: {ex.Message}");
            }
        }

        // DELETE: api/InvestmentAccounts/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteInvestmentAccount(int id)
        {
            var account = await _context.InvestmentAccounts.FindAsync(id);
            if (account == null)
            {
                return NotFound(new { message = "गुंतवणूक खाते सापडले नाही." });
            }

            bool hasMaturity = await _context.InvestmentMaturities.AnyAsync(m => m.InvestmentAccountID == id);
            if (hasMaturity)
            {
                return BadRequest(new { message = "हे खाते डिलीट करता येणार नाही कारण याची मुदतपूर्ती (Maturity) नोंद झालेली आहे." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var seq = await _context.InvestmentAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "INV");
                if (seq != null)
                {
                    var remainingMaxSeq = await _context.InvestmentAccounts
                        .Where(a => a.BranchID == account.BranchID && a.InvestmentAccountID != id)
                        .Select(a => a.InvestmentNo)
                        .ToListAsync();

                    int maxNum = 0;
                    foreach (var invNo in remainingMaxSeq)
                    {
                        var parts = invNo.Split('-');
                        if (parts.Length > 0 && int.TryParse(parts.Last(), out int parsed))
                        {
                            if (parsed > maxNum) maxNum = parsed;
                        }
                    }
                    seq.CurrentValue = maxNum;
                    _context.InvestmentAccountSequences.Update(seq);
                }

                _context.InvestmentAccounts.Remove(account);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "गुंतवणूक खाते यशस्वीरीत्या डिलीट केले." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = $"खाते डिलीट करताना त्रुटी आली: {ex.Message}" });
            }
        }

        // POST: api/InvestmentAccounts/Maturity - Process Maturity
        [HttpPost("Maturity")]
        public async Task<ActionResult> ProcessMaturity([FromBody] InvestmentMaturity maturity)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.InvestmentAccounts.FindAsync(maturity.InvestmentAccountID);
                if (account == null) return NotFound("गुंतवणूक खाते सापडले नाही.");
                if (account.Status != "Active") return BadRequest("हे खाते Active नाही.");

                maturity.TotalReceived = maturity.PrincipalReceived + maturity.InterestReceived;

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null)
                {
                    maturity.FinancialYearID = fy.FinancialYearID;
                }
                maturity.BranchID = account.BranchID;

                // Create voucher
                var mapping = await _context.InvestmentVoucherMappings
                    .FirstOrDefaultAsync(m => m.BranchID == account.BranchID);

                if (mapping != null)
                {
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"JV-INV-MAT-{account.InvestmentNo}",
                        VoucherDate = maturity.MaturityDate,
                        VoucherType = "Journal",
                        Narration = $"गुंतवणूक मुदतपूर्ती - {account.InvestmentNo}",
                        TotalAmount = maturity.TotalReceived,
                        CreatedBy = maturity.CreatedBy,
                        CreatedOn = DateTime.Now
                    };

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var d1 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = await GetDefaultCashBankLedgerId(), // Bank
                        DrCr = "Dr",
                        Amount = maturity.TotalReceived
                    };

                    var d2 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InvestmentLedgerID,
                        DrCr = "Cr",
                        Amount = maturity.PrincipalReceived
                    };

                    var d3 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestIncomeLedgerID,
                        DrCr = "Cr",
                        Amount = maturity.InterestReceived
                    };

                    _context.VoucherDetails.Add(d1);
                    _context.VoucherDetails.Add(d2);
                    _context.VoucherDetails.Add(d3);
                    await _context.SaveChangesAsync();
                    maturity.VoucherID = voucher.VoucherID;
                }

                _context.InvestmentMaturities.Add(maturity);
                account.Status = "Matured";
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "गुंतवणूक मुदतपूर्ती यशस्वी!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"मुदतपूर्ती त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/PrematureWithdraw - Premature Withdrawal
        [HttpPost("PrematureWithdraw")]
        public async Task<ActionResult> PrematureWithdraw([FromBody] InvestmentPrematureWithdrawal withdrawal)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.InvestmentAccounts.FindAsync(withdrawal.InvestmentAccountID);
                if (account == null) return NotFound("गुंतवणूक खाते सापडले नाही.");
                if (account.Status != "Active") return BadRequest("हे खाते Active नाही.");

                withdrawal.NetPayout = withdrawal.PrincipalPaid + withdrawal.InterestPaid - withdrawal.PenaltyAmount;

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null) withdrawal.FinancialYearID = fy.FinancialYearID;
                withdrawal.BranchID = account.BranchID;

                var mapping = await _context.InvestmentVoucherMappings
                    .FirstOrDefaultAsync(m => m.BranchID == account.BranchID);

                if (mapping != null)
                {
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"JV-INV-PRE-{account.InvestmentNo}",
                        VoucherDate = withdrawal.WithdrawalDate,
                        VoucherType = "Journal",
                        Narration = $"गुंतवणूक मुदतपूर्व बंद - {account.InvestmentNo}",
                        TotalAmount = withdrawal.NetPayout,
                        CreatedBy = withdrawal.CreatedBy,
                        CreatedOn = DateTime.Now
                    };

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var d1 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = await GetDefaultCashBankLedgerId(), // Bank
                        DrCr = "Dr",
                        Amount = withdrawal.NetPayout
                    };

                    var d2 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InvestmentLedgerID,
                        DrCr = "Cr",
                        Amount = withdrawal.PrincipalPaid
                    };

                    _context.VoucherDetails.Add(d1);
                    _context.VoucherDetails.Add(d2);

                    if (withdrawal.InterestPaid > 0)
                    {
                        var d3 = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = mapping.InterestIncomeLedgerID,
                            DrCr = "Cr",
                            Amount = withdrawal.InterestPaid
                        };
                        _context.VoucherDetails.Add(d3);
                    }

                    await _context.SaveChangesAsync();
                    withdrawal.VoucherID = voucher.VoucherID;
                }

                _context.InvestmentPrematureWithdrawals.Add(withdrawal);
                account.Status = "Closed";
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "मुदतपूर्व काढणे यशस्वी!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"मुदतपूर्व काढणे त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/Renew - Renewal
        [HttpPost("Renew")]
        public async Task<ActionResult> RenewInvestment([FromBody] RenewalRequest request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var oldAccount = await _context.InvestmentAccounts
                    .Include(a => a.InvestmentScheme)
                    .FirstOrDefaultAsync(a => a.InvestmentAccountID == request.OldInvestmentAccountID);
                if (oldAccount == null) return NotFound("जुने गुंतवणूक खाते सापडले नाही.");
                if (oldAccount.Status != "Active" && oldAccount.Status != "Matured") return BadRequest("हे खाते नूतनीकरणयोग्य नाही.");

                // Create new account
                var newAccount = new InvestmentAccount
                {
                    BranchID = oldAccount.BranchID,
                    InvestmentInstitutionID = oldAccount.InvestmentInstitutionID,
                    SchemeID = request.NewSchemeID > 0 ? request.NewSchemeID : oldAccount.SchemeID,
                    InvestmentDate = request.RenewalDate,
                    PrincipalAmount = request.RenewalAmount,
                    InterestRate = request.NewInterestRate > 0 ? request.NewInterestRate : oldAccount.InterestRate,
                    Status = "Active",
                    Remarks = $"नूतनीकरण - जुने खाते: {oldAccount.InvestmentNo}"
                };

                // Calculate maturity
                var scheme = await _context.InvestmentSchemes.FindAsync(newAccount.SchemeID);
                if (scheme != null)
                {
                    newAccount.MaturityDate = request.RenewalDate.AddMonths(scheme.DurationMonths);
                    if (scheme.InterestCalculationMethod == "Simple")
                    {
                        decimal interest = newAccount.PrincipalAmount * newAccount.InterestRate * scheme.DurationMonths / (12 * 100);
                        newAccount.ExpectedMaturityAmount = newAccount.PrincipalAmount + interest;
                    }
                    else
                    {
                        double P = (double)newAccount.PrincipalAmount;
                        double r = (double)newAccount.InterestRate / 100;
                        double t = scheme.DurationMonths / 12.0;
                        newAccount.ExpectedMaturityAmount = Math.Round((decimal)(P * Math.Pow(1 + r / 4, 4 * t)), 2);
                    }
                }

                newAccount.BookValue = newAccount.PrincipalAmount;

                // Generate account number
                var seq = await _context.InvestmentAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == oldAccount.BranchID && s.ProductType == "INV");
                if (seq == null)
                {
                    seq = new InvestmentAccountSequence { BranchID = oldAccount.BranchID, ProductType = "INV", CurrentValue = 0 };
                    _context.InvestmentAccountSequences.Add(seq);
                    await _context.SaveChangesAsync();
                }
                seq.CurrentValue += 1;
                Bhisi.Api.Models.Branch? branchEntity = await _context.Branches.FindAsync(oldAccount.BranchID);
                string branchCode = branchEntity?.BranchCode ?? "001";
                newAccount.InvestmentNo = $"{branchCode}-INV-{seq.CurrentValue:D6}";

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null) newAccount.FinancialYearID = fy.FinancialYearID;

                _context.InvestmentAccounts.Add(newAccount);
                await _context.SaveChangesAsync();

                // Create renewal record
                var renewal = new InvestmentRenewal
                {
                    BranchID = oldAccount.BranchID,
                    FinancialYearID = newAccount.FinancialYearID,
                    OldInvestmentAccountID = oldAccount.InvestmentAccountID,
                    NewInvestmentAccountID = newAccount.InvestmentAccountID,
                    RenewalType = request.RenewalType,
                    RenewalAmount = request.RenewalAmount,
                    RenewalDate = request.RenewalDate
                };

                _context.InvestmentRenewals.Add(renewal);
                oldAccount.Status = "Renewed";
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "गुंतवणूक नूतनीकरण यशस्वी!", newAccountNo = newAccount.InvestmentNo });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"नूतनीकरण त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/AccrualPosting - Interest Accrual
        [HttpPost("AccrualPosting")]
        public async Task<ActionResult> PostAccrual([FromBody] AccrualPostingRequest request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var activeAccounts = await _context.InvestmentAccounts
                    .Where(a => a.Status == "Active" && a.BranchID == request.BranchID)
                    .ToListAsync();

                if (!activeAccounts.Any()) return BadRequest("या शाखेत Active गुंतवणूक खाती नाहीत.");

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                int fyId = fy?.FinancialYearID ?? 1;

                // Check duplicate
                var existingAccrual = await _context.InvestmentInterestAccruals
                    .AnyAsync(a => a.BranchID == request.BranchID && a.AccrualDate.Month == request.AccrualDate.Month && a.AccrualDate.Year == request.AccrualDate.Year);

                if (existingAccrual) return BadRequest("या महिन्यासाठी व्याज तरतूद आधीच केली आहे.");

                var mapping = await _context.InvestmentVoucherMappings
                    .FirstOrDefaultAsync(m => m.BranchID == request.BranchID);

                decimal totalInterest = 0;
                var accruals = new List<InvestmentInterestAccrual>();

                foreach (var account in activeAccounts)
                {
                    // Calculate monthly interest (Simple: P * R / 1200)
                    decimal monthlyInterest = Math.Round(account.PrincipalAmount * account.InterestRate / 1200, 2);
                    totalInterest += monthlyInterest;

                    accruals.Add(new InvestmentInterestAccrual
                    {
                        InstitutionID = account.InstitutionID,
                        BranchID = request.BranchID,
                        FinancialYearID = fyId,
                        InvestmentAccountID = account.InvestmentAccountID,
                        AccrualDate = request.AccrualDate,
                        InterestAmount = monthlyInterest,
                        IsPosted = true
                    });
                }

                // Create consolidated voucher
                if (mapping != null && totalInterest > 0)
                {
                    var voucher = new Voucher
                    {
                        BranchID = request.BranchID,
                        VoucherNo = $"JV-INV-ACC-{request.AccrualDate:yyyyMMdd}",
                        VoucherDate = request.AccrualDate,
                        VoucherType = "Journal",
                        Narration = $"गुंतवणूक व्याज तरतूद - {request.AccrualDate:MMM yyyy}",
                        TotalAmount = totalInterest,
                        CreatedOn = DateTime.Now
                    };

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var d1 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestReceivableLedgerID,
                        DrCr = "Dr",
                        Amount = totalInterest
                    };

                    var d2 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestIncomeLedgerID,
                        DrCr = "Cr",
                        Amount = totalInterest
                    };

                    _context.VoucherDetails.Add(d1);
                    _context.VoucherDetails.Add(d2);
                    await _context.SaveChangesAsync();

                    foreach (var accrual in accruals)
                    {
                        accrual.VoucherID = voucher.VoucherID;
                    }
                }

                _context.InvestmentInterestAccruals.AddRange(accruals);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { 
                    message = "व्याज तरतूद यशस्वी!",
                    accountsProcessed = activeAccounts.Count,
                    totalInterest 
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"व्याज तरतूद त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/InterestReceipt - Record Interest Receipt
        [HttpPost("InterestReceipt")]
        public async Task<ActionResult> RecordInterestReceipt([FromBody] InvestmentInterestReceipt receipt)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.InvestmentAccounts.FindAsync(receipt.InvestmentAccountID);
                if (account == null) return NotFound("गुंतवणूक खाते सापडले नाही.");

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null) receipt.FinancialYearID = fy.FinancialYearID;
                receipt.BranchID = account.BranchID;

                var mapping = await _context.InvestmentVoucherMappings
                    .FirstOrDefaultAsync(m => m.BranchID == account.BranchID);

                if (mapping != null)
                {
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"REC-INV-INT-{account.InvestmentNo}",
                        VoucherDate = receipt.ReceiptDate,
                        VoucherType = "Receipt",
                        Narration = $"गुंतवणूक व्याज प्राप्ती - {account.InvestmentNo}",
                        TotalAmount = receipt.ReceivedAmount,
                        CreatedBy = receipt.CreatedBy,
                        CreatedOn = DateTime.Now
                    };

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var d1 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = await GetDefaultCashBankLedgerId(), // Bank
                        DrCr = "Dr",
                        Amount = receipt.ReceivedAmount
                    };

                    var d2 = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestReceivableLedgerID,
                        DrCr = "Cr",
                        Amount = receipt.ReceivedAmount
                    };

                    _context.VoucherDetails.Add(d1);
                    _context.VoucherDetails.Add(d2);
                    await _context.SaveChangesAsync();
                    receipt.VoucherID = voucher.VoucherID;
                }

                _context.InvestmentInterestReceipts.Add(receipt);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "व्याज प्राप्ती नोंद यशस्वी!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"व्याज प्राप्ती त्रुटी: {ex.Message}");
            }
        }

        // GET: api/InvestmentAccounts/Accruals?accountId=1
        [HttpGet("Accruals")]
        public async Task<ActionResult> GetAccruals([FromQuery] int? accountId, [FromQuery] int? branchId)
        {
            var query = _context.InvestmentInterestAccruals
                .Include(a => a.InvestmentAccount)
                .AsQueryable();

            if (accountId.HasValue) query = query.Where(a => a.InvestmentAccountID == accountId.Value);
            if (branchId.HasValue) query = query.Where(a => a.BranchID == branchId.Value);

            var accruals = await query
                .OrderByDescending(a => a.AccrualDate)
                .Select(a => new {
                    a.AccrualID,
                    a.InvestmentAccountID,
                    InvestmentNo = a.InvestmentAccount != null ? a.InvestmentAccount.InvestmentNo : "",
                    a.AccrualDate,
                    a.InterestAmount,
                    a.VoucherID,
                    a.IsPosted
                })
                .ToListAsync();

            return Ok(accruals);
        }

        // GET: api/InvestmentAccounts/Receipts?accountId=1
        [HttpGet("Receipts")]
        public async Task<ActionResult> GetReceipts([FromQuery] int? accountId, [FromQuery] int? branchId)
        {
            var query = _context.InvestmentInterestReceipts
                .Include(r => r.InvestmentAccount)
                .AsQueryable();

            if (accountId.HasValue) query = query.Where(r => r.InvestmentAccountID == accountId.Value);
            if (branchId.HasValue) query = query.Where(r => r.BranchID == branchId.Value);

            var receipts = await query
                .OrderByDescending(r => r.ReceiptDate)
                .Select(r => new {
                    r.ReceiptID,
                    r.InvestmentAccountID,
                    InvestmentNo = r.InvestmentAccount != null ? r.InvestmentAccount.InvestmentNo : "",
                    r.ReceiptDate,
                    r.ReceivedAmount,
                    r.VoucherID
                })
                .ToListAsync();

            return Ok(receipts);
        }

        // GET: api/InvestmentAccounts/Dashboard?branchId=1
        [HttpGet("Dashboard")]
        public async Task<ActionResult> GetDashboard([FromQuery] int? branchId)
        {
            var query = _context.InvestmentAccounts.AsQueryable();
            if (branchId.HasValue) query = query.Where(a => a.BranchID == branchId.Value);

            var activeAccounts = await query.Where(a => a.Status == "Active").ToListAsync();
            var totalInvestment = activeAccounts.Sum(a => a.PrincipalAmount);
            var totalBookValue = activeAccounts.Sum(a => a.BookValue);
            
            var totalAccruedInterest = await _context.InvestmentInterestAccruals
                .Where(a => activeAccounts.Select(ac => ac.InvestmentAccountID).Contains(a.InvestmentAccountID))
                .SumAsync(a => a.InterestAmount);

            var totalReceivedInterest = await _context.InvestmentInterestReceipts
                .Where(r => activeAccounts.Select(ac => ac.InvestmentAccountID).Contains(r.InvestmentAccountID))
                .SumAsync(r => r.ReceivedAmount);

            var maturityDueCount = activeAccounts.Count(a => a.MaturityDate <= DateTime.Today.AddMonths(3));
            var maturityDueAmount = activeAccounts.Where(a => a.MaturityDate <= DateTime.Today.AddMonths(3)).Sum(a => a.ExpectedMaturityAmount);

            return Ok(new {
                totalActiveAccounts = activeAccounts.Count,
                totalInvestment,
                totalBookValue,
                interestReceivable = totalAccruedInterest - totalReceivedInterest,
                totalAccruedInterest,
                totalReceivedInterest,
                maturityDueCount,
                maturityDueAmount
            });
        }

        // GET: api/InvestmentAccounts/VoucherMappings
        [HttpGet("VoucherMappings")]
        public async Task<ActionResult> GetVoucherMappings([FromQuery] int? branchId)
        {
            var query = _context.InvestmentVoucherMappings.AsQueryable();
            if (branchId.HasValue) query = query.Where(m => m.BranchID == branchId.Value);
            return Ok(await query.ToListAsync());
        }

        // POST: api/InvestmentAccounts/VoucherMappings
        [HttpPost("VoucherMappings")]
        public async Task<ActionResult> SaveVoucherMapping([FromBody] InvestmentVoucherMapping mapping)
        {
            var existing = await _context.InvestmentVoucherMappings
                .FirstOrDefaultAsync(m => m.BranchID == mapping.BranchID && m.InvestmentType == mapping.InvestmentType);

            if (existing != null)
            {
                existing.InvestmentLedgerID = mapping.InvestmentLedgerID;
                existing.InterestIncomeLedgerID = mapping.InterestIncomeLedgerID;
                existing.InterestReceivableLedgerID = mapping.InterestReceivableLedgerID;
            }
            else
            {
                _context.InvestmentVoucherMappings.Add(mapping);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "मॅपिंग जतन यशस्वी!" });
        }
    }

    // Request DTOs
    public class RenewalRequest
    {
        public int OldInvestmentAccountID { get; set; }
        public int NewSchemeID { get; set; }
        public string RenewalType { get; set; } = "PrincipalOnly";
        public decimal RenewalAmount { get; set; }
        public DateTime RenewalDate { get; set; }
        public decimal NewInterestRate { get; set; }
    }

    public class AccrualPostingRequest
    {
        public int BranchID { get; set; }
        public DateTime AccrualDate { get; set; }
    }
}
