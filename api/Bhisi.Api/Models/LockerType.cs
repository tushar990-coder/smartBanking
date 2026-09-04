using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LockerType
    {
        [Key]
        public int LockerTypeID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(50)]
        public string TypeCode { get; set; } = string.Empty; // e.g. SML, MED, LRG, XLRG

        [Required]
        [StringLength(100)]
        public string TypeName { get; set; } = string.Empty; // e.g. Small (लहान), Medium (मध्यम)

        [StringLength(100)]
        public string? Dimensions { get; set; } // e.g. 5" x 7" x 20"

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal AnnualRent { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal SecurityDeposit { get; set; } = 0; // Caution Deposit

        [Column(TypeName = "decimal(18,2)")]
        public decimal LateFeePerMonth { get; set; } = 0;

        [Column(TypeName = "decimal(5,2)")]
        public decimal GstRate { get; set; } = 0; // 0, 18% etc.

        // General Ledger (GL) Mappings
        public int? DepositLiabilityLedgerID { get; set; }
        [ForeignKey("DepositLiabilityLedgerID")]
        public virtual Ledger? DepositLiabilityLedger { get; set; }

        public int? RentIncomeLedgerID { get; set; }
        [ForeignKey("RentIncomeLedgerID")]
        public virtual Ledger? RentIncomeLedger { get; set; }

        public int? LateFeeIncomeLedgerID { get; set; }
        [ForeignKey("LateFeeIncomeLedgerID")]
        public virtual Ledger? LateFeeIncomeLedger { get; set; }

        public int? GstLiabilityLedgerID { get; set; }
        [ForeignKey("GstLiabilityLedgerID")]
        public virtual Ledger? GstLiabilityLedger { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
