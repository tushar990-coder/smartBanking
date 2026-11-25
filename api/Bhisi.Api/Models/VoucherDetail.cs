using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class VoucherDetail
    {
        [Key]
        public int VoucherDetailID { get; set; }

        [Required]
        public int VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        [Required]
        public int LedgerID { get; set; }

        [ForeignKey("LedgerID")]
        public virtual Ledger? Ledger { get; set; }

        public int? MemberID { get; set; }

        [ForeignKey("MemberID")]
        public virtual Member? Member { get; set; }

        public int? CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        public int? SavingAccountID { get; set; }

        [ForeignKey("SavingAccountID")]
        public virtual SavingAccountMaster? SavingAccount { get; set; }

        public int? ChargeLoanAccountID { get; set; }

        [ForeignKey("ChargeLoanAccountID")]
        public virtual LoanAccount? ChargeLoanAccount { get; set; }

        [StringLength(50)]
        public string? ChargeExpenseType { get; set; }

        [Required]
        [StringLength(2)]
        public required string DrCr { get; set; } // "Dr" or "Cr"

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }
    }
}
