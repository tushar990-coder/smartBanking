using System;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class DepartmentMaster
    {
        [Key]
        public int DepartmentID { get; set; }

        [Required]
        [MaxLength(20)]
        public string DepartmentCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string DepartmentName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? Description { get; set; }

        public bool Status { get; set; } = true;

        public int? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
