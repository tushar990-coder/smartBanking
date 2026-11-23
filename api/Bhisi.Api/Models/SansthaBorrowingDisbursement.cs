using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SansthaBorrowingDisbursement
    {
        [Key]
        public int BorrowingDisbursementID { get; set; }

        [Required]
        public int BorrowingID { get; set; }

        [ForeignKey("BorrowingID")]
        public virtual SansthaBorrowing? Borrowing { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [Required]
        [StringLength(60)]
        public string DisbursementNo { get; set; } = string.Empty;

        public DateTime DisbursementDate { get; set; } = DateTime.Today;

        [Column(TypeName = "decimal(18,2)")]
        public decimal GrossDisbursedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ProcessingFeeDeducted { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal OtherDeductionsAmount { get; set; } = 0m;

        public int? DeductionLedgerID { get; set; }

        [ForeignKey("DeductionLedgerID")]
        public virtual Ledger? DeductionLedger { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal NetReceivedAmount { get; set; }

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
