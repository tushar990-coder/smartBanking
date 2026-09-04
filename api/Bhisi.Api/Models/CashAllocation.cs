using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class CashAllocation
    {
        [Key]
        public int Id { get; set; }

        public int? BranchId { get; set; }

        [ForeignKey("BranchId")]
        public virtual Branch Branch { get; set; }

        public int? FromCashierId { get; set; }
        
        [ForeignKey("FromCashierId")]
        public virtual Cashier FromCashier { get; set; }

        public int ToCashierId { get; set; }

        [ForeignKey("ToCashierId")]
        public virtual Cashier ToCashier { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public DateTime AllocationDate { get; set; } = DateTime.Today;

        [StringLength(50)]
        public string AllocationType { get; set; } = "HEAD_TO_TELLER"; // HEAD_TO_TELLER, TELLER_TO_HEAD, TELLER_TO_TELLER, VAULT_IN, VAULT_OUT

        [StringLength(20)]
        public string Status { get; set; } = "ACCEPTED"; // PENDING, ACCEPTED, REJECTED

        [StringLength(250)]
        public string Remarks { get; set; }

        public bool IsReturn { get; set; } = false;

        public string CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
