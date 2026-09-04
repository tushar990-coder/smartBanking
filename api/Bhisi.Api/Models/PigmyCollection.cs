using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyCollection
    {
        [Key]
        public long CollectionId { get; set; }

        [Required]
        public int PigmyAccountId { get; set; }

        [ForeignKey("PigmyAccountId")]
        public virtual PigmyAccount? PigmyAccount { get; set; }

        [Required]
        public int AgentId { get; set; }

        [ForeignKey("AgentId")]
        public virtual PigmyAgent? Agent { get; set; }

        [Required]
        public DateTime CollectionDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal OpeningBalance { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal CollectionAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ClosingBalance { get; set; }

        [Required]
        [StringLength(50)]
        public string ReceiptNo { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string CollectionSource { get; set; } = string.Empty; // MANUAL, APP, IMPORT

        public Guid? ImportBatchId { get; set; }

        [StringLength(100)]
        public string? SyncReferenceId { get; set; }

        [StringLength(64)]
        public string? TransactionId { get; set; }

        [StringLength(10)]
        public string PaymentMode { get; set; } = "CASH";

        [StringLength(255)]
        public string? Notes { get; set; }

        public bool IsVoucherGenerated { get; set; } = false;

        public int? VoucherId { get; set; }

        [ForeignKey("VoucherId")]
        public virtual Voucher? Voucher { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}

