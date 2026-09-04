using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Sec101CaseMaster
    {
        [Key]
        public int CaseId { get; set; }

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
        public string CaseNumber { get; set; } = string.Empty; // e.g. 101/2026/PUNE

        [Required]
        [StringLength(200)]
        public string CourtName { get; set; } = "मा. सहाय्यक निबंधक, सहकारी संस्था";

        [StringLength(100)]
        public string? AdvocateName { get; set; }

        public DateTime FilingDate { get; set; } = DateTime.Today;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalClaim { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestClaim { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenalInterestClaim { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal OtherChargesClaim { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalClaimAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal CourtFeeAmount { get; set; } = 0;

        [StringLength(50)]
        public string? CourtFeeChallanNo { get; set; }

        [StringLength(50)]
        public string? CertificateNo { get; set; }

        public DateTime? CertificateDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? SanctionedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? FutureInterestRate { get; set; }

        [Required]
        [StringLength(50)]
        public string Status { get; set; } = "FILED"; 
        // NOTICE_STAGE, FILED, HEARING, CERTIFICATE_ISSUED, EXECUTION_RULE107, CLOSED_RECOVERED, DISMISSED

        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int CreatedBy { get; set; } = 1;

        public virtual ICollection<Sec101HearingLog> HearingLogs { get; set; } = new List<Sec101HearingLog>();
        public virtual ICollection<Sec101AttachmentAuction> Executions { get; set; } = new List<Sec101AttachmentAuction>();
        public virtual ICollection<Sec101LegalExpense> LegalExpenses { get; set; } = new List<Sec101LegalExpense>();
    }
}
