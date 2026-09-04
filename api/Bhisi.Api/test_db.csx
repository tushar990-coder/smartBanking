using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=d:\\Bhisi Software\\api\\Bhisi.Api\\bhisi.db").Options;
using var context = new AppDbContext(options);

var v = context.Vouchers.Include(v => v.VoucherDetails).FirstOrDefault(v => v.VoucherID == 46);
if (v == null) {
    Console.WriteLine("Voucher 46 NOT FOUND");
} else {
    Console.WriteLine($"Voucher 46 found, details count: {v.VoucherDetails.Count}");
}
