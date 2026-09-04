using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class CashierBalance
    {
        [Key]
        public int Id { get; set; }

        public int? BranchId { get; set; }

        [ForeignKey("BranchId")]
        public virtual Branch Branch { get; set; }

        public int CashierId { get; set; }

        [ForeignKey("CashierId")]
        public virtual Cashier Cashier { get; set; }

        public DateTime BalanceDate { get; set; } = DateTime.Today;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal OpeningBalance { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ReceivedFromHead { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalReceipts { get; set; } = 0; // Member deposits, loan recovery, etc.

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalPayments { get; set; } = 0; // Loan disbursements, withdrawals, expenses, etc.

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ReturnedToHead { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ClosingBalance { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PhysicalCashTally { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal CashDifference { get; set; } = 0;

        [StringLength(20)]
        public string Status { get; set; } = "OPEN"; // OPEN, CLOSED, AUDITED

        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    }
}
