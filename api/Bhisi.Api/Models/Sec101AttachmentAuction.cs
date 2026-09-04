using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Sec101AttachmentAuction
    {
        [Key]
        public int ExecutionId { get; set; }

        [Required]
        public int CaseId { get; set; }

        [ForeignKey("CaseId")]
        public virtual Sec101CaseMaster? Case { get; set; }

        [StringLength(100)]
        public string SroName { get; set; } = "विशेष वसुली अधिकारी"; // Special Recovery Officer

        [Required]
        [StringLength(50)]
        public string ExecutionType { get; set; } = "IMMOVABLE_PROPERTY"; 
        // SALARY_ATTACHMENT_SEC49, MOVABLE_PROPERTY, IMMOVABLE_PROPERTY, BANK_ACCOUNT_FREEZE

        [StringLength(500)]
        public string? PropertyDetails { get; set; } // गट क्र., घर नं., वाहन क्र., मालकाचे नाव

        [Column(TypeName = "decimal(18,2)")]
        public decimal ValuationAmount { get; set; } = 0;

        public DateTime? WarrantIssueDate { get; set; }

        public DateTime? PanchanamaDate { get; set; }

        public DateTime? AuctionNoticeDate { get; set; }

        public DateTime? AuctionDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ReservePrice { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal HighestBidAmount { get; set; } = 0;

        [StringLength(150)]
        public string? BuyerName { get; set; }

        [StringLength(100)]
        public string? BuyerContact { get; set; }

        public DateTime? SaleCertificateDate { get; set; }

        [StringLength(50)]
        public string? SaleCertificateNo { get; set; }

        [Required]
        [StringLength(50)]
        public string Status { get; set; } = "WARRANT_ISSUED";
        // DEMAND_ISSUED, WARRANT_ISSUED, ATTACHED, AUCTION_SCHEDULED, AUCTION_COMPLETED, SETTLED, CANCELLED

        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int CreatedBy { get; set; } = 1;
    }
}
