using System;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class Role
    {
        [Key]
        public int RoleID { get; set; }

        [Required]
        [MaxLength(30)]
        public string RoleCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string RoleName { get; set; } = string.Empty;

        [MaxLength(250)]
        public string? Description { get; set; }

        public bool IsSystemRole { get; set; } = true;

        public bool Status { get; set; } = true;
    }
}
