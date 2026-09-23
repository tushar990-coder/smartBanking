using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyAccountSequence
    {
        [Key]
        public int SequenceID { get; set; }

        [Required]
        public int BranchID { get; set; }

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int SchemeCodeNumeric { get; set; } = 301; // e.g. 301, 302, 303

        [Required]
        public int LastSequenceNumber { get; set; } = 0;

        public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;
    }
}
