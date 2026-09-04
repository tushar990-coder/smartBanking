using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class AssetAllocation
    {
        [Key]
        public int AllocationID { get; set; }

        [Required]
        public int InstitutionID { get; set; } = 1;

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int FinancialYearID { get; set; } = 1;

        [ForeignKey("FinancialYearID")]
        public virtual FinancialYear? FinancialYear { get; set; }

        [Required]
        public int AssetID { get; set; }

        [ForeignKey("AssetID")]
        public virtual Asset? Asset { get; set; }

        [Required]
        public int AllocatedBranchID { get; set; }

        [ForeignKey("AllocatedBranchID")]
        public virtual Branch? AllocatedBranch { get; set; }

        [Required]
        public DateTime AllocationDate { get; set; } = DateTime.Today;

        [Required]
        [StringLength(100)]
        public string Department { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        public string CustodianName { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Remarks { get; set; }

        // Audit fields
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public int? UpdatedBy { get; set; }
        public DateTime? UpdatedOn { get; set; }
    }
}
