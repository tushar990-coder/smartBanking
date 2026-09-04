using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Bhisi.Api.Helpers
{
    public static class IsmToUnicodeConverter
    {
        public static string ConvertIsmToUnicode(string ismText)
        {
            if (string.IsNullOrWhiteSpace(ismText))
                return ismText;

            string text = ismText;

            // DVBW-TTYogesh (ISM V6) to Unicode mapping based on visual character composition.
            // In ISM, half characters are often followed by 'Ö' (kana / vertical bar) to make them full.
            
            // 1. Direct replacements (Half letters & complex ligatures)
            var replacements = new Dictionary<string, string>
            {
                { "Ý", "ग्" },
                { "Þ", "ण्" },
                { "¯", "प्" },
                { "Ÿ", "त्" },
                { "¾", "व्" },
                { "¸ü", "र" },
                { "´", "म्" },
                { "Û", "क्" },
                { "Ü", "ख्" },
                { "‘", "घ्" },
                { "“", "च्" },
                { "”û", "छ" },
                { "•", "ज्" },
                { "—", "झ्" },
                { "™ü", "ट" },
                { "šü", "ठ" },
                { "›ü", "ड" },
                { "œü", "ढ" },
                { "£", "थ्" },
                { "¤ü", "द" },
                { "¬", "ध्" },
                { "®", "न्" },
                { "±", "फ्" },
                { "²", "ब्" },
                { "³", "भ्" },
                { "µ", "य्" },
                { "»", "ल्" },
                { "¿", "श्" },
                { "Â", "ष्" },
                { "Ã", "स्" },
                { "Æü", "ह" },
                { "ô", "ळ्" },
                { "õ", "क्ष्" },
                { "–", "ज्ञ्" },

                // Vowels
                { "†", "अ" },
                { "†Ö", "आ" },
                { "‡", "इ" },
                { "ˆ", "ई" },
                { "‰", "उ" },
                { "Š", "ऊ" },
                { "‹", "ए" },
                { "‹ê", "ऐ" },
                { "†Öê", "ओ" },
                { "†Öî", "औ" },
                
                // Matras
                { "Ö", "ा" }, // Kana (Vertical Bar) - also completes half letters
                { "Ï", "्र" }, // Rफार
                { "Õ", "ृ" }, // Kru
                { "ê", "े" }, // Matra 1 (e.g. के)
                { "î", "ै" }, // Matra 2 (e.g. कै)
                { "ã", "ु" }, // Ukar 1
                { "æ", "ू" }, // Ukar 2
                { "Ó", "ं" }, // Anuswar
                { "Ñ", "ँ" } // Chandrabindu
            };

            foreach (var kvp in replacements)
            {
                text = text.Replace(kvp.Key, kvp.Value);
            }

            // 2. Fix the "Half Letter + Kana (Ö)" combination making it a full letter
            // In Unicode: 'ग्' + 'ा' = 'ग' (because '्' and 'ा' cancel out in meaning of completion)
            text = text.Replace("्ा", "");

            // In ISM, ú, ü, û are often invisible completion characters used after matras to complete the visual block
            text = text.Replace("्ú", "");
            text = text.Replace("्ü", "");
            text = text.Replace("्û", "");

            // If a half-letter '्' is directly followed by a matra, remove '्' to make it a full letter
            var matras = new string[] { "ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ", "ं", "ः", "ँ" };
            foreach (var m in matras)
            {
                text = text.Replace("्" + m, m);
            }

            // Remove any leftover completion characters
            text = text.Replace("ú", "");
            text = text.Replace("ü", "");
            text = text.Replace("û", "");
            
            // Handle Reph (Ô)
            // In ISM: 'व' + 'Ô' -> visual 'र्व'
            // In Unicode: 'र्' + 'व' -> 'र्व'
            text = Regex.Replace(text, "([क-ह])Ô", "र्$1");

            // 3. Fix Velanti (इ कार)
            // In ISM, short velanti comes BEFORE the letter (e.g., '×' + 'क' for 'कि')
            // In Unicode, it comes AFTER the letter (e.g., 'क' + 'ि')
            // '×' is short velanti (ि)
            text = text.Replace("×", "ि");
            // Swap logic for short velanti: find 'ि' followed by any consonant, and swap them
            var regex = new Regex("ि([क-ह])");
            text = regex.Replace(text, "$1ि");
            
            // 'ß' is long velanti (ी)
            text = text.Replace("ß", "ी");

            // Clean up double spaces or bad characters
            text = text.Replace("Ô", "र्"); // Any leftover Reph
            text = text.Trim();

            return text;
        }
    }
}
