using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class InvestmentAccountSequence
    {
        [Key]
        public int SequenceID { get; set; }

        [Required]
        public int BranchID { get; set; }

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(10)]
        public string ProductType { get; set; } = "INV"; // INV

        [Required]
        public int CurrentValue { get; set; } = 0;
    }
}
