using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SavingAccountSequence
    {
        [Key]
        public int SequenceID { get; set; }

        [Required]
        public int BranchID { get; set; }

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        public int SchemeCodeNumeric { get; set; } = 101; // e.g. 101, 102, 103

        [Required]
        public int LastSequenceNumber { get; set; } = 0;

        public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;
    }
}
