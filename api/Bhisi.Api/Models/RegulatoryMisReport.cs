using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class RegulatoryMisReport
    {
        [Key]
        public int MisReportID { get; set; }

        [Required]
        [MaxLength(20)]
        public string FinancialYear { get; set; } = "2025-2026";

        public int BranchID { get; set; } = 1;

        public DateTime AsOnDate { get; set; } = DateTime.Today;

        // JSON sections for the 7 portal tabs
        public string? GeneralInfoJson { get; set; }
        public string? CapitalDepositsJson { get; set; }
        public string? LoansRecoveryJson { get; set; }
        public string? InvestmentsJson { get; set; }
        public string? FinancialRatiosJson { get; set; }
        public string? ContributionJson { get; set; }
        public string? OtherInfoJson { get; set; }

        public bool IsLocked { get; set; } = false;

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.Now;
        public DateTime UpdatedOn { get; set; } = DateTime.Now;
    }
}
