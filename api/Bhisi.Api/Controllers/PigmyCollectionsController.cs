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

        public class ManualCollectionDto
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
            public List<BulkManualItemDto> Items { get; set; } = new List<BulkManualItemDto>();
        }

        // GET: api/PigmyCollections
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetPigmyCollections(
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int? agentId,
            [FromQuery] int? branchId,
            [FromQuery] int? pigmyAccountId)
        {
            var query = _context.PigmyCollections
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

            var collections = await query
                .OrderByDescending(c => c.CollectionDate)
                .ThenByDescending(c => c.CollectionId)
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

        // POST: api/PigmyCollections/Manual
        [HttpPost("Manual")]
        public async Task<IActionResult> ProcessManualCollection([FromBody] ManualCollectionDto dto)
        {
            if (dto.CollectionAmount <= 0) return BadRequest("जमा रक्कम ० पेक्षा जास्त असणे आवश्यक आहे.");

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.PigmyAccounts.FirstOrDefaultAsync(a => a.PigmyAccountID == dto.PigmyAccountId);
                if (account == null) return NotFound("पिग्मी खाते सापडले नाही.");
                if (account.Status != "Active") return BadRequest("बंद किंवा निष्क्रिय खात्यावर जमा करता येणार नाही.");

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
                int drLedgerId = mapping?.DebitLedgerId ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("कॅश") || l.LedgerName.Contains("Cash")))?.LedgerID ?? 1;
                int crLedgerId = mapping?.CreditLedgerId ?? (await _context.PigmySchemes.FirstOrDefaultAsync(s => s.PigmySchemeID == account.PigmySchemeID))?.PigmyLiabilityLedgerID ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 2;

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

                    // Auto Voucher
                    var mapping = await _context.PigmyVoucherMappings.FirstOrDefaultAsync(m => m.BranchId == branchId && m.CollectionSource == "APP" && m.IsActive);
                    if (mapping != null)
                    {
                        string uniqueVoucherNo = $"PV-{branchId}-{dto.CollectionDate:yyyyMMdd}-APP-{appItemIdx:D3}-{Guid.NewGuid().ToString("N").Substring(0, 4)}";
                        var voucher = new Voucher
                        {
                            BranchID = branchId,
                            VoucherNo = uniqueVoucherNo,
                            VoucherDate = dto.CollectionDate,
                            VoucherType = "Receipt",
                            Narration = $"Pigmy App Collection for A/C {account.AccountNo}",
                            TotalAmount = dto.CollectionAmount
                        };

                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = mapping.DebitLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Dr",
                            Amount = dto.CollectionAmount
                        });

                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = mapping.CreditLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Cr",
                            Amount = dto.CollectionAmount
                        });

                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        collection.VoucherId = voucher.VoucherID;
                        collection.IsVoucherGenerated = true;
                    }
                    else
                    {
                        await _context.SaveChangesAsync();
                    }

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

            var validItems = request.Items.Where(i => i.CollectionAmount > 0).ToList();
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
                    int drLedgerId = mapping?.DebitLedgerId ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("कॅश") || l.LedgerName.Contains("Cash")))?.LedgerID ?? 1;
                    int crLedgerId = mapping?.CreditLedgerId ?? (await _context.PigmySchemes.FirstOrDefaultAsync(s => s.PigmySchemeID == account.PigmySchemeID))?.PigmyLiabilityLedgerID ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 2;

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
    }
}
