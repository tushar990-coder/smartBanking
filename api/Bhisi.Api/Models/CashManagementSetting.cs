using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class CashManagementSetting
    {
        [Key]
        public int Id { get; set; }

        public int? BranchId { get; set; }

        [ForeignKey("BranchId")]
        public virtual Branch? Branch { get; set; }

        // मुख्य तिजोरी रोख खाते (Main Vault Cash Ledger)
        public int? MainVaultLedgerId { get; set; }

        [ForeignKey("MainVaultLedgerId")]
        public virtual Ledger? MainVaultLedger { get; set; }

        // कॅश तफावत - कमी रक्कम खर्च खाते (Cash Shortage / Loss A/c)
        public int? CashShortageLedgerId { get; set; }

        [ForeignKey("CashShortageLedgerId")]
        public virtual Ledger? CashShortageLedger { get; set; }

        // कॅश तफावत - जास्त रक्कम उत्पन्न खाते (Cash Excess / Gain A/c)
        public int? CashExcessLedgerId { get; set; }

        [ForeignKey("CashExcessLedgerId")]
        public virtual Ledger? CashExcessLedger { get; set; }

        // रोख वाटप / परतावा करताना आपोआप आंतर-काउंटर व्हाउचर तयार करावे का?
        public bool AutoGenerateVouchers { get; set; } = false;

        // दिवस अखेर नोटांची मोजणी (Denominations) बंधनकारक करणे
        public bool EnableDenominationMandatory { get; set; } = true;

        // शाखेची एकूण तिजोरी रोख मर्यादा (Max Branch Vault Limit)
        [Column(TypeName = "decimal(18,2)")]
        public decimal MaxBranchVaultLimit { get; set; } = 5000000;

        // प्रत्येक काउंटरची डीफॉल्ट कमाल मर्यादा (Default Counter Limit)
        [Column(TypeName = "decimal(18,2)")]
        public decimal DefaultCounterLimit { get; set; } = 500000;

        [StringLength(250)]
        public string? Remarks { get; set; }

        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    }
}
