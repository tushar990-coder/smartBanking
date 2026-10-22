using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class FdMisPayout
    {
        [Key]
        public int PayoutID { get; set; }

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
        public int FdAccountID { get; set; }

        [ForeignKey("FdAccountID")]
        public virtual FdAccount? FdAccount { get; set; }

        [Required]
        public int PayoutYear { get; set; }

        [Required]
        public int PayoutMonth { get; set; }

        [Required]
        public DateTime PayoutDate { get; set; }

        public DateTime? PeriodFromDate { get; set; }
        public DateTime? PeriodToDate { get; set; }
        public int ElapsedDays { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DepositPrincipal { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal GrossInterest { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TdsAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal LoanAdjustedAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal NetDisbursedAmount { get; set; }

        [StringLength(30)]
        public string DisbursementMode { get; set; } = "SavingTransfer"; // SavingTransfer, Cash, Suspense, LoanRecovery

        public int? TargetSavingAccountID { get; set; }

        [ForeignKey("TargetSavingAccountID")]
        public virtual SavingAccountMaster? TargetSavingAccount { get; set; }

        public int? TargetLoanAccountID { get; set; }

        [ForeignKey("TargetLoanAccountID")]
        public virtual LoanAccount? TargetLoanAccount { get; set; }

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Success"; // Success, Reversed, Failed

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.Now;

        [StringLength(250)]
        public string? Remarks { get; set; }
    }
}
