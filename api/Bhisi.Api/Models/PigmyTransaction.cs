using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyTransaction
    {
        [Key]
        public int PigmyTransactionID { get; set; }

        [Required]
        public int PigmyAccountID { get; set; }

        [ForeignKey("PigmyAccountID")]
        public virtual PigmyAccount? PigmyAccount { get; set; }

        [Required]
        public DateTime TransactionDate { get; set; }

        [Required]
        public DateTime ValueDate { get; set; }

        [Required]
        [StringLength(20)]
        public string TransactionType { get; set; } = string.Empty; // OPENING_BALANCE, DEPOSIT, WITHDRAWAL, INTEREST

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal DrAmount { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal CrAmount { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal BalanceAmount { get; set; }

        [Required]
        [StringLength(255)]
        public string Narration { get; set; } = string.Empty;

        [StringLength(50)]
        public string? ReferenceId { get; set; }

        public int MakerId { get; set; } = 1;
        public DateTime PostedOn { get; set; } = DateTime.UtcNow;
    }
}
