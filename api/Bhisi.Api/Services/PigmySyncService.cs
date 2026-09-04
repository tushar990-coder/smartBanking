using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public class PigmySyncService : IPigmySyncService
    {
        private readonly AppDbContext _context;
        private readonly IAgentLockService _lockService;

        public PigmySyncService(AppDbContext context, IAgentLockService lockService)
        {
            _context = context;
            _lockService = lockService;
        }

        public async Task<SingleCollectionResponseDto> ProcessSingleCollectionAsync(int agentId, SingleCollectionRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.TransactionId))
            {
                return new SingleCollectionResponseDto
                {
                    Success = false,
                    StatusCode = 400,
                    Message = "TransactionId (UUID) is required for idempotency verification."
                };
            }

            if (dto.Amount <= 0)
            {
                return new SingleCollectionResponseDto
                {
                    Success = false,
                    StatusCode = 400,
                    TransactionId = dto.TransactionId,
                    Message = "Collection amount must be greater than zero."
                };
            }

            string cleanTxId = dto.TransactionId.Trim();

            // 1. Idempotency Check
            var existingCollection = await _context.PigmyCollections
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.Member)
                .FirstOrDefaultAsync(c => c.TransactionId == cleanTxId || c.SyncReferenceId == cleanTxId);

            if (existingCollection != null)
            {
                var memberName = existingCollection.PigmyAccount?.Member != null
                    ? $"{existingCollection.PigmyAccount.Member.FirstName} {existingCollection.PigmyAccount.Member.LastName}".Trim()
                    : "";

                return new SingleCollectionResponseDto
                {
                    Success = true,
                    IsDuplicate = true,
                    StatusCode = 200,
                    TransactionId = cleanTxId,
                    AccountId = existingCollection.PigmyAccountId,
                    AccountNo = existingCollection.PigmyAccount?.AccountNo ?? "",
                    MemberName = memberName,
                    ReceiptNo = existingCollection.ReceiptNo,
                    Amount = existingCollection.CollectionAmount,
                    CurrentBalance = existingCollection.ClosingBalance,
                    PaymentMode = existingCollection.PaymentMode,
                    Timestamp = existingCollection.CollectionDate,
                    Message = "Collection already synced (Idempotent success)."
                };
            }

            string paymentMode = !string.IsNullOrWhiteSpace(dto.PaymentMode) ? dto.PaymentMode.Trim().ToUpper() : "CASH";

            // 2. Agent Lock Check (Applies to CASH collections)
            var (isAllowed, lockError) = await _lockService.ValidateCollectionAllowedAsync(agentId, dto.Amount, paymentMode);
            if (!isAllowed)
            {
                return new SingleCollectionResponseDto
                {
                    Success = false,
                    StatusCode = 403,
                    TransactionId = cleanTxId,
                    AccountId = dto.AccountId,
                    Amount = dto.Amount,
                    Message = lockError ?? "Agent is locked. Cash holding exceeds the allowed limit."
                };
            }

            // 3. Process Collection Atomically
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.PigmyAccounts
                    .Include(a => a.Member)
                    .FirstOrDefaultAsync(a => a.PigmyAccountID == dto.AccountId);

                if (account == null)
                {
                    return new SingleCollectionResponseDto
                    {
                        Success = false,
                        StatusCode = 404,
                        TransactionId = cleanTxId,
                        AccountId = dto.AccountId,
                        Message = $"Pigmy account with ID {dto.AccountId} not found."
                    };
                }

                if (account.Status != "Active")
                {
                    return new SingleCollectionResponseDto
                    {
                        Success = false,
                        StatusCode = 400,
                        TransactionId = cleanTxId,
                        AccountId = dto.AccountId,
                        Message = $"Pigmy account is {account.Status} and cannot accept deposits."
                    };
                }

                DateTime collDate = dto.CollectionDate ?? DateTime.Today;
                decimal openingBal = account.TotalDepositedAmount;
                decimal addedAmount = dto.Amount;
                decimal closingBal = openingBal + addedAmount;

                string randomSuffix = Guid.NewGuid().ToString("N").Substring(0, 6).ToUpper();
                string receiptNo = $"REC-APP-{account.BranchID}-{collDate:yyyyMMdd}-{account.PigmyAccountID}-{randomSuffix}";

                var newColl = new PigmyCollection
                {
                    PigmyAccountId = account.PigmyAccountID,
                    AgentId = agentId,
                    CollectionDate = collDate,
                    OpeningBalance = openingBal,
                    CollectionAmount = addedAmount,
                    ClosingBalance = closingBal,
                    ReceiptNo = receiptNo,
                    PaymentMode = paymentMode,
                    Notes = dto.Notes?.Trim(),
                    CollectionSource = "APP",
                    TransactionId = cleanTxId,
                    SyncReferenceId = cleanTxId,
                    CreatedBy = agentId,
                    CreatedOn = DateTime.UtcNow
                };
                _context.PigmyCollections.Add(newColl);

                // Update Account Balance
                account.TotalDepositedAmount = closingBal;
                _context.PigmyAccounts.Update(account);

                // Customer Ledger Transaction (Passbook entry)
                var passbookTx = new PigmyTransaction
                {
                    PigmyAccountID = account.PigmyAccountID,
                    TransactionDate = collDate,
                    ValueDate = collDate,
                    TransactionType = "DEPOSIT",
                    DrAmount = 0m,
                    CrAmount = addedAmount,
                    BalanceAmount = closingBal,
                    Narration = $"Pigmy Collection ({paymentMode}) via App (Receipt: {receiptNo})",
                    ReferenceId = cleanTxId,
                    MakerId = agentId,
                    PostedOn = DateTime.UtcNow
                };
                _context.PigmyTransactions.Add(passbookTx);

                // Accounting Double-Entry Voucher
                try
                {
                    var branchId = account.BranchID;
                    var voucherMapping = await _context.PigmyVoucherMappings
                        .FirstOrDefaultAsync(m => m.BranchId == branchId && m.CollectionSource == "APP" && m.IsActive);

                    int drLedgerId = voucherMapping?.DebitLedgerId ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("कॅश") || l.LedgerName.Contains("Cash")))?.LedgerID ?? 1;
                    int crLedgerId = voucherMapping?.CreditLedgerId ?? (await _context.PigmySchemes.FirstOrDefaultAsync(s => s.PigmySchemeID == account.PigmySchemeID))?.PigmyLiabilityLedgerID ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 2;

                    string voucherNo = $"PV-{branchId}-{collDate:yyyyMMdd}-APP-{Guid.NewGuid().ToString("N").Substring(0, 4).ToUpper()}";
                    var voucher = new Voucher
                    {
                        BranchID = branchId,
                        VoucherNo = voucherNo,
                        VoucherDate = collDate,
                        VoucherType = "Receipt",
                        Status = "Pending",
                        Narration = $"Pigmy App Deposit: A/c {account.AccountNo}, Receipt: {receiptNo}",
                        TotalAmount = addedAmount,
                        CreatedBy = agentId,
                        CreatedOn = DateTime.UtcNow
                    };

                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = drLedgerId,
                        MemberID = null,
                        DrCr = "Dr",
                        Amount = addedAmount
                    });

                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = crLedgerId,
                        MemberID = account.MemberID,
                        DrCr = "Cr",
                        Amount = addedAmount
                    });

                    _context.Vouchers.Add(voucher);
                }
                catch
                {
                    // Non-fatal if voucher mapping fails; core ledger transaction is already saved.
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                var customerName = account.Member != null
                    ? $"{account.Member.FirstName} {account.Member.LastName}".Trim()
                    : "";

                return new SingleCollectionResponseDto
                {
                    Success = true,
                    IsDuplicate = false,
                    StatusCode = 200,
                    TransactionId = cleanTxId,
                    AccountId = account.PigmyAccountID,
                    AccountNo = account.AccountNo,
                    MemberName = customerName,
                    ReceiptNo = receiptNo,
                    Amount = addedAmount,
                    CurrentBalance = closingBal,
                    PaymentMode = paymentMode,
                    Timestamp = collDate,
                    Message = "Collection processed and saved successfully."
                };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return new SingleCollectionResponseDto
                {
                    Success = false,
                    StatusCode = 500,
                    TransactionId = cleanTxId,
                    AccountId = dto.AccountId,
                    Amount = dto.Amount,
                    Message = $"Database transaction failed: {ex.Message}"
                };
            }
        }

        public async Task<BulkSyncResponseDto> ProcessBulkSyncAsync(int agentId, List<SingleCollectionRequestDto> items)
        {
            var response = new BulkSyncResponseDto
            {
                TotalCount = items?.Count ?? 0,
                Results = new List<SingleCollectionResponseDto>()
            };

            if (items == null || items.Count == 0)
            {
                response.Success = true;
                response.Message = "No items to sync.";
                return response;
            }

            int successCount = 0;
            int duplicateCount = 0;
            int failedCount = 0;
            decimal totalAmount = 0m;

            foreach (var item in items)
            {
                var result = await ProcessSingleCollectionAsync(agentId, item);
                response.Results.Add(result);

                if (result.Success)
                {
                    if (result.IsDuplicate)
                    {
                        duplicateCount++;
                    }
                    else
                    {
                        successCount++;
                        totalAmount += result.Amount;
                    }
                }
                else
                {
                    failedCount++;
                }
            }

            response.Success = failedCount == 0;
            response.SuccessCount = successCount;
            response.DuplicateCount = duplicateCount;
            response.FailedCount = failedCount;
            response.TotalAmount = totalAmount;
            response.Message = $"Bulk sync completed: {successCount} synced, {duplicateCount} duplicates acknowledged, {failedCount} failed.";

            return response;
        }
    }
}
