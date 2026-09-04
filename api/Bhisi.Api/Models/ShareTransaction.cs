using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class ShareTransaction
    {
        [Key]
        public int TransactionId { get; set; }

        [Required]
        public int ShareAccountId { get; set; }

        [ForeignKey("ShareAccountId")]
        public virtual ShareAccount? ShareAccount { get; set; }

        [Required]
        public int CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        [Required]
        public DateTime TransactionDate { get; set; } = DateTime.Today;

        [Required]
        [MaxLength(50)]
        public string TransactionType { get; set; } = "Allotment"; // Allotment, Transfer, Refund

        [Required]
        public int NumberOfShares { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [MaxLength(255)]
        public string Narration { get; set; } = string.Empty;

        public int? VoucherId { get; set; }

        [ForeignKey("VoucherId")]
        public virtual Voucher? Voucher { get; set; }
    }
}
