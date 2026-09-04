using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class VoucherMapping
    {
        [Key]
        public int MappingID { get; set; }

        [Required]
        [StringLength(100)]
        public required string TransactionType { get; set; } // e.g., Share Capital, Loan Disbursement, Penalty

        public int? DebitLedgerID { get; set; }
        [ForeignKey("DebitLedgerID")]
        public virtual Ledger? DebitLedger { get; set; }

        public int? CreditLedgerID { get; set; }
        [ForeignKey("CreditLedgerID")]
        public virtual Ledger? CreditLedger { get; set; }
    }
}
