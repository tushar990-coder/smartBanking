using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LockerSurrender
    {
        [Key]
        public int SurrenderID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int AllotmentID { get; set; }

        [ForeignKey("AllotmentID")]
        public virtual LockerAllotment? Allotment { get; set; }

        [Required]
        public DateTime SurrenderDate { get; set; } = DateTime.Today;

        public bool KeyReceived { get; set; } = true;

        [StringLength(100)]
        public string KeysCondition { get; set; } = "Good"; // Good, LostKeyBreakOpen, KeyDamaged

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal DepositAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnpaidRentDeduction { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal DamagePenaltyDeduction { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal NetRefundAmount { get; set; } = 0;

        [Required]
        [StringLength(50)]
        public string RefundPaymentMode { get; set; } = "Cash"; // Cash, SavingCredit, BankTransfer

        public int? VoucherID { get; set; }
        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        [StringLength(250)]
        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
