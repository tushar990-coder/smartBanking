using System;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public interface IJwtTokenService
    {
        string GetSigningKey();
        string CreateStaffToken(User user, int branchId, int financialYearId, DateTime businessDate);
        string CreateAgentToken(PigmyAgent agent, int branchId, int financialYearId, DateTime businessDate);
    }
}
