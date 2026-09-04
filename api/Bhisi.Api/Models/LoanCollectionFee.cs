using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanCollectionFee
    {
        [Key]
        public int LoanCollectionFeeID { get; set; }

        [Required]
        public int LoanCollectionID { get; set; }

        [ForeignKey("LoanCollectionID")]
        public LoanCollection? LoanCollection { get; set; }

        [Required]
        public int LedgerID { get; set; }

        [ForeignKey("LedgerID")]
        public Ledger? Ledger { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }
    }
}
