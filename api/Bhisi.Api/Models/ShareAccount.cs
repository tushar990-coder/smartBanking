using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class ShareAccount
    {
        [Key]
        public int ShareAccountId { get; set; }

        [Required]
        [MaxLength(20)]
        public string AccountNo { get; set; } = string.Empty;

        [Required]
        public int MemberId { get; set; }

        [Required]
        public int CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        [ForeignKey("MemberId")]
        public virtual Member? Member { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalShareAmount { get; set; } = 0;

        [Required]
        public int TotalShareCount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal DividendPayableBalance { get; set; } = 0;

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        public DateTime OpeningDate { get; set; } = DateTime.Today;

        // Legacy Mapping Fields for Migration
        public int? LegacyAccountId { get; set; }

        [MaxLength(50)]
        public string? LegacyAccountNumber { get; set; }

        public virtual ICollection<ShareCertificate>? Certificates { get; set; }
        public virtual ICollection<ShareTransaction>? Transactions { get; set; }
        public virtual ICollection<DividendDistribution>? Dividends { get; set; }
    }
}
