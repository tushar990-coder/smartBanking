using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SavingAccountClosing
    {
        [Key]
        public int ClosingID { get; set; }

        [Required]
        public int SavingAccountID { get; set; }
        
        [ForeignKey("SavingAccountID")]
        public virtual SavingAccountMaster? SavingAccount { get; set; }

        [Required]
        public int CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        public DateTime ClosureDate { get; set; } = DateTime.Now;

        [Column(TypeName = "decimal(18,2)")]
        public decimal GrossBalance { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ClosingCharges { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal NetPayable { get; set; }

        [Required]
        [MaxLength(20)]
        public string PaymentMode { get; set; } = string.Empty; // Cash, Transfer, Bank

        [MaxLength(50)]
        public string? VoucherNo { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}
