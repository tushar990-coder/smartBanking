# 📋 SmartBanking CBS - Pigmy Scheme Slabs & Cycle Reset Database Patch Guide
**Patch Version:** `v2.5.15`  
**Patch File:** [`patch_pigmy_dynamic_slabs_and_cycle_reset.sql`](./patch_pigmy_dynamic_slabs_and_cycle_reset.sql)  
**Target Module:** Pigmy Daily Deposit (पिग्मी दैनिक ठेव योजना)  
**Date:** 26 September 2026  

---

## 🎯 उद्देश (Purpose & Summary)

हा पॅच **पिग्मी ठेव योजनेतील (Pigmy Daily Deposit)** खालील ३ प्रमुख वैशिष्ट्यांसाठी आवश्यक डेटाबेस स्कीमा बदल लागू करतो:
1. **डायनॅमिक व्याज व दंड स्लॅब (Dynamic Interest & Penalty Slabs):** प्रत्येक स्कीमसाठी महिन्यांच्या मर्यादेनुसार लवचिक स्लॅब (From Months, To Months, Interest %, Penalty %).
2. **अंशतः विड्रॉल व Day 1 रीसेट (Partial Withdrawal with Day 1 Reset):** ग्राहकाने मधल्या काळात काही रक्कम काढल्यास उर्वरित शिल्लक रकमेसाठी कालावधी मोजणी १ल्या दिवसापासून (Day 1) पुन्हा सुरू होते.
3. **विड्रॉल इतिहास व ऑडिट टेबल (Audit & Ledger Tracking):** प्रत्येक विड्रॉलचे तपशील, पावती क्रमांक (Voucher No), कपात केलेला दंड आणि मिळालेले व्याज नोंदवण्यासाठी स्वतंत्र टेबल.

> 🛡️ **Zero Data Loss Guarantee:** हा पॅच पूर्णपणे सुरक्षित आणि *Idempotent* आहे (पुन्हा पुन्हा चालवला तरी आधीच्या कोणत्याही खात्याचे किंवा व्यवहारांचे नुकसान होत नाही).

---

## 🏗️ डेटाबेस स्कीमा मधील बदल (Database Schema Changes)

### १. नवीन टेबल: `[dbo].[PigmySchemeInterestSlabs]`
*योजनांनुसार व्याज व दंड स्लॅब कॉन्फिगरेशन साठवण्यासाठी.*

| कॉलम नाव | डेटा टाईप | वर्णन |
| :--- | :--- | :--- |
| `SlabID` | `INT IDENTITY(1,1)` | Primary Key |
| `PigmySchemeID` | `INT` | Foreign Key (`PigmySchemes.PigmySchemeID`) |
| `FromMonths` | `INT` | सुरुवातीचे महिने (उदा. ०, ३, ६, ११) |
| `ToMonths` | `INT` | शेवटचे महिने (उदा. ३, ६, ११, १२) |
| `InterestRate` | `DECIMAL(5,2)` | लागू होणारा वार्षिक व्याजदर (%) |
| `PenaltyRate` | `DECIMAL(5,2)` | अकाली किंवा विड्रॉल दंड दर (%) |
| `SlabDescription` | `NVARCHAR(100)` | मराठी/इंग्रजी माहिती (उदा. '० ते ३ महिने (२% दंड)') |
| `IsActive` | `BIT` | चालू/बंद स्थिती (Default: 1) |
| `CreatedAt` | `DATETIME2` | नोंदणी वेळ (Default: GETUTCDATE()) |

---

### २. `[dbo].[PigmyAccounts]` टेबलमधील नवीन कॉलम्स
*खात्याच्या सायकल व Day 1 रीसेट ट्रॅकिंगसाठी.*

| कॉलम नाव | डेटा टाईप | डिफॉल्ट मूल्य | वर्णन |
| :--- | :--- | :--- | :--- |
| `EffectiveStartDate` | `DATETIME` | `OpeningDate` | विड्रॉल झाल्यावर सायकल रीसेट तारीख (इथून पुढील दिवस मोजले जातात) |
| `CurrentCycleNumber` | `INT` | `1` | सध्या सुरू असलेली सायकल क्रमांक (1, 2, 3...) |
| `LastWithdrawalDate` | `DATETIME` | `NULL` | सर्वात शेवटी रक्कम काढल्याची तारीख |
| `TotalWithdrawnAmount`| `DECIMAL(18,2)` | `0.00` | खात्यातून एकूण काढलेली मुद्दल रक्कम |

---

### ३. नवीन टेबल: `[dbo].[PigmyWithdrawals]`
*अंशतः विड्रॉलच्या प्रत्येक व्यवहाराचा संपूर्ण आर्थिक व ऑडिट ट्रेल.*

| कॉलम नाव | डेटा टाईप | वर्णन |
| :--- | :--- | :--- |
| `WithdrawalID` | `INT IDENTITY(1,1)` | Primary Key |
| `PigmyAccountID` | `INT` | Foreign Key (`PigmyAccounts.PigmyAccountID`) |
| `WithdrawalDate` | `DATETIME` | विड्रॉल केलेली तारीख व वेळ |
| `CycleNumber` | `INT` | ज्या सायकलीमध्ये रक्कम काढली तो क्रमांक |
| `CycleStartSnapshot` | `DATETIME` | त्या सायकलची सुरुवात तारीख |
| `ElapsedDays` | `INT` | सायकलमध्ये पूर्ण झालेले दिवस |
| `ElapsedMonths` | `DECIMAL(5,2)` | सायकलमध्ये पूर्ण झालेले महिने |
| `RequestedAmount` | `DECIMAL(18,2)` | मागणी केलेली मूळ मुद्दल रक्कम |
| `AppliedSlabID` | `INT` | लागू झालेला स्लॅब ID |
| `PenaltyRate` | `DECIMAL(5,2)` | कपात केलेला दंड दर (%) |
| `PenaltyAmount` | `DECIMAL(18,2)` | कापलेली प्रत्यक्ष दंड रक्कम (₹) |
| `InterestRate` | `DECIMAL(5,2)` | मिळालेला व्याजदर (%) |
| `InterestAmount` | `DECIMAL(18,2)` | मिळालेले व्याज (₹) |
| `NetPaidAmount` | `DECIMAL(18,2)` | ग्राहकाला प्रत्यक्ष रोख दिलेली रक्कम (₹) |
| `RemainingBalance` | `DECIMAL(18,2)` | विड्रॉल नंतर शिल्लक राहिलेली मुद्दल (₹) |
| `VoucherNo` | `NVARCHAR(50)` | CBS जनरल लेजर व्हाउचर क्रमांक |
| `Narration` | `NVARCHAR(250)` | तपशील / कारण |
| `CreatedBy` | `INT` | युझर आयडी |
| `CreatedDate` | `DATETIME` | नोंदणी तारीख |

---

### ४. स्वयंचलित डेटा मायग्रेशन (Data Migration)
- ज्या जुन्या स्कीम्समध्ये अद्याप स्लॅब भरलेले नसतील, त्यांना आपोआप ४ मानक स्लॅब (0-3M: 2% Penalty, 3-6M: 1% Penalty, 6-11M: Premature Rate, 11-12M: Full Rate) तयार होतात.
- सर्व अस्तित्वात असलेल्या पिग्मी खात्यांचा `EffectiveStartDate = OpeningDate`, `CurrentCycleNumber = 1`, `TotalWithdrawnAmount = 0.00` सेट होतो.

---

## 🚀 सहकारी कर्मचाऱ्यासाठी सूचना (Instructions for Colleague to Create Upload Patch)

### पद्धत १: स्वतंत्र पॅच म्हणून थेट चालवणे (Standalone SQL Execution)
1. **SQL Server Management Studio (SSMS)** उघडा.
2. संबंधित ग्राहकाच्या डेटाबेसशी कनेक्ट व्हा (उदा. `SmartBanking_Testing`, `SmartBanking_Padawalwadi`, इ.).
3. [`patch_pigmy_dynamic_slabs_and_cycle_reset.sql`](./patch_pigmy_dynamic_slabs_and_cycle_reset.sql) फाइल उघडा आणि **Execute (F5)** दाबा.
4. शेवटी येणाऱ्या ऑडिट टेबलमध्ये तिन्ही नोंदी तपासा.

### पद्धत २: मास्टर अपडेट पॅचमध्ये जोडणे (Include in Unified Upload Patch)
आपल्या संस्थेचा जो युनिफाइड अपलोड पॅच असतो (`SmartBanking_Testing_And_Testing1_Unified_Patch/database/update_schema.sql`):
1. `update_schema.sql` फाइल उघडा.
2. सर्वात शेवटी (किंवा संबंधित मॉड्यूल्स नंतर) `patch_pigmy_dynamic_slabs_and_cycle_reset.sql` मधील स्क्रिप्ट कॉपी करून पेस्ट करा.
3. `version.json` आणि पॅच व्हर्जन नंबर `v2.5.15` वर अपडेट करा.
4. ZIP किंवा पॅच बंडल तयार करून VPS वर अपलोड करा.
