using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanCollection
    {
        [Key]
        public int LoanCollectionID { get; set; }

        [Required]
        public int LoanAccountID { get; set; }

        [ForeignKey("LoanAccountID")]
        public LoanAccount? LoanAccount { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public Branch? Branch { get; set; }

        public int? CollectingCashierID { get; set; }

        public int? CreatedByUserID { get; set; }

        public bool IsCrossBranch { get; set; } = false;

        public int? HomeBranchID { get; set; }

        [Required]
        public DateTime CollectionDate { get; set; } = DateTime.Today;

        [StringLength(50)]
        public string? ReceiptNo { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmountReceived { get; set; }

        // Auto-split allocations
        [Column(TypeName = "decimal(18,2)")]
        public decimal SurchargeCollected { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenaltyInterestCollected { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ReceivableInterestCollected { get; set; } = 0; // जमा झालेले थकीत येणे व्याज (Cr. Receivable Ledger)

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestCollected { get; set; } // जमा झालेले चालू व्याज (Cr. Interest Income Ledger)

        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalCollected { get; set; }

        // OTS & Waiver fields
        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestWaived { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal PenaltyWaived { get; set; } = 0;

        public bool IsOTS { get; set; } = false;

        [StringLength(100)]
        public string? ResolutionNo { get; set; }

        public int? ApprovedByUserID { get; set; }

        [Required]
        [StringLength(50)]
        public string PaymentMode { get; set; } = "Cash"; // Cash, Bank, Cheque, Saving Transfer

        [StringLength(100)]
        public string? BankName { get; set; }

        [StringLength(50)]
        public string? ChequeNo { get; set; }

        public int? BankAccountLedgerID { get; set; } // If PaymentMode is Bank

        [StringLength(50)]
        public string? TransferFromSavingAccountNo { get; set; } // If PaymentMode is Saving Transfer

        public int? VoucherID { get; set; }

        public ICollection<LoanCollectionFee> Fees { get; set; } = new List<LoanCollectionFee>();

        [ForeignKey("VoucherID")]
        public Voucher? Voucher { get; set; }

        // IBT Home Branch Settlement Voucher
        public int? HomeBranchVoucherID { get; set; }

        [ForeignKey("HomeBranchVoucherID")]
        public Voucher? HomeBranchVoucher { get; set; }

        [StringLength(200)]
        public string? Remarks { get; set; }

        // Agent Doorstep Collection Provisioning
        public int? AgentID { get; set; }

        [ForeignKey("AgentID")]
        public virtual PigmyAgent? Agent { get; set; }

        [StringLength(20)]
        public string CollectionSource { get; set; } = "COUNTER";

        [StringLength(100)]
        public string? TransactionId { get; set; }

        [StringLength(100)]
        public string? SyncReferenceId { get; set; }
    }
}
