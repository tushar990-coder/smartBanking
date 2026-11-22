using System;
using System.Collections.Generic;
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

        public int? CustomerId { get; set; }

        [MaxLength(50)]
        public string? EmpCode { get; set; }

        [MaxLength(20)]
        public string? CIFNo { get; set; }

        [MaxLength(200)]
        public string? MemberName { get; set; }

        public bool IsSelected { get; set; } = true;

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

        [Column(TypeName = "decimal(18,2)")]
        public decimal RecoveredAmount { get; set; } = 0;

        [Required]
        [MaxLength(20)]
        public string RecoveryStatus { get; set; } = "Pending"; // Pending, Partial, Recovered

        [MaxLength(250)]
        public string? Remarks { get; set; }

        public bool IsProcessed { get; set; } = false;

        public virtual ICollection<DemandMemberColumnItem> ColumnItems { get; set; } = new List<DemandMemberColumnItem>();
    }
}
