using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;

namespace Bhisi.Api.Services
{
    public class SingleCollectionRequestDto
    {
        [Required]
        public string TransactionId { get; set; } = string.Empty; // UUID from client

        public int AccountId { get; set; }
        public int? PigmyAccountId { get; set; }
        public string? AccountNo { get; set; }
        public string? OldAccountNo { get; set; }

        [Required]
        [Range(0.01, 10000000)]
        public decimal Amount { get; set; }

        public string PaymentMode { get; set; } = "CASH"; // CASH | UPI

        public string? Notes { get; set; }

        public DateTime? CollectionDate { get; set; }
        public DateTime? Timestamp { get; set; }

        public int? AgentId { get; set; }
    }

    public class SingleCollectionResponseDto
    {
        public bool Success { get; set; }
        public bool IsDuplicate { get; set; }
        public string TransactionId { get; set; } = string.Empty;
        public int AccountId { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public string? OldAccountNo { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public string ReceiptNo { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public decimal CurrentBalance { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? PaymentMode { get; set; }
        public DateTime? Timestamp { get; set; }
        public int StatusCode { get; set; } = 200;
        public string? SmsNotificationText { get; set; }
        public string? CustomerMobile { get; set; }
    }

    public class BulkSyncRequestDto
    {
        public List<SingleCollectionRequestDto> Collections { get; set; } = new List<SingleCollectionRequestDto>();
    }

    public class BulkSyncResponseDto
    {
        public bool Success { get; set; }
        public int TotalCount { get; set; }
        public int SuccessCount { get; set; }
        public int DuplicateCount { get; set; }
        public int FailedCount { get; set; }
        public decimal TotalAmount { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<SingleCollectionResponseDto> Results { get; set; } = new List<SingleCollectionResponseDto>();
    }

    public interface IPigmySyncService
    {
        Task<SingleCollectionResponseDto> ProcessSingleCollectionAsync(int agentId, SingleCollectionRequestDto dto);
        Task<BulkSyncResponseDto> ProcessBulkSyncAsync(int agentId, List<SingleCollectionRequestDto> items);
    }
}
