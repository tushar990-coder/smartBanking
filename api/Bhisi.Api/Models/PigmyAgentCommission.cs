using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyAgentCommission
    {
        [Key]
        public int CommissionId { get; set; }

        [Required]
        public int AgentId { get; set; }

        [ForeignKey("AgentId")]
        public virtual PigmyAgent? Agent { get; set; }

        [Required]
        [MaxLength(20)]
        public string CalculationFrequency { get; set; } = string.Empty;

        public DateTime PeriodStartDate { get; set; }
        public DateTime PeriodEndDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalCollectionAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal CalculatedCommission { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "PENDING"; // "PENDING", "PAID"

        public int? VoucherId { get; set; }

        [ForeignKey("VoucherId")]
        public virtual Voucher? Voucher { get; set; }

        public DateTime CalculatedOn { get; set; } = DateTime.UtcNow;
    }
}
