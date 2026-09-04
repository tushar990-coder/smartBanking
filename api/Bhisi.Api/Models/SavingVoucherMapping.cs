using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SavingVoucherMapping
    {
        [Key]
        public int MappingID { get; set; }

        [Required]
        [MaxLength(50)]
        public string OperationType { get; set; } = string.Empty; // e.g. SavingControl, InterestExpense, ClosingCharges

        [Required]
        public int LedgerID { get; set; }
        
        [ForeignKey("LedgerID")]
        public virtual Ledger? Ledger { get; set; }

        [MaxLength(255)]
        public string? Description { get; set; }
    }
}
