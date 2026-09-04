using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyVoucherMapping
    {
        [Key]
        public int MappingId { get; set; }

        [Required]
        public int BranchId { get; set; }

        [ForeignKey("BranchId")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(20)]
        public string CollectionSource { get; set; } = string.Empty; // MANUAL, APP, IMPORT

        [Required]
        public int DebitLedgerId { get; set; }

        [ForeignKey("DebitLedgerId")]
        public virtual Ledger? DebitLedger { get; set; }

        [Required]
        public int CreditLedgerId { get; set; }

        [ForeignKey("CreditLedgerId")]
        public virtual Ledger? CreditLedger { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
