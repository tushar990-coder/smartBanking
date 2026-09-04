using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api {
    public class TestRunner3 {
        public static void Run() {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite("Data Source=app.db")
                .Options;

            using var ctx = new AppDbContext(options);

            var disbursements = ctx.LoanDisbursements.Include(d => d.Voucher).ThenInclude(v => v.VoucherDetails).OrderByDescending(d => d.DisbursementDate).Take(5).ToList();
            
            Console.WriteLine("Recent Disbursements:");
            foreach (var d in disbursements) {
                Console.WriteLine($"DisbursementID: {d.LoanDisbursementID}, Date: {d.DisbursementDate}, Amount: {d.DisbursementAmount}");
                if (d.Voucher != null) {
                    Console.WriteLine($"  VoucherID: {d.Voucher.VoucherID}, Date: {d.Voucher.VoucherDate}, BranchID: {d.Voucher.BranchID}");
                    foreach (var vd in d.Voucher.VoucherDetails) {
                        Console.WriteLine($"    VD ID: {vd.VoucherDetailID}, LedgerID: {vd.LedgerID}, DrCr: {vd.DrCr}, Amount: {vd.Amount}, MemberID: {vd.MemberID}");
                    }
                } else {
                    Console.WriteLine("  VOUCHER IS NULL!");
                }
            }
        }
    }
}
