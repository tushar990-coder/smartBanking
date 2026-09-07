using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class RdAccount
    {
        [Key]
        public int RdAccountID { get; set; }

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
        [InverseProperty("RdAccounts")]
        public virtual Customer? Customer { get; set; }

        [Required]
        public int RdSchemeID { get; set; }

        [ForeignKey("RdSchemeID")]
        public virtual RdScheme? RdScheme { get; set; }

        [StringLength(30)]
        public string AccountNo { get; set; } = string.Empty;

        [Required]
        public DateTime OpeningDate { get; set; } = DateTime.Today;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal InstallmentAmount { get; set; }

        [Required]
        public int DurationMonths { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [Required]
        public DateTime MaturityDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal MaturityAmount { get; set; }

        public int TotalPaidInstallments { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalDepositedAmount { get; set; } = 0;

        public bool IsLegacyAccount { get; set; } = false;

        [Column(TypeName = "decimal(18,2)")]
        public decimal LegacyAccruedInt { get; set; } = 0;

        // Legacy Mapping Fields for Migration
        public int? LegacyAccountId { get; set; }

        [MaxLength(50)]
        public string? LegacyAccountNumber { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Active"; // Active, Matured, Closed

        // CBS Core Banking Fields
        [StringLength(20)]
        public string AccountType { get; set; } = "Single"; // Single, Joint, Minor

        public int? JointCustomerID { get; set; }

        [ForeignKey("JointCustomerID")]
        public virtual Customer? JointCustomer { get; set; }

        [StringLength(100)]
        public string? GuardianName { get; set; }

        [StringLength(50)]
        public string? GuardianRelation { get; set; }

        [StringLength(30)]
        public string PaymentMode { get; set; } = "Cash"; // Cash, AutoDebit_Saving, Transfer

        public int? SavingAccountID { get; set; }

        [ForeignKey("SavingAccountID")]
        public virtual SavingAccountMaster? SavingAccount { get; set; }

        [StringLength(30)]
        public string MaturityInstruction { get; set; } = "Cash_Payout"; // Credit_Saving, Cash_Payout, Transfer_FD

        public int? AgentID { get; set; }

        [ForeignKey("AgentID")]
        public virtual PigmyAgent? Agent { get; set; }

        [StringLength(50)]
        public string? PassbookNo { get; set; }

        [StringLength(100)]
        public string? NomineeName { get; set; }

        [StringLength(50)]
        public string? NomineeRelation { get; set; }

        [StringLength(250)]
        public string? Remarks { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
