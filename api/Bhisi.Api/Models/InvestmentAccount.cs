using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class InvestmentAccount
    {
        [Key]
        public int InvestmentAccountID { get; set; }

        [Required]
        public int InstitutionID { get; set; } = 1; // Tenant ID

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int FinancialYearID { get; set; } = 1;

        [ForeignKey("FinancialYearID")]
        public virtual FinancialYear? FinancialYear { get; set; }

        [Required]
        public int InvestmentInstitutionID { get; set; }

        [ForeignKey("InvestmentInstitutionID")]
        public virtual InvestmentInstitution? InvestmentInstitution { get; set; }

        [Required]
        public int SchemeID { get; set; }

        [ForeignKey("SchemeID")]
        public virtual InvestmentScheme? InvestmentScheme { get; set; }

        [Required]
        [StringLength(30)]
        public string InvestmentNo { get; set; } = string.Empty;

        [StringLength(50)]
        public string? DepositReceiptNo { get; set; } // ठेव पावती क्रमांक / Deposit Receipt Number

        [Required]
        public DateTime InvestmentDate { get; set; } = DateTime.Today;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [Required]
        public DateTime MaturityDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ExpectedMaturityAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AccruedInterestTillMigration { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal BookValue { get; set; }

        public bool IsLegacyAccount { get; set; } = false;

        [StringLength(100)]
        public string? NomineeName { get; set; }

        [StringLength(50)]
        public string? NomineeRelation { get; set; }

        [StringLength(250)]
        public string? Remarks { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Active"; // Active, Matured, Closed, Renewed

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
