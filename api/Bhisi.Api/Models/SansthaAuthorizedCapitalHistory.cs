using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SansthaAuthorizedCapitalHistory
    {
        [Key]
        public int HistoryID { get; set; }

        public int SansthaID { get; set; } = 1;

        [Required]
        public DateTime EffectiveDate { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal AuthorizedCapitalAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ShareFaceValue { get; set; } = 100.00m;

        public int AuthorizedShareCount { get; set; } = 0;

        [StringLength(100)]
        public string? ResolutionNo { get; set; }

        [StringLength(100)]
        public string? RegistrarApprovalNo { get; set; }

        [StringLength(500)]
        public string? Remarks { get; set; }

        public int CreatedBy { get; set; } = 1;

        public DateTime CreatedDate { get; set; } = DateTime.Now;
    }
}
