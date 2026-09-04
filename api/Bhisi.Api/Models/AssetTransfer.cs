using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class AssetTransfer
    {
        [Key]
        public int TransferID { get; set; }

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
        public int FromBranchID { get; set; }

        [ForeignKey("FromBranchID")]
        public virtual Branch? FromBranch { get; set; }

        [Required]
        public int ToBranchID { get; set; }

        [ForeignKey("ToBranchID")]
        public virtual Branch? ToBranch { get; set; }

        [Required]
        public DateTime TransferDate { get; set; } = DateTime.Today;

        [Required]
        [StringLength(150)]
        public string FromCustodian { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        public string ToCustodian { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Remarks { get; set; }

        // Audit fields
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public int? UpdatedBy { get; set; }
        public DateTime? UpdatedOn { get; set; }
    }
}
