using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SavingTransaction
    {
        [Key]
        public int TransactionID { get; set; }

        [Required]
        public int SavingAccountID { get; set; }
        
        [ForeignKey("SavingAccountID")]
        public virtual SavingAccountMaster? SavingAccount { get; set; }

        [Required]
        public int CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        public int? TargetSavingAccountID { get; set; }

        [ForeignKey("TargetSavingAccountID")]
        public virtual SavingAccountMaster? TargetSavingAccount { get; set; }

        [NotMapped]
        public int? BankLedgerID { get; set; }

        public DateTime TransactionDate { get; set; } = DateTime.Now;

        [Required]
        [MaxLength(20)]
        public string TransactionType { get; set; } = string.Empty; // Deposit, Withdrawal, Interest, Charges

        [Required]
        [MaxLength(20)]
        public string PaymentMode { get; set; } = string.Empty; // Cash, Transfer, Bank

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal BalanceAfterTxn { get; set; }

        [MaxLength(255)]
        public string? Narration { get; set; }

        [MaxLength(50)]
        public string? VoucherNo { get; set; }

        public bool IsPrintedOnPassbook { get; set; } = false;

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}
