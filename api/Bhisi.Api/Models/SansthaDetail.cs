using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class SansthaDetail
    {
        [Key]
        public int SansthaID { get; set; }

        [Required]
        [StringLength(200)]
        public required string SansthaName { get; set; }

        [StringLength(500)]
        public string? Address { get; set; }

        [StringLength(100)]
        public string? Village { get; set; }

        [StringLength(100)]
        public string? Taluka { get; set; }

        [StringLength(100)]
        public string? District { get; set; }

        [StringLength(100)]
        public string? State { get; set; }

        [StringLength(20)]
        public string? PinCode { get; set; }

        [StringLength(20)]
        public string? ContactNo { get; set; }

        [StringLength(100)]
        public string? Email { get; set; }

        [StringLength(50)]
        public string? RegistrationNo { get; set; }

        public DateTime? RegistrationDate { get; set; }

        [StringLength(50)]
        public string? GSTNo { get; set; }

        [StringLength(500)]
        public string? LogoPath { get; set; }

        public bool IsMigrationLocked { get; set; } = false;

        public bool AutoPostVouchers { get; set; } = true;

        public decimal AutoPostVoucherLimit { get; set; } = 50000m;

        public bool IsMobileCompulsory { get; set; } = true; // मोबाईल नंबर अनिवार्य

        public bool IsAadhaarCompulsory { get; set; } = true; // आधार कार्ड नंबर अनिवार्य

        public bool IsPanCompulsory { get; set; } = false; // पॅन कार्ड नंबर अनिवार्य
    }
}

