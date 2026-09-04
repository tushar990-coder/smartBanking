using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class ShareScheme
    {
        [Key]
        public int ShareSchemeId { get; set; }

        public int BranchID { get; set; } = 1;

        [Required]
        [StringLength(50)]
        public string SchemeCode { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string SchemeName { get; set; } = string.Empty;

        [StringLength(50)]
        public string MemberType { get; set; } = "Regular"; // Regular (नियमित), Nominal (नाममात्र), Associate (सहयोगी), Institutional (संस्थागत)

        [Column(TypeName = "decimal(18, 2)")]
        public decimal ShareFaceValue { get; set; } = 100.00m; // एका शेअरचे दर्शनी मूल्य

        public int MinSharesCount { get; set; } = 1; // किमान शेअर्स मर्यादा
        public int MaxSharesCount { get; set; } = 1000; // कमाल शेअर्स मर्यादा

        [Column(TypeName = "decimal(18, 2)")]
        public decimal EntranceFee { get; set; } = 10.00m; // सभासद प्रवेश फी

        [Column(TypeName = "decimal(18, 2)")]
        public decimal BuildingFund { get; set; } = 0.00m; // इमारत / कल्याण निधी

        [Column(TypeName = "decimal(18, 2)")]
        public decimal ShareTransferFee { get; set; } = 25.00m; // शेअर हस्तांतरण फी

        [Column(TypeName = "decimal(18, 2)")]
        public decimal DividendRate { get; set; } = 10.00m; // अपेक्षित लाभांश दर (%)

        public bool HasVotingRights { get; set; } = true; // मतदानाचा हक्क

        public bool IsMobileCompulsory { get; set; } = true; // मोबाईल नंबर अनिवार्य
        public bool IsAadhaarCompulsory { get; set; } = true; // आधार कार्ड अनिवार्य
        public bool IsPanCompulsory { get; set; } = false; // पॅन कार्ड अनिवार्य

        public int LoanEligibilityMultiplier { get; set; } = 10; // शेअरच्या पटीत कर्ज पात्रता (उदा. 10 पट)

        public DateTime EffectiveDate { get; set; } = DateTime.Today;

        public bool IsActive { get; set; } = true;

        // Dynamic Accounting Ledgers Mapping
        public int? ShareCapitalLedgerID { get; set; }
        [ForeignKey("ShareCapitalLedgerID")]
        public virtual Ledger? ShareCapitalLedger { get; set; }

        public int? EntranceFeeLedgerID { get; set; }
        [ForeignKey("EntranceFeeLedgerID")]
        public virtual Ledger? EntranceFeeLedger { get; set; }

        public int? ShareTransferFeeLedgerID { get; set; }
        [ForeignKey("ShareTransferFeeLedgerID")]
        public virtual Ledger? ShareTransferFeeLedger { get; set; }

        public int? BuildingFundLedgerID { get; set; }
        [ForeignKey("BuildingFundLedgerID")]
        public virtual Ledger? BuildingFundLedger { get; set; }

        public int? DividendPayableLedgerID { get; set; }
        [ForeignKey("DividendPayableLedgerID")]
        public virtual Ledger? DividendPayableLedger { get; set; }
    }
}
