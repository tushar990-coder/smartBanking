using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    /// <summary>
    /// Sanstha-wide default Employee Salary Demand column & recovery priority configuration.
    /// SequenceOrder controls both left-to-right grid/print order (and multi-RD sub-row order)
    /// and partial/short-salary recovery priority order.
    /// </summary>
    public class DemandColumnSetting
    {
        [Key]
        public int DemandColumnSettingId { get; set; }

        [Required]
        public int SequenceOrder { get; set; } = 1;

        [Required]
        [MaxLength(100)]
        public string ColumnHeaderMr { get; set; } = string.Empty;

        /// <summary>
        /// LOAN | THRIFT_SAVING | DEPOSIT_LEDGER | RD | PIGMY | SHARE | LEDGER_OTHER
        /// </summary>
        [Required]
        [MaxLength(30)]
        public string ItemType { get; set; } = "LOAN";

        public int? LoanRateID { get; set; }
        [ForeignKey("LoanRateID")]
        public virtual LoanRate? LoanRate { get; set; }

        public int? SavingSchemeID { get; set; }
        [ForeignKey("SavingSchemeID")]
        public virtual SavingInterestSetting? SavingScheme { get; set; }

        public int? RdSchemeID { get; set; }
        [ForeignKey("RdSchemeID")]
        public virtual RdScheme? RdScheme { get; set; }

        public int? PigmySchemeID { get; set; }
        [ForeignKey("PigmySchemeID")]
        public virtual PigmyScheme? PigmyScheme { get; set; }

        public int? ShareSchemeId { get; set; }
        [ForeignKey("ShareSchemeId")]
        public virtual ShareScheme? ShareScheme { get; set; }

        /// <summary>
        /// Credit GL Ledger for Loan Principal / Saving / RD / Share / Other Deduction.
        /// </summary>
        public int? PrincipalOrDepositLedgerID { get; set; }
        [ForeignKey("PrincipalOrDepositLedgerID")]
        public virtual Ledger? PrincipalOrDepositLedger { get; set; }

        /// <summary>
        /// Credit GL Income Ledger for Loan Regular Interest.
        /// </summary>
        public int? InterestLedgerID { get; set; }
        [ForeignKey("InterestLedgerID")]
        public virtual Ledger? InterestLedger { get; set; }

        /// <summary>
        /// Optional Credit GL Ledger for Loan Posted Receivable Interest (InterestBalance).
        /// Falls back to InterestLedgerID when unset.
        /// </summary>
        public int? ReceivableInterestLedgerID { get; set; }
        [ForeignKey("ReceivableInterestLedgerID")]
        public virtual Ledger? ReceivableInterestLedger { get; set; }

        /// <summary>
        /// Optional Credit GL Ledger for Loan Penal/Overdue Interest.
        /// Falls back to InterestLedgerID when unset.
        /// </summary>
        public int? OverdueInterestLedgerID { get; set; }
        [ForeignKey("OverdueInterestLedgerID")]
        public virtual Ledger? OverdueInterestLedger { get; set; }

        public bool ShowBalanceColumn { get; set; } = true;

        public bool IncludeOverduePenalInterest { get; set; } = false;

        /// <summary>
        /// INTEREST_FIRST (default CBS rule) | PRINCIPAL_FIRST
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string LoanIntraAllocationOrder { get; set; } = "INTEREST_FIRST";

        /// <summary>
        /// Marks which THRIFT_SAVING / DEPOSIT_LEDGER / PIGMY / LEDGER_OTHER column receives the top-bar "वर्गणी ठेव" auto-fill amount.
        /// </summary>
        public bool IsContributionTarget { get; set; } = false;

        [Column(TypeName = "decimal(18,2)")]
        public decimal DefaultAmount { get; set; } = 0m;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
