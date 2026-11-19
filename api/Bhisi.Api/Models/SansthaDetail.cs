using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

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

        public bool AutoPostVouchers { get; set; } = false;

        public decimal AutoPostVoucherLimit { get; set; } = 0m;

        public bool IsMobileCompulsory { get; set; } = true; // मोबाईल नंबर अनिवार्य

        public bool IsAadhaarCompulsory { get; set; } = true; // आधार कार्ड नंबर अनिवार्य

        public bool IsPanCompulsory { get; set; } = false; // पॅन कार्ड नंबर अनिवार्य

        // मुदत ठेव नूतनीकरण पावती क्रमांक धोरण: "NEW_RECEIPT" | "RETAIN_ORIGINAL" | "NEXT_LEGACY" | "HYBRID_CHOICE"
        [StringLength(30)]
        public string FdRenewalReceiptPolicy { get; set; } = "NEW_RECEIPT";

        // नूतनीकरणावेळी कस्टम / प्री-प्रिंटेड पावती क्र. टाकण्याची मुभा
        public bool AllowManualReceiptNoOnRenewal { get; set; } = false;

        // अधिकृत भागभांडवल (Authorised Share Capital — Statutory Memo Ceiling, Non-Accounting)
        [Column(TypeName = "decimal(18,2)")]
        public decimal AuthorizedShareCapital { get; set; } = 0m;

        // एका शेअरचे दर्शनी मूल्य (Share Face Value)
        [Column(TypeName = "decimal(18,2)")]
        public decimal ShareFaceValue { get; set; } = 100.00m;

        // एकूण अधिकृत शेअर्स संख्या (AuthorizedShareCapital / ShareFaceValue)
        public int AuthorizedShareCount { get; set; } = 0;
    }
}

