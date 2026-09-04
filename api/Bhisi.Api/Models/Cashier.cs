using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Cashier
    {
        [Key]
        public int Id { get; set; }

        public int? BranchId { get; set; }

        [ForeignKey("BranchId")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(100)]
        public string CashierName { get; set; }

        [StringLength(50)]
        public string CounterNumber { get; set; } = "कॅश काउंटर १";

        // या काउंटरचे विशिष्ट रोख खाते (Counter Specific GL Ledger)
        public int? CashLedgerId { get; set; }

        [ForeignKey("CashLedgerId")]
        public virtual Ledger? CashLedger { get; set; }

        public int? UserId { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        [Required]
        public bool IsActive { get; set; } = true;
        
        [Required]
        public bool IsHeadCashier { get; set; } = false;

        [Column(TypeName = "decimal(18,2)")]
        public decimal MaxCashLimit { get; set; } = 500000;

        [StringLength(250)]
        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
