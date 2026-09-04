using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class NpaProvisionSlab
    {
        [Key]
        public int NpaProvisionSlabID { get; set; }

        [Required]
        [StringLength(10)]
        public string FinancialYear { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string Category { get; set; } = string.Empty; // Standard, Sub-Standard, Doubtful-1, Doubtful-2, Doubtful-3, Loss

        [Required]
        [StringLength(20)]
        public string SecurityType { get; set; } = string.Empty; // Secured, Unsecured, Both

        [Column(TypeName = "decimal(18,2)")]
        public decimal OverdueOrOutOfOrderMonthsFrom { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal OverdueOrOutOfOrderMonthsTo { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal NpaMonthsFrom { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal NpaMonthsTo { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal MinProvisionPercent { get; set; }
    }
}
