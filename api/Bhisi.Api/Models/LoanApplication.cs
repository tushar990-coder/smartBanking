using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanApplication
    {
        [Key]
        public int LoanApplicationID { get; set; }

        [StringLength(50)]
        public string? ApplicationNo { get; set; } = string.Empty; // Auto-generated e.g. APP-2425-001

        [Required]
        public DateTime ApplicationDate { get; set; } = DateTime.Today;

        public int? CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public Customer? Customer { get; set; }

        public int? MemberID { get; set; }

        [ForeignKey("MemberID")]
        public Member? Member { get; set; }

        public int? CoMemberID { get; set; }

        [ForeignKey("CoMemberID")]
        public Member? CoMember { get; set; }

        public int? CoMember2ID { get; set; }

        [ForeignKey("CoMember2ID")]
        public Member? CoMember2 { get; set; }

        public int? CoCustomerID { get; set; }

        [ForeignKey("CoCustomerID")]
        public Customer? CoCustomer { get; set; }

        public int? CoCustomer2ID { get; set; }

        [ForeignKey("CoCustomer2ID")]
        public Customer? CoCustomer2 { get; set; }

        [Required]
        public int LoanRateID { get; set; }

        [ForeignKey("LoanRateID")]
        public LoanRate? LoanRate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal RequestedAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestRate { get; set; } // Editable

        [Required]
        public int DurationMonths { get; set; }

        [Required]
        [StringLength(50)]
        public string InstallmentFrequency { get; set; } = "मासिक (Monthly)";

        [Column(TypeName = "decimal(18,2)")]
        public decimal InstallmentAmount { get; set; }

        public int NoOfInstallments { get; set; }

        public DateTime? FirstInstallmentDate { get; set; }

        public DateTime? MaturityDate { get; set; }

        public int? RecommendedByDirectorID { get; set; }

        [ForeignKey("RecommendedByDirectorID")]
        public Member? RecommendedByDirector { get; set; }

        [StringLength(200)]
        public string? Purpose { get; set; }

        public int? Guarantor1MemberID { get; set; }

        [ForeignKey("Guarantor1MemberID")]
        public Member? Guarantor1Member { get; set; }

        public int? Guarantor2MemberID { get; set; }

        [ForeignKey("Guarantor2MemberID")]
        public Member? Guarantor2Member { get; set; }

        public int? Guarantor1CustomerID { get; set; }

        [ForeignKey("Guarantor1CustomerID")]
        public Customer? Guarantor1Customer { get; set; }

        public int? Guarantor2CustomerID { get; set; }

        [ForeignKey("Guarantor2CustomerID")]
        public Customer? Guarantor2Customer { get; set; }

        [StringLength(500)]
        public string? SecurityDetails { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SecurityValue { get; set; }

        [StringLength(50)]
        public string? LoanAccountNo { get; set; } // Generated upon creation

        // Multi-Tranche Disbursement Tracking Properties (Not Mapped to DB table directly)
        [NotMapped]
        public decimal TotalDisbursedAmount { get; set; }

        [NotMapped]
        public decimal PendingSanctionedAmount { get; set; }

        [NotMapped]
        public int DisbursementCount { get; set; }

        [NotMapped]
        public string DisbursementStatus { get; set; } = "Pending";

        [NotMapped]
        public int? LinkedLoanAccountID { get; set; }
    }
}
