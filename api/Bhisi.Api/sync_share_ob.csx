using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
optionsBuilder.UseSqlite("Data Source=bhisi.db");
using var db = new AppDbContext(optionsBuilder.Options);

var shareLedger = db.Ledgers.FirstOrDefault(l => l.LedgerName.Contains("भाग भांडवल") || l.LedgerName.Contains("Share Capital") || l.LedgerName.Contains("Share"));
if (shareLedger == null)
{
    Console.WriteLine("Share Capital Ledger not found.");
    return;
}
Console.WriteLine($"Found Share Ledger: {shareLedger.LedgerName} (ID: {shareLedger.LedgerID})");

var shareAccounts = db.ShareAccounts.Where(s => s.TotalShareCount > 0).ToList();
Console.WriteLine($"Found {shareAccounts.Count} Share Accounts with balances.");

int addedCount = 0;
foreach(var sa in shareAccounts)
{
    var existingOb = db.MemberOpeningBalances.FirstOrDefault(m => m.MemberID == sa.MemberId && m.LedgerID == shareLedger.LedgerID);
    if (existingOb == null)
    {
        var ob = new MemberOpeningBalance
        {
            MemberID = sa.MemberId,
            LedgerID = shareLedger.LedgerID,
            OpeningDate = sa.OpeningDate,
            Amount = sa.TotalShareAmount,
            BalanceType = "Cr", // Share capital is Liability (Cr)
            Narration = "Share Opening Balance (Auto Synced)"
        };
        db.MemberOpeningBalances.Add(ob);
        addedCount++;
    }
}
db.SaveChanges();
Console.WriteLine($"Added {addedCount} new Member Opening Balances for Shares.");

// Now update Ledger Opening Balance total
var totalObDr = db.MemberOpeningBalances.Where(m => m.LedgerID == shareLedger.LedgerID && m.BalanceType == "Dr").Sum(m => m.Amount);
var totalObCr = db.MemberOpeningBalances.Where(m => m.LedgerID == shareLedger.LedgerID && m.BalanceType == "Cr").Sum(m => m.Amount);

shareLedger.OpeningBalance = Math.Abs(totalObDr - totalObCr);
shareLedger.OpeningType = totalObDr > totalObCr ? "Dr" : "Cr";
db.SaveChanges();

Console.WriteLine("Ledger updated. Sync complete.");
