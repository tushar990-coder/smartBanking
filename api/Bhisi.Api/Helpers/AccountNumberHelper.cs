using System;
using System.Linq;

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
    }
}
