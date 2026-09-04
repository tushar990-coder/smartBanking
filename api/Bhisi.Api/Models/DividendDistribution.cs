using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class DividendDistribution
    {
        [Key]
        public int DividendId { get; set; }

        [Required]
        public int ShareAccountId { get; set; }

        [ForeignKey("ShareAccountId")]
        public virtual ShareAccount? ShareAccount { get; set; }

        [Required]
        [MaxLength(20)]
        public string FinancialYear { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal DividendPercentage { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal DividendAmount { get; set; }

        [Required]
        public DateTime PayoutDate { get; set; } = DateTime.Today;

        public bool IsPaid { get; set; } = false;

        public int? VoucherId { get; set; }

        [ForeignKey("VoucherId")]
        public virtual Voucher? Voucher { get; set; }
    }
}
