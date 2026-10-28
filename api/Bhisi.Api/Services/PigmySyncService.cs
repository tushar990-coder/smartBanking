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
                    .ThenInclude(a => a!.Customer)
                .FirstOrDefaultAsync(c => c.TransactionId == cleanTxId || c.SyncReferenceId == cleanTxId);

            if (existingCollection != null)
            {
                var customerName = existingCollection.PigmyAccount?.Customer != null
                    ? $"{existingCollection.PigmyAccount.Customer.FirstName} {existingCollection.PigmyAccount.Customer.LastName}".Trim()
                    : "";

                return new SingleCollectionResponseDto
                {
                    Success = true,
                    IsDuplicate = true,
                    StatusCode = 200,
                    TransactionId = cleanTxId,
                    AccountId = existingCollection.PigmyAccountId,
                    AccountNo = existingCollection.PigmyAccount?.AccountNo ?? "",
                    OldAccountNo = existingCollection.PigmyAccount?.OldAccountNo ?? existingCollection.PigmyAccount?.LegacyAccountNumber ?? existingCollection.PigmyAccount?.PreviousAccountNo ?? "",
                    CustomerName = customerName,
                    MemberName = customerName,
                    CustomerMobile = existingCollection.PigmyAccount?.Customer?.MobileNo ?? "",
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
                int targetId = dto.AccountId > 0 ? dto.AccountId : (dto.PigmyAccountId ?? 0);
                PigmyAccount? account = null;

                // 1. Try finding by Primary Key ID
                if (targetId > 0)
                {
                    account = await _context.PigmyAccounts
                        .Include(a => a.Customer)
                        .FirstOrDefaultAsync(a => a.PigmyAccountID == targetId);
                }

                // 2. Try finding by Old Account Number (Physical Passbook No) under this agent
                if (account == null && !string.IsNullOrWhiteSpace(dto.OldAccountNo))
                {
                    string cleanOldNo = dto.OldAccountNo.Trim();
                    account = await _context.PigmyAccounts
                        .Include(a => a.Customer)
                        .FirstOrDefaultAsync(a => a.PigmyAgentID == agentId && 
                            (a.OldAccountNo == cleanOldNo || a.LegacyAccountNumber == cleanOldNo || a.PreviousAccountNo == cleanOldNo));
                }

                // 3. Try finding by CBS Account Number
                if (account == null && !string.IsNullOrWhiteSpace(dto.AccountNo))
                {
                    string cleanAccNo = dto.AccountNo.Trim();
                    account = await _context.PigmyAccounts
                        .Include(a => a.Customer)
                        .FirstOrDefaultAsync(a => a.AccountNo == cleanAccNo);
                }

                if (account == null)
                {
                    string searchIdentifier = targetId > 0 ? $"ID {targetId}" : (!string.IsNullOrWhiteSpace(dto.OldAccountNo) ? $"OldAccountNo '{dto.OldAccountNo}'" : $"AccountNo '{dto.AccountNo}'");
                    return new SingleCollectionResponseDto
                    {
                        Success = false,
                        StatusCode = 404,
                        TransactionId = cleanTxId,
                        AccountId = targetId,
                        Message = $"Pigmy account with {searchIdentifier} not found."
                    };
                }

                if (account.Status != "Active")
                {
                    return new SingleCollectionResponseDto
                    {
                        Success = false,
                        StatusCode = 400,
                        TransactionId = cleanTxId,
                        AccountId = account.PigmyAccountID,
                        Message = $"Pigmy account is {account.Status} and cannot accept deposits."
                    };
                }

                DateTime collDate = dto.Timestamp ?? dto.CollectionDate ?? DateTime.Today;
                decimal openingBal = account.TotalDepositedAmount;
                decimal addedAmount = dto.Amount;
                decimal closingBal = openingBal + addedAmount;

                string receiptNo = !string.IsNullOrWhiteSpace(dto.ReceiptNo)
                    ? dto.ReceiptNo.Trim()
                    : $"PG-AGT-{agentId}-{collDate:yyyyMMddHHmmss}";

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

                // Vouchers are not generated on field collection; voucher is generated when agent submits cash to the branch.
                newColl.VoucherId = null;
                newColl.IsVoucherGenerated = false;
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                var customerName = account.Customer != null
                    ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim()
                    : "";
                var customerMobile = account.Customer?.MobileNo ?? "";
                string smsText = $"प्रिय सभासद, आपल्या दैनिक ठेव खाते क्र. {account.AccountNo} मध्ये ₹{addedAmount:N2} जमा झाले आहेत. चालू शिल्लक ₹{closingBal:N2}. पावती: {receiptNo}. - SmartBanking";

                // Real-Time CBS notification hook
                try
                {
                    var notification = new SystemNotification
                    {
                        BranchID = account.BranchID,
                        ModuleName = "Pigmy",
                        NotificationType = "COLLECTION",
                        Title = $"पिग्मी पावती ₹{addedAmount:N0} जमा",
                        Description = $"खाते क्र. {account.AccountNo} ({customerName}) मध्ये ₹{addedAmount:N2} जमा. पावती: {receiptNo}, चालू शिल्लक: ₹{closingBal:N2}",
                        Priority = "LOW",
                        TargetTab = "Pigmy",
                        EntityName = "PigmyAccount",
                        EntityID = account.PigmyAccountID.ToString(),
                        Amount = addedAmount,
                        Status = "Active",
                        CreatedOn = DateTime.UtcNow
                    };
                    _context.SystemNotifications.Add(notification);
                    await _context.SaveChangesAsync();
                }
                catch
                {
                    // Non-blocking notification dispatch
                }

                return new SingleCollectionResponseDto
                {
                    Success = true,
                    IsDuplicate = false,
                    StatusCode = 200,
                    TransactionId = cleanTxId,
                    AccountId = account.PigmyAccountID,
                    AccountNo = account.AccountNo,
                    OldAccountNo = account.OldAccountNo ?? account.LegacyAccountNumber ?? account.PreviousAccountNo ?? "",
                    CustomerName = customerName,
                    MemberName = customerName,
                    CustomerMobile = customerMobile,
                    ReceiptNo = receiptNo,
                    Amount = addedAmount,
                    CurrentBalance = closingBal,
                    PaymentMode = paymentMode,
                    Timestamp = collDate,
                    SmsNotificationText = smsText,
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
