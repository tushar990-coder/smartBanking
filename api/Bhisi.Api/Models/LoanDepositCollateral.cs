using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanDepositCollateral
    {
        [Key]
        public int CollateralID { get; set; }

        public int? LoanApplicationID { get; set; }
        [ForeignKey("LoanApplicationID")]
        public virtual LoanApplication? LoanApplication { get; set; }

        public int? LoanAccountID { get; set; }
        [ForeignKey("LoanAccountID")]
        public virtual LoanAccount? LoanAccount { get; set; }

        [Required]
        public int CustomerID { get; set; }
        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        [Required]
        [StringLength(50)]
        public string CollateralType { get; set; } = "FixedDeposit"; // FixedDeposit, PigmyDeposit, RecurringDeposit, SavingDeposit

        [Required]
        public int DepositAccountID { get; set; } // FdAccountID, PigmyAccountID, RdAccountID, SavingAccountID

        [Required]
        [StringLength(50)]
        public string DepositAccountNo { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal DepositAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal CurrentDepositBalance { get; set; } = 0;

        public DateTime? MaturityDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LienAmount { get; set; } = 0;

        [Required]
        [StringLength(20)]
        public string LienStatus { get; set; } = "Pledged"; // Pledged, LienMarked, Released, Invoked

        public DateTime? LienMarkedDate { get; set; }

        public DateTime? LienReleasedDate { get; set; }

        [StringLength(250)]
        public string? Remarks { get; set; }

        public int CreatedBy { get; set; } = 1;

        public DateTime CreatedDate { get; set; } = DateTime.Now;
    }
}
