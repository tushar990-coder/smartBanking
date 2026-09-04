using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class InvestmentInstitution
    {
        [Key]
        public int InstitutionID { get; set; }

        [Required]
        public int InstitutionMasterID { get; set; } = 1; // Tenant ID

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(150)]
        public string InstitutionName { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string InstitutionType { get; set; } = "Bank"; // Bank, Cooperative, Government, MutualFund, Bond

        [StringLength(100)]
        public string InstitutionBranchName { get; set; } = string.Empty;

        [StringLength(250)]
        public string? Address { get; set; }

        [StringLength(100)]
        public string? ContactPerson { get; set; }

        [StringLength(15)]
        public string? MobileNumber { get; set; }

        [StringLength(100)]
        public string? EmailID { get; set; }

        public bool IsActive { get; set; } = true;

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}
