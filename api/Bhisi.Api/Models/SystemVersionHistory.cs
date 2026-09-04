using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    [Table("__SystemVersionHistory")]
    public class SystemVersionHistory
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string VersionNumber { get; set; } = string.Empty;

        public DateTime AppliedOn { get; set; } = DateTime.Now;

        [MaxLength(200)]
        public string PatchName { get; set; } = string.Empty;

        [MaxLength(20)]
        public string Status { get; set; } = "SUCCESS";

        public string? Remarks { get; set; }

        [MaxLength(100)]
        public string? AppliedBy { get; set; }
    }
}
