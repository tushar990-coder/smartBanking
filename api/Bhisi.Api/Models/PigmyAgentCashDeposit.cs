using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyAgentCashDeposit
    {
        [Key]
        public int DepositId { get; set; }

        [Required]
        public int AgentId { get; set; }

        [ForeignKey("AgentId")]
        public virtual PigmyAgent? Agent { get; set; }

        [Required]
        public DateTime DepositDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Required]
        [MaxLength(50)]
        public string ReceiptNo { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? Narration { get; set; }

        [MaxLength(50)]
        public string PaymentMode { get; set; } = "CASH";

        // Links to the generated accounting voucher
        public int? VoucherId { get; set; }

        [ForeignKey("VoucherId")]
        public virtual Voucher? Voucher { get; set; }

        [Required]
        public int CreatedBy { get; set; }

        [Required]
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}
