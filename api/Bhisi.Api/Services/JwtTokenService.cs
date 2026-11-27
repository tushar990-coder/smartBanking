using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Bhisi.Api.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Bhisi.Api.Services
{
    public class JwtTokenService : IJwtTokenService
    {
        private readonly IConfiguration _configuration;

        public JwtTokenService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private const string FallbackSigningKey = "BhisiSoftware-SecureMasterKey-2026-ShriUpdated-MinLength32Chars!";

        public string GetSigningKey()
        {
            var configuredKey = _configuration["Jwt:Key"] ?? Environment.GetEnvironmentVariable("Jwt__Key");
            if (string.IsNullOrWhiteSpace(configuredKey) || configuredKey.Length < 32)
            {
                Console.WriteLine("[CRITICAL WARNING] Jwt:Key is missing or shorter than 32 characters in appsettings.json. Falling back to default signing key to prevent startup outage; please configure a unique 32+ char Jwt:Key.");
                return FallbackSigningKey;
            }
            return configuredKey;
        }

        private int GetExpireDays()
        {
            if (int.TryParse(_configuration["Jwt:ExpireDays"], out int days) && days > 0)
            {
                return Math.Min(days, 7);
            }
            return 1;
        }

        public string CreateStaffToken(User user, int branchId, int financialYearId, DateTime businessDate)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(GetSigningKey());
            string canonicalRole = Bhisi.Api.Helpers.UserContextExtensions.NormalizeRoleClaim(user.Role?.RoleName);
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.Role, canonicalRole),
                    new Claim("BranchID", branchId.ToString()),
                    new Claim("DefaultBranchID", (user.DefaultBranchID ?? branchId).ToString()),
                    new Claim("FinancialYearID", financialYearId.ToString()),
                    new Claim("BusinessDate", businessDate.ToString("yyyy-MM-dd"))
                }),
                Expires = DateTime.UtcNow.AddDays(GetExpireDays()),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        public string CreateAgentToken(PigmyAgent agent, int branchId, int financialYearId, DateTime businessDate)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(GetSigningKey());
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, agent.PigmyAgentID.ToString()),
                    new Claim(ClaimTypes.Name, agent.AgentName),
                    new Claim(ClaimTypes.Role, "AGENT"),
                    new Claim("agentId", agent.PigmyAgentID.ToString()),
                    new Claim("AgentId", agent.PigmyAgentID.ToString()),
                    new Claim("MobileNo", agent.Customer?.MobileNo ?? string.Empty),
                    new Claim("BranchID", branchId.ToString()),
                    new Claim("DefaultBranchID", branchId.ToString()),
                    new Claim("FinancialYearID", financialYearId.ToString()),
                    new Claim("BusinessDate", businessDate.ToString("yyyy-MM-dd"))
                }),
                Expires = DateTime.UtcNow.AddDays(GetExpireDays()),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        public string CreateCustomerToken(Customer customer, int branchId, int financialYearId, DateTime businessDate)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(GetSigningKey());
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, customer.CustomerID.ToString()),
                    new Claim(ClaimTypes.Name, customer.FullName),
                    new Claim(ClaimTypes.Role, "CUSTOMER"),
                    new Claim("CustomerId", customer.CustomerID.ToString()),
                    new Claim("CIFNo", customer.CIFNo ?? string.Empty),
                    new Claim("MobileNo", customer.MobileNo ?? string.Empty),
                    new Claim("BranchID", branchId.ToString()),
                    new Claim("DefaultBranchID", branchId.ToString()),
                    new Claim("FinancialYearID", financialYearId.ToString()),
                    new Claim("BusinessDate", businessDate.ToString("yyyy-MM-dd"))
                }),
                Expires = DateTime.UtcNow.AddDays(GetExpireDays()),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}
