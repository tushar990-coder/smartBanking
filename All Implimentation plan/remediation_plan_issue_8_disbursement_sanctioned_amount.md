# 🛡️ वरिष्ठ सिस्टीम लेखापरीक्षक (Senior System Auditor) सुधारात्मक कृती योजना
## दोष क्र. ८ [मध्यम / MEDIUM]: LoanDisbursement मध्ये मूळ मंजूर रक्कमेऐवजी बाकी मुद्दल नोंदवणे (Sanctioned vs Principal Disbursed Bug)

---

### 📌 १. समस्या विश्लेषण व प्रत्यक्ष ऑडिट निरीक्षण (Forensic Audit Analysis)

#### अ. सद्यस्थितीतील तांत्रिक निरीक्षण:
1. **चुकीचे फील्ड मॅपिंग ([LoanAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/LoanAccountsController.cs)):**
   - कर्ज आरंभिक शिल्लक नोंदवताना (`PostOpeningBalance` - ओळ ५८९) आणि दुरुस्त करताना (`PutOpeningBalance` - ओळ ८५३), सिस्टीम आपोआप एक आरंभिक वाटप नोंद (`LoanDisbursement`) तयार करते.
   - परंतु या नोंदीमध्ये:
     ```csharp
     // PostOpeningBalance (ओळ ५८८-५९५):
     SanctionedAmount = dto.SanctionedAmount,
     DisbursementAmount = dto.PrincipalBalance,  // ❌ चूक! मूळ मंजूर रक्कमेऐवजी बाकी मुद्दल नोंदवले
     NetAmountPaid = dto.PrincipalBalance,       // ❌ चूक!
     PaymentMode = "Opening Balance",
     ```
     तसेच `PutOpeningBalance` मध्ये:
     ```csharp
     // PutOpeningBalance (ओळ ८५२-८५५):
     disbursement.SanctionedAmount = dto.SanctionedAmount;
     disbursement.DisbursementAmount = dto.PrincipalBalance; // ❌ चूक!
     disbursement.NetAmountPaid = dto.PrincipalBalance;      // ❌ चूक!
     ```
   - **विरोधाभास (Contradiction with Bulk Import):**
     विशेष म्हणजे `LoanAccountsController.cs` मधीलच एक्सेल इंपोर्ट पद्धतीत (`BulkImportLoanOpeningBalances` - ओळ १८१२-१८१४) ही रक्कम योग्यरित्या नोंदवली आहे:
     ```csharp
     SanctionedAmount = loanAccount.SanctionedAmount,
     DisbursementAmount = loanAccount.SanctionedAmount, // ✅ येथे योग्य लिहिले होते
     NetAmountPaid = loanAccount.SanctionedAmount,
     ```
     यावरून हे स्पष्ट होते की मॅन्युअल फॉर्म सेव्ह/अपडेट करताना डेव्हलपरकडून चुकून `dto.SanctionedAmount` ऐवजी `dto.PrincipalBalance` कॉपी झाला आहे.

---

#### ब. थेट डेटाबेस पडताळणी पुरावा (Live Database Forensic Proof):
`SmartBanking_Testing` डेटाबेसवर थेट तपासणी केली असता खालील विसंगती प्रत्यक्ष उघडकीस आली:

| कर्ज खाते ID | मंजूर रक्कम (`SanctionedAmount`) | वाटप नोंद रक्कम (`DisbursementAmount`) | चालू मुद्दल बाकी (`PrincipalBalance`) | विसंगती / तफावत (Difference) |
|:---:|:---:|:---:|:---:|:---|
| **खाते क्र. ६** | **₹ ८०,०००.००** | **₹ ५०,०००.००** ❌ | ₹ ५०,०००.०० | ₹ ३०,००० ने वाटप कमी नोंदवले गेले! |
| **खाते क्र. ८** | **₹ १,५०,०००.००** | **₹ १,२०,०००.००** ❌ | ₹ १,२०,०००.०० | ₹ ३०,००० ने वाटप कमी नोंदवले गेले! |
| **खाते क्र. १०** | **₹ १,००,०००.००** | **₹ १,०५,०००.००** ❌ | ₹ १,०५,०००.०० | भांडवली व्याजासह चुकीची नोंद! |

---

### ⚠️ २. बँकिंग, वैधानिक व लेखापरीक्षण जोखीम (Statutory Banking & Audit Risks)

1. **एकूण वितरित कर्ज अहवालात घट (Under-reporting of Cumulative Loan Disbursements):**
   - सहकार विभागाला (RCS), नाबार्ड (NABARD) किंवा संस्थेच्या वार्षिक अहवालात संस्थेने स्थापनेपासून किंवा आर्थिक वर्षात **"एकूण किती कर्ज वाटप केले"** (`SUM(LoanDisbursements.DisbursementAmount)`) याचा तपशील द्यावा लागतो.
   - जुन्या कर्जदाराने जर ₹ १,००,००० कर्जापैकी ₹ ७०,००० भरून केवळ ₹ ३०,००० बाकी ठेवले असेल, तर सिस्टीम त्याचे मूळ वाटप केवळ ₹ ३०,००० दाखवते! यामुळे संस्थेचे एकूण कर्ज वितरण ₹ ७०,००० ने कमी भरते.

2. **काल्पनिक शिल्लक वाटप मर्यादा (Phantom Pending Limit Security Loophole):**
   - `LoanAccountsController.cs` (ओळ २१०-२१२) मध्ये खात्याचे तपशील देताना:
     ```csharp
     var totalDisbursed = allDisbursements.Sum(d => d.DisbursementAmount);
     var pendingLimit = Math.Max(0, account.SanctionedAmount - totalDisbursed);
     ```
   - खाते क्र. ८ चे उदाहरण: मंजूर ₹ १,५०,०००, परंतु वाटप नोंद ₹ १,२०,०००.
   - सिस्टीम गणना करते: `pendingLimit = 150000 - 120000 = ₹ 30,000`!
   - ऑपरेटरला किंवा टेलरला वाटते की कर्जदाराची **₹ ३०,००० उचल अजून बाकी आहे (Pending Limit)**. जर ऑपरेटरने नजरचुकीने हे पैसे पुन्हा वितरित केले, तर संस्थेचे मोठे आर्थिक नुकसान (Double Disbursement Risk) होऊ शकते!

3. **कर्ज खतावणी व करारपत्रात तफावत (Sanction Register vs Ledger Discrepancy):**
   - कर्ज मंजुरी ठरावात ₹ १,५०,००० मंजूर व वितरित असताना सॉफ्टवेअरच्या वाटप नोंदवहीत ₹ १,२०,००० दिसल्यास वैधानिक लेखापरीक्षक (Statutory Auditor) आक्षेप नोंदवतात.

---

### 🎯 ३. सुधारात्मक अंमलबजावणी आराखडा (Remediation Implementation Plan)

#### पाऊल १: `LoanAccountsController.cs` मध्ये दुरुस्ती (`PostOpeningBalance` व `PutOpeningBalance`)
1. **`PostOpeningBalance` (ओळ ५८९, ५९५):**
   ```diff
   - DisbursementAmount = dto.PrincipalBalance,
   + DisbursementAmount = dto.SanctionedAmount,
     ProcessingFee = 0,
     ShareDeduction = 0,
     InsuranceDeduction = 0,
     StationeryCharges = 0,
     OtherDeductions = 0,
   - NetAmountPaid = dto.PrincipalBalance,
   + NetAmountPaid = dto.SanctionedAmount,
   ```

2. **`PutOpeningBalance` (ओळ ८५३, ८५४):**
   ```diff
     disbursement.DisbursementDate = dto.LoanDisbursementDate ?? dto.OpeningDate;
     disbursement.SanctionedAmount = dto.SanctionedAmount;
   - disbursement.DisbursementAmount = dto.PrincipalBalance;
   - disbursement.NetAmountPaid = dto.PrincipalBalance;
   + disbursement.DisbursementAmount = dto.SanctionedAmount;
   + disbursement.NetAmountPaid = dto.SanctionedAmount;
     disbursement.PaymentMode = "Opening Balance";
   ```

---

#### पाऊल २: डेटाबेस जुन्या विसंगत नोंदींची स्वयंचलित दुरुस्ती (Data Healing Script)
सध्या डेटाबेसमध्ये असलेल्या आरंभिक कर्ज खात्यांच्या वाटप नोंदी त्वरित दुरुस्त करण्यासाठी एसक्यूएल पॅच तयार करणे व चालवणे:

```sql
-- Fix existing Opening Balance LoanDisbursements
UPDATE ld
SET ld.DisbursementAmount = la.SanctionedAmount,
    ld.NetAmountPaid = la.SanctionedAmount,
    ld.SanctionedAmount = la.SanctionedAmount
FROM [LoanDisbursements] ld
INNER JOIN [LoanAccounts] la ON ld.LoanAccountID = la.LoanAccountID
WHERE (ld.PaymentMode = 'Opening Balance' OR ld.Remarks LIKE '%Opening Balance%')
  AND la.IsOpeningBalance = 1
  AND (ld.DisbursementAmount <> la.SanctionedAmount OR ld.NetAmountPaid <> la.SanctionedAmount);
```

तसेच भविष्यातील सर्व शाखा/डेटाबेससाठी हा पॅच `Program.cs` च्या मायग्रेशन रुटीनमध्ये समाविष्ट करणे.

---

#### पाऊल ३: सुसंगतता पडताळणी (Regression Safety Check)
- **रोजमेळ / कॅशबुक सुरक्षा:**
  [ReportsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/ReportsController.cs) (ओळ ५००) मधील दैनंदिन रोकड व ट्रान्सफर रोजमेळात `ld.PaymentMode != "Opening Balance"` अशी आधीच फिल्टर अट आहे. त्यामुळे `DisbursementAmount` बदलल्याने आजच्या रोजमेळ अथवा कॅश शिल्लकेवर **कोणताही अनिष्ट परिणाम होत नाही**.
- **हप्ता वेळापत्रक सुरक्षा:**
  हप्ता वेळापत्रक (`LoanInstallmentSchedule`) हे `SanctionedAmount` व `PrincipalBalance` मधील फरकानुसार (`dto.SanctionedAmount - dto.PrincipalBalance`) आधीच भरलेले हप्ते ('Paid') ठरवते, त्यामुळे तेही सुरक्षित राहील.

---

### 🧪 ४. चाचणी व पडताळणी आराखडा (Verification Matrix)

| चाचणी क्र. | चाचणी प्रसंग (Scenario) | इनपुट डेटा | अपेक्षित निकाल |
|:---:|:---|:---|:---|
| **१** | **नवीन कर्ज आरंभिक शिल्लक नोंदवणे** | मंजूर: ₹ १,००,०००, मुद्दल बाकी: ₹ ६०,००० | `LoanDisbursement.DisbursementAmount = ₹ 1,00,000`, `NetAmountPaid = ₹ 1,00,000` |
| **२** | **जुनी नोंद दुरुस्त (PUT) करणे** | मंजूर: ₹ २,००,०००, मुद्दल बाकी: ₹ १,४०,००० | `LoanDisbursement.DisbursementAmount = ₹ 2,00,000` |
| **३** | **शिल्लक वाटप मर्यादा तपासणी** | मंजूर: ₹ १,००,०००, पूर्ण वितरित | `PendingLimit = ₹ 0.00` (काल्पनिक मर्यादा दिसणार नाही) |
| **४** | **एकूण वितरित कर्ज रिपोर्ट** | संस्था अहवाल | एकूण वितरित कर्जात संपूर्ण मंजूर रक्कम अचूक परावर्तित होईल |

---

### 📋 ५. वरिष्ठ लेखापरीक्षक निष्कर्ष (Auditor's Recommendation)
सदर बदल तातडीने लागू केल्यास संस्थांचे ऐतिहासिक कर्ज वाटप आकडे तंतोतंत जुळतील आणि चुकीच्या 'शिल्लक वाटप मर्यादे'चा गैरवापर टळेल.
हा कृती आराखडा मंजूर असल्यास पुढील अंमलबजावणी सुरू करण्यात येईल.
