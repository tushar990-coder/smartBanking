using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AgentCommissionController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AgentCommissionController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/AgentCommission/Settings
        [HttpGet("Settings")]
        public async Task<ActionResult<IEnumerable<PigmyCommissionSetting>>> GetSettings()
        {
            return await _context.PigmyCommissionSettings
                .Include(s => s.Agent)
                .OrderByDescending(s => s.SettingId)
                .ToListAsync();
        }

        // POST: api/AgentCommission/Settings
        [HttpPost("Settings")]
        public async Task<ActionResult<PigmyCommissionSetting>> CreateSetting([FromBody] PigmyCommissionSetting setting)
        {
            if (setting == null) return BadRequest("वैध माहिती पुरवा.");

            string prod = string.IsNullOrWhiteSpace(setting.ProductType) ? "PIGMY" : setting.ProductType.ToUpper();
            setting.ProductType = prod;

            // Deactivate any existing active setting for the same agent / frequency / productType
            var existing = await _context.PigmyCommissionSettings
                .Where(s => s.AgentId == setting.AgentId && 
                            s.CalculationFrequency == setting.CalculationFrequency && 
                            (s.ProductType == prod || (prod == "PIGMY" && s.ProductType == null)) && 
                            s.IsActive)
                .ToListAsync();

            foreach (var ex in existing)
            {
                ex.IsActive = false;
            }

            setting.IsActive = true;
            setting.EffectiveFrom = DateTime.Today;

            _context.PigmyCommissionSettings.Add(setting);
            await _context.SaveChangesAsync();

            return Ok(setting);
        }

        // DELETE: api/AgentCommission/Settings/5
        [HttpDelete("Settings/{id}")]
        public async Task<IActionResult> DeleteSetting(int id)
        {
            var setting = await _context.PigmyCommissionSettings.FindAsync(id);
            if (setting == null) return NotFound("सेटिंग सापडली नाही.");

            _context.PigmyCommissionSettings.Remove(setting);
            await _context.SaveChangesAsync();
            return Ok(new { message = "सेटिंग हटवली." });
        }

        // GET: api/AgentCommission/Pending
        [HttpGet("Pending")]
        public async Task<ActionResult<IEnumerable<PigmyAgentCommission>>> GetPendingCommissions(
            [FromQuery] int? branchId,
            [FromQuery] int? agentId,
            [FromQuery] string? productType)
        {
            var query = _context.PigmyAgentCommissions
                .Include(c => c.Agent)
                .Where(c => c.Status == "PENDING")
                .AsQueryable();

            if (agentId.HasValue && agentId.Value > 0)
            {
                query = query.Where(c => c.AgentId == agentId.Value);
            }

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(c => c.Agent != null && c.Agent.BranchID == branchId.Value);
            }

            if (!string.IsNullOrWhiteSpace(productType) && productType != "ALL")
            {
                query = query.Where(c => c.ProductType == productType || (productType == "PIGMY" && c.ProductType == null));
            }

            return await query.OrderByDescending(c => c.PeriodStartDate).ToListAsync();
        }

        // GET: api/AgentCommission/History
        [HttpGet("History")]
        public async Task<ActionResult<IEnumerable<object>>> GetCommissionHistory(
            [FromQuery] int? branchId,
            [FromQuery] int? agentId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] string? productType)
        {
            var query = _context.PigmyAgentCommissions
                .Include(c => c.Agent)
                .Include(c => c.Voucher)
                .Where(c => c.Status == "PAID")
                .AsQueryable();

            if (agentId.HasValue && agentId.Value > 0)
            {
                query = query.Where(c => c.AgentId == agentId.Value);
            }

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(c => c.Agent != null && c.Agent.BranchID == branchId.Value);
            }

            if (!string.IsNullOrWhiteSpace(productType) && productType != "ALL")
            {
                query = query.Where(c => c.ProductType == productType || (productType == "PIGMY" && c.ProductType == null));
            }

            if (fromDate.HasValue)
            {
                var fDate = fromDate.Value.Date;
                query = query.Where(c => c.PeriodStartDate >= fDate);
            }

            if (toDate.HasValue)
            {
                var tDate = toDate.Value.Date.AddDays(1);
                query = query.Where(c => c.PeriodEndDate < tDate);
            }

            var history = await query
                .OrderByDescending(c => c.PeriodStartDate)
                .ThenByDescending(c => c.CommissionId)
                .Select(c => new
                {
                    c.CommissionId,
                    c.AgentId,
                    AgentName = c.Agent != null ? c.Agent.AgentName : "",
                    ProductType = c.ProductType ?? "PIGMY",
                    c.CalculationFrequency,
                    c.PeriodStartDate,
                    c.PeriodEndDate,
                    c.TotalCollectionAmount,
                    c.CalculatedCommission,
                    c.Status,
                    c.VoucherId,
                    VoucherNo = c.Voucher != null ? c.Voucher.VoucherNo : "",
                    c.CalculatedOn
                })
                .ToListAsync();

            return Ok(history);
        }

        public class CalculateRequest
        {
            public DateTime? FromDate { get; set; }
            public DateTime? ToDate { get; set; }
            public DateTime Date { get; set; } = DateTime.Today;
            public string Frequency { get; set; } = "DAILY"; // "DAILY", "MONTHLY", or "CUSTOM"
            public int? AgentId { get; set; }
            public string? ProductType { get; set; } = "ALL"; // "ALL", "PIGMY", "LOAN", "SAVING", "RD"
        }

        // POST: api/AgentCommission/Calculate
        [HttpPost("Calculate")]
        public async Task<IActionResult> Calculate([FromBody] CalculateRequest request)
        {
            var agentQuery = _context.PigmyAgents.Where(a => a.Status == "Active").AsQueryable();
            if (request.AgentId.HasValue && request.AgentId.Value > 0)
            {
                agentQuery = agentQuery.Where(a => a.PigmyAgentID == request.AgentId.Value);
            }

            var agents = await agentQuery.ToListAsync();
            var settings = await _context.PigmyCommissionSettings.Where(s => s.IsActive).ToListAsync();

            int calculatedCount = 0;
            decimal totalCalculatedAmount = 0;

            var targetProducts = !string.IsNullOrWhiteSpace(request.ProductType) && request.ProductType != "ALL"
                ? new[] { request.ProductType.ToUpper() }
                : new[] { "PIGMY", "LOAN", "RD", "SAVING" };

            DateTime startDate = request.FromDate?.Date ?? request.Date.Date;
            DateTime endDate = request.ToDate?.Date ?? request.Date.Date;

            if (request.Frequency == "MONTHLY" && !request.FromDate.HasValue)
            {
                startDate = new DateTime(request.Date.Year, request.Date.Month, 1);
                endDate = startDate.AddMonths(1).AddDays(-1);
            }

            DateTime queryNextDate = endDate.AddDays(1);

            foreach (var agent in agents)
            {
                foreach (var product in targetProducts)
                {
                    // Find most specific setting for this agent + product + frequency
                    var setting = settings.FirstOrDefault(s => s.AgentId == agent.PigmyAgentID && s.ProductType == product && s.CalculationFrequency == request.Frequency)
                               ?? settings.FirstOrDefault(s => s.AgentId == agent.PigmyAgentID && s.ProductType == product)
                               ?? settings.FirstOrDefault(s => s.AgentId == null && s.ProductType == product && s.CalculationFrequency == request.Frequency)
                               ?? settings.FirstOrDefault(s => s.AgentId == null && s.ProductType == product);

                    // If no product-specific setting for PIGMY, fallback to legacy null product type
                    if (setting == null && product == "PIGMY")
                    {
                        setting = settings.FirstOrDefault(s => s.AgentId == agent.PigmyAgentID && (s.ProductType == null || s.ProductType == "PIGMY"))
                               ?? settings.FirstOrDefault(s => s.AgentId == null && (s.ProductType == null || s.ProductType == "PIGMY"));
                    }

                    if (setting == null) continue;

                    // Check if already calculated for this exact period and product
                    var existing = await _context.PigmyAgentCommissions.FirstOrDefaultAsync(c =>
                        c.AgentId == agent.PigmyAgentID &&
                        (c.ProductType == product || (product == "PIGMY" && c.ProductType == null)) &&
                        c.PeriodStartDate == startDate &&
                        c.PeriodEndDate == endDate &&
                        c.CalculationFrequency == request.Frequency);

                    if (existing != null) continue;

                    decimal totalCollection = 0m;
                    if (product == "PIGMY")
                    {
                        totalCollection = await _context.PigmyCollections
                            .Where(c => c.AgentId == agent.PigmyAgentID && c.CollectionDate >= startDate && c.CollectionDate < queryNextDate)
                            .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;
                    }
                    else if (product == "LOAN")
                    {
                        totalCollection = await _context.LoanCollections
                            .Where(c => c.AgentID == agent.PigmyAgentID && c.CollectionSource == "AGENT_MOBILE" && c.CollectionDate >= startDate && c.CollectionDate < queryNextDate)
                            .SumAsync(c => (decimal?)c.TotalAmountReceived) ?? 0m;
                    }
                    else if (product == "SAVING")
                    {
                        totalCollection = await _context.SavingTransactions
                            .Where(t => t.AgentID == agent.PigmyAgentID && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Deposit" && t.TransactionDate >= startDate && t.TransactionDate < queryNextDate)
                            .SumAsync(t => (decimal?)t.Amount) ?? 0m;
                    }
                    else if (product == "RD")
                    {
                        totalCollection = await _context.RdTransactions
                            .Where(t => t.AgentID == agent.PigmyAgentID && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Installment" && t.TransactionDate >= startDate && t.TransactionDate < queryNextDate)
                            .SumAsync(t => (decimal?)t.PrincipalAmount) ?? 0m;
                    }

                    if (totalCollection <= 0 && setting.CommissionType == "PERCENTAGE") continue;

                    decimal calculatedAmount = 0m;
                    if (setting.CommissionType == "PERCENTAGE")
                    {
                        calculatedAmount = Math.Round((totalCollection * setting.CommissionValue) / 100m, 2);
                    }
                    else if (setting.CommissionType == "FIXED")
                    {
                        if (totalCollection > 0) calculatedAmount = setting.CommissionValue;
                    }

                    if (calculatedAmount > 0)
                    {
                        _context.PigmyAgentCommissions.Add(new PigmyAgentCommission
                        {
                            AgentId = agent.PigmyAgentID,
                            ProductType = product,
                            CalculationFrequency = request.Frequency,
                            PeriodStartDate = startDate,
                            PeriodEndDate = endDate,
                            TotalCollectionAmount = totalCollection,
                            CalculatedCommission = calculatedAmount,
                            Status = "PENDING",
                            CalculatedOn = DateTime.Now
                        });

                        calculatedCount++;
                        totalCalculatedAmount += calculatedAmount;
                    }
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new
            {
                message = $"एकूण {calculatedCount} कमिशन नोंदी (रक्कम ₹{totalCalculatedAmount:N2}) यशस्वीपणे तयार झाल्या.",
                calculatedCount,
                totalCalculatedAmount
            });
        }

        public class PayRequest
        {
            public int CommissionId { get; set; }
            public int BranchId { get; set; } = 1;
            public DateTime? PaymentDate { get; set; }
            public string PaymentMode { get; set; } = "CASH"; // "CASH", "BANK", "AGENT_SB"
            public int? CashLedgerId { get; set; }
            public int? ExpenseLedgerId { get; set; }
            public int? AgentSavingAccountId { get; set; }
            public int? BankLedgerId { get; set; }
            public string? ReferenceNo { get; set; }
        }

        // POST: api/AgentCommission/Pay
        [HttpPost("Pay")]
        public async Task<IActionResult> PayCommission([FromBody] PayRequest request)
        {
            var commission = await _context.PigmyAgentCommissions
                .Include(c => c.Agent)
                .FirstOrDefaultAsync(c => c.CommissionId == request.CommissionId);

            if (commission == null) return NotFound("कमिशन रेकॉर्ड सापडला नाही.");
            if (commission.Status == "PAID") return BadRequest("हे कमिशन आधीच अदा करण्यात आले आहे.");

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var branchId = commission.Agent?.BranchID ?? request.BranchId;

                // Find or assign Pigmy Commission Expense Ledger
                Ledger? expenseLedger = null;
                if (request.ExpenseLedgerId.HasValue && request.ExpenseLedgerId.Value > 0)
                {
                    expenseLedger = await _context.Ledgers.FindAsync(request.ExpenseLedgerId.Value);
                }
                
                if (expenseLedger == null)
                {
                    expenseLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("Commission") || l.LedgerName.Contains("कमिशन"));
                    if (expenseLedger == null) expenseLedger = await _context.Ledgers.FirstOrDefaultAsync();
                }

                bool isAgentSavingCredit = string.Equals(request.PaymentMode, "AGENT_SB", StringComparison.OrdinalIgnoreCase) ||
                                           string.Equals(request.PaymentMode, "SAVING", StringComparison.OrdinalIgnoreCase);
                SavingAccountMaster? savingAccount = null;

                // Find Credit Ledger (Saving Liability Ledger if AGENT_SB, otherwise Cash or Bank)
                Ledger? creditLedger = null;
                if (isAgentSavingCredit)
                {
                    if (!request.AgentSavingAccountId.HasValue || request.AgentSavingAccountId.Value <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("एजंट बचत खात्यात कमिशन जमा करण्यासाठी वैध बचत खाते निवडणे बंधनकारक आहे.");
                    }

                    savingAccount = await _context.SavingAccountMasters.FirstOrDefaultAsync(a => a.SavingAccountID == request.AgentSavingAccountId.Value);
                    if (savingAccount == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("निवडलेले एजंट बचत खाते सिस्टीममध्ये सापडले नाही.");
                    }

                    if (savingAccount.Status == "Closed" || savingAccount.Status == "Frozen")
                    {
                        await transaction.RollbackAsync();
                        return BadRequest($"एजंट बचत खाते (#{savingAccount.AccountNo}) सध्या '{savingAccount.Status}' स्थितीत असल्यामुळे त्यावर कमिशन जमा करता येणार नाही.");
                    }

                    int savingLiabilityLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, savingAccount);
                    if (savingLiabilityLedgerId <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(savingAccount.AccountNo));
                    }

                    creditLedger = await _context.Ledgers.FindAsync(savingLiabilityLedgerId);
                }
                else
                {
                    if (Helpers.BankLedgerHelper.IsBankPaymentMode(request.PaymentMode))
                    {
                        var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerId);
                        if (!bankCheck.IsValid)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(bankCheck.ErrorMessage);
                        }
                        creditLedger = await _context.Ledgers.FindAsync(bankCheck.LedgerId) ?? bankCheck.Ledger;
                    }
                    else if (request.CashLedgerId.HasValue && request.CashLedgerId.Value > 0)
                    {
                        creditLedger = await _context.Ledgers.FindAsync(request.CashLedgerId.Value);
                    }

                    if (creditLedger == null)
                    {
                        int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId, "PIGMY");
                        creditLedger = await _context.Ledgers.FindAsync(branchCashId)
                            ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Cash" || l.AccountType == "Cash In Hand" || l.LedgerName.Contains("रोख") || l.LedgerName.Contains("कॅश") || l.LedgerName.Contains("Cash"))
                            ?? await _context.Ledgers.FirstOrDefaultAsync();
                    }
                }

                DateTime effDate = request.PaymentDate?.Date ?? DateTime.Today;
                string todayStr = effDate.ToString("yyyyMMdd");
                string uniqueVoucherNo = $"VCH-COMM-{branchId}-{todayStr}-{Guid.NewGuid().ToString("N").Substring(0, 4)}";

                string refSuffix = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? $" | Ref/UTR: {request.ReferenceNo.Trim()}" : "";
                string narration = $"Pigmy Agent Commission Paid to '{commission.Agent?.AgentName}' for period {commission.PeriodStartDate:dd/MM/yyyy} to {commission.PeriodEndDate:dd/MM/yyyy} ({request.PaymentMode}){refSuffix}";

                var voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = uniqueVoucherNo,
                    VoucherDate = effDate,
                    VoucherType = isAgentSavingCredit ? "Journal" : "Payment",
                    TotalAmount = commission.CalculatedCommission,
                    Narration = narration,
                    CreatedBy = 1,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = expenseLedger!.LedgerID, DrCr = "Dr", Amount = commission.CalculatedCommission },
                        new VoucherDetail
                        {
                            LedgerID = creditLedger!.LedgerID,
                            DrCr = "Cr",
                            Amount = commission.CalculatedCommission,
                            CustomerID = isAgentSavingCredit ? savingAccount?.CustomerID : null
                        }
                    }
                };

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // Direct Credit to Agent Savings Account if AGENT_SB is selected
                if (isAgentSavingCredit && savingAccount != null)
                {
                    savingAccount.CurrentBalance += commission.CalculatedCommission;
                    _context.SavingAccountMasters.Update(savingAccount);

                    var savingTx = new SavingTransaction
                    {
                        SavingAccountID = savingAccount.SavingAccountID,
                        CustomerID = savingAccount.CustomerID,
                        BranchID = voucher.BranchID > 0 ? voucher.BranchID : savingAccount.BranchID,
                        TransactionDate = effDate,
                        TransactionType = "Deposit",
                        PaymentMode = "Transfer",
                        Amount = commission.CalculatedCommission,
                        BalanceAfterTxn = savingAccount.CurrentBalance,
                        Narration = $"Agent Commission Credit - Voucher: {uniqueVoucherNo}",
                        VoucherNo = uniqueVoucherNo,
                        CreatedBy = 1,
                        CreatedOn = DateTime.UtcNow
                    };
                    _context.SavingTransactions.Add(savingTx);
                }

                commission.Status = "PAID";
                commission.VoucherId = voucher.VoucherID;
                _context.PigmyAgentCommissions.Update(commission);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new { 
                    message = $"एजंट '{commission.Agent?.AgentName}' यांना ₹{commission.CalculatedCommission:N2} कमिशन पेमेंट यशस्वी!", 
                    voucherNo = voucher.VoucherNo,
                    voucherId = voucher.VoucherID
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "कमिशन पेमेंट करताना सर्व्हर त्रुटी आली: " + ex.Message);
            }
        }
    }
}
