using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class FdAccountSequence
    {
        [Key]
        public int SequenceID { get; set; }

        [Required]
        public int BranchID { get; set; }

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(10)]
        public string ProductType { get; set; } = "FD"; // E.g., FD

        [Required]
        public int CurrentValue { get; set; } = 0;
    }
}
