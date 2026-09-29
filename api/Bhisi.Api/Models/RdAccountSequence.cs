using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class RdAccountSequence
    {
        [Key]
        public int SequenceID { get; set; }

        [Required]
        public int BranchID { get; set; }

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(10)]
        public string ProductType { get; set; } = "RD"; // E.g., RD

        [Required]
        public int CurrentValue { get; set; } = 0;

        // CBS 14-Digit Standard Sequence Fields
        public int SchemeCodeNumeric { get; set; } = 501;

        public int LastSequenceNumber { get; set; } = 0;

        public System.DateTime? UpdatedOn { get; set; }
    }
}
