using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class FdScheme
    {
        [Key]
        public int FdSchemeID { get; set; }

        [Required]
        public int InstitutionID { get; set; } = 1;

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(20)]
        public string SchemeCode { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string SchemeName { get; set; } = string.Empty;

        [Required]
        public int DurationMonths { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal SeniorCitizenInterestRate { get; set; }

        [Required]
        [StringLength(20)]
        public string InterestType { get; set; } = "Simple"; // Simple, Cumulative, MIS

        [StringLength(20)]
        public string InterestPostingMethod { get; set; } = "On Principal"; // On Principal, On Interest

        [StringLength(20)]
        public string InterestCompoundingFrequency { get; set; } = "N/A"; // N/A, Quarterly, Half-Yearly, Yearly

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal MinimumAmount { get; set; } = 1000;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal MaximumAmount { get; set; } = 1000000;

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal PrematureInterestRate { get; set; }

        [Required]
        public DateTime EffectiveDate { get; set; } = DateTime.Today;

        public bool IsActive { get; set; } = true;

        // Ledger Mapping Properties for Core Banking Integration
        public int? FdLiabilityLedgerID { get; set; }
        [ForeignKey("FdLiabilityLedgerID")]
        public virtual Ledger? FdLiabilityLedger { get; set; }

        public int? InterestExpenseLedgerID { get; set; }
        [ForeignKey("InterestExpenseLedgerID")]
        public virtual Ledger? InterestExpenseLedger { get; set; }

        public int? InterestPayableLedgerID { get; set; }
        [ForeignKey("InterestPayableLedgerID")]
        public virtual Ledger? InterestPayableLedger { get; set; }

        public int? PrematurePenaltyLedgerID { get; set; }
        [ForeignKey("PrematurePenaltyLedgerID")]
        public virtual Ledger? PrematurePenaltyLedger { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
