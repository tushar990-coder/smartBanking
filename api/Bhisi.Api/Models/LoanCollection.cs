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
        public decimal InterestCollected { get; set; }

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

        [StringLength(200)]
        public string? Remarks { get; set; }
    }
}
