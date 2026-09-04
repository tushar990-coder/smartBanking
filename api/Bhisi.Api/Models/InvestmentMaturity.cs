using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class InvestmentMaturity
    {
        [Key]
        public int MaturityID { get; set; }

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
        public int InvestmentAccountID { get; set; }

        [ForeignKey("InvestmentAccountID")]
        public virtual InvestmentAccount? InvestmentAccount { get; set; }

        [Required]
        public DateTime MaturityDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalReceived { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestReceived { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalReceived { get; set; }

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
