using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Sec101HearingLog
    {
        [Key]
        public int HearingId { get; set; }

        [Required]
        public int CaseId { get; set; }

        [ForeignKey("CaseId")]
        public virtual Sec101CaseMaster? Case { get; set; }

        [Required]
        public DateTime HearingDate { get; set; } = DateTime.Today;

        public DateTime? NextHearingDate { get; set; }

        [Required]
        [StringLength(100)]
        public string Stage { get; set; } = "समन्स / नोटीस पूर्तता"; 
        // समन्स, लेखी जबाब (WS), युक्तिवाद (Arguments), साक्षीदार तपासणी, अंतरिम आदेश, अंतिम वसुली दाखला आदेश

        [StringLength(20)]
        public string BorrowerPresence { get; set; } = "ABSENT"; // PRESENT, ABSENT, REPRESENTED_BY_ADVOCATE

        [StringLength(20)]
        public string GuarantorPresence { get; set; } = "ABSENT"; // PRESENT, ABSENT, REPRESENTED_BY_ADVOCATE

        public string? CourtOrderSummary { get; set; }

        public string? AdvocateNotes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int CreatedBy { get; set; } = 1;
    }
}
