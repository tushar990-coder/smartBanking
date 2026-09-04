using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class FdTransaction
    {
        [Key]
        public int FdTransactionID { get; set; }

        [Required]
        public int InstitutionID { get; set; } = 1;

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int FinancialYearID { get; set; } = 1;

        [ForeignKey("FinancialYearID")]
        public virtual FinancialYear? FinancialYear { get; set; }

        [Required]
        public int FdAccountID { get; set; }

        [ForeignKey("FdAccountID")]
        public virtual FdAccount? FdAccount { get; set; }

        [Required]
        public int VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        [Required]
        public DateTime TransactionDate { get; set; } = DateTime.Now;

        [Required]
        [StringLength(20)]
        public string TransactionType { get; set; } = string.Empty; // Opening, Accrual, Payout, Premature_Close, Renewal

        [Required]
        [StringLength(2)]
        public string DebitCredit { get; set; } = string.Empty; // Dr, Cr

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
