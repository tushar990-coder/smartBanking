using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Bhisi.Api.Models
{
    public class FdSchemeInterestSlab
    {
        [Key]
        public int SlabID { get; set; }

        [Required]
        public int FdSchemeID { get; set; }

        [ForeignKey("FdSchemeID")]
        [JsonIgnore]
        public virtual FdScheme? FdScheme { get; set; }

        [Required]
        public int FromDays { get; set; }

        [Required]
        public int ToDays { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal InterestRate { get; set; }

        [Required]
        [Column(TypeName = "decimal(5,2)")]
        public decimal SeniorCitizenRate { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal PrematureRate { get; set; } = 0;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
