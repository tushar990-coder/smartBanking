using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;

var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
optionsBuilder.UseSqlite("Data Source=bhisi.db");
using var db = new AppDbContext(optionsBuilder.Options);

var targetDate = new DateTime(2026, 7, 6);

var disbs = db.LoanDisbursements
    .Include(d => d.LoanAccount).ThenInclude(l => l.Member)
    .Include(d => d.Voucher)
    .Where(d => d.LoanAccount != null && d.LoanAccount.Member != null && d.LoanAccount.Member.FirstName.ToLower().Contains("sandip") && d.LoanAccount.Member.LastName.ToLower().Contains("deshmukh"))
    .ToList();

foreach (var d in disbs)
{
    Console.WriteLine($"Found: {d.LoanAccount?.Member?.FirstName} {d.LoanAccount?.Member?.LastName}, DisbID: {d.LoanDisbursementID}");
    
    // Update Disbursement Date
    d.DisbursementDate = targetDate;
    
    // Update OpeningDate and LoanDisbursementDate in LoanAccount
    if (d.LoanAccount != null)
    {
        d.LoanAccount.OpeningDate = targetDate;
        d.LoanAccount.LoanDisbursementDate = targetDate;
    }
    
    // Update Voucher Date
    if (d.Voucher != null)
    {
        d.Voucher.VoucherDate = targetDate;
    }
}

db.SaveChanges();
Console.WriteLine("Update complete.");
