using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class InvestmentRenewal
    {
        [Key]
        public int RenewalID { get; set; }

        [Required]
        public int InstitutionID { get; set; } = 1;

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int FinancialYearID { get; set; } = 1;

        [ForeignKey("FinancialYearID")]
        public virtual FinancialYear? FinancialYear { get; set; }

        [Required]
        public int OldInvestmentAccountID { get; set; }

        [ForeignKey("OldInvestmentAccountID")]
        public virtual InvestmentAccount? OldInvestmentAccount { get; set; }

        [Required]
        public int NewInvestmentAccountID { get; set; }

        [ForeignKey("NewInvestmentAccountID")]
        public virtual InvestmentAccount? NewInvestmentAccount { get; set; }

        [Required]
        [StringLength(30)]
        public string RenewalType { get; set; } = "PrincipalOnly"; // PrincipalOnly, PrincipalAndInterest

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal RenewalAmount { get; set; }

        [Required]
        public DateTime RenewalDate { get; set; }

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
