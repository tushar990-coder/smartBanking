using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanAccountNpaStatus
    {
        [Key]
        public int LoanAccountNpaStatusID { get; set; }

        [Required]
        public int LoanAccountID { get; set; }

        [ForeignKey("LoanAccountID")]
        public virtual LoanAccount? LoanAccount { get; set; }

        [Required]
        public DateTime AsOfDate { get; set; }

        public DateTime? OverdueDate { get; set; } // Thakbaki Dinank

        [NotMapped]
        public int OverdueDays => OverdueDate.HasValue ? Math.Max(0, (AsOfDate - OverdueDate.Value).Days) : 0;

        public DateTime? OutOfOrderDate { get; set; } // CC/OD Irregularity start date

        [Required]
        [StringLength(50)]
        public string Category { get; set; } = "Standard"; // Standard, Sub-Standard, Doubtful-1/2/3, Loss

        [Required]
        [StringLength(50)]
        public string SecurityType { get; set; } = "Unsecured"; // Secured, Unsecured, Mixed

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal OutstandingBalance { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal CompliantCollateralValue { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ProvisionRequired { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ProvisionHeld { get; set; }

        [Required]
        public bool IsAutoClassified { get; set; } = true;

        [Required]
        public int LastClassificationRunId { get; set; }

        [ForeignKey("LastClassificationRunId")]
        public virtual NpaClassificationRun? Run { get; set; }

        [StringLength(500)]
        public string? AuditorRemarks { get; set; } // For Loss Asset classification
    }
}
