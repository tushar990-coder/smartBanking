using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Member
    {
        [Key]
        public int MemberID { get; set; }

        public int? CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [MaxLength(20)]
        public string? MemberCode { get; set; }

        [MaxLength(20)]
        public string? OldMemberCode { get; set; }

        [MaxLength(20)]
        public string? CIFNo { get; set; }

        [Required]
        [MaxLength(50)]
        public string FirstName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? MiddleName { get; set; }

        [Required]
        [MaxLength(50)]
        public string LastName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? NickName { get; set; }

        // English Name Details
        [MaxLength(50)]
        public string? FirstNameEng { get; set; }

        [MaxLength(50)]
        public string? MiddleNameEng { get; set; }

        [MaxLength(50)]
        public string? LastNameEng { get; set; }

        // Address Details
        [MaxLength(500)]
        public string? Address { get; set; }

        [MaxLength(500)]
        public string? AddressEng { get; set; }

        [MaxLength(100)]
        public string? Village { get; set; }

        [MaxLength(100)]
        public string? Taluka { get; set; }

        [MaxLength(100)]
        public string? District { get; set; }

        // Contact & KYC
        [MaxLength(15)]
        public string? MobileNo { get; set; } = string.Empty;

        [MaxLength(12)]
        public string? AadhaarNo { get; set; }

        [MaxLength(10)]
        public string? PANNo { get; set; }

        // Membership Info
        public DateTime JoiningDate { get; set; } = DateTime.Today;

        [MaxLength(150)]
        public string? NomineeName { get; set; }

        [MaxLength(150)]
        public string? NomineeNameEng { get; set; }

        [MaxLength(50)]
        public string? NomineeRelation { get; set; }

        [MaxLength(500)]
        public string? NomineeAddress { get; set; }

        public DateTime? NomineeBirthDate { get; set; }

        public bool NomineeIsMinor { get; set; } = false;

        [MaxLength(150)]
        public string? NomineeGuardianName { get; set; }

        public string? PhotoPath { get; set; }
        public string? SignaturePath { get; set; }
        public string? AadhaarDocPath { get; set; }
        public string? PanDocPath { get; set; }

        [MaxLength(10)]
        public string? Gender { get; set; }

        public DateTime? BirthDate { get; set; }

        [MaxLength(100)]
        public string? Occupation { get; set; }

        [MaxLength(50)]
        public string? CasteCategory { get; set; }

        [MaxLength(100)]
        public string? Caste { get; set; }

        [MaxLength(150)]
        public string? Email { get; set; }

        // Minor & Guardian Details
        public bool IsMinor { get; set; } = false;

        [MaxLength(150)]
        public string? GuardianName { get; set; }

        [MaxLength(150)]
        public string? GuardianNameEng { get; set; }

        [MaxLength(50)]
        public string? GuardianRelation { get; set; }

        [MaxLength(12)]
        public string? GuardianAadhaarNo { get; set; }

        [MaxLength(15)]
        public string? GuardianMobileNo { get; set; }

        [MaxLength(500)]
        public string? GuardianAddress { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        [MaxLength(30)]
        public string MembershipType { get; set; } = "Regular"; // Regular, Associate, Nominal, Sympathizer (MCS Act Sec 24)

        // Legacy Mapping Fields for Migration
        public int? LegacyMemberId { get; set; }

        [MaxLength(50)]
        public string? LegacyMemberNo { get; set; }

        public int? EmployerId { get; set; }

        [ForeignKey("EmployerId")]
        public virtual EmployerMaster? Employer { get; set; }

        // Soft Delete
        public bool IsDeleted { get; set; } = false;

        // Audit Fields
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public int? UpdatedBy { get; set; }
        public DateTime? UpdatedOn { get; set; }
    }
}
