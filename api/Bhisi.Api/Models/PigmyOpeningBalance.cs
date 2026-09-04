using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyOpeningBalance
    {
        [Key]
        public int PigmyOpeningBalanceID { get; set; }

        [Required]
        public int PigmyAccountID { get; set; }

        [ForeignKey("PigmyAccountID")]
        public virtual PigmyAccount? PigmyAccount { get; set; }

        [Required]
        [StringLength(9)]
        public string FinancialYear { get; set; } = string.Empty;

        [Required]
        public DateTime AsOfDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal MigratedBalanceAmount { get; set; }

        [StringLength(255)]
        public string? MigrationRemarks { get; set; }

        public bool IsPostedToLedger { get; set; } = false;

        public int MigratedBy { get; set; } = 1;
        public DateTime MigratedOn { get; set; } = DateTime.UtcNow;
    }
}
