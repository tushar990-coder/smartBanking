using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class AuditLedgerMapping
    {
        [Key]
        public int AuditLedgerMappingID { get; set; }

        [Required]
        [StringLength(50)]
        public string CategoryCode { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        public string CategoryName { get; set; } = string.Empty;

        [Required]
        public int LedgerID { get; set; }

        [ForeignKey("LedgerID")]
        public virtual Ledger? Ledger { get; set; }

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;
    }
}
