using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class CommitteeMember
    {
        [Key]
        public int CommitteeMemberID { get; set; }

        [Required]
        public int MemberID { get; set; }

        [ForeignKey("MemberID")]
        public virtual Member? Member { get; set; }

        [Required]
        [StringLength(100)]
        public string Designation { get; set; } = string.Empty;

        [Required]
        public DateTime JoiningDate { get; set; }

        public DateTime? EndDate { get; set; }

        [StringLength(100)]
        public string? ResolutionNo { get; set; }

        [StringLength(20)]
        public string Status { get; set; } = "Active";

        [StringLength(50)]
        public string? TermYear { get; set; }

        [StringLength(100)]
        public string? Category { get; set; }

        [StringLength(50)]
        public string? DINNo { get; set; }

        [StringLength(500)]
        public string? Remarks { get; set; }

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

        [StringLength(100)]
        public string CreatedBy { get; set; } = "System";

        public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;

        [StringLength(100)]
        public string UpdatedBy { get; set; } = "System";
    }
}
