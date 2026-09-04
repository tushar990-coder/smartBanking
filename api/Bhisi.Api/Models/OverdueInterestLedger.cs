using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class OverdueInterestLedger
    {
        [Key]
        public int OverdueInterestLedgerID { get; set; }

        [Required]
        public int LoanAccountID { get; set; }

        [ForeignKey("LoanAccountID")]
        public virtual LoanAccount? LoanAccount { get; set; }

        [Required]
        public DateTime TransactionDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal DebitAmount { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal CreditAmount { get; set; } = 0;

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        [StringLength(250)]
        public string Particulars { get; set; } = string.Empty;
    }
}
