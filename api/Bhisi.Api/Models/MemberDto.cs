using System;
using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class MemberResponseDto
    {
        public int MemberID { get; set; }
        public int? CustomerID { get; set; }
        public int BranchID { get; set; }
        public string? MemberCode { get; set; }
        public DateTime JoiningDate { get; set; }
        public string Status { get; set; } = "Active";
        public string MembershipType { get; set; } = "Regular";
        public string? LegacyMemberNo { get; set; }
        public bool IsDeleted { get; set; }

        // Demographic properties sourced from linked Customer
        public string CIFNo { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string MiddleName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string NickName { get; set; } = string.Empty;
        public string FirstNameEng { get; set; } = string.Empty;
        public string MiddleNameEng { get; set; } = string.Empty;
        public string LastNameEng { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string AddressEng { get; set; } = string.Empty;
        public string Village { get; set; } = string.Empty;
        public string Taluka { get; set; } = string.Empty;
        public string District { get; set; } = string.Empty;
        public string MobileNo { get; set; } = string.Empty;
        public string AadhaarNo { get; set; } = string.Empty;
        public string PANNo { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Gender { get; set; } = string.Empty;
        public DateTime? BirthDate { get; set; }
        public string Occupation { get; set; } = string.Empty;
        public string CasteCategory { get; set; } = string.Empty;
        public string Caste { get; set; } = string.Empty;
        public bool IsMinor { get; set; }
        public string GuardianName { get; set; } = string.Empty;
        public string GuardianNameEng { get; set; } = string.Empty;
        public string GuardianRelation { get; set; } = string.Empty;
        public string GuardianAadhaarNo { get; set; } = string.Empty;
        public string GuardianMobileNo { get; set; } = string.Empty;
        public string GuardianAddress { get; set; } = string.Empty;
        public string NomineeName { get; set; } = string.Empty;
        public string NomineeNameEng { get; set; } = string.Empty;
        public string NomineeRelation { get; set; } = string.Empty;
        public string NomineeAddress { get; set; } = string.Empty;
        public DateTime? NomineeBirthDate { get; set; }
        public bool NomineeIsMinor { get; set; }
        public string NomineeGuardianName { get; set; } = string.Empty;
        public string PhotoPath { get; set; } = string.Empty;
        public string SignaturePath { get; set; } = string.Empty;
        public string AadhaarDocPath { get; set; } = string.Empty;
        public string PanDocPath { get; set; } = string.Empty;
        public int? EmployerId { get; set; }

        public virtual Customer? Customer { get; set; }
        public virtual Branch? Branch { get; set; }

        public static MemberResponseDto FromMember(Member m)
        {
            var cust = m.Customer;
            return new MemberResponseDto
            {
                MemberID = m.MemberID,
                CustomerID = m.CustomerID,
                BranchID = m.BranchID,
                MemberCode = m.MemberCode ?? string.Empty,
                JoiningDate = m.JoiningDate,
                Status = m.Status ?? "Active",
                MembershipType = m.MembershipType ?? "Regular",
                LegacyMemberNo = m.LegacyMemberNo ?? string.Empty,
                IsDeleted = m.IsDeleted,

                CIFNo = cust?.CIFNo ?? string.Empty,
                FirstName = cust?.FirstName ?? string.Empty,
                MiddleName = cust?.MiddleName ?? string.Empty,
                LastName = cust?.LastName ?? string.Empty,
                FullName = cust != null ? $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Replace("  ", " ").Trim() : string.Empty,
                NickName = cust?.NickName ?? string.Empty,
                FirstNameEng = cust?.FirstNameEng ?? string.Empty,
                MiddleNameEng = cust?.MiddleNameEng ?? string.Empty,
                LastNameEng = cust?.LastNameEng ?? string.Empty,
                Address = cust?.Address ?? string.Empty,
                AddressEng = cust?.AddressEng ?? string.Empty,
                Village = cust?.Village ?? string.Empty,
                Taluka = cust?.Taluka ?? string.Empty,
                District = cust?.District ?? string.Empty,
                MobileNo = cust?.MobileNo ?? string.Empty,
                AadhaarNo = cust?.AadhaarNo ?? string.Empty,
                PANNo = cust?.PANNo ?? string.Empty,
                Email = cust?.Email ?? string.Empty,
                Gender = cust?.Gender ?? string.Empty,
                BirthDate = cust?.BirthDate,
                Occupation = cust?.Occupation ?? string.Empty,
                CasteCategory = cust?.CasteCategory ?? string.Empty,
                Caste = cust?.Caste ?? string.Empty,
                IsMinor = cust?.IsMinor ?? false,
                GuardianName = cust?.GuardianName ?? string.Empty,
                GuardianNameEng = cust?.GuardianNameEng ?? string.Empty,
                GuardianRelation = cust?.GuardianRelation ?? string.Empty,
                GuardianAadhaarNo = cust?.GuardianAadhaarNo ?? string.Empty,
                GuardianMobileNo = cust?.GuardianMobileNo ?? string.Empty,
                GuardianAddress = cust?.GuardianAddress ?? string.Empty,
                NomineeName = cust?.NomineeName ?? string.Empty,
                NomineeNameEng = cust?.NomineeNameEng ?? string.Empty,
                NomineeRelation = cust?.NomineeRelation ?? string.Empty,
                NomineeAddress = cust?.NomineeAddress ?? string.Empty,
                NomineeBirthDate = cust?.NomineeBirthDate,
                NomineeIsMinor = cust?.NomineeIsMinor ?? false,
                NomineeGuardianName = cust?.NomineeGuardianName ?? string.Empty,
                PhotoPath = cust?.PhotoPath ?? string.Empty,
                SignaturePath = cust?.SignaturePath ?? string.Empty,
                AadhaarDocPath = cust?.AadhaarDocPath ?? string.Empty,
                PanDocPath = cust?.PanDocPath ?? string.Empty,
                EmployerId = cust?.EmployerId,

                Customer = m.Customer,
                Branch = m.Branch
            };
        }
    }

    public class MemberRequestDto
    {
        public int MemberID { get; set; }
        public int? CustomerID { get; set; }
        public int BranchID { get; set; } = 1;
        public string? MemberCode { get; set; }
        public DateTime JoiningDate { get; set; } = DateTime.Today;
        public string Status { get; set; } = "Active";
        public string MembershipType { get; set; } = "Regular";
        public string? LegacyMemberNo { get; set; }
        public bool IsDeleted { get; set; }

        // Customer / Demographic fields
        public string? CIFNo { get; set; }
        public string? FirstName { get; set; }
        public string? MiddleName { get; set; }
        public string? LastName { get; set; }
        public string? NickName { get; set; }
        public string? FirstNameEng { get; set; }
        public string? MiddleNameEng { get; set; }
        public string? LastNameEng { get; set; }
        public string? Address { get; set; }
        public string? AddressEng { get; set; }
        public string? Village { get; set; }
        public string? Taluka { get; set; }
        public string? District { get; set; }
        public string? MobileNo { get; set; }
        public string? AadhaarNo { get; set; }
        public string? PANNo { get; set; }
        public string? Email { get; set; }
        public string? Gender { get; set; }
        public DateTime? BirthDate { get; set; }
        public string? Occupation { get; set; }
        public string? CasteCategory { get; set; }
        public string? Caste { get; set; }
        public bool IsMinor { get; set; }
        public string? GuardianName { get; set; }
        public string? GuardianNameEng { get; set; }
        public string? GuardianRelation { get; set; }
        public string? GuardianAadhaarNo { get; set; }
        public string? GuardianMobileNo { get; set; }
        public string? GuardianAddress { get; set; }
        public string? NomineeName { get; set; }
        public string? NomineeNameEng { get; set; }
        public string? NomineeRelation { get; set; }
        public string? NomineeAddress { get; set; }
        public DateTime? NomineeBirthDate { get; set; }
        public bool NomineeIsMinor { get; set; }
        public string? NomineeGuardianName { get; set; }
        public string? PhotoPath { get; set; }
        public string? SignaturePath { get; set; }
        public string? AadhaarDocPath { get; set; }
        public string? PanDocPath { get; set; }
        public int? EmployerId { get; set; }

        // Share & Payment transient fields
        public int? NumberOfShares { get; set; }
        public decimal? ShareFaceValue { get; set; }
        public decimal? AdmissionFee { get; set; }
        public decimal? BuildingFund { get; set; }
        public DateTime? AllotmentDate { get; set; }
        public string? PaymentMode { get; set; }
        public int? SavingAccountId { get; set; }
        public string? GeneratedVoucherNo { get; set; }
    }
}
