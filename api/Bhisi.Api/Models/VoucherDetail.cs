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

        [Required]
        [StringLength(2)]
        public required string DrCr { get; set; } // "Dr" or "Cr"

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }
    }
}
