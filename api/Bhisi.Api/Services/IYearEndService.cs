using System;
using System.Threading.Tasks;

namespace Bhisi.Api.Services
{
    public interface IYearEndService
    {
        Task<bool> CloseFinancialYearAsync(int branchId, int closedByUserId);
        Task<object> GetYearEndStatusAsync(int branchId);
    }
}
