using System;
using System.Linq;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyAccount
    {
        [Key]
        public int PigmyAccountID { get; set; }

        [Required]
        [StringLength(30)]
        public string AccountNo { get; set; } = string.Empty;

        [Required]
        public int CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer Customer { get; set; } = null!;

        [Required]
        public int BranchID { get; set; }

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int PigmySchemeID { get; set; }

        [ForeignKey("PigmySchemeID")]
        public virtual PigmyScheme? PigmyScheme { get; set; }

        [Required]
        public int PigmyAgentID { get; set; }

        [ForeignKey("PigmyAgentID")]
        public virtual PigmyAgent? PigmyAgent { get; set; }

        [Required]
        public DateTime OpeningDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [Required]
        public DateTime MaturityDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalDepositedAmount { get; set; } = 0;

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Active"; // Active, Matured, Closed

        // Dynamic Cycle & Day 1 Reset Fields
        public DateTime? EffectiveStartDate { get; set; }

        public int CurrentCycleNumber { get; set; } = 1;

        public DateTime? LastWithdrawalDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalWithdrawnAmount { get; set; } = 0;

        public virtual ICollection<PigmyWithdrawal> Withdrawals { get; set; } = new List<PigmyWithdrawal>();

        // Legacy Mapping Fields for Migration
        public int? LegacyAccountId { get; set; }

        [MaxLength(50)]
        public string? LegacyAccountNumber { get; set; }

        [MaxLength(50)]
        public string? PreviousAccountNo { get; set; }

        [NotMapped]
        public string? FormattedAccountNo { get; set; }

        [NotMapped]
        public string? CustomerName => Customer != null 
            ? string.Join(" ", new[] { Customer.FirstName, Customer.MiddleName, Customer.LastName }
                .Where(s => !string.IsNullOrWhiteSpace(s))).Trim() 
            : null;

        [NotMapped]
        public string? FullName => CustomerName;

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
