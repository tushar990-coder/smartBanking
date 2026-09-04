using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class DemandMemberDetail
    {
        [Key]
        public int DemandMemberDetailId { get; set; }

        [Required]
        public int DemandNoticeId { get; set; }

        [ForeignKey("DemandNoticeId")]
        public virtual DemandNotice? DemandNotice { get; set; }

        [Required]
        public int MemberId { get; set; }

        [ForeignKey("MemberId")]
        public virtual Member? Member { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LoanInstallment { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal SavingDeposit { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal ShareDeposit { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PigmyDeposit { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal RdDeposit { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalDeduction { get; set; } = 0;

        public bool IsProcessed { get; set; } = false;
    }
}
