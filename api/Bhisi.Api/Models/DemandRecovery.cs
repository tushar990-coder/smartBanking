using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class DemandRecovery
    {
        [Key]
        public int DemandRecoveryId { get; set; }

        [Required]
        public int DemandNoticeId { get; set; }

        [ForeignKey("DemandNoticeId")]
        public virtual DemandNotice? DemandNotice { get; set; }

        public int BranchId { get; set; } = 1;

        [Required]
        public DateTime RecoveryDate { get; set; } = DateTime.Today;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalReceivedAmount { get; set; }

        [MaxLength(30)]
        public string PaymentMode { get; set; } = "Bank";

        public int? BankLedgerID { get; set; }

        [MaxLength(100)]
        public string? ReferenceNo { get; set; }

        [MaxLength(100)]
        public string? BatchReference { get; set; }

        [MaxLength(100)]
        public string? IdempotencyKey { get; set; }

        public int RecoveredMemberCount { get; set; } = 0;

        public int? VoucherId { get; set; }

        [ForeignKey("VoucherId")]
        public virtual Voucher? Voucher { get; set; }

        [MaxLength(250)]
        public string? Remarks { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public int CreatedBy { get; set; } = 1;

        public virtual ICollection<DemandRecoveryAllocation> Allocations { get; set; } = new List<DemandRecoveryAllocation>();
    }
}
