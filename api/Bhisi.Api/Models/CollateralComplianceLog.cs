using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class CollateralComplianceLog
    {
        [Key]
        public int CollateralComplianceLogID { get; set; }

        [Required]
        public int LoanAccountID { get; set; }

        [ForeignKey("LoanAccountID")]
        public virtual LoanAccount? LoanAccount { get; set; }

        [Required]
        [StringLength(50)]
        public string CollateralType { get; set; } = string.Empty; // Immovable Property, Plant & Machinery, Pledged Stock, Other Exempt

        [Required]
        public DateTime ValuationDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ValuationValue { get; set; }

        [Required]
        public int ValuersCount { get; set; } = 1;

        [Required]
        public DateTime LastInspectionDate { get; set; }

        [Required]
        public DateTime InsuranceExpiryDate { get; set; }

        public DateTime? LastStockStatementDate { get; set; } // Only for Pledged Stock

        public bool IsAuditorVerified { get; set; } = false; // Only for Pledged Stock (limits >= 25 Lakh)

        public bool IsMarginMaintained { get; set; } = true; // Only for Exempt/Other assets (NSC, FD, Gold)

        [Column(TypeName = "decimal(18,2)")]
        public decimal? CollateralValue { get; set; }

        public string? CollateralDescription { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal? MarginPercent { get; set; }

        [StringLength(100)]
        public string? InspectorName { get; set; }

        [StringLength(500)]
        public string? Remarks { get; set; }

        [Required]
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}
