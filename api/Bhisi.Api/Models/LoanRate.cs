using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanRate
    {
        [Key]
        public int LoanRateID { get; set; }

        [Required]
        [StringLength(100)]
        public string LoanType { get; set; } = string.Empty; // कर्ज प्रकार

        [StringLength(50)]
        public string LoanCode { get; set; } = string.Empty; // कोड

        public int? LoanLedgerID { get; set; } // कर्ज खाते (मुद्दल लेजर)
        public int? InterestLedgerID { get; set; } // व्याज खाते (उत्पन्न लेजर)

        public int? OverdueInterestLedgerID { get; set; } // थकीत व्याज खाते
        public int? ReceivableInterestLedgerID { get; set; } // येणे व्याज खाते
        public int? SurchargeLedgerID { get; set; } // सरचार्ज खाते
        public int? RecoveryFeeLedgerID { get; set; } // वसुली फी खाते
        public int? ProcessingFeeLedgerID { get; set; } // प्रोसेसिंग फी खाते

        [Column(TypeName = "decimal(18, 2)")]
        public decimal InterestRate { get; set; } // व्याजदर

        [Column(TypeName = "decimal(18, 2)")]
        public decimal OverdueInterestRate { get; set; } // थकीत व्याजदर

        [StringLength(100)]
        public string? InterestPostingType { get; set; } = string.Empty; // व्याज पोस्टींग प्रकार

        [StringLength(100)]
        public string? InterestPostingFrequency { get; set; } = "मासिक"; // व्याज पोस्टींग वारंवारता (Monthly, Quarterly, Half-Yearly, Yearly, Along with Installment, Daily)

        [StringLength(100)]
        public string? InterestCalculationMethod { get; set; } = "Flat (फ्लॅट)"; // व्याज आकारणी पद्धत (e.g., Flat, Reducing)

        [StringLength(100)]
        public string? ShortName { get; set; } = string.Empty; // संक्षिप्त

        public int? DurationMonths { get; set; } = 12; // मुदत (महिने)

        [StringLength(100)]
        public string? InstallmentType { get; set; } = string.Empty; // हप्ता प्रकार

        public int? InstallmentCount { get; set; } = 12; // हप्ता संख्या

        [StringLength(100)]
        public string? LoanInstallmentType { get; set; } = string.Empty; // कर्ज हप्ता प्रकार

        [StringLength(100)]
        public string? SecurityType { get; set; } = string.Empty; // तारणी (Security Type)

        public bool IsCcOrOd { get; set; } = false;

        public bool IsActive { get; set; } = true;
    }
}
