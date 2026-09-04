using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LockerRentPosting
    {
        [Key]
        public int PostingID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int AllotmentID { get; set; }

        [ForeignKey("AllotmentID")]
        public virtual LockerAllotment? Allotment { get; set; }

        [Required]
        [StringLength(20)]
        public string FinancialYear { get; set; } = string.Empty; // e.g. "2026-2027"

        [Required]
        public DateTime FromDate { get; set; }

        [Required]
        public DateTime ToDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal RentAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal GstAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenaltyAmount { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; } = 0;

        [Required]
        [StringLength(50)]
        public string PaymentMode { get; set; } = "Cash"; // Cash, SavingAutoDebit, Transfer

        public DateTime? PaymentDate { get; set; }

        [StringLength(50)]
        public string? ReceiptNo { get; set; }

        public int? VoucherID { get; set; }
        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        public bool IsPaid { get; set; } = false;

        [StringLength(250)]
        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
