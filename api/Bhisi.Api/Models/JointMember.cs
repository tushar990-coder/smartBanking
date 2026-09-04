using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class JointMember
    {
        [Key]
        public int JointMemberID { get; set; }

        [Required]
        public int PrimaryMemberID { get; set; }

        [ForeignKey("PrimaryMemberID")]
        public virtual Member? PrimaryMember { get; set; }

        [MaxLength(30)]
        public string? JointMemberCode { get; set; }

        [Required]
        [MaxLength(50)]
        public string FirstName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? MiddleName { get; set; }

        [Required]
        [MaxLength(50)]
        public string LastName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? FirstNameEng { get; set; }

        [MaxLength(50)]
        public string? MiddleNameEng { get; set; }

        [MaxLength(50)]
        public string? LastNameEng { get; set; }

        [Required]
        [MaxLength(50)]
        public string RelationWithPrimary { get; set; } = "Spouse"; // पती/पत्नी, मुलगा, मुलगी, भाऊ, इ.

        [MaxLength(12)]
        public string? AadhaarNo { get; set; }

        [MaxLength(10)]
        public string? PANNo { get; set; }

        [MaxLength(15)]
        public string? MobileNo { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }

        public string? PhotoPath { get; set; }

        public string? SignaturePath { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        public bool IsDeleted { get; set; } = false;

        public int CreatedBy { get; set; } = 1;

        public DateTime CreatedOn { get; set; } = DateTime.Now;

        public int? UpdatedBy { get; set; }

        public DateTime? UpdatedOn { get; set; }
    }
}
