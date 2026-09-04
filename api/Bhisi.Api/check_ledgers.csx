using System;
using System.Linq;
using Bhisi.Api.Data;
using Microsoft.EntityFrameworkCore;

var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(@"Server=.\SQLEXPRESS01;Database=SmartBanking;Trusted_Connection=True;MultipleActiveResultSets=true;Encrypt=False").Options;
using var db = new AppDbContext(options);

Console.WriteLine("Imported Ledgers:");
var ledgers = db.Ledgers.Where(l => l.LegacyLedgerId != null).Take(20).Select(l => l.LedgerName).ToList();
foreach(var l in ledgers) {
    Console.WriteLine(l);
}
