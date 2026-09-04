using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Asset
    {
        [Key]
        public int AssetID { get; set; }

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
        public int CategoryID { get; set; }

        [ForeignKey("CategoryID")]
        public virtual AssetCategory? Category { get; set; }

        [Required]
        [StringLength(30)]
        public string AssetCode { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        public string AssetName { get; set; } = string.Empty;

        [Required]
        public DateTime PurchaseDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal OriginalCost { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal AccumulatedDepreciation { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal CurrentBookValue { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Active"; // Active, Suspended, Disposed, Damaged

        [StringLength(100)]
        public string? Location { get; set; }

        [StringLength(100)]
        public string? Custodian { get; set; }

        [Required]
        public bool IsOpeningBalance { get; set; } = false;

        // Audit fields
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public int? UpdatedBy { get; set; }
        public DateTime? UpdatedOn { get; set; }
    }
}
