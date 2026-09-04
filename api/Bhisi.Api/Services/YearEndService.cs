using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public class YearEndService : IYearEndService
    {
        private readonly AppDbContext _context;

        public YearEndService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<object> GetYearEndStatusAsync(int branchId)
        {
            var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
            
            bool isReadyForClosure = activeYear != null && DateTime.Today >= activeYear.EndDate;

            return new 
            {
                CurrentFinancialYear = activeYear?.YearCode ?? "Not Set",
                IsReadyForClosure = isReadyForClosure,
                LastClosedDate = activeYear?.EndDate
            };
        }

        public async Task<bool> CloseFinancialYearAsync(int branchId, int closedByUserId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (activeYear == null) return false;

                // 1. Find Income and Expense account groups
                var incomeGroups = await _context.AccountGroups.Where(g => g.NatureOfGroup == "Income").Select(g => g.GroupID).ToListAsync();
                var expenseGroups = await _context.AccountGroups.Where(g => g.NatureOfGroup == "Expenses").Select(g => g.GroupID).ToListAsync();
                
                var incomeLedgers = await _context.Ledgers.Where(l => incomeGroups.Contains(l.GroupID)).ToListAsync();
                var expenseLedgers = await _context.Ledgers.Where(l => expenseGroups.Contains(l.GroupID)).ToListAsync();

                // 2. Deactivate and Close current year
                activeYear.IsActive = false;
                activeYear.IsClosed = true;
                _context.FinancialYears.Update(activeYear);

                // 3. Create next year
                int startYear = activeYear.EndDate.Year;
                int endYear = startYear + 1;
                var nextYear = new FinancialYear
                {
                    YearCode = $"{startYear}-{endYear}",
                    StartDate = new DateTime(startYear, 4, 1),
                    EndDate = new DateTime(endYear, 3, 31),
                    IsActive = true,
                    IsClosed = false
                };
                await _context.FinancialYears.AddAsync(nextYear);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return false;
            }
        }
    }
}
