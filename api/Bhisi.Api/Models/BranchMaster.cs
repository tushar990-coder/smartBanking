using System;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class BranchMaster
    {
        [Key]
        public int BranchID { get; set; }

        [Required]
        [MaxLength(20)]
        public string BranchCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string BranchName { get; set; } = string.Empty;

        [MaxLength(20)]
        public string BranchType { get; set; } = "Branch";

        [MaxLength(255)]
        public string? Address { get; set; }

        [MaxLength(50)]
        public string? City { get; set; }

        [MaxLength(50)]
        public string? District { get; set; }

        [MaxLength(50)]
        public string? State { get; set; }

        [MaxLength(10)]
        public string? Pincode { get; set; }

        [MaxLength(15)]
        public string? MobileNo { get; set; }

        [MaxLength(100)]
        public string? Email { get; set; }

        public bool Status { get; set; } = true;

        public int? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
