using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using System.Text.Json;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PigmyCollectionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PigmyCollectionsController(AppDbContext context)
        {
            _context = context;
        }

        private static string NormalizePigmyPaymentMode(string? mode, bool isBank)
        {
            if (!isBank) return "CASH";
            var trimmed = mode?.Trim();
            if (string.IsNullOrEmpty(trimmed)) return "BANK";
            return trimmed.Length <= 10 ? trimmed.ToUpperInvariant() : "BANK";
        }

        public class ApproveMobileSyncRequestDto
        {
            public DateTime? Date { get; set; }
            public int? AgentId { get; set; }
            public List<long>? CollectionIds { get; set; }
            public string? PaymentMode { get; set; }
            public int? BankLedgerId { get; set; }
        }

        public class ManualCollectionBaseDto
        {
            public string? PaymentMode { get; set; }
            public int? BankLedgerId { get; set; }
        }

        public class ManualCollectionDto : ManualCollectionBaseDto
        {
            public int PigmyAccountId { get; set; }
            public int AgentId { get; set; }
            public DateTime CollectionDate { get; set; }
            public decimal CollectionAmount { get; set; }
        }

        public class AppSyncCollectionDto
        {
            public int PigmyAccountId { get; set; }
            public int AgentId { get; set; }
            public DateTime CollectionDate { get; set; }
            public decimal CollectionAmount { get; set; }
            public string SyncReferenceId { get; set; } = string.Empty;
            public string? PaymentMode { get; set; }
            public int? BankLedgerId { get; set; }
        }

        public class BulkManualItemDto
        {
            public int PigmyAccountId { get; set; }
            public decimal CollectionAmount { get; set; }
        }

        public class BulkManualCollectionRequestDto
        {
            public int AgentId { get; set; }
            public DateTime CollectionDate { get; set; }
            public string? PaymentMode { get; set; }
            public int? BankLedgerId { get; set; }
            public List<BulkManualItemDto> Items { get; set; } = new List<BulkManualItemDto>();
        }

        public class BulkMonthlyChartEntryDto
        {
            public int PigmyAccountId { get; set; }
            public DateTime CollectionDate { get; set; }
            public decimal CollectionAmount { get; set; }
        }

        public class BulkMonthlyChartRequestDto
        {
            public int AgentId { get; set; }
            public string MonthYear { get; set; } = string.Empty; // e.g. "2026-04"
            public DateTime? ActiveBusinessDate { get; set; }
            public string? PaymentMode { get; set; }
            public int? BankLedgerId { get; set; }
            public List<BulkMonthlyChartEntryDto> Entries { get; set; } = new List<BulkMonthlyChartEntryDto>();
        }

        // GET: api/PigmyCollections
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetPigmyCollections(
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int? agentId,
            [FromQuery] int? branchId,
            [FromQuery] int? pigmyAccountId,
            [FromQuery] int? page = null,
            [FromQuery] int? pageSize = null)
        {
            var query = _context.PigmyCollections
                .AsNoTracking()
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(c => c.Agent)
                .AsQueryable();

            if (fromDate.HasValue)
            {
                var fDate = fromDate.Value.Date;
                query = query.Where(c => c.CollectionDate >= fDate);
            }

            if (toDate.HasValue)
            {
                var tDate = toDate.Value.Date.AddDays(1);
                query = query.Where(c => c.CollectionDate < tDate);
            }

            if (agentId.HasValue && agentId.Value > 0)
            {
                query = query.Where(c => c.AgentId == agentId.Value);
            }

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(c => c.PigmyAccount != null && c.PigmyAccount.BranchID == branchId.Value);
            }

            if (pigmyAccountId.HasValue && pigmyAccountId.Value > 0)
            {
                query = query.Where(c => c.PigmyAccountId == pigmyAccountId.Value);
            }

            query = query
                .OrderByDescending(c => c.CollectionDate)
                .ThenByDescending(c => c.CollectionId);

            if (page.HasValue || pageSize.HasValue)
            {
                int p = page ?? 1;
                int ps = pageSize ?? 50;
                if (p < 1) p = 1;
                if (ps < 1 || ps > 500) ps = 50;
                query = query.Skip((p - 1) * ps).Take(ps);
            }
            else if (!fromDate.HasValue && !toDate.HasValue && !pigmyAccountId.HasValue)
            {
                // Default safety limit for unconstrained queries (Pillar 2)
                query = query.Take(50);
            }

            var collections = await query
                .Select(c => new
                {
                    c.CollectionId,
                    c.ReceiptNo,
                    c.CollectionDate,
                    c.CollectionAmount,
                    c.CollectionSource,
                    c.OpeningBalance,
                    c.ClosingBalance,
                    c.PigmyAccountId,
                    PigmyAccountNo = c.PigmyAccount != null ? c.PigmyAccount.AccountNo : "",
                    CustomerName = c.PigmyAccount != null && c.PigmyAccount.Customer != null ? 
                        (c.PigmyAccount.Customer.FirstName + " " + (c.PigmyAccount.Customer.LastName ?? "")).Trim() : "",
                    MemberName = c.PigmyAccount != null && c.PigmyAccount.Customer != null ? 
                        (c.PigmyAccount.Customer.FirstName + " " + (c.PigmyAccount.Customer.LastName ?? "")).Trim() : "",
                    CIFNo = c.PigmyAccount != null && c.PigmyAccount.Customer != null ? c.PigmyAccount.Customer.CIFNo : "",
                    CustomerNo = c.PigmyAccount != null && c.PigmyAccount.Customer != null ? (c.PigmyAccount.Customer.CIFNo ?? c.PigmyAccount.Customer.LegacyCustomerNo ?? "") : "",
                    AgentId = c.AgentId,
                    AgentName = c.Agent != null ? c.Agent.AgentName : ""
                })
                .ToListAsync();

            return Ok(collections);
        }

        // GET: api/PigmyCollections/MobileSyncQueue
        [HttpGet("MobileSyncQueue")]
        public async Task<ActionResult<object>> GetMobileSyncQueue([FromQuery] DateTime? date, [FromQuery] int? agentId)
        {
            var targetDate = (date ?? DateTime.Today).Date;
            var nextDate = targetDate.AddDays(1);

            var query = _context.PigmyCollections
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(c => c.Agent)
                .Where(c => c.CollectionSource == "APP" && c.CollectionDate >= targetDate && c.CollectionDate < nextDate);

            if (agentId.HasValue && agentId.Value > 0)
            {
                query = query.Where(c => c.AgentId == agentId.Value);
            }

            var items = await query
                .OrderByDescending(c => c.CollectionId)
                .Select(c => new
                {
                    c.CollectionId,
                    c.ReceiptNo,
                    c.CollectionDate,
                    c.CollectionAmount,
                    c.OpeningBalance,
                    c.ClosingBalance,
                    c.PaymentMode,
                    c.Notes,
                    c.IsVoucherGenerated,
                    c.VoucherId,
                    c.SyncReferenceId,
                    c.TransactionId,
                    PigmyAccountNo = c.PigmyAccount != null ? c.PigmyAccount.AccountNo : "",
                    CustomerName = c.PigmyAccount != null && c.PigmyAccount.Customer != null ? 
                        (c.PigmyAccount.Customer.FirstName + " " + (c.PigmyAccount.Customer.LastName ?? "")).Trim() : "",
                    MobileNo = c.PigmyAccount != null && c.PigmyAccount.Customer != null ? c.PigmyAccount.Customer.MobileNo : "",
                    AgentId = c.AgentId,
                    AgentName = c.Agent != null ? c.Agent.AgentName : ""
                })
                .ToListAsync();

            var totalAmount = items.Sum(i => i.CollectionAmount);
            var totalCount = items.Count;

            var agentSummaries = items
                .GroupBy(i => new { i.AgentId, i.AgentName })
                .Select(g => new
                {
                    g.Key.AgentId,
                    g.Key.AgentName,
                    Count = g.Count(),
                    TotalAmount = g.Sum(x => x.CollectionAmount),
                    PendingVouchers = g.Count(x => !x.IsVoucherGenerated)
                })
                .ToList();

            return Ok(new
            {
                Date = targetDate,
                TotalCount = totalCount,
                TotalAmount = totalAmount,
                AgentSummaries = agentSummaries,
                Items = items
            });
        }

        // POST: api/PigmyCollections/Manual
        [HttpPost("Manual")]
        public async Task<IActionResult> ProcessManualCollection([FromBody] ManualCollectionDto dto)
        {
            if (dto.CollectionAmount <= 0) return BadRequest("जमा रक्कम ० पेक्षा जास्त असणे आवश्यक आहे.");

            // Core Banking Date Safeguards: Prevent future dating and transactions in closed financial years
            if (dto.CollectionDate.Date > DateTime.Today)
            {
                return BadRequest("पिग्मी वसुलीची दिनांक भविष्यातील (Future Date) असू शकत नाही.");
            }

            var closedFyManual = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && dto.CollectionDate.Date >= fy.StartDate.Date && dto.CollectionDate.Date <= fy.EndDate.Date);
            if (closedFyManual != null)
            {
                return BadRequest($"निवडलेली तारीख बंद झालेल्या आर्थिक वर्षात ({closedFyManual.YearCode}) मोडत असल्याने या तारखेवर पिग्मी वसुली करता येत नाही.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.PigmyAccounts.FirstOrDefaultAsync(a => a.PigmyAccountID == dto.PigmyAccountId);
                if (account == null) return NotFound("पिग्मी खाते सापडले नाही.");
                if (account.Status != "Active") return BadRequest("बंद किंवा निष्क्रिय खात्यावर जमा करता येणार नाही.");

                bool isBankMode = Helpers.BankLedgerHelper.IsBankPaymentMode(dto.PaymentMode);
                int validatedBankLedgerId = 0;
                if (isBankMode)
                {
                    var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, dto.BankLedgerId);
                    if (!bankCheck.IsValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(bankCheck.ErrorMessage);
                    }
                    validatedBankLedgerId = bankCheck.LedgerId;
                }

                var targetDate = dto.CollectionDate.Date;
                var nextDate = targetDate.AddDays(1);
                var branchId = account.BranchID;
                PigmyCollection collection;
                string receiptNo;

                var existingCollection = await _context.PigmyCollections.FirstOrDefaultAsync(c => 
                    c.PigmyAccountId == dto.PigmyAccountId && 
                    c.CollectionDate >= targetDate && c.CollectionDate < nextDate && 
                    (c.CollectionSource == "MANUAL" || c.CollectionSource == "IMPORT"));

                if (existingCollection != null)
                {
                    receiptNo = existingCollection.ReceiptNo;
                    existingCollection.CollectionAmount += dto.CollectionAmount;
                    existingCollection.ClosingBalance = existingCollection.OpeningBalance + existingCollection.CollectionAmount;
                    _context.PigmyCollections.Update(existingCollection);
                    collection = existingCollection;
                }
                else
                {
                    var seq = await _context.PigmyCollections.CountAsync(c => c.CollectionSource == "MANUAL" && c.CollectionDate >= targetDate && c.CollectionDate < nextDate) + 1;
                    receiptNo = $"MAN-{account.PigmyAgentID}-{targetDate:yyyyMMdd}-{seq:D4}";

                    var openingBalance = account.TotalDepositedAmount;
                    var closingBalance = openingBalance + dto.CollectionAmount;

                    collection = new PigmyCollection
                    {
                        PigmyAccountId = dto.PigmyAccountId,
                        AgentId = dto.AgentId,
                        CollectionDate = targetDate,
                        OpeningBalance = openingBalance,
                        CollectionAmount = dto.CollectionAmount,
                        ClosingBalance = closingBalance,
                        ReceiptNo = receiptNo,
                        CollectionSource = "MANUAL",
                        CreatedBy = 1
                    };
                    _context.PigmyCollections.Add(collection);
                }

                var updatedAccountBalance = account.TotalDepositedAmount + dto.CollectionAmount;

                var ledgerTx = new PigmyTransaction
                {
                    PigmyAccountID = account.PigmyAccountID,
                    TransactionDate = targetDate,
                    ValueDate = targetDate,
                    TransactionType = "DEPOSIT",
                    DrAmount = 0,
                    CrAmount = dto.CollectionAmount,
                    BalanceAmount = updatedAccountBalance,
                    Narration = $"Pigmy Collection (Manual) - Rcpt: {receiptNo}",
                    MakerId = 1,
                    PostedOn = DateTime.Now
                };
                _context.PigmyTransactions.Add(ledgerTx);

                account.TotalDepositedAmount = updatedAccountBalance;
                _context.PigmyAccounts.Update(account);

                var mapping = await _context.PigmyVoucherMappings.FirstOrDefaultAsync(m => m.BranchId == branchId && m.CollectionSource == "MANUAL" && m.IsActive);
                int drLedgerId = isBankMode ? validatedBankLedgerId : (mapping?.DebitLedgerId ?? await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId, "PIGMY"));
                int crLedgerId = mapping?.CreditLedgerId ?? (await _context.PigmySchemes.FirstOrDefaultAsync(s => s.PigmySchemeID == account.PigmySchemeID))?.PigmyLiabilityLedgerID ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 47;

                collection.PaymentMode = NormalizePigmyPaymentMode(dto.PaymentMode, isBankMode);
                string uniqueVoucherNo = $"PV-{branchId}-{targetDate:yyyyMMdd}-{DateTime.Now:HHmmss}-{Guid.NewGuid().ToString("N").Substring(0, 4)}";
                var voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = uniqueVoucherNo,
                    VoucherDate = targetDate,
                    VoucherType = "Receipt",
                    Status = "Pending",
                    Narration = $"Pigmy Manual Collection for A/C {account.AccountNo}",
                    TotalAmount = dto.CollectionAmount
                };

                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = drLedgerId,
                    CustomerID = account.CustomerID,
                    DrCr = "Dr",
                    Amount = dto.CollectionAmount
                });

                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = crLedgerId,
                    CustomerID = account.CustomerID,
                    DrCr = "Cr",
                    Amount = dto.CollectionAmount
                });

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                collection.VoucherId = voucher.VoucherID;
                collection.IsVoucherGenerated = true;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "कलेक्शन यशस्वीरीत्या जमा झाले!", receiptNo = receiptNo });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "कलेक्शन सेव्ह करताना सर्व्हर त्रुटी आली: " + ex.Message);
            }
        }

        // POST: api/PigmyCollections/AppSync
        [HttpPost("AppSync")]
        public async Task<IActionResult> ProcessAppSync([FromBody] List<AppSyncCollectionDto> dtos)
        {
            if (dtos == null || !dtos.Any()) return BadRequest("No data provided.");

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var processedReceipts = new List<string>();
                var appTargetDate = dtos.First().CollectionDate.Date;
                var appNextDate = appTargetDate.AddDays(1);
                var baseAppSeq = await _context.PigmyCollections.CountAsync(c => c.CollectionSource == "APP" && c.CollectionDate >= appTargetDate && c.CollectionDate < appNextDate);
                int appItemIdx = 0;
                
                foreach (var dto in dtos)
                {
                    if (dto.CollectionAmount <= 0) continue;

                    // Idempotency check via SyncReferenceId
                    if (!string.IsNullOrEmpty(dto.SyncReferenceId))
                    {
                        var isDuplicate = await _context.PigmyCollections.AnyAsync(c => c.SyncReferenceId == dto.SyncReferenceId);
                        if (isDuplicate) continue; // Skip silently
                    }

                    var account = await _context.PigmyAccounts.FirstOrDefaultAsync(a => a.PigmyAccountID == dto.PigmyAccountId);
                    if (account == null || account.Status != "Active") continue;

                    appItemIdx++;
                    int currentSeq = baseAppSeq + appItemIdx;
                    var branchId = account.BranchID;
                    bool isBankMode = Helpers.BankLedgerHelper.IsBankPaymentMode(dto.PaymentMode);
                    int validatedBankLedgerId = 0;
                    if (isBankMode)
                    {
                        var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, dto.BankLedgerId);
                        if (!bankCheck.IsValid)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(bankCheck.ErrorMessage);
                        }
                        validatedBankLedgerId = bankCheck.LedgerId;
                    }

                    string receiptNo = $"APP-{account.PigmyAgentID}-{dto.CollectionDate:yyyyMMdd}-{currentSeq:D4}";

                    var openingBalance = account.TotalDepositedAmount;
                    var closingBalance = openingBalance + dto.CollectionAmount;

                    var collection = new PigmyCollection
                    {
                        PigmyAccountId = dto.PigmyAccountId,
                        AgentId = dto.AgentId,
                        CollectionDate = dto.CollectionDate,
                        OpeningBalance = openingBalance,
                        CollectionAmount = dto.CollectionAmount,
                        ClosingBalance = closingBalance,
                        ReceiptNo = receiptNo,
                        CollectionSource = "APP",
                        SyncReferenceId = dto.SyncReferenceId,
                        PaymentMode = NormalizePigmyPaymentMode(dto.PaymentMode, isBankMode),
                        CreatedBy = 1
                    };

                    _context.PigmyCollections.Add(collection);

                    var ledgerTx = new PigmyTransaction
                    {
                        PigmyAccountID = account.PigmyAccountID,
                        TransactionDate = dto.CollectionDate,
                        ValueDate = dto.CollectionDate,
                        TransactionType = "DEPOSIT",
                        DrAmount = 0,
                        CrAmount = dto.CollectionAmount,
                        BalanceAmount = closingBalance,
                        Narration = $"Pigmy Collection (App) - Rcpt: {receiptNo}",
                        MakerId = 1,
                        PostedOn = DateTime.Now
                    };
                    _context.PigmyTransactions.Add(ledgerTx);

                    account.TotalDepositedAmount = closingBalance;
                    _context.PigmyAccounts.Update(account);

                    // Collections are credited to member accounts; voucher will be generated when agent deposits cash at the branch.
                    collection.VoucherId = null;
                    collection.IsVoucherGenerated = false;

                    processedReceipts.Add(receiptNo);
                }

                await transaction.CommitAsync();
                return Ok(new { message = $"Processed {processedReceipts.Count} records successfully.", receipts = processedReceipts });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "An error occurred while processing the app sync. " + ex.Message);
            }
        }

        // POST: api/PigmyCollections/BulkManual
        [HttpPost("BulkManual")]
        public async Task<IActionResult> ProcessBulkManualCollection([FromBody] BulkManualCollectionRequestDto request)
        {
            if (request == null || request.Items == null || !request.Items.Any(i => i.CollectionAmount > 0))
            {
                return BadRequest("कृपया किमान एका खात्याची वैध जमा रक्कम (Collection Amount > 0) प्रविष्ट करा.");
            }

            // Core Banking Date Safeguards: Prevent future dating and transactions in closed financial years
            if (request.CollectionDate.Date > DateTime.Today)
            {
                return BadRequest("पिग्मी वसुलीची दिनांक भविष्यातील (Future Date) असू शकत नाही.");
            }

            var closedFyBulk = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && request.CollectionDate.Date >= fy.StartDate.Date && request.CollectionDate.Date <= fy.EndDate.Date);
            if (closedFyBulk != null)
            {
                return BadRequest($"निवडलेली तारीख बंद झालेल्या आर्थिक वर्षात ({closedFyBulk.YearCode}) मोडत असल्याने या तारखेवर पिग्मी वसुली करता येत नाही.");
            }

            var validItems = request.Items.Where(i => i.CollectionAmount > 0).ToList();
            bool isBankMode = Helpers.BankLedgerHelper.IsBankPaymentMode(request.PaymentMode);
            int validatedBankLedgerId = 0;
            if (isBankMode)
            {
                var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerId);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(bankCheck.ErrorMessage);
                }
                validatedBankLedgerId = bankCheck.LedgerId;
            }
            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == request.AgentId);
            if (agent == null)
            {
                return BadRequest("निवडलेला पिग्मी एजंट सापडले नाही.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                int processedCount = 0;
                decimal totalAmount = 0;
                var processedReceipts = new List<string>();
                var targetDate = request.CollectionDate.Date;
                var nextDate = targetDate.AddDays(1);
                var baseManualSeq = await _context.PigmyCollections.CountAsync(c => c.CollectionSource == "MANUAL" && c.CollectionDate >= targetDate && c.CollectionDate < nextDate);
                int itemIdx = 0;

                foreach (var item in validItems)
                {
                    var account = await _context.PigmyAccounts.FirstOrDefaultAsync(a => a.PigmyAccountID == item.PigmyAccountId);
                    if (account == null || account.Status != "Active") continue;

                    var branchId = account.BranchID;
                    PigmyCollection collection;
                    string receiptNo;

                    var existingCollection = await _context.PigmyCollections.FirstOrDefaultAsync(c => 
                        c.PigmyAccountId == item.PigmyAccountId && 
                        c.CollectionDate >= targetDate && c.CollectionDate < nextDate && 
                        (c.CollectionSource == "MANUAL" || c.CollectionSource == "IMPORT"));

                    if (existingCollection != null)
                    {
                        receiptNo = existingCollection.ReceiptNo;
                        existingCollection.CollectionAmount += item.CollectionAmount;
                        existingCollection.ClosingBalance = existingCollection.OpeningBalance + existingCollection.CollectionAmount;
                        _context.PigmyCollections.Update(existingCollection);
                        collection = existingCollection;
                    }
                    else
                    {
                        itemIdx++;
                        int currentSeq = baseManualSeq + itemIdx;
                        receiptNo = $"MAN-{account.PigmyAgentID}-{targetDate:yyyyMMdd}-{currentSeq:D4}";

                        var openingBal = account.TotalDepositedAmount;
                        var closingBal = openingBal + item.CollectionAmount;

                        collection = new PigmyCollection
                        {
                            PigmyAccountId = item.PigmyAccountId,
                            AgentId = request.AgentId,
                            CollectionDate = targetDate,
                            OpeningBalance = openingBal,
                            CollectionAmount = item.CollectionAmount,
                            ClosingBalance = closingBal,
                            ReceiptNo = receiptNo,
                            CollectionSource = "MANUAL",
                            CreatedBy = 1
                        };
                        _context.PigmyCollections.Add(collection);
                    }

                    var updatedAccountBalance = account.TotalDepositedAmount + item.CollectionAmount;

                    var ledgerTx = new PigmyTransaction
                    {
                        PigmyAccountID = account.PigmyAccountID,
                        TransactionDate = targetDate,
                        ValueDate = targetDate,
                        TransactionType = "DEPOSIT",
                        DrAmount = 0,
                        CrAmount = item.CollectionAmount,
                        BalanceAmount = updatedAccountBalance,
                        Narration = $"Pigmy Collection (Bulk Sheet) - Rcpt: {receiptNo}",
                        MakerId = 1,
                        PostedOn = DateTime.Now
                    };
                    _context.PigmyTransactions.Add(ledgerTx);

                    account.TotalDepositedAmount = updatedAccountBalance;
                    _context.PigmyAccounts.Update(account);

                    var mapping = await _context.PigmyVoucherMappings.FirstOrDefaultAsync(m => m.BranchId == branchId && m.CollectionSource == "MANUAL" && m.IsActive);
                    int drLedgerId = isBankMode ? validatedBankLedgerId : (mapping?.DebitLedgerId ?? await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId, "PIGMY"));
                    int crLedgerId = mapping?.CreditLedgerId ?? (await _context.PigmySchemes.FirstOrDefaultAsync(s => s.PigmySchemeID == account.PigmySchemeID))?.PigmyLiabilityLedgerID ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 47;

                    collection.PaymentMode = NormalizePigmyPaymentMode(request.PaymentMode, isBankMode);
                    string uniqueVoucherNo = $"PV-{branchId}-{targetDate:yyyyMMdd}-BLK-{itemIdx:D3}-{Guid.NewGuid().ToString("N").Substring(0, 4)}";
                    var voucher = new Voucher
                    {
                        BranchID = branchId,
                        VoucherNo = uniqueVoucherNo,
                        VoucherDate = targetDate,
                        VoucherType = "Receipt",
                        Status = "Pending",
                        Narration = $"Pigmy Bulk Manual Collection for A/C {account.AccountNo}",
                        TotalAmount = item.CollectionAmount
                    };

                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = drLedgerId,
                        CustomerID = account.CustomerID,
                        DrCr = "Dr",
                        Amount = item.CollectionAmount
                    });

                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = crLedgerId,
                        CustomerID = account.CustomerID,
                        DrCr = "Cr",
                        Amount = item.CollectionAmount
                    });

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    collection.VoucherId = voucher.VoucherID;
                    collection.IsVoucherGenerated = true;

                    await _context.SaveChangesAsync();

                    processedCount++;
                    totalAmount += item.CollectionAmount;
                    processedReceipts.Add(receiptNo);
                }

                await transaction.CommitAsync();
                return Ok(new { 
                    message = $"एजंट '{agent.AgentName}' अंतर्गत एकूण {processedCount} खात्यांचे ₹{totalAmount:N2} चे कलेक्शन यशस्वीरीत्या जमा झाले!", 
                    processedCount, 
                    totalAmount,
                    receipts = processedReceipts 
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "बल्क कलेक्शन सेव्ह करताना सर्व्हर त्रुटी आली: " + ex.Message);
            }
        }

        // GET: api/PigmyCollections/CheckMonthlyExists?agentId=1&monthYear=2026-08
        [HttpGet("CheckMonthlyExists")]
        public async Task<IActionResult> CheckMonthlyExists([FromQuery] int agentId, [FromQuery] string monthYear)
        {
            if (agentId <= 0 || string.IsNullOrWhiteSpace(monthYear))
            {
                return BadRequest("Invalid agentId or monthYear.");
            }

            var parts = monthYear.Split('-');
            if (parts.Length != 2 || !int.TryParse(parts[0], out int year) || !int.TryParse(parts[1], out int month))
            {
                return BadRequest("Invalid monthYear format. Expected YYYY-MM.");
            }

            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);

            var collections = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate >= startDate && c.CollectionDate < endDate && c.CollectionAmount > 0)
                .Select(c => new { c.PigmyAccountId, c.CollectionAmount })
                .ToListAsync();

            if (collections.Any())
            {
                return Ok(new
                {
                    hasExisting = true,
                    count = collections.Count,
                    totalAmount = collections.Sum(c => c.CollectionAmount),
                    accountsCount = collections.Select(c => c.PigmyAccountId).Distinct().Count(),
                    monthYear = $"{month:D2}/{year}"
                });
            }

            return Ok(new
            {
                hasExisting = false,
                count = 0,
                totalAmount = 0m,
                accountsCount = 0,
                monthYear = $"{month:D2}/{year}"
            });
        }

        // POST: api/PigmyCollections/BulkMonthlyChart
        [HttpPost("BulkMonthlyChart")]
        public async Task<IActionResult> ProcessBulkMonthlyChart([FromBody] BulkMonthlyChartRequestDto request)
        {
            if (request == null || request.Entries == null || !request.Entries.Any(i => i.CollectionAmount > 0))
            {
                return BadRequest("कृपया किमान एका खात्याची वैध जमा रक्कम (Collection Amount > 0) प्रविष्ट करा.");
            }

            var validEntries = request.Entries.Where(i => i.CollectionAmount > 0).ToList();
            bool isBankMonthly = Helpers.BankLedgerHelper.IsBankPaymentMode(request.PaymentMode);
            int validatedMonthlyBankLedgerId = 0;
            if (isBankMonthly)
            {
                var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerId);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(bankCheck.ErrorMessage);
                }
                validatedMonthlyBankLedgerId = bankCheck.LedgerId;
            }
            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == request.AgentId);
            if (agent == null)
            {
                return BadRequest("निवडलेला पिग्मी एजंट सापडले नाही.");
            }

            // Duplicate Prevention: Check if collections already exist for this agent and month
            var parts = request.MonthYear?.Split('-');
            if (parts != null && parts.Length == 2 && int.TryParse(parts[0], out int year) && int.TryParse(parts[1], out int month))
            {
                var startDate = new DateTime(year, month, 1);
                var endDate = startDate.AddMonths(1);
                var existingCount = await _context.PigmyCollections.CountAsync(c => 
                    c.AgentId == request.AgentId && 
                    c.CollectionDate >= startDate && 
                    c.CollectionDate < endDate && 
                    c.CollectionAmount > 0);

                if (existingCount > 0)
                {
                    return BadRequest($"या एजंटसाठी {month:D2}/{year} महिन्याचे कलेक्शन आधीच सिस्टीममध्ये जमा आहे ({existingCount} नोंदी आढळल्या). खात्यांवर दुबार (Duplicate) रक्कम जमा होऊ नये म्हणून आयात रोखण्यात आली आहे.");
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                int processedEntriesCount = 0;
                int openingEntriesCount = 0;
                int activeEntriesCount = 0;
                int skippedFutureEntriesCount = 0;
                decimal grandTotalAmount = 0;
                decimal openingTotalAmount = 0;
                decimal activeTotalAmount = 0;
                var affectedAccounts = new HashSet<int>();
                var processedDates = new HashSet<string>();

                var businessDate = (request.ActiveBusinessDate ?? DateTime.Today).Date;
                var groupedByDate = validEntries.GroupBy(e => e.CollectionDate.Date).OrderBy(g => g.Key);

                foreach (var dateGroup in groupedByDate)
                {
                    var targetDate = dateGroup.Key;

                    // Safely ignore future collections beyond current active business date
                    if (targetDate > businessDate)
                    {
                        skippedFutureEntriesCount += dateGroup.Count();
                        continue;
                    }

                    // True Opening Balance is strictly on or prior to 31/03/2026; dates after 31/03/2026 are regular transactional collections
                    bool isOpeningBalance = targetDate <= new DateTime(2026, 3, 31);
                    var nextDate = targetDate.AddDays(1);
                    var baseSeq = await _context.PigmyCollections.CountAsync(c => c.CollectionDate >= targetDate && c.CollectionDate < nextDate);
                    int itemIdx = 0;

                    decimal dayTotalAmount = 0;
                    var dayCollections = new List<PigmyCollection>();
                    int targetBranchId = 1;

                    foreach (var item in dateGroup)
                    {
                        var account = await _context.PigmyAccounts.FirstOrDefaultAsync(a => a.PigmyAccountID == item.PigmyAccountId);
                        if (account == null || account.Status != "Active") continue;

                        if (account.OpeningDate.Date > targetDate) continue;

                        targetBranchId = account.BranchID > 0 ? account.BranchID : 1;
                        PigmyCollection collection;
                        string receiptNo;

                        var existingCollection = await _context.PigmyCollections.FirstOrDefaultAsync(c => 
                            c.PigmyAccountId == item.PigmyAccountId && 
                            c.CollectionDate >= targetDate && c.CollectionDate < nextDate);

                        if (existingCollection != null)
                        {
                            receiptNo = existingCollection.ReceiptNo;
                            existingCollection.CollectionAmount += item.CollectionAmount;
                            existingCollection.ClosingBalance = existingCollection.OpeningBalance + existingCollection.CollectionAmount;
                            _context.PigmyCollections.Update(existingCollection);
                            collection = existingCollection;
                        }
                        else
                        {
                            itemIdx++;
                            int currentSeq = baseSeq + itemIdx;
                            receiptNo = isOpeningBalance
                                ? $"IMP-OP-{account.PigmyAgentID}-{targetDate:yyyyMMdd}-{currentSeq:D4}"
                                : $"IMP-{account.PigmyAgentID}-{targetDate:yyyyMMdd}-{currentSeq:D4}";

                            var openingBal = account.TotalDepositedAmount;
                            var closingBal = openingBal + item.CollectionAmount;

                            collection = new PigmyCollection
                            {
                                PigmyAccountId = item.PigmyAccountId,
                                AgentId = request.AgentId,
                                CollectionDate = targetDate,
                                OpeningBalance = openingBal,
                                CollectionAmount = item.CollectionAmount,
                                ClosingBalance = closingBal,
                                ReceiptNo = receiptNo,
                                CollectionSource = isOpeningBalance ? "OPENING_IMPORT" : "IMPORT",
                                PaymentMode = NormalizePigmyPaymentMode(request.PaymentMode, isBankMonthly),
                                CreatedBy = 1
                            };
                            _context.PigmyCollections.Add(collection);
                        }

                        var updatedAccountBalance = account.TotalDepositedAmount + item.CollectionAmount;

                        var ledgerTx = new PigmyTransaction
                        {
                            PigmyAccountID = account.PigmyAccountID,
                            TransactionDate = targetDate,
                            ValueDate = targetDate,
                            TransactionType = "DEPOSIT",
                            DrAmount = 0,
                            CrAmount = item.CollectionAmount,
                            BalanceAmount = updatedAccountBalance,
                            Narration = isOpeningBalance
                                ? $"Pigmy Opening/Historical Balance - Rcpt: {receiptNo}"
                                : $"Pigmy Chart Collection - Rcpt: {receiptNo}",
                            MakerId = 1,
                            PostedOn = DateTime.Now
                        };
                        _context.PigmyTransactions.Add(ledgerTx);

                        account.TotalDepositedAmount = updatedAccountBalance;
                        _context.PigmyAccounts.Update(account);

                        dayCollections.Add(collection);
                        dayTotalAmount += item.CollectionAmount;

                        processedEntriesCount++;
                        grandTotalAmount += item.CollectionAmount;
                        if (isOpeningBalance)
                        {
                            openingEntriesCount++;
                            openingTotalAmount += item.CollectionAmount;
                        }
                        else
                        {
                            activeEntriesCount++;
                            activeTotalAmount += item.CollectionAmount;
                        }
                        affectedAccounts.Add(account.PigmyAccountID);
                        processedDates.Add(targetDate.ToString("yyyy-MM-dd"));
                    }

                    // Opening Balance Migration Voucher (<= 31/03/2026 only).
                    // For regular active collections, NO voucher is generated at import time; 
                    // exactly ONE consolidated voucher will be created when the agent submits cash at the branch counter (Agent Day Book).
                    if (isOpeningBalance && dayTotalAmount > 0 && dayCollections.Any())
                    {
                        var mapping = await _context.PigmyVoucherMappings.FirstOrDefaultAsync(m => m.BranchId == targetBranchId && m.IsActive);
                        int drLedgerId = isBankMonthly ? validatedMonthlyBankLedgerId : (mapping?.DebitLedgerId ?? await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, targetBranchId, "PIGMY"));
                        int crLedgerId = mapping?.CreditLedgerId ?? (await _context.PigmySchemes.FirstOrDefaultAsync())?.PigmyLiabilityLedgerID ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 47;

                        string uniqueVoucherNo = $"PV-{targetBranchId}-{targetDate:yyyyMMdd}-OP-IMP-{Guid.NewGuid().ToString("N").Substring(0, 4)}";

                        var voucher = new Voucher
                        {
                            BranchID = targetBranchId,
                            VoucherNo = uniqueVoucherNo,
                            VoucherDate = targetDate,
                            VoucherType = "Opening",
                            Status = "Approved",
                            Narration = $"पिग्मी आरंभिक शिल्लक आयात (एजंट: {agent.AgentName}) - एकूण {dayCollections.Count} खाती",
                            TotalAmount = dayTotalAmount,
                            ApprovedBy = 1,
                            ApprovedOn = DateTime.Now
                        };

                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = drLedgerId,
                            DrCr = "Dr",
                            Amount = dayTotalAmount
                        });

                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = crLedgerId,
                            DrCr = "Cr",
                            Amount = dayTotalAmount
                        });

                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        foreach (var col in dayCollections)
                        {
                            col.VoucherId = voucher.VoucherID;
                            col.IsVoucherGenerated = true;
                        }
                        await _context.SaveChangesAsync();
                    }
                }

                await transaction.CommitAsync();

                string messageText = $"एजंट '{agent.AgentName}' अंतर्गत {affectedAccounts.Count} खात्यांच्या एकूण {processedEntriesCount} दैनंदिन नोंदी (एकूण रक्कम ₹{grandTotalAmount:N2}) यशस्वीरीत्या जमा झाल्या! एजंटने रक्कम बँकेत जमा केल्यावर (एजंट डे बुक) त्या दिवसाचे १ एकत्रित व्हाउचर तयार होईल.";
                if (skippedFutureEntriesCount > 0)
                {
                    messageText += $" (सूचना: चालू तारखेपुढील {skippedFutureEntriesCount} भविष्यकालीन नोंदी वगळल्या).";
                }

                return Ok(new { 
                    message = messageText, 
                    processedEntriesCount,
                    openingEntriesCount,
                    openingTotalAmount,
                    activeEntriesCount,
                    activeTotalAmount,
                    skippedFutureEntriesCount,
                    totalAccounts = affectedAccounts.Count,
                    totalAmount = grandTotalAmount,
                    totalDates = processedDates.Count
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "मासिक चार्ट आयात सेव्ह करताना सर्व्हर त्रुटी आली: " + ex.Message);
            }
        }

        // POST: api/PigmyCollections/ApproveMobileSync
        [HttpPost("ApproveMobileSync")]
        public async Task<IActionResult> ApproveMobileSync([FromBody] ApproveMobileSyncRequestDto request)
        {
            if (request == null) return BadRequest("Invalid request.");

            var query = _context.PigmyCollections
                .Include(c => c.PigmyAccount)
                .Where(c => c.CollectionSource == "APP" && !c.IsVoucherGenerated);

            if (request.CollectionIds != null && request.CollectionIds.Any())
            {
                query = query.Where(c => request.CollectionIds.Contains(c.CollectionId));
            }
            else
            {
                var targetDate = (request.Date ?? DateTime.Today).Date;
                var nextDate = targetDate.AddDays(1);
                query = query.Where(c => c.CollectionDate >= targetDate && c.CollectionDate < nextDate);
                if (request.AgentId.HasValue && request.AgentId.Value > 0)
                {
                    query = query.Where(c => c.AgentId == request.AgentId.Value);
                }
            }

            var pendingItems = await query.ToListAsync();
            if (!pendingItems.Any())
            {
                return BadRequest("व्हाउचर तयार करण्यासाठी प्रलंबित मोबाईल सिंक नोंदी आढळल्या नाहीत.");
            }

            bool requestForcesBank = Helpers.BankLedgerHelper.IsBankPaymentMode(request.PaymentMode);
            bool anyItemIsBank = requestForcesBank || pendingItems.Any(c => Helpers.BankLedgerHelper.IsBankPaymentMode(c.PaymentMode));
            int validatedSyncBankLedgerId = 0;

            if (anyItemIsBank)
            {
                var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerId);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(bankCheck.ErrorMessage);
                }
                validatedSyncBankLedgerId = bankCheck.LedgerId;
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var groupedItems = pendingItems
                    .GroupBy(c => new {
                        BranchId = (c.PigmyAccount != null && c.PigmyAccount.BranchID > 0) ? c.PigmyAccount.BranchID : 1,
                        AgentId = c.AgentId,
                        Date = c.CollectionDate.Date
                    })
                    .ToList();

                int generatedVouchersCount = 0;
                int totalProcessedCollections = 0;

                foreach (var group in groupedItems)
                {
                    int groupBranchId = group.Key.BranchId;
                    int groupAgentId = group.Key.AgentId;
                    DateTime groupDate = group.Key.Date;
                    decimal groupTotal = group.Sum(c => c.CollectionAmount);

                    if (groupTotal <= 0) continue;

                    var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == groupAgentId);
                    string agentName = agent?.AgentName ?? ("Agent-" + groupAgentId);

                    var mapping = await _context.PigmyVoucherMappings.FirstOrDefaultAsync(m => m.BranchId == groupBranchId && m.CollectionSource == "APP" && m.IsActive);
                    int drLedgerId = anyItemIsBank
                        ? validatedSyncBankLedgerId
                        : (mapping?.DebitLedgerId ?? await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, groupBranchId, "PIGMY"));
                    int crLedgerId = mapping?.CreditLedgerId ?? (await _context.PigmySchemes.FirstOrDefaultAsync())?.PigmyLiabilityLedgerID ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 47;

                    generatedVouchersCount++;
                    string uniqueVoucherNo = $"PV-{groupBranchId}-{groupDate:yyyyMMdd}-APP-AGT-{groupAgentId}";
                    var existingVoucher = await _context.Vouchers.FirstOrDefaultAsync(v => v.BranchID == groupBranchId && v.VoucherNo == uniqueVoucherNo);
                    if (existingVoucher != null)
                    {
                        uniqueVoucherNo = $"PV-{groupBranchId}-{groupDate:yyyyMMdd}-APP-AGT-{groupAgentId}-{Guid.NewGuid().ToString("N").Substring(0, 4)}";
                    }

                    var voucher = new Voucher
                    {
                        BranchID = groupBranchId,
                        VoucherNo = uniqueVoucherNo,
                        VoucherDate = groupDate,
                        VoucherType = "Receipt",
                        Status = "Pending",
                        Narration = $"पिग्मी मोबाईल ॲप संकलन भरणा (एजंट: {agentName}, दिनांक: {groupDate:dd/MM/yyyy}) - एकूण {group.Count()} खाती",
                        TotalAmount = groupTotal
                    };

                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = drLedgerId,
                        CustomerID = group.First().PigmyAccount?.CustomerID,
                        DrCr = "Dr",
                        Amount = groupTotal
                    });

                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = crLedgerId,
                        CustomerID = group.First().PigmyAccount?.CustomerID,
                        DrCr = "Cr",
                        Amount = groupTotal
                    });

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    foreach (var col in group)
                    {
                        col.VoucherId = voucher.VoucherID;
                        col.IsVoucherGenerated = true;
                        if (anyItemIsBank)
                        {
                            col.PaymentMode = NormalizePigmyPaymentMode(requestForcesBank ? request.PaymentMode : col.PaymentMode, true);
                        }
                        _context.PigmyCollections.Update(col);
                        totalProcessedCollections++;
                    }
                    await _context.SaveChangesAsync();

                    // Record PigmyAgentCashDeposit so Agent Day Book reflects this remittance
                    var deposit = new PigmyAgentCashDeposit
                    {
                        AgentId = groupAgentId,
                        DepositDate = groupDate,
                        CollectionDateFrom = groupDate,
                        CollectionDateTo = groupDate,
                        Amount = groupTotal,
                        PaymentMode = anyItemIsBank ? "BANK" : "CASH",
                        ReceiptNo = $"REMD-{groupDate:yyyyMMdd}-APP-{groupAgentId}-{generatedVouchersCount:D2}",
                        Narration = $"पिग्मी मोबाईल ॲप संकलन भरणा (एजंट: {agentName})",
                        VoucherId = voucher.VoucherID,
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.PigmyAgentCashDeposits.Add(deposit);
                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();
                return Ok(new { 
                    message = $"एकूण {totalProcessedCollections} नोंदींसाठी {generatedVouchersCount} दिवसानिहाय एकत्रित व्हाउचर्स यशस्वीरीत्या तयार झाले व पासिंगसाठी पाठवले गेले!", 
                    generatedCount = generatedVouchersCount,
                    totalCollections = totalProcessedCollections
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "मोबाईल सिंक व्हाउचर तयार करताना त्रुटी आली: " + ex.Message);
            }
        }

        // GET: api/PigmyCollections/by-voucher/{voucherId}
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<IActionResult> GetCollectionByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = $"व्हाउचर क्र. {voucherId} सिस्टीममध्ये सापडले नाही." });
            }

            // 1. Try finding collection by VoucherId
            var collection = await _context.PigmyCollections
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.PigmyScheme)
                .Include(c => c.Agent)
                .FirstOrDefaultAsync(c => c.VoucherId == voucherId);

            PigmyAccount? account = collection?.PigmyAccount;
            PigmyAgent? agent = collection?.Agent;

            // 2. Fallback: Parse AccountNo from Narration (e.g. "for A/C 1234")
            if (account == null && !string.IsNullOrEmpty(voucher.Narration))
            {
                var match = System.Text.RegularExpressions.Regex.Match(
                    voucher.Narration,
                    @"(?:A\/C|खाते|Account)\s+([A-Za-z0-9\-]+)",
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

            // 3. Fallback: Lookup by Customer in VoucherDetails
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

            if (account != null && agent == null && account.PigmyAgentID > 0)
            {
                agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == account.PigmyAgentID);
            }

            return Ok(new
            {
                collection = collection != null ? new
                {
                    collection.CollectionId,
                    collection.ReceiptNo,
                    collection.CollectionDate,
                    collection.CollectionAmount,
                    collection.CollectionSource,
                    collection.OpeningBalance,
                    collection.ClosingBalance,
                    collection.PaymentMode
                } : null,
                account = account != null ? new
                {
                    account.PigmyAccountID,
                    account.AccountNo,
                    account.CustomerID,
                    CustomerName = account.Customer != null ? (account.Customer.FirstName + " " + account.Customer.LastName).Trim() : "",
                    CIFNo = account.Customer?.CIFNo ?? "",
                    account.TotalDepositedAmount,
                    account.Status,
                    SchemeName = account.PigmyScheme?.SchemeName ?? ""
                } : null,
                agent = agent != null ? new
                {
                    agent.PigmyAgentID,
                    agent.AgentName,
                    AgentCode = agent.Username ?? ("AGT-" + agent.PigmyAgentID),
                    MobileNo = agent.Customer?.MobileNo ?? ""
                } : null,
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
                    CanPass = voucher.Status == "Unapproved" || voucher.Status == "Draft" || voucher.Status == "Pending",
                    BankLedgerId = voucher.VoucherDetails.FirstOrDefault(vd => vd.DrCr == "Dr" && vd.Ledger != null && Helpers.BankLedgerHelper.IsBankAccountType(vd.Ledger.AccountType))?.LedgerID
                }
            });
        }
    }
}
