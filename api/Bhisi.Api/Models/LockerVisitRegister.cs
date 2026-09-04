using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LockerVisitRegister
    {
        [Key]
        public int VisitID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int AllotmentID { get; set; }

        [ForeignKey("AllotmentID")]
        public virtual LockerAllotment? Allotment { get; set; }

        [Required]
        public DateTime VisitDate { get; set; } = DateTime.Today;

        [Required]
        [StringLength(20)]
        public string TimeIn { get; set; } = string.Empty; // e.g. "11:30 AM"

        [StringLength(20)]
        public string? TimeOut { get; set; } // e.g. "11:45 AM"

        [Required]
        [StringLength(50)]
        public string OperatedBy { get; set; } = "PrimaryMember"; // PrimaryMember, JointMember1, JointMember2, Nominee, CourtOrder

        [Required]
        [StringLength(150)]
        public string OperatorName { get; set; } = string.Empty;

        public bool IsSignatureVerified { get; set; } = true;

        [StringLength(100)]
        public string? BankOfficerName { get; set; } // Custodian / Officer who operated master key

        [StringLength(250)]
        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
