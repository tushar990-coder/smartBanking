using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Sec101NoticeHistory
    {
        [Key]
        public int NoticeId { get; set; }

        [Required]
        public int BranchId { get; set; } = 1;

        [ForeignKey("BranchId")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int LoanAccountId { get; set; }

        [ForeignKey("LoanAccountId")]
        public virtual LoanAccount? LoanAccount { get; set; }

        [Required]
        public int MemberId { get; set; }

        [ForeignKey("MemberId")]
        public virtual Member? Member { get; set; }

        [Required]
        [StringLength(50)]
        public string NoticeType { get; set; } = "NOTICE_1"; // NOTICE_1, NOTICE_2, FINAL_NOTICE, SRO_DEMAND

        [Required]
        [StringLength(50)]
        public string NoticeNumber { get; set; } = string.Empty;

        public DateTime NoticeDate { get; set; } = DateTime.Today;

        public DateTime DueDate { get; set; } = DateTime.Today.AddDays(15);

        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalDue { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestDue { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenalInterestDue { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal NoticeFee { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalDemandAmount { get; set; } = 0;

        [StringLength(100)]
        public string? PostalTrackingNo { get; set; } // Speed post / RPAD tracking barcode

        [StringLength(50)]
        public string PostalStatus { get; set; } = "DISPATCHED"; // DISPATCHED, DELIVERED, RETURNED_UNCLAIMED, REFUSED

        public DateTime? DeliveredDate { get; set; }

        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int CreatedBy { get; set; } = 1;
    }
}
