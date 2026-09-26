using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyWithdrawal
    {
        [Key]
        public int WithdrawalID { get; set; }

        [Required]
        public int PigmyAccountID { get; set; }

        [ForeignKey("PigmyAccountID")]
        public virtual PigmyAccount? PigmyAccount { get; set; }

        [Required]
        public DateTime WithdrawalDate { get; set; } = DateTime.Today;

        public int CycleNumber { get; set; } = 1;

        [Required]
        public DateTime CycleStartSnapshot { get; set; }

        public int ElapsedDays { get; set; } = 0;

        [Column(TypeName = "decimal(5,2)")]
        public decimal ElapsedMonths { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal RequestedAmount { get; set; }

        public int? AppliedSlabID { get; set; }

        [ForeignKey("AppliedSlabID")]
        public virtual PigmySchemeInterestSlab? AppliedSlab { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal PenaltyRate { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenaltyAmount { get; set; } = 0;

        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestAmount { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal NetPaidAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal RemainingBalance { get; set; }

        [StringLength(50)]
        public string? VoucherNo { get; set; }

        [StringLength(250)]
        public string? Narration { get; set; }

        public int CreatedBy { get; set; } = 1;

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
