using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Bhisi.Api.Models
{
    public class ShareCertificate
    {
        [Key]
        public int CertificateId { get; set; }

        [Required]
        public int ShareAccountId { get; set; }

        [Required]
        public int CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        [Required]
        [MaxLength(50)]
        public string CertificateNo { get; set; } = string.Empty;

        public DateTime IssueDate { get; set; }

        public long FromShareNo { get; set; }
        
        public long ToShareNo { get; set; }

        public int NumberOfShares { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal FaceValue { get; set; } = 100M;

        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        public int PrintCount { get; set; } = 0;

        public int CreatedBy { get; set; }
        
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public int? ModifiedBy { get; set; }
        
        public DateTime? ModifiedDate { get; set; }

        public string? CancellationReason { get; set; }

        [ForeignKey("ShareAccountId")]
        [JsonIgnore]
        public ShareAccount? ShareAccount { get; set; }
    }
}
