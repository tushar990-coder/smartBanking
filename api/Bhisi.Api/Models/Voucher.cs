using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Voucher
    {
        [Key]
        public int VoucherID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(50)]
        public required string VoucherNo { get; set; }

        [Required]
        public DateTime VoucherDate { get; set; } = DateTime.Today;

        [Required]
        [StringLength(20)]
        public required string VoucherType { get; set; } // Receipt, Payment, Journal, Contra

        [StringLength(500)]
        public string? Narration { get; set; }

        [Required]
        public decimal TotalAmount { get; set; }

        // Maker-Checker & Scroll Fields
        public int? ScrollNo { get; set; } // दिवसानिहाय व शाखानिहाय स्क्रॉल क्रमांक (Day-wise & Branch-wise Scroll No)

        // Audit Fields
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

        // Maker-Checker Fields
        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected.

        public int? ApprovedBy { get; set; }
        public DateTime? ApprovedOn { get; set; }

        [StringLength(500)]
        public string? RejectionReason { get; set; }

        // Navigation Property
        public virtual ICollection<VoucherDetail> VoucherDetails { get; set; } = new List<VoucherDetail>();
    }
}
