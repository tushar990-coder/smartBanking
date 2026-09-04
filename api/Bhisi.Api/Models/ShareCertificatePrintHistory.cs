using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class ShareCertificatePrintHistory
    {
        [Key]
        public int PrintHistoryId { get; set; }

        [Required]
        public int CertificateId { get; set; }

        [Required]
        [MaxLength(20)]
        public string ActionType { get; set; } = "Print"; // e.g., Print, Download PDF, Email

        public int PrintedBy { get; set; }

        public DateTime PrintedOn { get; set; } = DateTime.UtcNow;

        [MaxLength(50)]
        public string? IPAddress { get; set; }

        [ForeignKey("CertificateId")]
        public ShareCertificate? ShareCertificate { get; set; }
    }
}
