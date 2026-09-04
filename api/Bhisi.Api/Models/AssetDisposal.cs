using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class AssetDisposal
    {
        [Key]
        public int DisposalID { get; set; }

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
        public DateTime DisposalDate { get; set; } = DateTime.Today;

        [Required]
        [StringLength(30)]
        public string DisposalType { get; set; } = "Scrap"; // Scrap, Write-Off, Sale

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal BookValueAtDisposal { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal SaleAmount { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ProfitOrLoss { get; set; } = 0;

        [StringLength(150)]
        public string? BuyerName { get; set; }

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
