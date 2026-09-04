using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class AssetMaintenance
    {
        [Key]
        public int MaintenanceID { get; set; }

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
        public DateTime MaintenanceDate { get; set; } = DateTime.Today;

        [Required]
        [StringLength(30)]
        public string MaintenanceType { get; set; } = "Repair"; // Repair, AMC, Routine

        [Required]
        [StringLength(150)]
        public string ServiceProvider { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Cost { get; set; }

        [StringLength(500)]
        public string? Remarks { get; set; }

        public DateTime? NextServiceDate { get; set; }

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
