using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyWithdrawal
    {
        [Key]
        public int WithdrawalID { get; set; }

        [Required]
        public int PigmyAccountID { get; set; }

        [ForeignKey("PigmyAccountID")]
        public virtual PigmyAccount? PigmyAccount { get; set; }

        [Required]
        public DateTime WithdrawalDate { get; set; } = DateTime.Today;

        public int CycleNumber { get; set; } = 1;

        [Required]
        public DateTime CycleStartSnapshot { get; set; }

        public int ElapsedDays { get; set; } = 0;

        [Column(TypeName = "decimal(5,2)")]
        public decimal ElapsedMonths { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal RequestedAmount { get; set; }

        public int? AppliedSlabID { get; set; }

        [ForeignKey("AppliedSlabID")]
        public virtual PigmySchemeInterestSlab? AppliedSlab { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal PenaltyRate { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenaltyAmount { get; set; } = 0;

        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestAmount { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal NetPaidAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal RemainingBalance { get; set; }

        [StringLength(50)]
        public string? VoucherNo { get; set; }

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        [StringLength(30)]
        public string PaymentMode { get; set; } = "Cash";

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

        public int? DeductionLedgerID { get; set; }

        [ForeignKey("DeductionLedgerID")]
        public virtual Ledger? DeductionLedger { get; set; }

        public int? InterestDebitLedgerID { get; set; }

        [ForeignKey("InterestDebitLedgerID")]
        public virtual Ledger? InterestDebitLedger { get; set; }

        public bool IsManualOverride { get; set; }

        [StringLength(250)]
        public string? OverrideReason { get; set; }

        [StringLength(250)]
        public string? Narration { get; set; }

        public int CreatedBy { get; set; } = 1;

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
