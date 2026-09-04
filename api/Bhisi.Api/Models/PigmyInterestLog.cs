using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyInterestLog
    {
        [Key]
        public int LogId { get; set; }

        [Required]
        public int PigmyAccountId { get; set; }

        [ForeignKey("PigmyAccountId")]
        public virtual PigmyAccount? PigmyAccount { get; set; }

        public DateTime CalculationDate { get; set; }

        public DateTime PeriodStartDate { get; set; }
        public DateTime PeriodEndDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestAmount { get; set; }

        public int? VoucherId { get; set; }

        [ForeignKey("VoucherId")]
        public virtual Voucher? Voucher { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "POSTED";

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}
