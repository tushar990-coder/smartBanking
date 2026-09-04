using System;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class FinancialYear
    {
        [Key]
        public int FinancialYearID { get; set; }
        
        [Required]
        [StringLength(50)]
        public required string YearCode { get; set; } // e.g., "2024-2025"
        
        [Required]
        public DateTime StartDate { get; set; }
        
        [Required]
        public DateTime EndDate { get; set; }
        
        [Required]
        public bool IsActive { get; set; } = false;
        
        [Required]
        public bool IsClosed { get; set; } = false;
    }
}
