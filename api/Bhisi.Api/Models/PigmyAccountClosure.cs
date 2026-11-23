using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyAccountClosure
    {
        [Key]
        public int PigmyClosureID { get; set; }

        [Required]
        public int PigmyAccountID { get; set; }

        [ForeignKey("PigmyAccountID")]
        public virtual PigmyAccount? PigmyAccount { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [Required]
        public DateTime ClosureDate { get; set; } = DateTime.Today;

        public bool IsPremature { get; set; }

        public int CycleNumber { get; set; } = 1;

        public DateTime CycleStartSnapshot { get; set; }

        public int ElapsedDays { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal GrossDepositBalance { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AlreadyCapitalizedInterest { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal VerifiedProvisionedInterest { get; set; }

        public int? AppliedSlabID { get; set; }

        [ForeignKey("AppliedSlabID")]
        public virtual PigmySchemeInterestSlab? AppliedSlab { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal CalculatedPenaltyRate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal CommissionOrPenaltyAmount { get; set; }

        public int? DeductionLedgerID { get; set; }

        [ForeignKey("DeductionLedgerID")]
        public virtual Ledger? DeductionLedger { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal CalculatedInterestRate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal FinalInterestAmount { get; set; }

        [StringLength(30)]
        public string InterestDebitMode { get; set; } = "Expense"; // Expense | Provision

        public int? InterestDebitLedgerID { get; set; }

        [ForeignKey("InterestDebitLedgerID")]
        public virtual Ledger? InterestDebitLedger { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal NetPayableAmount { get; set; }

        [StringLength(30)]
        public string PaymentMode { get; set; } = "Cash"; // Cash | Bank | Saving Transfer | Adjust in Loan

        public int? BankLedgerID { get; set; }

        public int? SavingAccountID { get; set; }

        [StringLength(80)]
        public string? ReferenceNo { get; set; }

        public bool AdjustInLoan { get; set; }

        public int? TargetLoanAccountID { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LoanAdjustedAmount { get; set; }

        public int? LinkedLoanCollectionID { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SurplusPayoutAmount { get; set; }

        [StringLength(30)]
        public string? SurplusPaymentMode { get; set; }

        public int? SurplusBankLedgerID { get; set; }

        public int? SurplusSavingAccountID { get; set; }

        [StringLength(20)]
        public string PreviousAccountStatus { get; set; } = "Active";

        public bool WasLienMarked { get; set; }

        [StringLength(50)]
        public string? PreviousLienLoanAccountNo { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? PreviousLienAmount { get; set; }

        public bool IsManualOverride { get; set; }

        [StringLength(250)]
        public string? OverrideReason { get; set; }

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        [StringLength(60)]
        public string? VoucherNo { get; set; }

        [StringLength(500)]
        public string? Narration { get; set; }

        public int CreatedBy { get; set; } = 1;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
