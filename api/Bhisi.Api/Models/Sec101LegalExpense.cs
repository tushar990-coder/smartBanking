using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Sec101LegalExpense
    {
        [Key]
        public int ExpenseId { get; set; }

        [Required]
        public int BranchId { get; set; } = 1;

        [ForeignKey("BranchId")]
        public virtual Branch? Branch { get; set; }

        public int? CaseId { get; set; }

        [ForeignKey("CaseId")]
        public virtual Sec101CaseMaster? Case { get; set; }

        [Required]
        public int LoanAccountId { get; set; }

        [ForeignKey("LoanAccountId")]
        public virtual LoanAccount? LoanAccount { get; set; }

        [Required]
        [StringLength(50)]
        public string ExpenseType { get; set; } = "COURT_FEE"; 
        // NOTICE_FEE, COURT_FEE, ADVOCATE_FEE, NEWSPAPER_AD, SRO_COMMISSION, OTHER

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; } = 0;

        public DateTime ExpenseDate { get; set; } = DateTime.Today;

        [StringLength(150)]
        public string? PaidTo { get; set; } // Advocate Name / SRO Name / Newspaper Agency

        public int? VoucherId { get; set; }

        [ForeignKey("VoucherId")]
        public virtual Voucher? Voucher { get; set; }

        public bool IsDebitedToLoan { get; set; } = true;

        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int CreatedBy { get; set; } = 1;
    }
}
