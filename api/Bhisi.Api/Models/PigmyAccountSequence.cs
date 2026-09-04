using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class PigmyAccountSequence
    {
        [Key]
        public int ID { get; set; }
        
        [Required]
        public int BranchID { get; set; }
        
        [Required]
        public int LastSequenceNumber { get; set; }
    }
}
