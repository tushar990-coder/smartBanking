using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class AssetDepreciation
    {
        [Key]
        public int DepreciationID { get; set; }

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
        public DateTime CalculationDate { get; set; } = DateTime.Today;

        [Required]
        [StringLength(10)]
        public string Method { get; set; } = "WDV";

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal Rate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal DepreciationAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal BookValueBefore { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal BookValueAfter { get; set; }

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        // Audit fields
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public int? UpdatedBy { get; set; }
        public DateTime? UpdatedOn { get; set; }
    }
}
