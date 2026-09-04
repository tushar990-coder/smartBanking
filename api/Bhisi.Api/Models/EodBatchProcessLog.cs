using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class EodBatchProcessLog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long LogID { get; set; }

        public int BranchID { get; set; }

        public DateTime BusinessDate { get; set; }

        public int StepNumber { get; set; }

        [Required]
        [MaxLength(100)]
        public string StepName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "SUCCESS"; // SUCCESS, FAILED, IN_PROGRESS, SKIPPED

        public int RecordsProcessed { get; set; } = 0;

        public string? ErrorMessage { get; set; }

        public DateTime StartTime { get; set; } = DateTime.Now;

        public DateTime? EndTime { get; set; }

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }
    }
}
