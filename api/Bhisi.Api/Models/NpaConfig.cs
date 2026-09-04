using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class NpaConfig
    {
        [Key]
        [StringLength(10)]
        public string FinancialYear { get; set; } = string.Empty;

        [Required]
        public int ConcessionPeriodDays { get; set; } = 180;
    }
}
