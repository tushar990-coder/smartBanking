using System;
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

        [Required]
        public DateTime RecoveryDate { get; set; } = DateTime.Today;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalReceivedAmount { get; set; }

        public int? VoucherId { get; set; }

        [ForeignKey("VoucherId")]
        public virtual Voucher? Voucher { get; set; }

        [MaxLength(250)]
        public string? Remarks { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public int CreatedBy { get; set; } = 1;
    }
}
