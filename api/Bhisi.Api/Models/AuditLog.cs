using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class AuditLog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long AuditLogID { get; set; }

        public int? UserID { get; set; }

        [StringLength(100)]
        public string Username { get; set; } = string.Empty;

        [StringLength(100)]
        public string Action { get; set; } = string.Empty; // E.g., VOUCHER_CREATE, LOAN_COLLECTION, MEMBER_UPDATE, LOGIN

        [StringLength(100)]
        public string EntityName { get; set; } = string.Empty; // E.g., Voucher, Member, LoanAccount

        [StringLength(50)]
        public string? EntityID { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.Now;

        [StringLength(50)]
        public string? IPAddress { get; set; }

        public string? Details { get; set; } // JSON or text description of changes

        [StringLength(20)]
        public string Status { get; set; } = "Success"; // Success, Failed
    }
}
