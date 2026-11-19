using System;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Services
{
    public class BusinessDateGuardService : IBusinessDateGuardService
    {
        private readonly AppDbContext _context;

        public BusinessDateGuardService(AppDbContext context)
        {
            _context = context;
        }

        public DateTime GetIstToday()
        {
            return ToIstDate(DateTime.UtcNow);
        }

        public DateTime ToIstDate(DateTime dateTime)
        {
            if (dateTime.Kind == DateTimeKind.Unspecified)
            {
                return dateTime.Date;
            }

            DateTime utc = dateTime.Kind == DateTimeKind.Utc ? dateTime : dateTime.ToUniversalTime();
            try
            {
                var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(utc, istZone).Date;
            }
            catch
            {
                return utc.AddHours(5.5).Date;
            }
        }

        public async Task<(DateTime ActiveOpenDate, DateTime? LastClosedDate)> GetBranchBusinessDateAsync(int branchId)
        {
            var lastClosed = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == branchId && b.IsDayClosed && b.BusinessDate.Year >= 2000)
                .OrderByDescending(b => b.BusinessDate)
                .Select(b => (DateTime?)b.BusinessDate.Date)
                .FirstOrDefaultAsync();

            var oldestUnclosed = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == branchId && !b.IsDayClosed && b.BusinessDate.Year >= 2000 &&
                            (!lastClosed.HasValue || b.BusinessDate.Date > lastClosed.Value))
                .OrderBy(b => b.BusinessDate)
                .Select(b => (DateTime?)b.BusinessDate.Date)
                .FirstOrDefaultAsync();

            if (oldestUnclosed.HasValue)
            {
                return (oldestUnclosed.Value, lastClosed);
            }

            if (lastClosed.HasValue)
            {
                return (lastClosed.Value.AddDays(1), lastClosed);
            }

            var activeFy = await _context.FinancialYears.AsNoTracking().FirstOrDefaultAsync(f => f.IsActive);
            var fallbackDate = GetIstToday();
            if (activeFy != null && fallbackDate < activeFy.StartDate.Date)
            {
                fallbackDate = activeFy.StartDate.Date;
            }

            return (fallbackDate, null);
        }

        public async Task<bool> IsDateClosedAsync(int branchId, DateTime date)
        {
            var targetDate = date.Date;
            var lastClosed = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == branchId && b.IsDayClosed && b.BusinessDate.Year >= 2000)
                .OrderByDescending(b => b.BusinessDate)
                .Select(b => (DateTime?)b.BusinessDate.Date)
                .FirstOrDefaultAsync();

            if (lastClosed.HasValue && targetDate <= lastClosed.Value)
            {
                return true;
            }

            return await _context.BranchDayEndStatuses
                .AsNoTracking()
                .AnyAsync(b => b.BranchID == branchId && b.BusinessDate.Date == targetDate && b.IsDayClosed);
        }

        public async Task<CollectionDateValidationResult> ValidateCollectionDateAsync(int branchId, DateTime? requestedDate, bool isOfflineSync)
        {
            var (activeOpenDate, lastClosedDate) = await GetBranchBusinessDateAsync(branchId);
            DateTime effectiveDate = requestedDate.HasValue && requestedDate.Value.Year >= 2000
                ? requestedDate.Value
                : activeOpenDate;

            bool isClosed = (lastClosedDate.HasValue && effectiveDate.Date <= lastClosedDate.Value) ||
                            await _context.BranchDayEndStatuses.AsNoTracking().AnyAsync(b =>
                                b.BranchID == branchId && b.BusinessDate.Date == effectiveDate.Date && b.IsDayClosed);

            if (!isOfflineSync && isClosed)
            {
                return new CollectionDateValidationResult
                {
                    IsAllowed = false,
                    EffectiveCollectionDate = effectiveDate,
                    ActiveOpenBusinessDate = activeOpenDate,
                    IsPostEodOfflineSync = false,
                    ErrorMessage = $"दिनांक {effectiveDate:dd/MM/yyyy} चा दिवस Day-End ने बंद करण्यात आला आहे. बंद तारखेवर ऑनलाईन वसुली घेता येणार नाही."
                };
            }

            // For offline sync, preserve the original CollectionDate as requested by business rules,
            // while marking IsPostEodOfflineSync so GL Voucher posting occurs on branch cash remittance (DepositDate).
            return new CollectionDateValidationResult
            {
                IsAllowed = true,
                EffectiveCollectionDate = effectiveDate,
                ActiveOpenBusinessDate = activeOpenDate,
                IsPostEodOfflineSync = isOfflineSync && isClosed
            };
        }
    }
}
