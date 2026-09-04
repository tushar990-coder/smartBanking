using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SystemNotification
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long NotificationID { get; set; }

        public int BranchID { get; set; } = 1;

        public int? UserID { get; set; }

        [StringLength(50)]
        public string? RoleName { get; set; }

        [Required]
        [StringLength(50)]
        public string ModuleName { get; set; } = string.Empty; // Loans, FD, RD, Shares, Vouchers, Pigmy, NPA, System

        [Required]
        [StringLength(50)]
        public string NotificationType { get; set; } = string.Empty; // LoanOverdue, FdMaturity, VoucherPending, etc.

        [Required]
        [StringLength(250)]
        public string Title { get; set; } = string.Empty; // Marathi / English Title

        [Required]
        [StringLength(500)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string Priority { get; set; } = "MEDIUM"; // HIGH, MEDIUM, LOW

        [Required]
        [StringLength(100)]
        public string TargetTab { get; set; } = string.Empty; // React app route tab name

        [StringLength(50)]
        public string? EntityName { get; set; } // Voucher, LoanAccount, ShareTransaction, etc.

        [StringLength(50)]
        public string? EntityID { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Amount { get; set; }

        public DateTime? DueDate { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Active"; // Active, Completed, Dismissed

        public DateTime CreatedOn { get; set; } = DateTime.Now;

        public DateTime? CompletedOn { get; set; }

        public int? CompletedBy { get; set; }
    }
}
