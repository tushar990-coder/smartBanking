using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SansthaBorrowingRepayment
    {
        [Key]
        public int BorrowingRepaymentID { get; set; }

        [Required]
        public int BorrowingID { get; set; }

        [ForeignKey("BorrowingID")]
        public virtual SansthaBorrowing? Borrowing { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [StringLength(60)]
        public string? RepaymentNo { get; set; }

        /// <summary>
        /// RegularEMI | PartPayment | InterestOnly | Foreclosure
        /// </summary>
        [StringLength(30)]
        public string RepaymentType { get; set; } = "RegularEMI";

        [StringLength(120)]
        public string? InstallmentsCovered { get; set; }

        public DateTime RepaymentDate { get; set; } = DateTime.Today;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalPaid { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestPaid { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenalOrChargesPaid { get; set; } = 0m;

        public int? ChargesLedgerID { get; set; }

        [ForeignKey("ChargesLedgerID")]
        public virtual Ledger? ChargesLedger { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalPaid { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal BalanceBeforeRepayment { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal BalanceAfterRepayment { get; set; }

        public DateTime? PreviousLastInterestPaidDate { get; set; }

        [Required]
        [StringLength(30)]
        public string PaymentMode { get; set; } = "Bank";

        public int? BankLedgerID { get; set; }

        [StringLength(80)]
        public string? ReferenceNo { get; set; }

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        [StringLength(300)]
        public string? Remarks { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
