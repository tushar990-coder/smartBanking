using System;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class RolePermission
    {
        [Key]
        public int RolePermissionID { get; set; }

        public int RoleID { get; set; }

        [Required]
        [MaxLength(50)]
        public string ModuleCode { get; set; } = string.Empty;

        public bool CanView { get; set; } = false;
        public bool CanAdd { get; set; } = false;
        public bool CanEdit { get; set; } = false;
        public bool CanDelete { get; set; } = false;
        public bool CanPrint { get; set; } = false;
        public bool CanApprove { get; set; } = false;

        [MaxLength(20)]
        public string ScopeLevel { get; set; } = "BranchOnly"; // "AllBranches" or "BranchOnly"
    }
}
