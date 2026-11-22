using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class DemandNotice
    {
        [Key]
        public int DemandNoticeId { get; set; }

        [Required]
        [MaxLength(50)]
        public string NoticeNumber { get; set; } = string.Empty;

        [Required]
        public int Month { get; set; }

        [Required]
        public int Year { get; set; }

        [Required]
        public int EmployerId { get; set; }

        [ForeignKey("EmployerId")]
        public virtual EmployerMaster? Employer { get; set; }

        [Required]
        public int BranchId { get; set; } = 1;

        [ForeignKey("BranchId")]
        public virtual Branch? Branch { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalDemandAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalRecoveredAmount { get; set; } = 0;

        public DateTime DemandDate { get; set; } = DateTime.Today;

        public bool OnlyBorrowers { get; set; } = false;

        [Column(TypeName = "decimal(18,2)")]
        public decimal ContributionInputAmount { get; set; } = 0;

        [MaxLength(500)]
        public string? Remarks { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, PartiallyReceived, Received, Cancelled

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public int CreatedBy { get; set; } = 1;

        public virtual ICollection<DemandMemberDetail> MemberDetails { get; set; } = new List<DemandMemberDetail>();
        public virtual ICollection<DemandRecovery> Recoveries { get; set; } = new List<DemandRecovery>();
    }
}
