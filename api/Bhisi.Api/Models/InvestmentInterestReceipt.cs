using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class InvestmentInterestReceipt
    {
        [Key]
        public int ReceiptID { get; set; }

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
        public DateTime ReceiptDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ReceivedAmount { get; set; }

        public int? VoucherID { get; set; }

        [ForeignKey("VoucherID")]
        public virtual Voucher? Voucher { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
