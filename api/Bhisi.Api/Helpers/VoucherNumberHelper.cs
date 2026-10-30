using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Centralized collision-safe VoucherNo generator that inspects both persisted Vouchers
    /// and tracked in-flight Vouchers (.Local) so deleted vouchers or concurrent multi-voucher
    /// transactions never produce duplicate VoucherNo values.
    /// </summary>
    public static class VoucherNumberHelper
    {
        public static async Task<int> NextSequenceAsync(AppDbContext context, string prefix, int padWidth = 5)
        {
            if (context == null) throw new ArgumentNullException(nameof(context));
            prefix ??= string.Empty;

            var dbNos = await context.Vouchers
                .AsNoTracking()
                .Where(v => v.VoucherNo != null && v.VoucherNo.StartsWith(prefix))
                .Select(v => v.VoucherNo!)
                .ToListAsync();

            var localNos = context.Vouchers.Local
                .Where(v => v.VoucherNo != null && v.VoucherNo.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                .Select(v => v.VoucherNo!);

            var existingSet = new HashSet<string>(dbNos, StringComparer.OrdinalIgnoreCase);
            foreach (var localNo in localNos)
            {
                existingSet.Add(localNo);
            }

            int maxSeq = 0;
            foreach (var vNo in existingSet)
            {
                if (vNo.Length <= prefix.Length) continue;
                string suffix = vNo.Substring(prefix.Length).Trim();
                // Strip any trailing revision suffix after '-' if present (e.g., 00012-R1)
                int dashIdx = suffix.IndexOf('-');
                string numericPart = dashIdx > 0 ? suffix.Substring(0, dashIdx) : suffix;
                if (int.TryParse(numericPart, out int parsed) && parsed > maxSeq)
                {
                    maxSeq = parsed;
                }
            }

            int nextSeq = Math.Max(existingSet.Count, maxSeq) + 1;
            string format = $"D{Math.Max(1, padWidth)}";
            while (existingSet.Contains($"{prefix}{nextSeq.ToString(format)}"))
            {
                nextSeq++;
            }

            return nextSeq;
        }

        public static async Task<string> NextVoucherNoAsync(AppDbContext context, string prefix, int padWidth = 5)
        {
            int seq = await NextSequenceAsync(context, prefix, padWidth);
            string format = $"D{Math.Max(1, padWidth)}";
            return $"{prefix}{seq.ToString(format)}";
        }
    }
}

