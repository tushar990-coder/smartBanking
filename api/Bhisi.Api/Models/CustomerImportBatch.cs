using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    /// <summary>
    /// Audit and batch execution log for bulk customer entries and imports.
    /// </summary>
    public class CustomerImportBatch
    {
        [Key]
        public long BatchID { get; set; }

        [Required]
        [MaxLength(50)]
        public string BatchNumber { get; set; } = string.Empty;

        [MaxLength(255)]
        public string FileName { get; set; } = "DirectGridEntry";

        [MaxLength(20)]
        public string InputMode { get; set; } = "DirectGrid"; // 'DirectGrid' or 'Excel'

        public int InstitutionID { get; set; } = 1;

        public int HomeBranchID { get; set; } = 1;

        public int TotalRecords { get; set; } = 0;

        public int ValidRecords { get; set; } = 0;

        public int InvalidRecords { get; set; } = 0;

        public int ImportedRecords { get; set; } = 0;

        public int MergedRecords { get; set; } = 0;

        public int SkippedRecords { get; set; } = 0;

        [MaxLength(30)]
        public string Status { get; set; } = "Completed"; // 'Draft', 'PendingApproval', 'Completed', 'RolledBack'

        public int MakerUserID { get; set; } = 1;

        [MaxLength(100)]
        public string MakerUsername { get; set; } = "System";

        public DateTime SubmittedOn { get; set; } = DateTime.UtcNow;

        public int? CheckerUserID { get; set; }

        [MaxLength(100)]
        public string? CheckerUsername { get; set; }

        public DateTime? ApprovedOn { get; set; }

        [MaxLength(20)]
        public string? StartCif { get; set; }

        [MaxLength(20)]
        public string? EndCif { get; set; }

        public long ExecutionTimeMs { get; set; } = 0;

        public int? RolledBackBy { get; set; }

        [MaxLength(100)]
        public string? RolledBackUsername { get; set; }

        public DateTime? RolledBackOn { get; set; }

        [MaxLength(500)]
        public string? RollbackReason { get; set; }

        public string? SummaryJson { get; set; }

        public string? ErrorLogJson { get; set; }

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}
