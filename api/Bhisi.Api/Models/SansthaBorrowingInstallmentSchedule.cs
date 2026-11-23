using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SansthaBorrowingInstallmentSchedule
    {
        [Key]
        public int ScheduleID { get; set; }

        [Required]
        public int BorrowingID { get; set; }

        [ForeignKey("BorrowingID")]
        public virtual SansthaBorrowing? Borrowing { get; set; }

        public int InstallmentNo { get; set; }

        public DateTime DueDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal OpeningPrincipal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalDue { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestDue { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalInstallmentAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ClosingPrincipal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalPaid { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestPaid { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenaltyPaid { get; set; } = 0m;

        public DateTime? PaidDate { get; set; }

        /// <summary>
        /// Pending | Partial | Paid | Overdue
        /// </summary>
        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Pending";

        [StringLength(200)]
        public string? Remarks { get; set; }
    }
}
