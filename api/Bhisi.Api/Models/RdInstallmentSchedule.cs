using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class RdInstallmentSchedule
    {
        [Key]
        public long ScheduleID { get; set; }

        [Required]
        public int RdAccountID { get; set; }

        [ForeignKey("RdAccountID")]
        public virtual RdAccount? RdAccount { get; set; }

        [Required]
        public int InstallmentNo { get; set; }

        [Required]
        public DateTime DueDate { get; set; }

        [Required]
        public DateTime GraceDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ExpectedAmount { get; set; }

        public DateTime? PaidDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PaidAmount { get; set; } = 0.00m;

        public int OverdueDays { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenaltyCharged { get; set; } = 0.00m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenaltyWaived { get; set; } = 0.00m;

        [StringLength(30)]
        public string? PaymentMode { get; set; }

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Paid, Overdue, Partial
    }
}
