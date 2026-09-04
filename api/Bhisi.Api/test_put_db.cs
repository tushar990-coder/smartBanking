using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Controllers;

namespace Bhisi.Api {
    public class TestPutDb {
        public static async Task Run() {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite("Data Source=app.db")
                .Options;

            using var ctx = new AppDbContext(options);
            var controller = new LoanDisbursementsController(ctx);
            
            var existing = await ctx.LoanDisbursements
                .Include(d => d.Voucher).ThenInclude(v => v.VoucherDetails)
                .OrderByDescending(d => d.LoanDisbursementID)
                .FirstOrDefaultAsync();
                
            if (existing == null) {
                Console.WriteLine("No disbursements found.");
                return;
            }
            
            Console.WriteLine($"Found Disbursement {existing.LoanDisbursementID}");
            Console.WriteLine($"VoucherDetails count: {existing.Voucher?.VoucherDetails?.Count}");
            
            // Clone properties manually to simulate API PUT payload
            var payload = new LoanDisbursement {
                LoanDisbursementID = existing.LoanDisbursementID,
                LoanAccountID = existing.LoanAccountID,
                DisbursementDate = existing.DisbursementDate,
                DisbursementAmount = existing.DisbursementAmount + 100, // Make a change
                SanctionedAmount = existing.SanctionedAmount,
                NetAmountPaid = existing.NetAmountPaid + 100,
                PaymentMode = existing.PaymentMode,
                BankAccountLedgerID = existing.BankAccountLedgerID,
                Deductions = existing.Deductions?.Select(d => new LoanDisbursementDeduction {
                    LedgerID = d.LedgerID,
                    Amount = d.Amount
                }).ToList()
            };
            
            try {
                var result = await controller.PutLoanDisbursement(payload.LoanDisbursementID, payload);
                Console.WriteLine($"PutResult: {result.GetType().Name}");
                
                // Now check DB again
                using var ctx2 = new AppDbContext(options);
                var after = await ctx2.LoanDisbursements
                    .Include(d => d.Voucher).ThenInclude(v => v.VoucherDetails)
                    .FirstOrDefaultAsync(d => d.LoanDisbursementID == payload.LoanDisbursementID);
                    
                Console.WriteLine($"After VoucherDetails count: {after.Voucher?.VoucherDetails?.Count}");
                foreach(var vd in after.Voucher?.VoucherDetails ?? new System.Collections.Generic.List<VoucherDetail>()) {
                    Console.WriteLine($"  VD LedgerID: {vd.LedgerID}, Amount: {vd.Amount}, DrCr: {vd.DrCr}");
                }
            } catch (Exception ex) {
                Console.WriteLine($"EXCEPTION: {ex.Message}");
                if (ex.InnerException != null) Console.WriteLine($"INNER: {ex.InnerException.Message}");
            }
        }
    }
}
