using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanInstallmentSchedule
    {
        [Key]
        public int ScheduleID { get; set; }

        [Required]
        public int LoanAccountID { get; set; }
        [ForeignKey("LoanAccountID")]
        public LoanAccount? LoanAccount { get; set; }

        [Required]
        public int InstallmentNo { get; set; }

        [Required]
        public DateTime DueDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal BalanceAmount { get; set; }

        [StringLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Paid, Overdue

        public DateTime? PaidDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal OpeningBalance { get; set; } = 0.00m;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ClosingBalance { get; set; } = 0.00m;

        [Required]
        public int Days { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestRate { get; set; } = 0.00m;
    }
}
