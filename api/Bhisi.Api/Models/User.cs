using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class User
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int UserID { get; set; }

        [Required]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [StringLength(255)]
        public string PasswordHash { get; set; } = string.Empty;

        public int RoleID { get; set; }

        public int? DefaultBranchID { get; set; }

        public bool IsActive { get; set; } = true;

        public bool IsLocked { get; set; } = false;

        public int FailedLoginAttempts { get; set; } = 0;

        public bool RequirePasswordChange { get; set; } = true;

        public DateTime? LastPasswordChangeDate { get; set; }

        public DateTime? LastLoginDate { get; set; }

        [StringLength(2000)]
        public string? ActiveSessionToken { get; set; }

        [StringLength(100)]
        public string? Email { get; set; }

        [StringLength(20)]
        public string? MobileNumber { get; set; }

        [ForeignKey("RoleID")]
        public virtual Role? Role { get; set; }

        [ForeignKey("DefaultBranchID")]
        public virtual Branch? DefaultBranch { get; set; }
    }
}
