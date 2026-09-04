using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class CashDenomination
    {
        [Key]
        public int Id { get; set; }

        public int? BranchId { get; set; }

        [ForeignKey("BranchId")]
        public virtual Branch Branch { get; set; }

        public int CashierId { get; set; }

        [ForeignKey("CashierId")]
        public virtual Cashier Cashier { get; set; }

        public DateTime DenominationDate { get; set; } = DateTime.Today;

        [StringLength(50)]
        public string EntryType { get; set; } = "CLOSING"; // OPENING, MID_DAY, CLOSING, VAULT

        public int Count2000 { get; set; } = 0;
        public int Count500 { get; set; } = 0;
        public int Count200 { get; set; } = 0;
        public int Count100 { get; set; } = 0;
        public int Count50 { get; set; } = 0;
        public int Count20 { get; set; } = 0;
        public int Count10 { get; set; } = 0;
        public int Count5 { get; set; } = 0;
        public int CountCoins { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ExpectedAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal DifferenceAmount { get; set; } = 0; // Short or Excess

        [StringLength(20)]
        public string DifferenceType { get; set; } = "MATCHED"; // MATCHED, SHORT, EXCESS

        [StringLength(250)]
        public string Remarks { get; set; }

        public string VerifiedBy { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
