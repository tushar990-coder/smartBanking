using System;
using System.Threading.Tasks;

namespace Bhisi.Api.Services
{
    public class CollectionDateValidationResult
    {
        public bool IsAllowed { get; set; } = true;
        public DateTime EffectiveCollectionDate { get; set; }
        public DateTime ActiveOpenBusinessDate { get; set; }
        public bool IsPostEodOfflineSync { get; set; }
        public string? ErrorMessage { get; set; }
    }

    public interface IBusinessDateGuardService
    {
        DateTime GetIstToday();
        DateTime ToIstDate(DateTime dateTime);
        Task<(DateTime ActiveOpenDate, DateTime? LastClosedDate)> GetBranchBusinessDateAsync(int branchId);
        Task<bool> IsDateClosedAsync(int branchId, DateTime date);
        Task<CollectionDateValidationResult> ValidateCollectionDateAsync(int branchId, DateTime? requestedDate, bool isOfflineSync);
    }
}
