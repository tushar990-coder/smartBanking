using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class FdAccount
    {
        [Key]
        public int FdAccountID { get; set; }

        [Required]
        public int InstitutionID { get; set; } = 1;

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int FinancialYearID { get; set; } = 1;

        [ForeignKey("FinancialYearID")]
        public virtual FinancialYear? FinancialYear { get; set; }

        [Required]
        public int CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        [Required]
        public int FdSchemeID { get; set; }

        [ForeignKey("FdSchemeID")]
        public virtual FdScheme? FdScheme { get; set; }

        [StringLength(30)]
        public string AccountNo { get; set; } = string.Empty;

        [Required]
        public DateTime OpeningDate { get; set; } = DateTime.Today;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal DepositAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [Required]
        public DateTime MaturityDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal MaturityAmount { get; set; }

        public bool IsLegacyAccount { get; set; } = false;

        [Column(TypeName = "decimal(18,2)")]
        public decimal LegacyAccruedInt { get; set; } = 0;

        public DateTime? LastInterestPostingDate { get; set; }

        // Legacy Mapping Fields for Migration
        public int? LegacyAccountId { get; set; }

        [MaxLength(50)]
        public string? LegacyAccountNumber { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Active"; // Active, Matured, Closed

        [StringLength(100)]
        public string? NomineeName { get; set; }

        [StringLength(50)]
        public string? NomineeRelation { get; set; }

        [StringLength(250)]
        public string? Remarks { get; set; }

        [StringLength(20)]
        public string PaymentMode { get; set; } = "Cash"; // Cash, Bank, Transfer

        public int? BankAccountLedgerID { get; set; }

        [ForeignKey("BankAccountLedgerID")]
        public virtual Ledger? BankAccountLedger { get; set; }

        [StringLength(50)]
        public string? ChequeNo { get; set; }

        public DateTime? ChequeDate { get; set; }

        public int? SavingAccountID { get; set; }

        [ForeignKey("SavingAccountID")]
        public virtual SavingAccountMaster? SavingAccount { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
