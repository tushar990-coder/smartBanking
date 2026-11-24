using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class CustomerServiceRequest
    {
        [Key]
        public int RequestID { get; set; }

        [Required]
        public int CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [MaxLength(40)]
        public string ReferenceNo { get; set; } = string.Empty;

        [Required]
        [MaxLength(30)]
        public string RequestType { get; set; } = "SUPPORT_TICKET"; // DOORSTEP_PICKUP | LOAN_APPLY | DEPOSIT_OPEN | CERTIFICATE | SUPPORT_TICKET

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Subtitle { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Amount { get; set; }

        [MaxLength(100)]
        public string? PreferredSlot { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "PENDING"; // PENDING | APPROVED | COMPLETED | REJECTED

        public int? ReviewedByUserID { get; set; }
        public DateTime? ReviewedOn { get; set; }

        [MaxLength(500)]
        public string? Remarks { get; set; }

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}
