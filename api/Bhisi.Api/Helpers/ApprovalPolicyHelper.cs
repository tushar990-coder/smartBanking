using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;

namespace Bhisi.Api.Helpers
{
    public static class ApprovalPolicyHelper
    {
        public static async Task<(string Status, int? ApprovedBy, DateTime? ApprovedOn)> DetermineVoucherStatusAsync(AppDbContext context, decimal totalAmount, int? createdByUserId = 1)
        {
            var sanstha = await context.SansthaDetails.FirstOrDefaultAsync();
            bool autoPost = sanstha?.AutoPostVouchers ?? true;
            decimal autoPostLimit = sanstha?.AutoPostVoucherLimit ?? 50000m;

            if (autoPost && totalAmount <= autoPostLimit)
            {
                return ("Approved", createdByUserId ?? 1, DateTime.Now);
            }
            else
            {
                return ("Pending", null, null);
            }
        }
    }
}
