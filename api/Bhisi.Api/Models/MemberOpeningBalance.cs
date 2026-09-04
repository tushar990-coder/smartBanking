using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class MemberOpeningBalance
    {
        [Key]
        public int MemberOpeningBalanceID { get; set; }

        [Required]
        public int MemberID { get; set; }
        
        [ForeignKey("MemberID")]
        public virtual Member? Member { get; set; }

        [Required]
        public int LedgerID { get; set; }

        [ForeignKey("LedgerID")]
        public virtual Ledger? Ledger { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; } = 0;

        [Required]
        [StringLength(2)]
        public string BalanceType { get; set; } = "Dr"; // Dr (येणे) or Cr (देणे)

        // Audit Fields
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public int? UpdatedBy { get; set; }
        public DateTime? UpdatedOn { get; set; }
    }
}
