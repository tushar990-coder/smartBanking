using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class AgentCustomerRequest
    {
        [Key]
        public int RequestID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        public int? PigmyAgentID { get; set; }

        [ForeignKey("PigmyAgentID")]
        public virtual PigmyAgent? PigmyAgent { get; set; }

        [MaxLength(100)]
        public string? AgentName { get; set; }

        public DateTime RequestDate { get; set; } = DateTime.Now;

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected

        public DateTime? ApprovalDate { get; set; }
        public int? ApprovedByUserID { get; set; }

        [MaxLength(500)]
        public string? RejectionReason { get; set; }

        // Linked created entity IDs
        public int? CreatedMemberID { get; set; }
        public int? CreatedPigmyAccountID { get; set; }

        // Personal Details
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

        [MaxLength(10)]
        public string? Gender { get; set; } = "Male";

        public DateTime? BirthDate { get; set; }

        [MaxLength(50)]
        public string? Occupation { get; set; }

        [MaxLength(50)]
        public string? CasteCategory { get; set; }

        // Contact & KYC
        [MaxLength(15)]
        public string? MobileNo { get; set; }

        [MaxLength(100)]
        public string? Email { get; set; }

        [MaxLength(12)]
        public string? AadhaarNo { get; set; }

        [MaxLength(10)]
        public string? PANNo { get; set; }

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

        [MaxLength(10)]
        public string? Pincode { get; set; }

        // Nominee Details
        [MaxLength(150)]
        public string? NomineeName { get; set; }

        [MaxLength(150)]
        public string? NomineeNameEng { get; set; }

        [MaxLength(50)]
        public string? NomineeRelation { get; set; }

        [MaxLength(500)]
        public string? NomineeAddress { get; set; }

        public DateTime? NomineeBirthDate { get; set; }
        public int? NomineeAge { get; set; }

        // Documents & Media URLs
        public string? PhotoPath { get; set; }
        public string? SignaturePath { get; set; }
        public string? AadhaarDocPath { get; set; }
        public string? PanDocPath { get; set; }

        // Pigmy Account Opening Preferences
        public bool OpenPigmyAccount { get; set; } = true;
        public int? PigmySchemeID { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DailyDepositAmount { get; set; } = 100;

        [Column(TypeName = "decimal(18,2)")]
        public decimal InitialDepositAmount { get; set; } = 0;

        [MaxLength(500)]
        public string? Remarks { get; set; }
    }
}
