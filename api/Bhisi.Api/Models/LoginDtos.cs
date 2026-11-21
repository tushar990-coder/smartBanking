using System.ComponentModel.DataAnnotations;

namespace Bhisi.Api.Models
{
    public class LoginRequestDto
    {
        [Required]
        public string Username { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;

        public int BranchID { get; set; }

        public int FinancialYearID { get; set; }

        public DateTime? BusinessDate { get; set; }

        public string? LoginAs { get; set; } // Optional: "CUSTOMER" | "AGENT" | "STAFF"
    }

    public class LoginResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int BranchID { get; set; }
        public int? DefaultBranchID { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public int FinancialYearID { get; set; }
        public string FinancialYearCode { get; set; } = string.Empty;
        public string BusinessDate { get; set; } = string.Empty;
        public bool RequirePasswordChange { get; set; }
        public int? AgentId { get; set; }
        public int? CustomerId { get; set; }
        public string? CifNo { get; set; }
        public string? MobileNo { get; set; }
    }

    public class CustomerTempActivatePinDto
    {
        [Required]
        public string MobileNo { get; set; } = string.Empty;

        [Required]
        public string CifNo { get; set; } = string.Empty;

        [Required]
        [MinLength(4)]
        [MaxLength(12)]
        public string NewPin { get; set; } = string.Empty;
    }

    public class AdminSetCustomerPinDto
    {
        [Required]
        [MinLength(4)]
        [MaxLength(12)]
        public string Pin { get; set; } = string.Empty;
    }

    public class ChangePasswordDto
    {
        [Required]
        public string Username { get; set; } = string.Empty;

        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        public string NewPassword { get; set; } = string.Empty;

        [Required]
        public string ConfirmPassword { get; set; } = string.Empty;
    }

    public class SwitchBranchRequestDto
    {
        [Required]
        public int TargetBranchID { get; set; }
    }

    public class SwitchBranchResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public int BranchID { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public string BusinessDate { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}


