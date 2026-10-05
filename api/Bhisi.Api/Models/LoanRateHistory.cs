using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanRateHistory
    {
        [Key]
        public int HistoryID { get; set; }

        [Required]
        public int LoanRateID { get; set; }

        [ForeignKey("LoanRateID")]
        public LoanRate? LoanRate { get; set; }

        [Column(TypeName = "decimal(18, 2)")]
        public decimal OldInterestRate { get; set; } // पूर्वीचा नियमित व्याजदर

        [Column(TypeName = "decimal(18, 2)")]
        public decimal NewInterestRate { get; set; } // सुधारित नियमित व्याजदर

        [Column(TypeName = "decimal(18, 2)")]
        public decimal OldOverdueInterestRate { get; set; } // पूर्वीचा थकीत/दंड व्याजदर

        [Column(TypeName = "decimal(18, 2)")]
        public decimal NewOverdueInterestRate { get; set; } // सुधारित थकीत/दंड व्याजदर

        [StringLength(100)]
        public string ResolutionNo { get; set; } = string.Empty; // संचालक मंडळ ठराव क्र.

        public DateTime? ResolutionDate { get; set; } // ठराव दिनांक

        public DateTime EffectiveDate { get; set; } = DateTime.Today; // अंमलबजावणी लागू दिनांक

        [StringLength(500)]
        public string? Reason { get; set; } // बदल करण्याचे कारण / परिपत्रक / शेरा

        public int ChangedByUserID { get; set; } = 1;

        [StringLength(100)]
        public string ChangedByUsername { get; set; } = "System";

        public DateTime ChangedAt { get; set; } = DateTime.Now;

        [StringLength(50)]
        public string? IPAddress { get; set; }
    }
}
