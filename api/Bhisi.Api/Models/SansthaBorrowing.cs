using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SansthaBorrowing
    {
        [Key]
        public int BorrowingID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int FinancialYearID { get; set; } = 1;

        [ForeignKey("FinancialYearID")]
        public virtual FinancialYear? FinancialYear { get; set; }

        [Required]
        [StringLength(50)]
        public string BorrowingNo { get; set; } = string.Empty;

        public int? LenderInstitutionID { get; set; }

        [ForeignKey("LenderInstitutionID")]
        public virtual InvestmentInstitution? LenderInstitution { get; set; }

        [Required]
        [StringLength(150)]
        public string LenderName { get; set; } = string.Empty;

        [StringLength(100)]
        public string? LenderBranchName { get; set; }

        [StringLength(80)]
        public string? ExternalLoanAccountNo { get; set; }

        /// <summary>
        /// GOLD_REPLEDGE | TERM_LOAN | CASH_CREDIT_OD | FD_AGAINST_LOAN
        /// </summary>
        [Required]
        [StringLength(40)]
        public string BorrowingType { get; set; } = "GOLD_REPLEDGE";

        public int? PledgedInvestmentAccountID { get; set; }

        [ForeignKey("PledgedInvestmentAccountID")]
        public virtual InvestmentAccount? PledgedInvestmentAccount { get; set; }

        public DateTime SanctionDate { get; set; } = DateTime.Today;
        public DateTime DisbursementDate { get; set; } = DateTime.Today;
        public DateTime? MaturityDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SanctionedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DisbursedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal OutstandingPrincipal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalInterestPaid { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal BorrowingInterestRate { get; set; }

        [StringLength(40)]
        public string InterestCalculationMethod { get; set; } = "Reducing";

        [Column(TypeName = "decimal(18,2)")]
        public decimal InstallmentAmount { get; set; } = 0m;

        [Required]
        public int BorrowingLiabilityLedgerID { get; set; }

        [ForeignKey("BorrowingLiabilityLedgerID")]
        public virtual Ledger? BorrowingLiabilityLedger { get; set; }

        [Required]
        public int InterestExpenseLedgerID { get; set; }

        [ForeignKey("InterestExpenseLedgerID")]
        public virtual Ledger? InterestExpenseLedger { get; set; }

        [StringLength(30)]
        public string PaymentMode { get; set; } = "Bank";

        public int? BankLedgerID { get; set; }

        [StringLength(80)]
        public string? ReferenceNo { get; set; }

        public int? DisbursementVoucherID { get; set; }

        [ForeignKey("DisbursementVoucherID")]
        public virtual Voucher? DisbursementVoucher { get; set; }

        [StringLength(300)]
        public string? PurposeOrLinkedLoansNote { get; set; }

        [StringLength(300)]
        public string? Remarks { get; set; }

        /// <summary>
        /// Active | Closed
        /// </summary>
        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Active";

        public DateTime? ClosedDate { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public virtual ICollection<SansthaBorrowingGoldPledge> GoldPledges { get; set; } = new List<SansthaBorrowingGoldPledge>();
        public virtual ICollection<SansthaBorrowingRepayment> Repayments { get; set; } = new List<SansthaBorrowingRepayment>();
    }
}
