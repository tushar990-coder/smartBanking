using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SansthaBorrowingGoldPledge
    {
        [Key]
        public int BorrowingGoldPledgeID { get; set; }

        [Required]
        public int BorrowingID { get; set; }

        [ForeignKey("BorrowingID")]
        public virtual SansthaBorrowing? Borrowing { get; set; }

        [Required]
        public int LoanAccountID { get; set; }

        [ForeignKey("LoanAccountID")]
        public virtual LoanAccount? LoanAccount { get; set; }

        [Required]
        public int GoldCustodyID { get; set; }

        [ForeignKey("GoldCustodyID")]
        public virtual GoldLoanCustody? GoldCustody { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal CustomerLoanInterestRate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestSpreadPercent { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AllocatedBorrowedAmount { get; set; }

        [StringLength(80)]
        public string? LenderPledgeReceiptNo { get; set; }

        public DateTime PledgedDate { get; set; } = DateTime.Today;

        // Snapshot of previous custody location so unpledge/rollback restores cleanly
        [Required]
        [StringLength(40)]
        public string PreviousCustodyStatus { get; set; } = "BRANCH_SAFE";

        public int? PreviousOwnLockerID { get; set; }
        public int? PreviousExternalLockerID { get; set; }

        [StringLength(100)]
        public string? PreviousVaultRackNo { get; set; }

        /// <summary>
        /// Pledged | Released
        /// </summary>
        [Required]
        [StringLength(20)]
        public string PledgeStatus { get; set; } = "Pledged";

        public DateTime? ReleasedDate { get; set; }
        public int? ReleasedOnRepaymentID { get; set; }

        [StringLength(250)]
        public string? ReleaseRemarks { get; set; }
    }
}
