using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class GoldLoanDetail
    {
        [Key]
        public int GoldLoanDetailID { get; set; }

        [Required]
        public int LoanAccountID { get; set; }

        [ForeignKey("LoanAccountID")]
        public virtual LoanAccount? LoanAccount { get; set; }

        [Required]
        [StringLength(200)]
        public string OrnamentName { get; set; } = string.Empty; // दागिन्याचे नाव (उदा. अंगठी)

        public int Quantity { get; set; } = 1; // नग

        [Required]
        [Column(TypeName = "decimal(18,3)")]
        public decimal GrossWeight { get; set; } // एकूण वजन (Gross Weight) - 3 decimal places for precision

        [Required]
        [Column(TypeName = "decimal(18,3)")]
        public decimal NetWeight { get; set; } // निव्वळ वजन (Net Weight)

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Purity { get; set; } = 22; // शुद्धता (Karat)

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal GoldRatePerGram { get; set; } // प्रति ग्रॅम दर

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal EstimatedValue { get; set; } // एकूण किंमत (Estimated Cost)

        [StringLength(500)]
        public string? ImagePath { get; set; } // दागिन्यांचा फोटो (Physical Image Path)
    }
}
