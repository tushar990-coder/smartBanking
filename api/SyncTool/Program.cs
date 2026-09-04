using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
optionsBuilder.UseSqlite(@"Data Source=D:\Bhisi Software\api\Bhisi.Api\bhisi.db");
using var _context = new AppDbContext(optionsBuilder.Options);

var shareLedger = _context.Ledgers.FirstOrDefault(l => l.LedgerName.Contains("भाग भांडवल") || l.LedgerName.Contains("Share Capital") || l.LedgerName.Contains("Share") || l.LedgerName.Contains("शेअर"));
if (shareLedger == null) {
    Console.WriteLine("Share Capital Ledger not found. Available ledgers:");
    foreach(var l in _context.Ledgers.ToList()) {
        Console.WriteLine($"{l.LedgerID} - {l.LedgerName}");
    }
    return;
}

var shareAccounts = _context.ShareAccounts.Where(s => s.TotalShareCount > 0).ToList();
int addedCount = 0;
foreach(var sa in shareAccounts)
{
    var existingOb = _context.MemberOpeningBalances.FirstOrDefault(m => m.MemberID == sa.MemberId && m.LedgerID == shareLedger.LedgerID);
    if (existingOb == null)
    {
        var ob = new MemberOpeningBalance
        {
            MemberID = sa.MemberId,
            LedgerID = shareLedger.LedgerID,
            Amount = sa.TotalShareAmount,
            BalanceType = "Cr",
            CreatedOn = DateTime.UtcNow
        };
        _context.MemberOpeningBalances.Add(ob);
        addedCount++;
    }
}
_context.SaveChanges();

var totalObDr = _context.MemberOpeningBalances.Where(m => m.LedgerID == shareLedger.LedgerID && m.BalanceType == "Dr").Sum(m => m.Amount);
var totalObCr = _context.MemberOpeningBalances.Where(m => m.LedgerID == shareLedger.LedgerID && m.BalanceType == "Cr").Sum(m => m.Amount);
shareLedger.OpeningBalance = Math.Abs(totalObDr - totalObCr);
shareLedger.OpeningBalanceType = totalObDr > totalObCr ? "Dr" : "Cr";
_context.SaveChanges();

Console.WriteLine($"Sync complete. Added {addedCount} new Member Opening Balances.");
