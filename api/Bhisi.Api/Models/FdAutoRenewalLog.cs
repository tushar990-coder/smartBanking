using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class FdAutoRenewalLog
    {
        [Key]
        public int LogID { get; set; }

        public int InstitutionID { get; set; } = 1;

        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public DateTime BatchDate { get; set; } = DateTime.Today;

        public int OldFdAccountID { get; set; }

        [ForeignKey("OldFdAccountID")]
        public virtual FdAccount? OldFdAccount { get; set; }

        public int? NewFdAccountID { get; set; }

        [ForeignKey("NewFdAccountID")]
        public virtual FdAccount? NewFdAccount { get; set; }

        [StringLength(30)]
        public string OldAccountNo { get; set; } = string.Empty;

        [StringLength(30)]
        public string? NewAccountNo { get; set; }

        public int CustomerID { get; set; }

        [StringLength(150)]
        public string CustomerName { get; set; } = string.Empty;

        [StringLength(30)]
        public string RenewalOption { get; set; } = "PrincipalPlusInterest"; // PrincipalPlusInterest, PrincipalOnly

        [Column(TypeName = "decimal(18,2)")]
        public decimal RenewedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestPaidOut { get; set; } = 0;

        [Column(TypeName = "decimal(5,2)")]
        public decimal AppliedRate { get; set; }

        public int? VoucherID { get; set; }

        [StringLength(20)]
        public string Status { get; set; } = "Success"; // Success, Failed, Reverted

        [StringLength(500)]
        public string? ErrorMessage { get; set; }

        [StringLength(100)]
        public string ExecutedBy { get; set; } = "System-EOD";

        public DateTime ExecutionTime { get; set; } = DateTime.UtcNow;

        public bool IsReverted { get; set; } = false;

        public DateTime? RevertedDate { get; set; }

        [StringLength(100)]
        public string? RevertedBy { get; set; }

        [StringLength(250)]
        public string? RevertReason { get; set; }
    }
}
