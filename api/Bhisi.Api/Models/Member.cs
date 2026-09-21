using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace Bhisi.Api.Models
{
    /// <summary>
    /// Pure Normalized Member entity - stores strictly membership-specific data (13 columns).
    /// All demographic/KYC/nominee/guardian info is stored in the linked Customer record
    /// and accessed via the Customer navigation property.
    /// </summary>
    public class Member
    {
        [Key]
        public int MemberID { get; set; }

        public int? CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        [ValidateNever]
        public virtual Customer? Customer { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        [ValidateNever]
        public virtual Branch? Branch { get; set; }

        [MaxLength(20)]
        public string? MemberCode { get; set; }

        // Membership Info
        public DateTime JoiningDate { get; set; } = DateTime.Today;

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        [MaxLength(30)]
        public string MembershipType { get; set; } = "Regular"; // Regular, Associate, Nominal, Sympathizer (MCS Act Sec 24)

        // Legacy Mapping Field for Migration
        [MaxLength(50)]
        public string? LegacyMemberNo { get; set; }

        // Soft Delete
        public bool IsDeleted { get; set; } = false;

        // Audit Fields
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public int? UpdatedBy { get; set; }
        public DateTime? UpdatedOn { get; set; }
    }
}
