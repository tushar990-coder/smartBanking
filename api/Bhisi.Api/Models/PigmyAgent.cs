using System;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class PigmyAgent
    {
        [Key]
        public int PigmyAgentID { get; set; }

        [Required]
        [StringLength(100)]
        public string AgentName { get; set; } = string.Empty;

        [Required]
        [StringLength(15)]
        public string MobileNo { get; set; } = string.Empty;

        public DateTime? JoiningDate { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Active";

        public int? BranchID { get; set; }

        [System.ComponentModel.DataAnnotations.Schema.ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "decimal(18,2)")]
        public decimal MaxCashLimit { get; set; } = 20000.00m;

        [StringLength(255)]
        public string? PasswordHash { get; set; }

        [StringLength(10)]
        public string? Pin { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}

