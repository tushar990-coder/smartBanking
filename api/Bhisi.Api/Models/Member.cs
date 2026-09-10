using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace Bhisi.Api.Models
{
    /// <summary>
    /// Normalized Member entity - stores only membership-specific data.
    /// All demographic/KYC/nominee/guardian info is stored in the linked Customer record
    /// and exposed here via [NotMapped] computed shim properties for backward compatibility.
    /// </summary>
    public class Member
    {
        // ═══════════════════════════════════════════════════════════
        // ██  DB-MAPPED COLUMNS (Membership-Specific Only)  ██
        // ═══════════════════════════════════════════════════════════

        [Key]
        public int MemberID { get; set; }

        public int? CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        [ValidateNever]
        public virtual Customer? Customer { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        [ValidateNever]
        public virtual Branch? Branch { get; set; }

        [MaxLength(20)]
        public string? MemberCode { get; set; }

        // Membership Info
        public DateTime JoiningDate { get; set; } = DateTime.Today;

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        [MaxLength(30)]
        public string MembershipType { get; set; } = "Regular"; // Regular, Associate, Nominal, Sympathizer (MCS Act Sec 24)

        // Legacy Mapping Field for Migration
        [MaxLength(50)]
        public string? LegacyMemberNo { get; set; }

        // Soft Delete
        public bool IsDeleted { get; set; } = false;

        // Audit Fields
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
        public int? UpdatedBy { get; set; }
        public DateTime? UpdatedOn { get; set; }

        // ═══════════════════════════════════════════════════════════
        // ██  LEGACY [NotMapped] SHIM PROPERTIES  ██
        // ██  (Delegate to Customer navigation for backward compat) ██
        // ═══════════════════════════════════════════════════════════

        // --- Admission Fee & Payment Mode (For Instant Day Book Voucher Generation) ---
        [NotMapped]
        public decimal? AdmissionFee { get; set; } = 0;

        [NotMapped]
        public decimal? BuildingFund { get; set; } = 0;

        [NotMapped]
        public string? PaymentMode { get; set; } = "Cash";

        [NotMapped]
        public int? SavingAccountId { get; set; }

        [NotMapped]
        public string? GeneratedVoucherNo { get; set; }

        // --- Direct Share Allotment Shims (For Integrated Application Form) ---
        [NotMapped]
        public int? NumberOfShares { get; set; } = 0;

        [NotMapped]
        public decimal? ShareFaceValue { get; set; } = 100M;

        [NotMapped]
        public DateTime? AllotmentDate { get; set; }

        // --- Legacy Migration Shims ---
        [NotMapped]
        public string? OldMemberCode
        {
            get => LegacyMemberNo;
            set { if (!string.IsNullOrWhiteSpace(value)) LegacyMemberNo = value; }
        }

        [NotMapped]
        public int? LegacyMemberId
        {
            get => int.TryParse(LegacyMemberNo, out int id) ? id : null;
            set { if (value.HasValue) LegacyMemberNo = value.Value.ToString(); }
        }

        private Customer EnsureCustomer()
        {
            if (Customer == null)
            {
                Customer = new Customer
                {
                    CustomerID = CustomerID.HasValue && CustomerID.Value > 0 ? CustomerID.Value : 0,
                    BranchID = BranchID > 0 ? BranchID : 1,
                    Status = "Active"
                };
            }
            return Customer;
        }

        // --- CIF & KYC Shims (read/write via Customer) ---
        [NotMapped]
        public string? CIFNo
        {
            get => Customer?.CIFNo;
            set => EnsureCustomer().CIFNo = value ?? string.Empty;
        }

        [NotMapped]
        public string? FirstName
        {
            get => Customer?.FirstName ?? string.Empty;
            set => EnsureCustomer().FirstName = value ?? string.Empty;
        }

        [NotMapped]
        public string? MiddleName
        {
            get => Customer?.MiddleName;
            set => EnsureCustomer().MiddleName = value;
        }

        [NotMapped]
        public string? LastName
        {
            get => Customer?.LastName ?? string.Empty;
            set => EnsureCustomer().LastName = value ?? string.Empty;
        }

        [NotMapped]
        public string? NickName
        {
            get => Customer?.NickName;
            set => EnsureCustomer().NickName = value;
        }

        // --- English Name Shims ---
        [NotMapped]
        public string? FirstNameEng
        {
            get => Customer?.FirstNameEng;
            set => EnsureCustomer().FirstNameEng = value;
        }

        [NotMapped]
        public string? MiddleNameEng
        {
            get => Customer?.MiddleNameEng;
            set => EnsureCustomer().MiddleNameEng = value;
        }

        [NotMapped]
        public string? LastNameEng
        {
            get => Customer?.LastNameEng;
            set => EnsureCustomer().LastNameEng = value;
        }

        // --- Address Shims ---
        [NotMapped]
        public string? Address
        {
            get => Customer?.Address;
            set => EnsureCustomer().Address = value;
        }

        [NotMapped]
        public string? AddressEng
        {
            get => Customer?.AddressEng;
            set => EnsureCustomer().AddressEng = value;
        }

        [NotMapped]
        public string? Village
        {
            get => Customer?.Village;
            set => EnsureCustomer().Village = value;
        }

        [NotMapped]
        public string? Taluka
        {
            get => Customer?.Taluka;
            set => EnsureCustomer().Taluka = value;
        }

        [NotMapped]
        public string? District
        {
            get => Customer?.District;
            set => EnsureCustomer().District = value;
        }

        // --- Contact & KYC Shims ---
        [NotMapped]
        public string? MobileNo
        {
            get => Customer?.MobileNo;
            set => EnsureCustomer().MobileNo = value;
        }

        [NotMapped]
        public string? AadhaarNo
        {
            get => Customer?.AadhaarNo;
            set => EnsureCustomer().AadhaarNo = value;
        }

        [NotMapped]
        public string? PANNo
        {
            get => Customer?.PANNo;
            set => EnsureCustomer().PANNo = value;
        }

        // --- Nominee Shims ---
        [NotMapped]
        public string? NomineeName
        {
            get => Customer?.NomineeName;
            set => EnsureCustomer().NomineeName = value;
        }

        [NotMapped]
        public string? NomineeNameEng
        {
            get => Customer?.NomineeNameEng;
            set => EnsureCustomer().NomineeNameEng = value;
        }

        [NotMapped]
        public string? NomineeRelation
        {
            get => Customer?.NomineeRelation;
            set => EnsureCustomer().NomineeRelation = value;
        }

        [NotMapped]
        public string? NomineeAddress
        {
            get => Customer?.NomineeAddress;
            set => EnsureCustomer().NomineeAddress = value;
        }

        [NotMapped]
        public DateTime? NomineeBirthDate
        {
            get => Customer?.NomineeBirthDate;
            set => EnsureCustomer().NomineeBirthDate = value;
        }

        [NotMapped]
        public bool NomineeIsMinor
        {
            get => Customer?.NomineeIsMinor ?? false;
            set => EnsureCustomer().NomineeIsMinor = value;
        }

        [NotMapped]
        public string? NomineeGuardianName
        {
            get => Customer?.NomineeGuardianName;
            set => EnsureCustomer().NomineeGuardianName = value;
        }

        // --- Document Path Shims ---
        [NotMapped]
        public string? PhotoPath
        {
            get => Customer?.PhotoPath;
            set => EnsureCustomer().PhotoPath = value;
        }

        [NotMapped]
        public string? SignaturePath
        {
            get => Customer?.SignaturePath;
            set => EnsureCustomer().SignaturePath = value;
        }

        [NotMapped]
        public string? AadhaarDocPath
        {
            get => Customer?.AadhaarDocPath;
            set => EnsureCustomer().AadhaarDocPath = value;
        }

        [NotMapped]
        public string? PanDocPath
        {
            get => Customer?.PanDocPath;
            set => EnsureCustomer().PanDocPath = value;
        }

        // --- Personal Info Shims ---
        [NotMapped]
        public string? Gender
        {
            get => Customer?.Gender;
            set => EnsureCustomer().Gender = value;
        }

        [NotMapped]
        public DateTime? BirthDate
        {
            get => Customer?.BirthDate;
            set => EnsureCustomer().BirthDate = value;
        }

        [NotMapped]
        public string? Occupation
        {
            get => Customer?.Occupation;
            set => EnsureCustomer().Occupation = value;
        }

        [NotMapped]
        public string? CasteCategory
        {
            get => Customer?.CasteCategory;
            set => EnsureCustomer().CasteCategory = value;
        }

        [NotMapped]
        public string? Caste
        {
            get => Customer?.Caste;
            set => EnsureCustomer().Caste = value;
        }

        [NotMapped]
        public string? Email
        {
            get => Customer?.Email;
            set => EnsureCustomer().Email = value;
        }

        // --- Minor & Guardian Shims ---
        [NotMapped]
        public bool IsMinor
        {
            get => Customer?.IsMinor ?? false;
            set => EnsureCustomer().IsMinor = value;
        }

        [NotMapped]
        public string? GuardianName
        {
            get => Customer?.GuardianName;
            set => EnsureCustomer().GuardianName = value;
        }

        [NotMapped]
        public string? GuardianNameEng
        {
            get => Customer?.GuardianNameEng;
            set => EnsureCustomer().GuardianNameEng = value;
        }

        [NotMapped]
        public string? GuardianRelation
        {
            get => Customer?.GuardianRelation;
            set => EnsureCustomer().GuardianRelation = value;
        }

        [NotMapped]
        public string? GuardianAadhaarNo
        {
            get => Customer?.GuardianAadhaarNo;
            set => EnsureCustomer().GuardianAadhaarNo = value;
        }

        [NotMapped]
        public string? GuardianMobileNo
        {
            get => Customer?.GuardianMobileNo;
            set => EnsureCustomer().GuardianMobileNo = value;
        }

        [NotMapped]
        public string? GuardianAddress
        {
            get => Customer?.GuardianAddress;
            set => EnsureCustomer().GuardianAddress = value;
        }

        // --- Employer Shim ---
        [NotMapped]
        public int? EmployerId
        {
            get => Customer?.EmployerId;
            set => EnsureCustomer().EmployerId = value;
        }

        [NotMapped]
        public virtual EmployerMaster? Employer
        {
            get => Customer?.Employer;
            set { if (value != null) EnsureCustomer().Employer = value; }
        }
    }
}
