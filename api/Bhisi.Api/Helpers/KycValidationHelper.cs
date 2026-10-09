using System.Text.RegularExpressions;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Statutory KYC Validation and Aadhaar/PAN Security Utility
    /// Compliant with UIDAI Aadhaar Regulations 2016 and Income Tax PAN Format Rules
    /// </summary>
    public static class KycValidationHelper
    {
        // Multiplication Table (d)
        private static readonly int[,] D = {
            { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 },
            { 1, 2, 3, 4, 0, 6, 7, 8, 9, 5 },
            { 2, 3, 4, 0, 1, 7, 8, 9, 5, 6 },
            { 3, 4, 0, 1, 2, 8, 9, 5, 6, 7 },
            { 4, 0, 1, 2, 3, 9, 5, 6, 7, 8 },
            { 5, 9, 8, 7, 6, 0, 4, 3, 2, 1 },
            { 6, 5, 9, 8, 7, 1, 0, 4, 3, 2 },
            { 7, 6, 5, 9, 8, 2, 1, 0, 4, 3 },
            { 8, 7, 6, 5, 9, 3, 2, 1, 0, 4 },
            { 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 }
        };

        // Permutation Table (p)
        private static readonly int[,] P = {
            { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 },
            { 1, 5, 7, 6, 2, 8, 3, 0, 9, 4 },
            { 5, 8, 0, 3, 7, 9, 6, 1, 4, 2 },
            { 8, 9, 1, 6, 0, 4, 3, 5, 2, 7 },
            { 9, 4, 5, 3, 1, 2, 6, 8, 7, 0 },
            { 4, 2, 8, 6, 5, 7, 3, 9, 0, 1 },
            { 2, 7, 9, 3, 8, 0, 6, 4, 1, 5 },
            { 7, 0, 4, 6, 9, 1, 3, 2, 5, 8 }
        };

        private static readonly Regex PanRegex = new Regex("^[A-Z]{5}[0-9]{4}[A-Z]$", RegexOptions.Compiled);
        private static readonly char[] ValidPanEntityTypes = { 'P', 'C', 'H', 'A', 'B', 'T', 'F', 'G', 'J', 'L' };

        /// <summary>
        /// Validates number string against Verhoeff checksum algorithm used by UIDAI
        /// </summary>
        public static bool ValidateVerhoeff(string numStr)
        {
            if (string.IsNullOrWhiteSpace(numStr)) return false;
            var clean = numStr.Trim().Replace(" ", "").Replace("-", "");
            if (!clean.All(char.IsDigit)) return false;

            int c = 0;
            var inverted = clean.Reverse().Select(ch => ch - '0').ToArray();

            for (int i = 0; i < inverted.Length; i++)
            {
                c = D[c, P[i % 8, inverted[i]]];
            }

            return c == 0;
        }

        /// <summary>
        /// Validates 12-digit Indian Aadhaar Number
        /// </summary>
        public static bool IsValidAadhaar(string? aadhaar, out string? error)
        {
            error = null;
            if (string.IsNullOrWhiteSpace(aadhaar))
            {
                error = "आधार क्रमांक आवश्यक आहे.";
                return false;
            }

            var clean = aadhaar.Trim().Replace(" ", "").Replace("-", "");

            if (clean.Length != 12)
            {
                error = $"आधार क्रमांक १२ अंकांचा असावा (सध्या {clean.Length} अंक).";
                return false;
            }

            if (!clean.All(char.IsDigit))
            {
                error = "आधार क्रमांकामध्ये केवळ अंक असावेत.";
                return false;
            }

            if (clean.StartsWith("0") || clean.StartsWith("1"))
            {
                error = "UIDAI नियमांनुसार आधार क्रमांक ० किंवा १ ने सुरू होत नाही.";
                return false;
            }

            // Check all identical digits (e.g. 222222222222)
            if (clean.Distinct().Count() == 1)
            {
                error = "अवैध आधार क्रमांक (सर्व आकडे समान असू शकत नाहीत).";
                return false;
            }

            if (!ValidateVerhoeff(clean))
            {
                error = "आधार क्रमांक अमान्य आहे (Verhoeff चेकसम जुळत नाही, टायपिंग तपासा).";
                return false;
            }

            return true;
        }

        /// <summary>
        /// Validates 10-character Indian PAN number
        /// </summary>
        public static bool IsValidPan(string? pan, out string? error)
        {
            error = null;
            if (string.IsNullOrWhiteSpace(pan))
            {
                error = "पॅन क्रमांक आवश्यक आहे.";
                return false;
            }

            var clean = pan.Trim().ToUpperInvariant();

            if (clean.Length != 10)
            {
                error = $"पॅन क्रमांक १० अक्षरी असावा (सध्या {clean.Length} अक्षरे).";
                return false;
            }

            if (!PanRegex.IsMatch(clean))
            {
                error = "पॅन फॉरमॅट चुकीचा आहे (उदा. ABCDE1234F).";
                return false;
            }

            char fourthChar = clean[3];
            if (!ValidPanEntityTypes.Contains(fourthChar))
            {
                error = "पॅन कार्ड मधील चौथे अक्षर वैध खातेदार प्रकार दर्शवत नाही.";
                return false;
            }

            return true;
        }

        /// <summary>
        /// Masks 12-digit Aadhaar number for statutory privacy compliance (UIDAI Aadhaar Act Sec 29)
        /// Returns "XXXX-XXXX-1234"
        /// </summary>
        public static string MaskAadhaar(string? aadhaar)
        {
            if (string.IsNullOrWhiteSpace(aadhaar)) return "-";
            var clean = aadhaar.Trim().Replace(" ", "").Replace("-", "");
            if (clean.Length == 12)
            {
                return $"XXXX-XXXX-{clean.Substring(8)}";
            }
            if (clean.Length > 4)
            {
                return new string('X', clean.Length - 4) + clean.Substring(clean.Length - 4);
            }
            return clean;
        }
    }
}
