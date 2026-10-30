using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Centralized CBS Double-Entry Guardrail ensuring every accounting voucher
    /// satisfies TotalDebit == TotalCredit and TotalDebit > 0 before transaction commit.
    /// </summary>
    public static class VoucherBalanceHelper
    {
        public static (bool IsBalanced, decimal TotalDebit, decimal TotalCredit, string? ErrorMessage) ValidateDetails(
            IEnumerable<VoucherDetail>? details,
            string? voucherNo = null)
        {
            if (details == null)
            {
                return (false, 0m, 0m, $"व्हाउचर {(string.IsNullOrWhiteSpace(voucherNo) ? "" : $"({voucherNo}) ")}मध्ये कोणतीही डेबिट/क्रेडिट (Dr/Cr) नोंद नाही.");
            }

            var list = details.ToList();
            if (list.Count == 0)
            {
                return (false, 0m, 0m, $"व्हाउचर {(string.IsNullOrWhiteSpace(voucherNo) ? "" : $"({voucherNo}) ")}मध्ये कोणतीही डेबिट/क्रेडिट (Dr/Cr) ओळ तयार झालेली नाही.");
            }

            var invalidLedgerLine = list.FirstOrDefault(d => d.LedgerID <= 0 && d.Amount > 0);
            if (invalidLedgerLine != null)
            {
                return (false, 0m, 0m, $"व्हाउचर {(string.IsNullOrWhiteSpace(voucherNo) ? "" : $"({voucherNo}) ")}मधील रकमेसाठी (₹{invalidLedgerLine.Amount:N2}) वैध जी.एल. लेजर (Ledger Mapping) सापडले नाही.");
            }

            decimal totalDr = Math.Round(
                list.Where(d => string.Equals(d.DrCr, "Dr", StringComparison.OrdinalIgnoreCase)).Sum(d => d.Amount),
                2,
                MidpointRounding.AwayFromZero);

            decimal totalCr = Math.Round(
                list.Where(d => string.Equals(d.DrCr, "Cr", StringComparison.OrdinalIgnoreCase)).Sum(d => d.Amount),
                2,
                MidpointRounding.AwayFromZero);

            if (totalDr <= 0m || totalCr <= 0m)
            {
                return (false, totalDr, totalCr, $"अवैध शून्य किंवा एकतर्फी व्हाउचर {(string.IsNullOrWhiteSpace(voucherNo) ? "" : $"({voucherNo})")}: एकूण नावे (Dr) = ₹{totalDr:N2}, एकूण जमा (Cr) = ₹{totalCr:N2}. कृपया संबंधित योजनेचे लेजर मॅपिंग तपासा.");
            }

            if (Math.Abs(totalDr - totalCr) > 0.01m)
            {
                return (false, totalDr, totalCr, $"असंतुलित व्हाउचर {(string.IsNullOrWhiteSpace(voucherNo) ? "" : $"({voucherNo})")} रोखले गेले: एकूण नावे (Dr) = ₹{totalDr:N2} आणि एकूण जमा (Cr) = ₹{totalCr:N2} जुळत नाहीत (फरक: ₹{Math.Abs(totalDr - totalCr):N2}). कृपया सर्व शुल्क/व्याज/दंड लेजर मॅपिंग तपासा.");
            }

            return (true, totalDr, totalCr, null);
        }

        public static void EnsureBalanced(Voucher voucher)
        {
            if (voucher == null)
                throw new ArgumentNullException(nameof(voucher));

            var check = ValidateDetails(voucher.VoucherDetails, voucher.VoucherNo);
            if (!check.IsBalanced)
            {
                throw new InvalidOperationException(check.ErrorMessage);
            }
        }

        public static async Task EnsureBalancedInContextAsync(AppDbContext context, int voucherId, string? voucherNo = null)
        {
            if (context == null) throw new ArgumentNullException(nameof(context));
            if (voucherId <= 0)
            {
                throw new InvalidOperationException("व्हाउचर क्रमांक/आयडी तयार झालेला नाही (VoucherID <= 0).");
            }

            // Combine persisted details and any unsaved tracked details in ChangeTracker
            var persisted = await context.VoucherDetails
                .AsNoTracking()
                .Where(vd => vd.VoucherID == voucherId)
                .ToListAsync();

            var localAdded = context.ChangeTracker.Entries<VoucherDetail>()
                .Where(e => e.State == EntityState.Added && e.Entity.VoucherID == voucherId)
                .Select(e => e.Entity)
                .ToList();

            var combined = new List<VoucherDetail>(persisted);
            foreach (var item in localAdded)
            {
                if (item.VoucherDetailID == 0 || !persisted.Any(p => p.VoucherDetailID == item.VoucherDetailID))
                {
                    combined.Add(item);
                }
            }

            var check = ValidateDetails(combined, voucherNo);
            if (!check.IsBalanced)
            {
                throw new InvalidOperationException(check.ErrorMessage);
            }
        }
    }
}

