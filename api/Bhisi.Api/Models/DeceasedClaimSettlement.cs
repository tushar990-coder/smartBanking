using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class DeceasedClaimSettlement
    {
        [Key]
        public int ClaimID { get; set; }

        [Required]
        public int MemberID { get; set; }

        [ForeignKey("MemberID")]
        public virtual Member? Member { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        public DateTime DeathDate { get; set; } = DateTime.Today;

        [MaxLength(100)]
        public string? DeathCertificateNo { get; set; }

        [Required]
        [MaxLength(150)]
        public string NomineeName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? NomineeRelation { get; set; }

        [MaxLength(12)]
        public string? NomineeAadhaarNo { get; set; }

        [MaxLength(15)]
        public string? NomineeMobileNo { get; set; }

        [MaxLength(100)]
        public string? NomineeBankAccount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalSavingsBalance { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalFdBalance { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalRdBalance { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalPigmyBalance { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalShareAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalLoanLiability { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal NetPayableAmount { get; set; } = 0;

        [MaxLength(100)]
        public string? ResolutionNo { get; set; } // संचालक मंडळ ठराव क्र.

        public DateTime? ResolutionDate { get; set; }

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "Settled"; // Settled, Approved, Pending

        public DateTime SettlementDate { get; set; } = DateTime.Today;

        [MaxLength(500)]
        public string? Remarks { get; set; }

        public int CreatedBy { get; set; } = 1;

        public DateTime CreatedOn { get; set; } = DateTime.Now;
    }
}
