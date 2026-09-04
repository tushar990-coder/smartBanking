using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanDisbursementDeduction
    {
        [Key]
        public int LoanDisbursementDeductionID { get; set; }

        [Required]
        public int LoanDisbursementID { get; set; }

        [ForeignKey("LoanDisbursementID")]
        public LoanDisbursement? LoanDisbursement { get; set; }

        [Required]
        public int LedgerID { get; set; }

        [ForeignKey("LedgerID")]
        public Ledger? Ledger { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }
    }
}
