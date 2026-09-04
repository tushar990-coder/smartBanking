using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class RdScheme
    {
        [Key]
        public int RdSchemeID { get; set; }

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
        [Column(TypeName = "decimal(18,2)")]
        public decimal InstallmentAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal MinimumInstallment { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal MaximumInstallment { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [Required]
        [StringLength(20)]
        public string InterestMethod { get; set; } = "Quarterly"; // Quarterly compounded

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal PenaltyAmount { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal PrematurePenaltyRate { get; set; } = 1.00m;

        [Required]
        public DateTime EffectiveDate { get; set; } = DateTime.Today;

        public bool IsActive { get; set; } = true;

        // General Ledger (GL) Mapping Properties for Core Banking Integration
        public int? RdLiabilityLedgerID { get; set; }
        [ForeignKey("RdLiabilityLedgerID")]
        public virtual Ledger? RdLiabilityLedger { get; set; }

        public int? InterestExpenseLedgerID { get; set; }
        [ForeignKey("InterestExpenseLedgerID")]
        public virtual Ledger? InterestExpenseLedger { get; set; }

        public int? InterestPayableLedgerID { get; set; }
        [ForeignKey("InterestPayableLedgerID")]
        public virtual Ledger? InterestPayableLedger { get; set; }

        public int? PenaltyIncomeLedgerID { get; set; }
        [ForeignKey("PenaltyIncomeLedgerID")]
        public virtual Ledger? PenaltyIncomeLedger { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
