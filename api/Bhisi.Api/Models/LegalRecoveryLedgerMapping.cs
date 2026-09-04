using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LegalRecoveryLedgerMapping
    {
        [Key]
        public int MappingId { get; set; }

        [Required]
        public int BranchId { get; set; } = 1; // 0 for Global Default
        
        [ForeignKey("BranchId")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(50)]
        public string TransactionType { get; set; } = string.Empty; 
        // NOTICE_FEE, COURT_FEE, ADVOCATE_FEE, NEWSPAPER_AD, SRO_COMMISSION, AUCTION_SUSPENSE, PENAL_INTEREST

        [Required]
        public int DebitLedgerId { get; set; }

        [ForeignKey("DebitLedgerId")]
        public virtual Ledger? DebitLedger { get; set; }

        [Required]
        public int CreditLedgerId { get; set; }

        [ForeignKey("CreditLedgerId")]
        public virtual Ledger? CreditLedger { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
