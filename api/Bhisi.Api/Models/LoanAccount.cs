using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanAccount
    {
        [Key]
        public int LoanAccountID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        public int? LoanApplicationID { get; set; }
        [ForeignKey("LoanApplicationID")]
        public LoanApplication? LoanApplication { get; set; }

        public int? CustomerID { get; set; }
        [ForeignKey("CustomerID")]
        [InverseProperty("LoanAccounts")]
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

        [StringLength(50)]
        public string? LoanAccountNo { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalBalance { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestBalance { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal OverdueInterestBalance { get; set; }

        [Required]
        public DateTime OpeningDate { get; set; }

        public DateTime? LoanDisbursementDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SanctionedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestRate { get; set; }

        public int DurationMonths { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal InstallmentAmount { get; set; }

        public DateTime? FirstInstallmentDate { get; set; }
        public DateTime? MaturityDate { get; set; }
        
        [StringLength(50)]
        public string InstallmentFrequency { get; set; } = "मासिक (Monthly)";

        public DateTime? LastInstallmentPaidDate { get; set; }

        public int NoOfInstallments { get; set; }

        public int? RecommendedByDirectorID { get; set; }
        [ForeignKey("RecommendedByDirectorID")]
        public Member? RecommendedByDirector { get; set; }

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

        public bool IsOpeningBalance { get; set; } = false;

        // Legacy Mapping Fields for Migration
        public int? LegacyAccountId { get; set; }

        [MaxLength(50)]
        public string? LegacyAccountNumber { get; set; }

        [StringLength(20)]
        public string Status { get; set; } = "Active"; // Active, Closed

        public virtual ICollection<LoanInstallmentSchedule> LoanInstallmentSchedules { get; set; } = new List<LoanInstallmentSchedule>();
    }
}
