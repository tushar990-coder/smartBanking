using System;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class Branch
    {
        [Key]
        public int BranchID { get; set; }

        [Required]
        [MaxLength(10)]
        public string BranchCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string BranchName { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? Address { get; set; }

        [MaxLength(20)]
        public string? IFSCCode { get; set; }

        [MaxLength(20)]
        public string? BranchType { get; set; } = "Branch";

        [MaxLength(15)]
        public string? MobileNo { get; set; }

        [MaxLength(100)]
        public string? Email { get; set; }

        public int? DefaultCashLedgerID { get; set; }

        [System.ComponentModel.DataAnnotations.Schema.ForeignKey("DefaultCashLedgerID")]
        public virtual Ledger? DefaultCashLedger { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
