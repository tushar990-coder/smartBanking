using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class InvestmentScheme
    {
        [Key]
        public int SchemeID { get; set; }

        [Required]
        public int InstitutionID { get; set; } = 1; // Tenant ID

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int InvestmentInstitutionID { get; set; }

        [ForeignKey("InvestmentInstitutionID")]
        public virtual InvestmentInstitution? InvestmentInstitution { get; set; }

        [Required]
        [StringLength(20)]
        public string SchemeCode { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string SchemeName { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [Required]
        public int DurationMonths { get; set; }

        [Required]
        [StringLength(50)]
        public string InterestCalculationMethod { get; set; } = "Simple"; // Simple, Cumulative, MonthlyMIS

        [Required]
        [StringLength(30)]
        public string InvestmentType { get; set; } = "Deposit"; // Deposit, Share

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal PrematureWithdrawalRate { get; set; }

        // General Ledger (GL) Accounts Mapping
        public int? InvestmentAssetLedgerID { get; set; }
        [ForeignKey("InvestmentAssetLedgerID")]
        public virtual Ledger? InvestmentAssetLedger { get; set; }

        public int? InterestIncomeLedgerID { get; set; }
        [ForeignKey("InterestIncomeLedgerID")]
        public virtual Ledger? InterestIncomeLedger { get; set; }

        public int? InterestReceivableLedgerID { get; set; }
        [ForeignKey("InterestReceivableLedgerID")]
        public virtual Ledger? InterestReceivableLedger { get; set; }

        public bool IsActive { get; set; } = true;

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
