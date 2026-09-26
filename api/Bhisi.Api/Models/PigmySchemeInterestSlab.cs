using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Bhisi.Api.Models
{
    public class PigmySchemeInterestSlab
    {
        [Key]
        public int SlabID { get; set; }

        [Required]
        public int PigmySchemeID { get; set; }

        [ForeignKey("PigmySchemeID")]
        [JsonIgnore]
        public virtual PigmyScheme? PigmyScheme { get; set; }

        [Required]
        public int FromMonths { get; set; }

        [Required]
        public int ToMonths { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; } = 0.00m;

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal PenaltyRate { get; set; } = 0.00m;

        [StringLength(100)]
        public string? SlabDescription { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
