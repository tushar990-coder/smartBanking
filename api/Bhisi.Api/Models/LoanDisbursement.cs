using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanDisbursement
    {
        [Key]
        public int LoanDisbursementID { get; set; }

        [Required]
        public int LoanAccountID { get; set; }

        [ForeignKey("LoanAccountID")]
        public LoanAccount? LoanAccount { get; set; }

        [Required]
        public DateTime DisbursementDate { get; set; } = DateTime.Today;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal SanctionedAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal DisbursementAmount { get; set; }

        // Deductions
        [Column(TypeName = "decimal(18,2)")]
        public decimal ProcessingFee { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ShareDeduction { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal InsuranceDeduction { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal StationeryCharges { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal OtherDeductions { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal NetAmountPaid { get; set; } // SanctionedAmount - sum(Deductions)

        [Required]
        [StringLength(50)]
        public string PaymentMode { get; set; } = "Cash"; // Cash, Bank, Saving Transfer

        [StringLength(100)]
        public string? BankName { get; set; }

        [StringLength(50)]
        public string? ChequeNo { get; set; }

        public int? BankAccountLedgerID { get; set; } // If PaymentMode is Bank

        [ForeignKey("BankAccountLedgerID")]
        public Ledger? BankAccountLedger { get; set; }

        [StringLength(50)]
        public string? TransferToSavingAccountNo { get; set; } // If PaymentMode is Saving Transfer

        public int? VoucherID { get; set; } // Integration with accounting

        [ForeignKey("VoucherID")]
        public Voucher? Voucher { get; set; }

        [StringLength(200)]
        public string? Remarks { get; set; }

        [StringLength(100)]
        public string? LoanInstallmentType { get; set; } // कर्जावरती or व्याजवरती

        public ICollection<LoanDisbursementDeduction> Deductions { get; set; } = new List<LoanDisbursementDeduction>();

        // NPA Integration Fields
        [NotMapped]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? CollateralValue { get; set; }

        [NotMapped]
        [StringLength(200)]
        public string? CollateralDescription { get; set; }
    }
}
