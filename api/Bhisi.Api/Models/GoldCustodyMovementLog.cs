using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class GoldCustodyMovementLog
    {
        [Key]
        public int MovementLogID { get; set; }

        [Required]
        public int GoldCustodyID { get; set; }

        [ForeignKey("GoldCustodyID")]
        public virtual GoldLoanCustody? GoldCustody { get; set; }

        [Required]
        public int LoanAccountID { get; set; }

        [StringLength(40)]
        public string? FromStatus { get; set; }

        [Required]
        [StringLength(40)]
        public string ToStatus { get; set; } = string.Empty;

        [StringLength(250)]
        public string? FromLocationSummary { get; set; }

        [Required]
        [StringLength(250)]
        public string ToLocationSummary { get; set; } = string.Empty;

        public int? ReferenceBorrowingID { get; set; }

        [StringLength(300)]
        public string? Remarks { get; set; }

        public DateTime MovementDate { get; set; } = DateTime.Today;
        public int MovedByUserID { get; set; } = 1;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
