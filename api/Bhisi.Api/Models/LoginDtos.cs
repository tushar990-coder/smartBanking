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
    }

    public class LoginResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int BranchID { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public int FinancialYearID { get; set; }
        public string FinancialYearCode { get; set; } = string.Empty;
        public string BusinessDate { get; set; } = string.Empty;
        public bool RequirePasswordChange { get; set; }
        public int? AgentId { get; set; }
        public string? MobileNo { get; set; }
    }
}

