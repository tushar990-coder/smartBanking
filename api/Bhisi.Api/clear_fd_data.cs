using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;

namespace Bhisi.Api
{
    public class ClearFdDataScript
    {
        public static async Task Main(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
            // Try SQL Server first
            string connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true";
            
            try
            {
                optionsBuilder.UseSqlServer(connStr);
                using var ctx = new AppDbContext(optionsBuilder.Options);

                Console.WriteLine("Clearing FD Module data...");

                // 1. Delete FD Transactions
                var txs = await ctx.FdTransactions.ToListAsync();
                if (txs.Any())
                {
                    ctx.FdTransactions.RemoveRange(txs);
                    Console.WriteLine($"Removed {txs.Count} FD Transactions.");
                }

                // 2. Delete FD Interest Accruals
                var accruals = await ctx.FdInterestAccruals.ToListAsync();
                if (accruals.Any())
                {
                    ctx.FdInterestAccruals.RemoveRange(accruals);
                    Console.WriteLine($"Removed {accruals.Count} FD Accruals.");
                }

                // 3. Delete FD Vouchers
                var fdVouchers = await ctx.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => v.VoucherNo.StartsWith("JV-FD-"))
                    .ToListAsync();

                foreach (var v in fdVouchers)
                {
                    if (v.VoucherDetails != null && v.VoucherDetails.Any())
                    {
                        ctx.VoucherDetails.RemoveRange(v.VoucherDetails);
                    }
                }
                if (fdVouchers.Any())
                {
                    ctx.Vouchers.RemoveRange(fdVouchers);
                    Console.WriteLine($"Removed {fdVouchers.Count} FD Vouchers.");
                }

                // 4. Delete FD Accounts
                var accounts = await ctx.FdAccounts.ToListAsync();
                if (accounts.Any())
                {
                    ctx.FdAccounts.RemoveRange(accounts);
                    Console.WriteLine($"Removed {accounts.Count} FD Accounts.");
                }

                // 5. Reset FD Sequences
                var seqs = await ctx.FdAccountSequences.Where(s => s.ProductType == "FD").ToListAsync();
                foreach (var s in seqs)
                {
                    s.CurrentValue = 0;
                }
                Console.WriteLine("Reset FD Account Sequences to 0.");

                // 6. Clean corrupt null FD Schemes if any
                var corruptSchemes = await ctx.FdSchemes
                    .Where(s => string.IsNullOrEmpty(s.SchemeCode) || string.IsNullOrEmpty(s.SchemeName))
                    .ToListAsync();
                if (corruptSchemes.Any())
                {
                    ctx.FdSchemes.RemoveRange(corruptSchemes);
                    Console.WriteLine($"Removed {corruptSchemes.Count} corrupted FD Schemes.");
                }

                await ctx.SaveChangesAsync();
                Console.WriteLine("✅ FD Data Cleared Successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine("ERROR using SQL Server: " + ex.Message);
                // Fallback to SQLite app.db if SQL Server is not running
                try
                {
                    var sqliteOptions = new DbContextOptionsBuilder<AppDbContext>()
                        .UseSqlite("Data Source=app.db")
                        .Options;

                    using var ctxSqlite = new AppDbContext(sqliteOptions);
                    var txs = await ctxSqlite.FdTransactions.ToListAsync();
                    ctxSqlite.FdTransactions.RemoveRange(txs);
                    var accounts = await ctxSqlite.FdAccounts.ToListAsync();
                    ctxSqlite.FdAccounts.RemoveRange(accounts);
                    await ctxSqlite.SaveChangesAsync();
                    Console.WriteLine("✅ FD Data Cleared Successfully on SQLite!");
                }
                catch (Exception ex2)
                {
                    Console.WriteLine("ERROR using SQLite: " + ex2.Message);
                }
            }
        }
    }
}
