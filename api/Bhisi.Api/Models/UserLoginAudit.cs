using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class UserLoginAudit
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int AuditID { get; set; }

        public int UserID { get; set; }

        public DateTime LoginTime { get; set; }

        public DateTime? LogoutTime { get; set; }

        [StringLength(50)]
        public string? IPAddress { get; set; }

        [StringLength(255)]
        public string? DeviceDetails { get; set; }

        [StringLength(50)]
        public string Status { get; set; } = string.Empty;

        [ForeignKey("UserID")]
        public virtual User? User { get; set; }
    }
}
