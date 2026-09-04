using System;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class UserDto
    {
        public int UserID { get; set; }
        public string Username { get; set; } = string.Empty;
        public int RoleID { get; set; }
        public string RoleName { get; set; } = string.Empty;
        public int? DefaultBranchID { get; set; }
        public string? BranchName { get; set; }
        public bool IsActive { get; set; }
        public bool IsLocked { get; set; }
        public int FailedLoginAttempts { get; set; }
        public bool RequirePasswordChange { get; set; }
        public DateTime? LastLoginDate { get; set; }
    }

    public class CreateUserDto
    {
        [Required]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        public int RoleID { get; set; }

        public int? DefaultBranchID { get; set; }

        public bool IsActive { get; set; } = true;
    }

    public class UpdateUserDto
    {
        [Required]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        public int RoleID { get; set; }

        public int? DefaultBranchID { get; set; }

        public bool IsActive { get; set; }
    }
}
