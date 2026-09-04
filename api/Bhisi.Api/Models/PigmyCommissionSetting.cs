using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyCommissionSetting
    {
        [Key]
        public int SettingId { get; set; }

        public int? AgentId { get; set; }

        [ForeignKey("AgentId")]
        public virtual PigmyAgent? Agent { get; set; }

        [Required]
        [MaxLength(20)]
        public string CommissionType { get; set; } = "PERCENTAGE"; // "PERCENTAGE" or "FIXED"

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal CommissionValue { get; set; }

        [Required]
        [MaxLength(20)]
        public string CalculationFrequency { get; set; } = "DAILY"; // "DAILY" or "MONTHLY"

        public DateTime EffectiveFrom { get; set; } = DateTime.Today;

        public DateTime? EffectiveTo { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
