using System;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class NpaClassificationRun
    {
        [Key]
        public int NpaClassificationRunID { get; set; }

        [Required]
        public DateTime RunDate { get; set; } = DateTime.Now;

        [Required]
        [StringLength(100)]
        public string TriggeredBy { get; set; } = "System";

        [Required]
        public int RecordsProcessed { get; set; } = 0;

        [Required]
        [StringLength(50)]
        public string Status { get; set; } = "Pending"; // Success, Failed

        [StringLength(500)]
        public string? Remarks { get; set; }
    }
}
