# 🏛️ कोअर बँकिंग सिस्टीम (CBS) — घटक क्र. १० अंमलबजावणी आराखडा (Implementation Plan)
## **शाखानिहाय दिवसअखेर रोख ताळमेळ व तिजोरी-कॅशियर पडताळणी (Branch-wise EOD Cash Tally & Multi-Branch Vault Reconciliation)**

---

### 📌 १. लेखापरीक्षण निरीक्षण व समस्येचे मूळ (Audit Finding & Root Cause Analysis)

#### **अ. ऑडिट निरीक्षण (Audit Gap):**
| घटक (Audit Parameter) | बँकिंग निकष (Core Banking Rule) | सद्यस्थिती (Current Status) | त्रुटी व कारण (Audit Finding) |
| :--- | :--- | :--- | :--- |
| **Branch-wise EOD Cash Tally** | दिवसअखेर त्या शाखेच्याच अधिकृत रोख खात्याशी (Dedicated Branch Cash Ledger) ताळमेळ व तिजोरी शिल्लक तपासणी | ❌ **Non-Compliant (अयोग्य)** | **EOD कोडमध्ये पहिल्याच कॅश लेजरचा (`LedgerID: 1` / HO Cash) हार्डकोडेड संदर्भ आहे. उप-शाखांचा (Branch 2, 3...) दिवस बंद करताना मुख्य शाखेचे कॅश लेजर तपासले जाण्याचा अथवा ओपनिंग बॅलन्स शून्य धरला जाण्याचा धोका आहे.** |

---

#### **ब. सद्य कोडिंगमधील तांत्रिक दोष (Technical Root Causes in `EodBodService.cs`):**

१. **एकाच लेजर आयडीचा संकुचित शोध (`GetCashLedgerIdAsync` ऐवजी `GetCashLedgerIdsForBranchAsync` चा अभाव):**
   ```csharp
   // File: api/Bhisi.Api/Services/EodBodService.cs (Lines 54-55)
   int cashLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId);
   var cashLedger = await _context.Ledgers.FindAsync(cashLedgerId);
   ```
   * **दोष:** सिस्टीम फक्त एकाच `cashLedgerId` ला शोधते. जर शाखेत मुख्य तिजोरी (`Main Vault`), काऊंटर कॅश (`Counter 1 Cash`), किरकोळ रोख (`Petty Cash`) अशी अनेक खाती असतील, तर उर्वरित रोख खाती EOD मधून सुटतात.
   * `ReportsController.cs` मध्ये `GetCashLedgerIdsForBranchAsync` वापरून सर्व खाती एकत्रित तपासली जातात, परंतु `EodBodService.cs` मध्ये जुनी पद्धत राहिली आहे.

२. **ट्रान्सफर व्हाउचर तपासणीत कॅश वगळण्याचा दोष (Flawed Transfer Tally Logic):**
   ```csharp
   // File: api/Bhisi.Api/Services/EodBodService.cs (Lines 59-65)
   bool hasCash = v.VoucherDetails.Any(vd => vd.LedgerID == cashLedgerId);
   if (!hasCash)
   {
       transferDr += v.VoucherDetails.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
       transferCr += v.VoucherDetails.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);
   }
   ```
   * **दोष:** जर व्हाउचरमध्ये शाखेचे दुसरे कॅश लेजर वापरले गेले असेल, तर `vd.LedgerID == cashLedgerId` हे त्याला 'कॅश नसलेले' समजून ट्रान्सफर बॅचमध्ये पकडते, ज्यामुळे विनाकारण `Transfer Debit-Credit Mismatch` एरर येऊ शकते.

३. **मुख्य शाखेचा हार्डकोडेड संदर्भ (`branchId == 1` Hardcoded Check):**
   ```csharp
   // File: api/Bhisi.Api/Services/EodBodService.cs (Lines 77-87)
   var branchOb = await _context.BranchLedgerOpeningBalances
       .FirstOrDefaultAsync(b => b.BranchID == branchId && b.LedgerID == cashLedgerId);

   if (branchOb != null)
   {
       openingCash = branchOb.OpeningBalanceType == "Dr" ? branchOb.OpeningBalance : -branchOb.OpeningBalance;
   }
   else if (branchId == 1) // ⚠️ HARDCODED HO FALLBACK
   {
       openingCash = cashLedger.OpeningBalanceType == "Dr" ? cashLedger.OpeningBalance : -cashLedger.OpeningBalance;
   }
   ```
   * **दोष:** उप-शाखेचा (Branch 2 - पडवळवाडी, Branch 3 - बांबवडे इ.) `BranchLedgerOpeningBalances` रेकॉर्ड नसेल, तर `else if (branchId == 1)` मुळे उप-शाखेचा आरंभिक शिल्लक (Opening Balance) थेट ₹०.०० धरला जातो! यामुळे उप-शाखेची रोख शिल्लक वजा (Negative) जाऊ शकते किंवा चुकीची दाखवली जाते.

४. **केवळ `ClosingCash >= 0` तपासणी — प्रत्यक्ष नोटा मोजदाद (Physical Denomination Tally) शून्य:**
   ```csharp
   // File: api/Bhisi.Api/Services/EodBodService.cs (Lines 163-167)
   if (!status.CashTally.IsPositive)
   {
       return (false, $"EOD करता येत नाही. अखेरची रोख शिल्लक वजा ({status.CashTally.Closing}) आहे.");
   }
   ```
   * **दोष:** कोअर बँकिंगच्या नियमानुसार दिवसअखेर केवळ वहीतील शिल्लक धन (Positive) असणे पुरेसे नाही; **कॅशिअरने प्रत्यक्ष मोजलेली नोटांची शिल्लक (Physical Denomination) आणि सिस्टीमची वही शिल्लक (Book Balance) पैशा-पैशाने जुळणे (Difference == ₹०.००)** बंधनकारक असते. सध्या EOD मध्ये `CashDenominations` किंवा `CashierBalances` चा कोणताही मेळ तपासला जात नाही!

५. **काऊंटर कॅशिअर तिजोरी परतावा (Drawer-to-Vault Handover) तपासणीचा अभाव:**
   * दिवस समाप्ती करताना सर्व उप-कॅशिअर्सनी त्यांची काऊंटर शिल्लक मुख्य तिजोरीत (`Vault`) जमा केली आहे का (`CashAllocations.IsReturn = true` किंवा कॅशिअर शिल्लक = ०), हे तपासले जात नाही.

---

### 🎯 २. प्रस्तावित संपूर्ण कोअर बँकिंग समाधान (Architectural Solution)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   🏛️ शाखानिहाय अचूक दिवसअखेर रोख ताळमेळ इंजिन (Branch-wise CBS EOD Cash Engine)                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                  │
│  [शाखा आयडी: BranchID] ───► १. शाखा अधिकृत कॅश खाती निश्चिती (Branch Specific Cash Ledgers)                      │
│                                • Branch.DefaultCashLedgerID (प्राधान्य क्र. १)                                   │
│                                • CashLedgerHelper.GetCashLedgerIdsForBranchAsync(branchId)                      │
│                                                                                                                  │
│                                            ▼                                                                     │
│                             २. शाखानिहाय सुरुवातीची शिल्लक (Branch-wise Opening Balance)                          │
│                                • BranchLedgerOpeningBalances (शाखेची अधिकृत OB)                                  │
│                                • Ledgers.OpeningBalance (केवळ मुख्य कार्यालय / जर मॅप असेल तर)                   │
│                                • शून्य किंवा विसंगती आढळल्यास कडक चेतावणी (Zero Ambiguity)                      │
│                                                                                                                  │
│                                            ▼                                                                     │
│                             ३. दिवसभराचे रोख व्यवहार (Today's Cash Ledger Movement)                              │
│                                • Today's Cash Receipts (सर्व रोख जमा व्हाउचर्स) Dr                              │
│                                • Today's Cash Payments (सर्व रोख नावे व्हाउचर्स) Cr                             │
│                                • वहीतील अखेरची शिल्लक (System Closing Cash) = Opening + Dr - Cr                  │
│                                                                                                                  │
│                                            ▼                                                                     │
│                             ४. प्रत्यक्ष नोटांची मोजदाद मेळ (Physical Denomination Verification)                 │
│                                • CashDenominations टेबलमधील आजची प्रत्यक्ष मोजणी                                 │
│                                • तफावत पडताळणी: Physical Cash - System Closing Cash == ₹ ०.००                     │
│                                                                                                                  │
│                                            ▼                                                                     │
│                             ५. काऊंटर कॅशिअर क्लिअरन्स (Counter Cashier Drawers Settlement)                       │
│                                • CashAllocations मधील सर्व काऊंटर रकमा तिजोरीत परत आल्याची खात्री                │
│                                                                                                                  │
│                                            ▼                                                                     │
│  [EOD निकाल] ──────────────► 🟢 सर्व मेळ १००% जुळले तरच EOD लॉक व पुढील बिझनेस डेट सुरू (BOD)                     │
│                              🔴 १ रुपयाचाही फरक असल्यास EOD ब्लॉक + तपशीलवार तफावत अहवाल                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 📋 ३. तपशीलवार अंमलबजावणी कृती आराखडा (Step-by-Step Action Plan)

---

#### 🔹 टप्पा १: बॅकएंड सुधारणा — `EodBodService.cs` शाखानिहाय रोख ताळमेळ पुनर्रचना
**फाइल:** [`api/Bhisi.Api/Services/EodBodService.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Services/EodBodService.cs)

१. **शाखेची सर्व अधिकृत रोख खाती लोड करणे:**
   * एका हार्डकोडेड लेजरऐवजी `CashLedgerHelper.GetCashLedgerIdsForBranchAsync(_context, branchId)` वापरणे.
   * जर शाखेचे कोणतेही रोख खाते निश्चित नसेल, तर त्वरित स्पष्ट एरर देणे:  
     `"शाखा '{BranchName}' साठी अधिकृत रोख खाते निश्चित केलेले नाही. कृपया शाखा मास्टरमध्ये रोख खाते सेट करा."`

२. **अचूक शाखा ओपनिंग बॅलन्स मॅपिंग:**
   * `BranchLedgerOpeningBalances` मधून त्या शाखेचे सर्व कॅश लेजर्स एकत्रित करणे.
   * `branchId == 1` चा हार्डकोडेड बायपास काढून टाकणे.

३. **रोख जमा व खर्च (Receipts & Payments) अचूक वेगळे करणे:**
   ```csharp
   // शाखेचे आजचे मंजूर रोख व्हाउचर तपशील
   var todayCashVds = await _context.VoucherDetails
       .AsNoTracking()
       .Include(vd => vd.Voucher)
       .Where(vd => branchCashLedgerIds.Contains(vd.LedgerID) &&
                    vd.Voucher != null &&
                    vd.Voucher.BranchID == branchId &&
                    vd.Voucher.Status == "Approved" &&
                    vd.Voucher.VoucherDate == businessDate)
       .ToListAsync();

   decimal todayReceipts = todayCashVds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
   decimal todayPayments = todayCashVds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);
   decimal closingCash = openingCash + todayReceipts - todayPayments;
   ```

४. **ट्रान्सफर व्हाउचर्समध्ये सर्व शाखा कॅश लेजर्स तपासणे:**
   ```csharp
   foreach (var v in transferVouchers)
   {
       bool hasCash = v.VoucherDetails.Any(vd => branchCashLedgerIds.Contains(vd.LedgerID));
       if (!hasCash)
       {
           transferDr += v.VoucherDetails.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
           transferCr += v.VoucherDetails.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);
       }
   }
   ```

५. **प्रत्यक्ष नोटांची मोजदाद (Physical Denomination) तपासणी समाविष्ट करणे:**
   * `CashDenominations` टेबलमध्ये त्या शाखेचे व आजच्या तारखेचे `EntryType == "CLOSING"` किंवा `"VAULT"` रेकॉर्ड शोधणे.
   * प्रत्यक्ष मोजलेली रक्कम आणि वहीतील रक्कम यांचा फरक काढणे:
     `decimal cashDifference = physicalAmount - closingCash;`
   * जर तफावत शून्य नसेल तर EOD थांबवणे आणि अलर्ट देणे:
     `"EOD करता येत नाही. रोख तफावत: वही शिल्लक ₹ X, प्रत्यक्ष मोजलेली रोख ₹ Y (फरक: ₹ Z)."`

६. **काऊंटर कॅशिअर शिल्लक पडताळणी:**
   * शाखेतील कोणत्याही कॅशिअरकडे अन-रिटर्न कॅश राहिली आहे का हे तपासणे.

७. **EodStatus DTO सुधारणा:**
   `GetEodStatusAsync` मधील रिटर्न ऑब्जेक्ट अधिक पारदर्शक व तपशीलवार करणे:
   ```json
   {
     "businessDate": "2026-10-16T00:00:00",
     "isDayClosed": false,
     "unpostedVouchers": 0,
     "transferTally": {
       "debit": 150000.00,
       "credit": 150000.00,
       "isMatched": true
     },
     "cashTally": {
       "branchId": 2,
       "branchName": "पडवळवाडी शाखा",
       "cashLedgers": [
         { "ledgerId": 104, "ledgerName": "हातावरील रोख शिल्लक (पडवळवाडी)", "opening": 45000.00, "closing": 62500.00 }
       ],
       "opening": 45000.00,
       "todayReceipts": 85000.00,
       "todayPayments": 67500.00,
       "closing": 62500.00,
       "isPositive": true,
       "physicalCount": {
         "isSubmitted": true,
         "totalAmount": 62500.00,
         "difference": 0.00,
         "isMatched": true
       },
       "cashierDrawers": {
         "pendingAllocations": 0,
         "isAllReturned": true
       }
     }
   }
   ```

---

#### 🔹 टप्पा २: फ्रंटएंड UI सुधारणा — `DayEndDashboard.tsx`
**फाइल:** [`client/src/components/DayEndDashboard.tsx`](file:///d:/Bhisi%20Software/client/src/components/DayEndDashboard.tsx)

१. **इंटरफेस अद्ययावत करणे (`interface EodStatus`):**
   * नवीन `cashTally` स्ट्रक्चर, शाखा नाव, कॅश लेजर्सची यादी, जमा-नावे आणि नोटा मोजणीचे स्टेट जोडणे.

२. **१. EOD पूर्व तपासणी (Validation Checks) कार्डचे आधुनिकीकरण:**
   * **तपासणी १:** प्रलंबित व्हाउचर्स (Unposted Vouchers) — ० प्रलंबित असणे आवश्यक.
   * **तपासणी २:** ट्रान्सफर डेबिट-क्रेडिट जुळणी (Transfer Batch Tally) — Dr == Cr असणे आवश्यक.
   * **तपासणी ३ (विस्तारित):** शाखानिहाय रोख खाते व तिजोरी ताळमेळ (Branch Cash & Vault Tally):
     - शाखेचे अधिकृत कॅश लेजर नाव व कोड ठळकपणे दाखवणे.
     - `सुरुवात: ₹ X | जमा (+): ₹ Y | खर्च (-): ₹ Z | अखेर शिल्लक: ₹ W`.
     - रंगीत स्टेटस: `🟢 धन शिल्लक (Positive Cash)`.
   * **तपासणी ४ (नवीन):** प्रत्यक्ष नोटांची मोजदाद (Physical Denomination Match):
     - जर नोटा मोजल्या असतील व फरक ₹०.०० असेल: `🟢 तंतोतंत जुळले (Physical Matched)`.
     - जर नोटा मोजल्या नसतील: `🟡 नोटा मोजणी प्रलंबित (Pending Count)` + थेट `[💵 नोटा मोजणी करा]` चे बटण.
     - जर फरक असेल: `🔴 तफावत: ₹ X (Difference Detected)`.
   * **तपासणी ५ (नवीन):** कॅशिअर काऊंटर परतावा (Cashier Drawers Clearance):
     - सर्व काऊंटर कॅशिअर्सनी तिजोरीत रोख जमा केल्याची खात्री: `🟢 सर्व काऊंटर्स निरंक (Drawers Cleared)`.

३. **दिवस अखेर चालवण्यापूर्वी (Run EOD) सुरक्षा पॉप-अप (Confirmation Modal with Cash Details):**
   * नुसत्या `window.confirm` ऐवजी एक सुंदर मॉडेल किंवा कन्फर्मेशन बॉक्स, ज्यामध्ये शाखेचे नाव, आजची तारीख, प्रत्यक्ष रोख शिल्लक स्पष्ट दिसेल.

---

#### 🔹 टप्पा ३: डेटाबेस पडताळणी व स्वयं-दुरुस्ती (Database Health Check & Auto-Healing)
**फाइल:** [`tools/master_vps_update_schema.sql`](file:///d:/Bhisi%20Software/tools/master_vps_update_schema.sql)

१. **सर्व शाखांसाठी `DefaultCashLedgerID` पडताळणी:**
   * ज्या शाखांमध्ये `DefaultCashLedgerID` NULL आहे, त्या शाखांसाठी त्यांच्या नावाशी जुळणारे कॅश लेजर स्वयंचलितरीत्या शोधून लिंक करणे.
   * जर एकाही शाखेला कॅश लेजर मॅप नसेल तर तात्काळ सुरक्षित लेजर तयार करून मॅप करणे:
   ```sql
   -- शाखा रोख खाते स्वयं-मॅपिंग
   UPDATE b
   SET b.[DefaultCashLedgerID] = l.[LedgerID]
   FROM [Branches] b
   CROSS APPLY (
       SELECT TOP 1 [LedgerID] FROM [Ledgers]
       WHERE ([LedgerName] LIKE N'%' + REPLACE(b.[BranchName], N'शाखा', N'') + N'%'
          OR [LedgerName] LIKE N'%' + b.[BranchCode] + N'%')
         AND ([LedgerName] LIKE N'%रोख%' OR [LedgerName] LIKE N'%हात%' OR [AccountType] LIKE N'%Cash%')
       ORDER BY [LedgerID]
   ) l
   WHERE b.[DefaultCashLedgerID] IS NULL;
   ```

२. **सर्व शाखांसाठी `BranchLedgerOpeningBalances` ची कॅश एन्ट्री सुनिश्चित करणे:**
   * जर एखाद्या शाखेचा कॅश लेजर ओपनिंग बॅलन्स टेबलमध्ये नसेल, तर शून्य किंवा लेजरच्या मूळ शिल्लकसह सेफ डिफॉल्ट तयार करणे.

---

### 🧪 ४. चाचणी व पडताळणी निकष (Verification & Test Scenarios)

| चाचणी क्र. | परिस्थिती (Scenario) | अपेक्षित वर्तन (Expected Result) | दर्जा (Status) |
| :---: | :--- | :--- | :---: |
| **१** | **शाखा २ (पडवळवाडी) चा EOD स्टेटस तपासणे** | केवळ पडवळवाडीच्या कॅश लेजरची (GL 104) शिल्लक व व्यवहार दिसतील; मुख्य शाखेचे (GL 1) लेजर यात मिसळणार नाही. | 🎯 Planned |
| **२** | **शाखा ३ (बांबवडे) मध्ये नोटा मोजणी न करता EOD चा प्रयत्न करणे** | EOD ब्लॉक होईल; "प्रत्यक्ष नोटांची मोजणी प्रलंबित आहे" असा लाल इशारा दिसेल. | 🎯 Planned |
| **३** | **प्रत्यक्ष रोख आणि वहीत ₹ ५०० चा फरक असणे** | EOD ब्लॉक होईल; "रोख तफावत ₹ ५०० आढळली आहे" असा स्पष्ट अलर्ट दिसेल. | 🎯 Planned |
| **४** | **कॅशिअरकडे रोख शिल्लक प्रलंबित असताना EOD करणे** | EOD ब्लॉक होईल; "काऊंटर कॅशिअरकडून तिजोरीत शिल्लक जमा करणे बाकी आहे" असा संदेश येईल. | 🎯 Planned |
| **५** | **सर्व अटी पूर्ण झाल्यावर (0 Pending, Dr=Cr, Cash Matched)** | ९ टप्प्यांची बॅच यशस्वी धावेल, बिझनेस डेट D वरून D+1 होईल आणि Audit Log मध्ये शाखेच्या रोख शिलकीसह अचूक नोंद होईल. | 🎯 Planned |

---

### 🚀 ५. अंमलबजावणी क्रम (Execution Roadmap)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ १. EodBodService.cs मध्ये GetCashLedgerIdsForBranchAsync द्वारे संपूर्ण बहु-शाखा रोख ताळमेळ लागू करणे│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ २. EodBodService.cs मध्ये CashDenominations व CashAllocations पडताळणी समाविष्ट करणे       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ३. DayEndDashboard.tsx फ्रंटएंड स्क्रीनवर नवीन रोख-तिजोरी-नोटा मोजणी कार्ड्स डिझाइन करणे│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ४. master_vps_update_schema.sql मध्ये शाखा रोख खाते स्वयं-दुरुस्ती स्क्रिप्ट समाविष्ट करणे│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ५. .NET बॅकएंड व रिएक्ट फ्रंटएंड बिल्ड यशस्वी तपासणे (Zero Lint / TypeScript Errors)   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---
*सदर आराखड्यानुसार काम पूर्ण झाल्यावर कोअर बँकिंग ऑडिटमधील **"Branch-wise EOD Cash Tally"** हा घटक ❌ Non-Compliant वरून 🟢 **100% Fully Compliant** मध्ये रूपांतरित होईल.*
