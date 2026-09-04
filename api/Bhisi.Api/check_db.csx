using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;

var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
optionsBuilder.UseSqlite("Data Source=bhisi.db");
using var db = new AppDbContext(optionsBuilder.Options);

var disbs = db.LoanDisbursements.Include(d => d.LoanAccount).ThenInclude(l => l.Member).Include(d => d.Voucher).OrderByDescending(d => d.LoanDisbursementID).Take(5).ToList();
foreach(var d in disbs) {
    Console.WriteLine($"DisbID: {d.LoanDisbursementID}, Name: {d.LoanAccount?.Member?.FirstName} {d.LoanAccount?.Member?.LastName}, DisbDate: {d.DisbursementDate:yyyy-MM-dd HH:mm:ss}, VouchDate: {d.Voucher?.VoucherDate:yyyy-MM-dd HH:mm:ss}");
}
