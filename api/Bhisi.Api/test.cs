using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api {
    public class TestRunner {
        public static void Run() {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite("Data Source=app.db")
                .Options;

            using var ctx = new AppDbContext(options);

            var countBefore = ctx.LoanDisbursements.Count();
            Console.WriteLine($"Disbursements before: {countBefore}");

            var existing = ctx.LoanDisbursements.Include(d => d.Voucher).ThenInclude(v => v.VoucherDetails).Include(d => d.Deductions).OrderByDescending(d => d.LoanDisbursementID).FirstOrDefault();
            if (existing != null)
            {
                Console.WriteLine($"Editing ID: {existing.LoanDisbursementID}");
                if (existing.Voucher != null) {
                    ctx.VoucherDetails.RemoveRange(existing.Voucher.VoucherDetails);
                    ctx.SaveChanges();
                    Console.WriteLine("Removed old voucher details.");
                    
                    // Add new ones
                    ctx.VoucherDetails.Add(new VoucherDetail { VoucherID = existing.Voucher.VoucherID, LedgerID = 1, DrCr = "Dr", Amount = 100 });
                    ctx.SaveChanges();
                    Console.WriteLine("Added new voucher details.");
                }
            }

            var countAfter = ctx.LoanDisbursements.Count();
            Console.WriteLine($"Disbursements after: {countAfter}");
        }
    }
}
