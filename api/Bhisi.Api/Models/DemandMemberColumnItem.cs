using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    /// <summary>
    /// Normalized per-member, per-setting-column (and per-RD sub-row when employee has >1 RD) snapshot
    /// of demanded & recovered amounts, preserving SequenceOrder and underlying Account IDs for bulk recovery.
    /// </summary>
    public class DemandMemberColumnItem
    {
        [Key]
        public int DemandMemberColumnItemId { get; set; }

        [Required]
        public int DemandMemberDetailId { get; set; }
        [ForeignKey("DemandMemberDetailId")]
        public virtual DemandMemberDetail? DemandMemberDetail { get; set; }

        public int? DemandColumnSettingId { get; set; }
        [ForeignKey("DemandColumnSettingId")]
        public virtual DemandColumnSetting? DemandColumnSetting { get; set; }

        /// <summary>
        /// Snapshot of DemandColumnSetting.SequenceOrder at the time Demand was saved.
        /// Controls both display order / sub-row order and bulk short-salary recovery priority.
        /// </summary>
        [Required]
        public int SequenceOrder { get; set; } = 1;

        [Required]
        [MaxLength(30)]
        public string ItemType { get; set; } = "LOAN";

        [MaxLength(100)]
        public string ColumnHeaderMr { get; set; } = string.Empty;

        public int? SchemeId { get; set; }

        /// <summary>
        /// Specific sub-ledger Account ID (e.g., RdAccountID for multi-RD sub-rows, SavingAccountID, ShareAccountId).
        /// </summary>
        public int? AccountId { get; set; }

        /// <summary>
        /// Comma-separated LoanAccountIDs when an employee holds multiple active loans under the same LoanRateID.
        /// </summary>
        [MaxLength(500)]
        public string? SourceAccountIdsCsv { get; set; }

        /// <summary>
        /// 0 for employee main row; 1, 2, ... for additional RD sub-rows placed right below the employee row.
        /// </summary>
        public int SubRowIndex { get; set; } = 0;

        [MaxLength(150)]
        public string? DisplaySubLabel { get; set; }

        public int? PrincipalOrDepositLedgerID { get; set; }
        public int? InterestLedgerID { get; set; }
        public int? ReceivableInterestLedgerID { get; set; }
        public int? OverdueInterestLedgerID { get; set; }

        [MaxLength(20)]
        public string LoanIntraAllocationOrder { get; set; } = "INTEREST_FIRST";

        [Column(TypeName = "decimal(18,2)")]
        public decimal CurrentBalanceAmount { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal DemandPrincipalOrDeposit { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal DemandInterest { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal DemandPenalInterest { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal RecoveredPrincipalOrDeposit { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal RecoveredInterest { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal RecoveredPenalInterest { get; set; } = 0m;
    }
}
