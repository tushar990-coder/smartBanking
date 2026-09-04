using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SavingAccountMaster
    {
        [Key]
        public int SavingAccountID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [MaxLength(20)]
        public string AccountNo { get; set; } = string.Empty;

        [Required]
        public int CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        public int? MemberID { get; set; }
        
        [ForeignKey("MemberID")]
        public virtual Member? Member { get; set; }

        // खाते प्रकार - Personal / Joint
        [MaxLength(20)]
        public string AccountType { get; set; } = "Personal";

        public DateTime OpeningDate { get; set; } = DateTime.Today;

        public bool IsLegacyAccount { get; set; } = false;

        // Legacy Mapping Fields for Migration
        public int? LegacyAccountId { get; set; }

        [MaxLength(50)]
        public string? LegacyAccountNumber { get; set; }

        [MaxLength(50)]
        public string? OldAccountNo { get; set; }

        // बचत ठेव प्रकार - Ledger mapping (विविध प्रकारच्या बचत ठेवी)
        [Required]
        public int LedgerID { get; set; } = 7; // Default: बचत ठेव ledger

        [ForeignKey("LedgerID")]
        public virtual Ledger? Ledger { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal OpeningBalance { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal CurrentBalance { get; set; } = 0;

        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; } = 0;

        // मागील व्याज जमा दिनांक व रक्कम (Last Interest Posting Date & Amount for accurate calculation)
        public DateTime? LastInterestPostingDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LastInterestAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal MinimumBalance { get; set; } = 500;

        [Column(TypeName = "decimal(18,2)")]
        public decimal LienAmount { get; set; } = 0;

        [MaxLength(250)]
        public string? LienReason { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        public DateTime? ClosingDate { get; set; }

        // वारसदार माहिती (Nominee Details)
        [MaxLength(150)]
        public string? NomineeName { get; set; }

        [MaxLength(50)]
        public string? NomineeRelation { get; set; }

        [MaxLength(500)]
        public string? NomineeAddress { get; set; }

        // Joint Holders
        public virtual ICollection<SavingAccountJointHolder> JointHolders { get; set; } = new List<SavingAccountJointHolder>();

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public int? UpdatedBy { get; set; }
        public DateTime? UpdatedOn { get; set; }
    }
}
