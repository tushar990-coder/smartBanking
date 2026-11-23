using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SansthaExternalLocker
    {
        [Key]
        public int ExternalLockerID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        public int? InstitutionID { get; set; }

        [ForeignKey("InstitutionID")]
        public virtual InvestmentInstitution? Institution { get; set; }

        [Required]
        [StringLength(150)]
        public string BankOrSocietyName { get; set; } = string.Empty;

        [StringLength(100)]
        public string? BankBranchName { get; set; }

        [Required]
        [StringLength(50)]
        public string LockerNo { get; set; } = string.Empty;

        [StringLength(50)]
        public string? CabinetOrBoxNo { get; set; }

        [StringLength(50)]
        public string? KeyNo { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AnnualRentAmount { get; set; } = 0m;

        public DateTime? AgreementStartDate { get; set; }
        public DateTime? AgreementExpiryDate { get; set; }

        [StringLength(200)]
        public string? AuthorizedSignatories { get; set; }

        [StringLength(300)]
        public string? Remarks { get; set; }

        public bool IsActive { get; set; } = true;
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
