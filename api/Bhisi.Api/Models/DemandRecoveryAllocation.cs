using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    /// <summary>
    /// Exact per-recovery-batch allocation log per DemandMemberColumnItem so partial/bulk recoveries
    /// and Voucher Reject/Cancel rollbacks remain 100% lossless across multiple recovery receipts.
    /// </summary>
    public class DemandRecoveryAllocation
    {
        [Key]
        public int DemandRecoveryAllocationId { get; set; }

        [Required]
        public int DemandRecoveryId { get; set; }
        [ForeignKey("DemandRecoveryId")]
        public virtual DemandRecovery? DemandRecovery { get; set; }

        [Required]
        public int DemandMemberDetailId { get; set; }
        [ForeignKey("DemandMemberDetailId")]
        public virtual DemandMemberDetail? DemandMemberDetail { get; set; }

        [Required]
        public int DemandMemberColumnItemId { get; set; }
        [ForeignKey("DemandMemberColumnItemId")]
        public virtual DemandMemberColumnItem? DemandMemberColumnItem { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AllocatedPrincipalOrDeposit { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal AllocatedInterest { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal AllocatedPenalInterest { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAllocated { get; set; } = 0m;

        [MaxLength(30)]
        public string? GeneratedSubLedgerType { get; set; }

        [MaxLength(500)]
        public string? GeneratedSubLedgerIdsCsv { get; set; }
    }
}
