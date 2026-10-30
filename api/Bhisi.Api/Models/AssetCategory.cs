using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class AssetCategory
    {
        [Key]
        public int CategoryID { get; set; }

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
        [StringLength(20)]
        public string CategoryCode { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string CategoryName { get; set; } = string.Empty;

        [Required]
        public int UsefulLifeMonths { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal DepreciationRate { get; set; }

        [Required]
        [StringLength(10)] // WDV or SLM
        public string DepreciationMethod { get; set; } = "WDV";

        // GL Ledger Mapping for Scheme Setting
        public int? AssetLedgerID { get; set; }

        [ForeignKey("AssetLedgerID")]
        public virtual Ledger? AssetLedger { get; set; }

        public int? DepreciationExpenseLedgerID { get; set; }

        [ForeignKey("DepreciationExpenseLedgerID")]
        public virtual Ledger? DepreciationExpenseLedger { get; set; }

        public int? AccumulatedDepreciationLedgerID { get; set; }

        [ForeignKey("AccumulatedDepreciationLedgerID")]
        public virtual Ledger? AccumulatedDepreciationLedger { get; set; }

        public int? DisposalProfitLossLedgerID { get; set; }

        [ForeignKey("DisposalProfitLossLedgerID")]
        public virtual Ledger? DisposalProfitLossLedger { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Active";

        // Audit fields
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public int? UpdatedBy { get; set; }
        public DateTime? UpdatedOn { get; set; }
    }
}
