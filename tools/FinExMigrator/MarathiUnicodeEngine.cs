using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace FinExMigrator
{
    public static class MarathiUnicodeEngine
    {
        public static string ConvertFromRawIsm(string? rawIsmText)
        {
            if (string.IsNullOrWhiteSpace(rawIsmText)) return rawIsmText ?? "";
            string t = rawIsmText.Trim();

            // 1. Initial compound vowels in ISM
            t = t.Replace("†Öî", "औ");
            t = t.Replace("†Öê", "ओ");
            t = t.Replace("†Ö", "आ");
            t = t.Replace("‹ê", "ऐ");
            t = t.Replace("‡Ô", "ई");
            t = t.Replace("†", "अ");
            t = t.Replace("‡", "इ");
            t = t.Replace("ˆ", "ई");
            t = t.Replace("‰", "उ");
            t = t.Replace("Š", "ऊ");
            t = t.Replace("‹", "ए");

            // 2. High-priority conjuncts and multi-character patterns
            t = t.Replace("±Ìåú", "फु");
            t = t.Replace("±ÌúÖî", "फौ");
            t = t.Replace("±ÌúÖê", "फो");
            t = t.Replace("±ÌúÖ", "फा");
            t = t.Replace("±Ìú", "फ");
            t = t.Replace("±Ì", "फ");

            t = t.Replace("Ûéú", "कृ");
            t = t.Replace("‘ÖÖê", "घो");
            t = t.Replace("‘Öê", "घे");
            t = t.Replace("‘Ö", "घा");
            t = t.Replace("‘", "घ्");

            t = t.Replace("¹ý", "रू");
            t = t.Replace("¸ü", "र");
            t = t.Replace("™êü", "त्ते");
            t = t.Replace("™ü", "ट");
            t = t.Replace("™", "त्त");
            t = t.Replace("šü", "ठ");
            t = t.Replace("›Òü", "ड्ड");
            t = t.Replace("›ü", "ड");
            t = t.Replace("œü", "ढ");
            t = t.Replace("ª", "द्य्");
            t = t.Replace("ÁÖß", "श्री");
            t = t.Replace("ÁÖ", "श्रा");
            t = t.Replace("Á", "श्र्");
            t = t.Replace("Œ", "क्");

            // Positional markers
            t = t.Replace("Ø", "{{VEL_ANUSWAR}}");
            t = t.Replace("Ù", "{{REPH_VEL}}");
            t = t.Replace("×", "{{VEL}}");

            // Anuswar on aa-matra (उदा. कांबळे, फरांडे, तांबवे)
            t = t.Replace("ÖÓ", "ां");
            t = t.Replace("Öò", "ां");
            t = t.Replace("ÖÖÓ", "ां");

            // ë and ¦ ligatures (राजेंद्र, भुजगोंडा)
            t = t.Replace("ë¦ü", "ेंद्र");
            t = t.Replace("ë¦", "ेंद्र");
            t = t.Replace("¦ü", "द्र");
            t = t.Replace("¦", "द्र");

            // DVB / Shree-Lipi compound consonants: consonant + Ö is FULL consonant, consonant + ÖÖ is consonant + ा
            var compounds = new (string Code, string Base)[]
            {
                ("Ûú", "क"), ("Üú", "ख"), ("Ý", "ग"), ("‘", "घ"), ("“", "च"), ("•", "ज"), ("—", "झ"),
                ("Þ", "ण"), ("Ÿ", "त"), ("£", "थ"), ("¬", "ध"), ("®", "न"), ("¯", "प"), ("²", "ब"),
                ("³", "भ"), ("´", "म"), ("µ", "य"), ("»", "ल"), ("¾", "व"), ("¿", "श"), ("Â", "ष"),
                ("Ã", "स"), ("õ", "क्ष"), ("–", "ज्ञ")
            };

            foreach (var (k, b) in compounds)
            {
                t = t.Replace(k + "ÖÖê", b + "ो");
                t = t.Replace(k + "Öê", b + "ो");
                t = t.Replace(k + "Öî", b + "ौ");
                t = t.Replace(k + "ÖÖ", b + "ा");
                t = t.Replace(k + "Öã", b + "ु");
                t = t.Replace(k + "Öæ", b + "ू");
                t = t.Replace(k + "Ö", b);
            }

            var map = new Dictionary<string, string>
            {
                { "Ý", "ग्" }, { "Þ", "ण्" }, { "¯", "प्" }, { "Ÿ", "त्" }, { "¾", "व्" },
                { "´", "म्" }, { "Û", "क्" }, { "Ü", "ख्" }, { "“", "च्" }, { "”û", "छ" },
                { "•", "ज्" }, { "—", "झ्" }, { "£", "थ्" }, { "¤ü", "द" }, { "¤", "द्" },
                { "¬", "ध्" }, { "®", "न्" }, { "±", "फ्" }, { "²", "ब्" }, { "³", "भ्" },
                { "µ", "य्" }, { "»", "ल्" }, { "¿", "श्" }, { "Â", "ष्" }, { "Ã", "स्" },
                { "Æü", "ह" }, { "Æ", "ह" },  { "ôêû", "ळे" }, { "ôû", "ळ" }, { "ô", "ळ्" },
                { "õ", "क्ष्" }, { "–", "ज्ञ्" },

                // Matras
                { "Öê", "ो" }, { "Öî", "ौ" }, { "Ö", "ा" }, { "Ï", "्र" }, { "Õ", "ृ" },
                { "ê", "े" }, { "î", "ै" }, { "ã", "ु" }, { "æ", "ू" }, { "Ó", "ं" },
                { "ò", "ं" }, { "Ñ", "ँ" }, { "ß", "ी" }, { "Ô", "र्" }
            };

            foreach (var kvp in map) t = t.Replace(kvp.Key, kvp.Value);

            // Strip redundant halants before matras
            t = t.Replace("्ा", "ा");
            t = t.Replace("्ो", "ो");
            t = t.Replace("्ौ", "ौ");
            t = t.Replace("्े", "े");
            t = t.Replace("्ै", "ै");
            t = t.Replace("्ु", "ु");
            t = t.Replace("्ू", "ू");
            t = t.Replace("्ी", "ी");
            t = t.Replace("्ृ", "ृ");
            t = t.Replace("्ं", "ं");
            t = t.Replace("्ú", "").Replace("्ü", "").Replace("्û", "");
            t = t.Replace("ú", "").Replace("ü", "").Replace("û", "");

            // Apply positional Velanti & Anuswar
            t = Regex.Replace(t, @"\{\{VEL_ANUSWAR\}\}([क-ह](?:्[क-ह])*(?:ा)?)", "$1िं");
            t = t.Replace("ािं", "िँ");

            t = Regex.Replace(t, @"\{\{REPH_VEL\}\}([क-ह](?:्[क-ह])*(?:ा)?)", "र्$1ि");

            t = Regex.Replace(t, @"\{\{VEL\}\}([क-ह](?:्[क-ह])*(?:ा)?)", "$1ि");
            t = t.Replace("ाि", "ि");

            // Remaining ë
            t = t.Replace("ाë", "ों");
            t = t.Replace("ë", "ें");

            t = Regex.Replace(t, @"([क-ह])Ô", "र्$1");

            return CleanExistingText(t);
        }

        public static string CleanExistingText(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return text ?? "";
            string t = text.Trim();

            // 1. Unicode Composite Vowels normalization
            t = t.Replace("\u0905\u093E", "\u0906"); // अ + ा -> आ
            t = t.Replace("\u0905\u094B", "\u0913"); // अ + ो -> ओ
            t = t.Replace("\u0905\u094C", "\u0914"); // अ + ौ -> औ

            // 2. Split matras normalization
            t = t.Replace("\u093E\u0947", "\u094B"); // ा + े -> ो
            t = t.Replace("\u093E\u0948", "\u094C"); // ा + ै -> ौ
            t = t.Replace("ाा", "ा");
            t = t.Replace("ाो", "ो");
            t = t.Replace("ाौ", "ौ");
            t = t.Replace("ाे", "े");
            t = t.Replace("ाै", "ै");
            t = t.Replace("ाी", "ी");
            t = t.Replace("ाु", "ु");
            t = t.Replace("ाू", "ू");
            t = t.Replace("मार्", "र्मा");
            t = t.Replace("नार्", "र्ना");
            t = t.Replace("तार्", "र्ता");
            t = t.Replace("वार्", "र्वा");
            t = t.Replace("यार्", "र्या");
            t = t.Replace("कार्", "र्का");
            t = t.Replace("शार्", "र्शा");
            t = t.Replace("धार्म", "धर्मा");

            // 3. Known legacy mojibake mappings
            // Complex name combos first
            t = t.Replace("द¢ाा¡ाय", "दत्तात्रय");
            t = t.Replace("द¢ाा", "दत्ता");
            t = t.Replace("द¢ाु", "दत्तू");
            t = t.Replace("ई¢ाम", "उत्तम");
            t = t.Replace("निवé¢ाी", "निवृत्ती");
            t = t.Replace("निवéि¢ा", "निवृत्ती");
            t = t.Replace("निवé", "निवृ");
            t = t.Replace("सा¢ाा", "सात्ता");
            t = t.Replace("अा¢ाार", "अत्तार");
            t = t.Replace("¢ाा", "त्ता");
            t = t.Replace("¢ाे", "त्ते");
            t = t.Replace("¢ा", "त्त");
            t = t.Replace("¢", "त्त");
            t = t.Replace("ि¡ा", "त्रि");
            t = t.Replace("क्é", "कृ");
            t = t.Replace("¡ाय", "त्रय");
            t = t.Replace("¡ा", "त्रा");
            t = t.Replace("¡", "त्र");
            t = t.Replace("šे", "ठे");
            t = t.Replace("šव", "ठेव");
            t = t.Replace("š", "ठ");
            t = t.Replace("वाषáक", "वार्षिक");
            t = t.Replace("á", "र्वि");
            t = t.Replace("बòक", "बँक");
            t = t.Replace("¤े", "दे");
            t = t.Replace("¤", "द");
            t = t.Replace("¸े", "रे");
            t = t.Replace("¸", "र");

            t = t.Replace("फ्Ìåलाबाइर्", "फुलाबाई");
            t = t.Replace("फ्Ìå", "फु");
            t = t.Replace("फ्Ìा", "फा");
            t = t.Replace("फ्Ì", "फ");
            t = t.Replace("बाइर्", "बाई");
            t = t.Replace("म्Æै", "म्है");
            t = t.Replace("बाÆुबली", "बाहुबली");
            t = t.Replace("राÆुल", "राहुल");
            t = t.Replace("Æु", "हु");
            t = t.Replace("Æे", "हे");
            t = t.Replace("Æ", "ह");
            t = t.Replace("मुरचि™े", "मुरचित्ते");
            t = t.Replace("™े", "त्ते");
            t = t.Replace("™", "त्त");
            t = t.Replace("अरØवद", "अरविंद");
            t = t.Replace("Øव", "विं");
            t = t.Replace("Øल", "लिं");
            t = t.Replace("Øह", "हिंगे"); // Øहगे -> हिंगे
            t = t.Replace("Ø", "ि");
            t = t.Replace("राजë¦", "राजेंद्र");
            t = t.Replace("ë¦", "ेंद्र");
            t = t.Replace("गाëडा", "गोंडा");
            t = t.Replace("ëडा", "ोंडा");
            t = t.Replace("ëड", "ेंड");
            t = t.Replace("ë", "ें");
            t = t.Replace("¹ý", "रू");
            t = t.Replace("¹", "रू");
            t = t.Replace("ý", "");
            t = t.Replace("Ùप", "र्पि");
            t = t.Replace("Ù", "र्");
            t = t.Replace("Œक", "क्क");
            t = t.Replace("Œत", "क्त");
            t = t.Replace("Œ", "क्");
            t = t.Replace("›Ò", "ड्ड");
            t = t.Replace("›", "ड");
            t = t.Replace("ª", "द्य");
            t = t.Replace("Áाी", "श्री");
            t = t.Replace("Áा", "श्रा");
            t = t.Replace("Á", "श्र");
            t = t.Replace("ò", "ं");
            t = t.Replace("é", "ृ");

            // Additional legacy cleanups
            t = t.Replace("अा", "आ");
            t = t.Replace("अो", "ओ");
            t = t.Replace("अौ", "औ");
            t = t.Replace("साे", "सो");
            t = t.Replace("नाे", "नो");
            t = t.Replace("पाे", "पो");
            t = t.Replace("काे", "को");
            t = t.Replace("लाे", "लो");
            t = t.Replace("माे", "मो");
            t = t.Replace("राे", "रो");
            t = t.Replace("ताे", "तो");
            t = t.Replace("दाे", "दो");
            t = t.Replace("घाे", "घो");
            t = t.Replace("चाे", "चो");

            // Final canonical normalization
            return t.Normalize(NormalizationForm.FormC).Trim();
        }
    }
}
