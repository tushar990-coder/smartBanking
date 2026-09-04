using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

try {
    var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
    optionsBuilder.UseSqlite("Data Source=Bhisi.db");
    using var db = new ApplicationDbContext(optionsBuilder.Options);

    Console.WriteLine("--- LEDGERS ---");
    var ledgers = db.Ledgers.Where(l => l.LedgerName.Contains("ठेव") || l.LedgerName.Contains("शेअर्स") || l.LedgerName.Contains("Share") || l.LedgerName.Contains("Deposit")).ToList();
    foreach(var l in ledgers) {
        Console.WriteLine($"LedgerID: {l.LedgerID}, Name: {l.LedgerName}, Type: {l.AccountType}, Group: {l.GroupID}");
    }

    Console.WriteLine("--- SAVING ACCOUNTS MATCHING LEDGERS ---");
    var ledgerIds = ledgers.Select(l => l.LedgerID).ToList();
    var savingAccs = db.SavingAccountMasters.Where(s => ledgerIds.Contains(s.LedgerID)).ToList();
    foreach(var s in savingAccs) {
        Console.WriteLine($"SavingID: {s.AccountId}, LedgerID: {s.LedgerID}, Balance: {s.Balance}");
    }
}
catch (Exception ex) {
    Console.WriteLine(ex.ToString());
}
