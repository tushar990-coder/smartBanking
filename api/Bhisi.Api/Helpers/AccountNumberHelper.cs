using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    public static class AccountNumberHelper
    {
        public static int CalculateCheckDigit(string digits)
        {
            if (string.IsNullOrWhiteSpace(digits)) return 0;
            int sum = 0;
            bool alternate = true;
            for (int i = digits.Length - 1; i >= 0; i--)
            {
                if (!char.IsDigit(digits[i])) continue;
                int d = digits[i] - '0';
                if (alternate)
                {
                    d *= 2;
                    if (d > 9) d -= 9;
                }
                sum += d;
                alternate = !alternate;
            }
            int mod = sum % 10;
            return (mod == 0) ? 0 : 10 - mod;
        }

        public static bool ValidateAccountNo(string fullAccountNo)
        {
            if (string.IsNullOrWhiteSpace(fullAccountNo)) return false;
            var digitsOnly = new string(fullAccountNo.Where(char.IsDigit).ToArray());
            if (digitsOnly.Length != 14) return false;
            string prefix13 = digitsOnly.Substring(0, 13);
            int expectedCheck = CalculateCheckDigit(prefix13);
            return (digitsOnly[13] - '0') == expectedCheck;
        }

        public static string Format14Digit(string? accountNo)
        {
            if (string.IsNullOrWhiteSpace(accountNo)) return "-";
            var d = new string(accountNo.Where(char.IsDigit).ToArray());
            if (d.Length == 14)
            {
                return $"{d.Substring(0, 3)}-{d.Substring(3, 3)}-{d.Substring(6, 7)}-{d.Substring(13, 1)}";
            }
            return accountNo;
        }

        public static string Generate14DigitAccountNo(int branchId, int schemeCodeNum, int sequenceNumber)
        {
            string branch3 = Math.Max(1, branchId).ToString("D3");
            string scheme3 = Math.Max(1, schemeCodeNum).ToString("D3");
            string seq7 = Math.Max(1, sequenceNumber).ToString("D7");
            string thirteen = $"{branch3}{scheme3}{seq7}";
            int checkDigit = CalculateCheckDigit(thirteen);
            return $"{thirteen}{checkDigit}";
        }

        // Standardized Pure CBS 9-character Unique CIF Generator: CIF + 6 sequential digits (e.g. CIF000001)
        public static async Task<string> GenerateUniqueCifAsync(AppDbContext context)
        {
            try
            {
                var maxCustomerId = await context.Customers
                    .AsNoTracking()
                    .MaxAsync(c => (int?)c.CustomerID) ?? 0;

                var allCifsInDb = await context.Customers
                    .AsNoTracking()
                    .Where(c => c.CIFNo != null && c.CIFNo != "")
                    .Select(c => c.CIFNo!)
                    .ToListAsync();

                int maxNumericCif = 0;
                foreach (var cif in allCifsInDb)
                {
                    if (cif.StartsWith("CIF", StringComparison.OrdinalIgnoreCase))
                    {
                        var digits = new string(cif.Where(char.IsDigit).ToArray());
                        if (int.TryParse(digits, out int parsed) && parsed > maxNumericCif)
                        {
                            maxNumericCif = parsed;
                        }
                    }
                }

                int candidateNum = Math.Max(maxCustomerId, maxNumericCif) + 1;
                if (candidateNum < 1) candidateNum = 1;
                string candidateCif = $"CIF{candidateNum:D6}";

                var cifSet = new HashSet<string>(allCifsInDb, StringComparer.OrdinalIgnoreCase);
                while (cifSet.Contains(candidateCif))
                {
                    candidateNum++;
                    candidateCif = $"CIF{candidateNum:D6}";
                }

                return candidateCif;
            }
            catch
            {
                return $"CIF{DateTime.Now.Ticks % 1000000:D6}";
            }
        }

        // CBS Standard 14-digit Pigmy Account Generator: [3-digit Branch] + [3-digit Scheme (301, 302...)] + [7-digit Sequence] + [1-digit Checksum]
        public static async Task<string> GenerateNextPigmyAccountNo(AppDbContext context, int branchId, int? schemeId = null, bool incrementSequence = false)
        {
            var branch = await context.Branches.FindAsync(branchId);
            
            // 1. Branch Code: 3 numeric digits (e.g. 001, 002)
            string branchCode3 = branchId.ToString("D3");
            if (branch != null && !string.IsNullOrWhiteSpace(branch.BranchCode))
            {
                var digitsOnly = new string(branch.BranchCode.Where(char.IsDigit).ToArray());
                if (!string.IsNullOrEmpty(digitsOnly) && int.TryParse(digitsOnly, out int parsed) && parsed > 0)
                {
                    branchCode3 = parsed.ToString("D3");
                }
            }

            // 2. Scheme Code: 3 numeric digits (e.g. 301, 302)
            int schemeCodeNum = 301;
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                var scheme = await context.PigmySchemes.FindAsync(schemeId.Value);
                if (scheme != null && !string.IsNullOrWhiteSpace(scheme.SchemeCode))
                {
                    var sDigits = new string(scheme.SchemeCode.Where(char.IsDigit).ToArray());
                    if (!string.IsNullOrEmpty(sDigits) && int.TryParse(sDigits, out int parsedScheme) && parsedScheme > 0)
                    {
                        schemeCodeNum = parsedScheme;
                    }
                }
            }
            string schemeCode3 = schemeCodeNum.ToString("D3");

            // 3. Scan existing PigmyAccounts in this branch for collision prevention and max sequence derivation
            var existingPigmyAccs = await context.PigmyAccounts
                .Where(p => p.BranchID == branchId && p.AccountNo != null)
                .Select(p => p.AccountNo!)
                .ToListAsync();

            var existingSet = new HashSet<string>(existingPigmyAccs, StringComparer.OrdinalIgnoreCase);

            int maxSeq = 0;
            foreach (var accNo in existingPigmyAccs)
            {
                var d = new string(accNo.Where(char.IsDigit).ToArray());
                if (d.Length == 14)
                {
                    string seqPart = d.Substring(6, 7);
                    if (int.TryParse(seqPart, out int sVal) && sVal > maxSeq)
                    {
                        maxSeq = sVal;
                    }
                }
            }

            // 4. Sequence: Atomic sequence per (BranchID, SchemeCodeNumeric)
            var seq = await context.PigmyAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && s.SchemeCodeNumeric == schemeCodeNum);

            if (seq == null)
            {
                seq = new PigmyAccountSequence
                {
                    BranchID = branchId,
                    SchemeCodeNumeric = schemeCodeNum,
                    LastSequenceNumber = maxSeq,
                    UpdatedOn = DateTime.UtcNow
                };
                context.PigmyAccountSequences.Add(seq);
                await context.SaveChangesAsync();
            }
            else if (maxSeq > seq.LastSequenceNumber)
            {
                seq.LastSequenceNumber = maxSeq;
                seq.UpdatedOn = DateTime.UtcNow;
                await context.SaveChangesAsync();
            }

            int nextSeqNumber = seq.LastSequenceNumber + 1;
            string thirteenDigits = $"{branchCode3}{schemeCode3}{nextSeqNumber:D7}";
            int checkDigit = CalculateCheckDigit(thirteenDigits);
            string candidate = $"{thirteenDigits}{checkDigit}";

            while (existingSet.Contains(candidate))
            {
                nextSeqNumber++;
                thirteenDigits = $"{branchCode3}{schemeCode3}{nextSeqNumber:D7}";
                checkDigit = CalculateCheckDigit(thirteenDigits);
                candidate = $"{thirteenDigits}{checkDigit}";
            }

            if (incrementSequence)
            {
                seq.LastSequenceNumber = nextSeqNumber;
                seq.UpdatedOn = DateTime.UtcNow;
                await context.SaveChangesAsync();
            }

            return candidate;
        }
    }
}
