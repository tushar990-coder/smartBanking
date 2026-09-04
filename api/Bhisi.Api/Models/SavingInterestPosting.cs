using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SavingInterestPosting
    {
        [Key]
        public int PostingID { get; set; }

        [Required]
        public int FinancialYearID { get; set; }
        
        [ForeignKey("FinancialYearID")]
        public virtual FinancialYear? FinancialYear { get; set; }

        public DateTime PeriodStart { get; set; }
        public DateTime PeriodEnd { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalInterest { get; set; }

        [MaxLength(50)]
        public string? VoucherNo { get; set; }

        public DateTime PostedOn { get; set; } = DateTime.Now;
        public int PostedBy { get; set; } = 1;
    }
}
