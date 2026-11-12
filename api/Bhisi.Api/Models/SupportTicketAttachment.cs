using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Bhisi.Api.Models
{
    [Table("SupportTicketAttachments")]
    public class SupportTicketAttachment
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int AttachmentID { get; set; }

        public int TicketID { get; set; }

        [Required]
        [StringLength(255)]
        public string OriginalFileName { get; set; } = string.Empty;

        [Required]
        [StringLength(500)]
        public string FilePath { get; set; } = string.Empty;

        [StringLength(100)]
        public string? FileType { get; set; }

        public long? FileSize { get; set; }

        public DateTime CreatedOn { get; set; } = DateTime.Now;

        [ForeignKey("TicketID")]
        [JsonIgnore]
        public virtual SupportTicket? SupportTicket { get; set; }
    }
}

