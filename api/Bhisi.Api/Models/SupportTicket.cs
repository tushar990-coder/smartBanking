using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    [Table("SupportTickets")]
    public class SupportTicket
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int TicketID { get; set; }

        [Required]
        [StringLength(50)]
        public string TicketNo { get; set; } = string.Empty;

        public int BranchID { get; set; } = 1;

        [Required]
        [StringLength(100)]
        public string BranchName { get; set; } = string.Empty;

        public int UserID { get; set; }

        [Required]
        [StringLength(100)]
        public string Username { get; set; } = string.Empty;

        [StringLength(30)]
        public string? ContactNumber { get; set; }

        [Required]
        [StringLength(100)]
        public string ModuleCategory { get; set; } = "General";

        [Required]
        [StringLength(20)]
        public string Priority { get; set; } = "MEDIUM"; // CRITICAL, HIGH, MEDIUM, LOW

        [Required]
        [StringLength(250)]
        public string Subject { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        public string? SystemInfoJson { get; set; }

        [Required]
        [StringLength(30)]
        public string Status { get; set; } = "OPEN"; // OPEN, IN_PROGRESS, RESOLVED, CLOSED

        public string? ResolutionRemarks { get; set; }

        public int? ResolvedByUserID { get; set; }

        public DateTime? ResolvedAt { get; set; }

        public DateTime CreatedOn { get; set; } = DateTime.Now;

        public DateTime? UpdatedOn { get; set; }

        public virtual ICollection<SupportTicketAttachment> Attachments { get; set; } = new List<SupportTicketAttachment>();
    }
}

