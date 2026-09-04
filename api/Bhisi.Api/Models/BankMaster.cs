using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class BankMaster
    {
        [Key]
        public int BankID { get; set; }

        [Required]
        [MaxLength(100)]
        public string BankName { get; set; } = string.Empty;
    }
}
