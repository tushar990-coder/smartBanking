using System;
using System.Threading.Tasks;
using Bhisi.Api.Data;

namespace Bhisi.Api.Helpers
{
    public static class ApprovalPolicyHelper
    {
        public static Task<(string Status, int? ApprovedBy, DateTime? ApprovedOn)> DetermineVoucherStatusAsync(AppDbContext context, decimal totalAmount, int? createdByUserId = 1)
        {
            // Strict 100% Maker-Checker policy: every live transactional voucher requires explicit Checker/Manager passing.
            return Task.FromResult<(string Status, int? ApprovedBy, DateTime? ApprovedOn)>(("Pending", null, null));
        }
    }
}
