using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Ledger
    {
        [Key]
        public int LedgerID { get; set; }
        
        [Required]
        [StringLength(100)]
        public required string LedgerName { get; set; }

        [StringLength(100)]
        public string? LedgerNameEnglish { get; set; }
        
        [StringLength(50)]
        public string? LedgerCode { get; set; }
        
        [Required]
        public int GroupID { get; set; }
        
        [ForeignKey("GroupID")]
        public virtual AccountGroup? AccountGroup { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal OpeningBalance { get; set; } = 0;
        
        [Required]
        [StringLength(2)]
        public string OpeningBalanceType { get; set; } = "Dr"; // Dr or Cr
        
        [StringLength(100)]
        public string? ReportType { get; set; } // Patrak
        
        [StringLength(100)]
        public string? AccountType { get; set; } // Khate Prakar
        
        public bool ExcludeFromRule35Swanidhi { get; set; } = false;
        
        [Required]
        public bool IsActive { get; set; } = true;

        // Legacy Mapping Fields for Migration
        public int? LegacyLedgerId { get; set; }

        [NotMapped]
        public decimal CurrentBalance { get; set; }
    }
}
