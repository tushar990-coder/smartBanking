using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SavingInterestSetting
    {
        [Key]
        public int SettingID { get; set; }

        [MaxLength(50)]
        public string? SchemeCode { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [MaxLength(100)]
        public string? SchemeName { get; set; }

        [Required]
        [MaxLength(50)]
        public string CalculationMethod { get; set; } = "DailyProduct"; // DailyProduct, MonthlyMinimum

        [Required]
        [MaxLength(20)]
        public string PostingFrequency { get; set; } = "Quarterly"; // Monthly, Quarterly, HalfYearly, Yearly

        public DateTime EffectiveDate { get; set; }

        // General Ledger (GL) Mapping Properties
        public int? LedgerID { get; set; }
        [ForeignKey("LedgerID")]
        public Ledger? Ledger { get; set; }

        public int? SavingLiabilityLedgerID { get; set; }
        [ForeignKey("SavingLiabilityLedgerID")]
        public Ledger? SavingLiabilityLedger { get; set; }

        public int? InterestExpenseLedgerID { get; set; }
        [ForeignKey("InterestExpenseLedgerID")]
        public Ledger? InterestExpenseLedger { get; set; }

        public int? InterestPayableLedgerID { get; set; }
        [ForeignKey("InterestPayableLedgerID")]
        public Ledger? InterestPayableLedger { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}
