using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyScheme
    {
        [Key]
        public int PigmySchemeID { get; set; }

        [StringLength(50)]
        public string? SchemeCode { get; set; }

        [Required]
        [StringLength(100)]
        public string SchemeName { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [Required]
        public int DurationMonths { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Active";

        // General Ledger (GL) Mapping Properties for Core Banking Integration
        public int? PigmyLiabilityLedgerID { get; set; }
        [ForeignKey("PigmyLiabilityLedgerID")]
        public virtual Ledger? PigmyLiabilityLedger { get; set; }

        public int? InterestExpenseLedgerID { get; set; }
        [ForeignKey("InterestExpenseLedgerID")]
        public virtual Ledger? InterestExpenseLedger { get; set; }

        public int? InterestPayableLedgerID { get; set; }
        [ForeignKey("InterestPayableLedgerID")]
        public virtual Ledger? InterestPayableLedger { get; set; }

        public int? CommissionExpenseLedgerID { get; set; }
        [ForeignKey("CommissionExpenseLedgerID")]
        public virtual Ledger? CommissionExpenseLedger { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
