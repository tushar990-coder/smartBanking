# अंतिम कोअर बँकिंग अंमलबजावणी आराखडा (Final CBS Implementation Plan)
## योजनानिहाय डायनॅमिक व्याज पोस्टींग, लेजर मॅपिंग व कर्ज आरंभिक शिल्लक (भांडवलीकृत व्याज व व्याज तरतूद) एकात्मिक प्रणाली
### Unified Enterprise Architecture: Dynamic Scheme-Driven Interest Posting & Loan Opening Balance Management

---

| दस्तऐवज माहिती | तपशील |
|---|---|
| **प्रकल्प (Project)** | कोअर बँकिंग सिस्टीम (SmartBanking / Bhisi Software) |
| **मॉड्यूल (Module)** | कर्ज व्यवस्थापन (Loan Management & General Ledger Integration) |
| **प्रकल्प व्यवस्थापक (Role)** | Core Banking Project Manager & Enterprise Solution Architect |
| **दस्तऐवज आवृत्ती (Version)** | v1.0.0 (Final Architecture Blueprint) |
| **तारीख (Date)** | ऑक्टोबर २०२६ |
| **स्थिती (Status)** | मंजूर / अंमलबजावणीसाठी तयार (Approved for Execution) |

---

### १. कार्यकारी सारांश व उद्दिष्ट (Executive Summary & Strategic Scope)

सहकारी बँकिंग व पतसंस्था प्रणालीमध्ये (Cooperative Credit Societies) वित्तीय अचूकता, ऑडिट पूर्तता (RCS / Statutory Audit Compliance) आणि पारदर्शकता टिकवण्यासाठी कर्ज व्याज आकारणी आणि आरंभिक शिल्लक नोंदणी या दोन घटकांचे पुनर्गठन करणे अनिवार्य आहे.

हा अंतिम आराखडा खालील **दोन प्रमुख स्तंभांना (Two Core Pillars)** एकात्मिक करतो:

1. **स्तंभ १: योजनानिहाय डायनॅमिक व्याज पोस्टींग व लेजर मॅपिंग (Scheme-Driven Dynamic Interest Posting):**
   - डेटा एंट्री ऑपरेटरने योजना मास्टरमध्ये (`LoanRateMaster`) निवडलेल्या **"व्याज पोस्टींग प्रकार"** (`InterestPostingType` - उदा. **"कर्जावर"** किंवा **"येणे व्याजावर"**) नुसार प्रत्येक खात्यावर व जनरल लेजरमध्ये (GL) अचूक आणि **१००% डायनॅमिक** परावर्तन (Reflection) घडवणे.
   - सिस्टीममधील सर्व हार्ड-कोडेड मराठी/इंग्रजी लेजर सर्च (उदा. `"१३० कर्जावरील व्याज"`, `"१२ मुदत कर्ज"`, `"थकीत व्याज येणे खाते"`) पूर्णपणे काढून टाकणे.
2. **स्तंभ २: कर्ज आरंभिक शिल्लक नोंदणी (Loan Opening Balance Master):**
   - लेगसी किंवा जुन्या खात्यांमधील **"मुद्दलात समाविष्ट झालेले व्याज" (Capitalized Interest)** आणि **"शुद्ध मुद्दल" (Pure Principal)** यांचे अचूक बायफरकेशन करणे.
   - नियमित खात्यांचे चालू येणे व्याज आणि एन.पी.ए. (NPA/थकीत) खात्यांचे **"व्याज तरतूद / अनामत" (Interest Provision / Suspense)** सुरक्षित ठेवणे.
   - हप्ता वसुलीच्या वेळी (Loan Collection Waterfall) योग्य प्राधान्याने रक्कम वळती करणे.

---

### २. सिस्टीम आर्किटेक्चर व डेटा फ्लो (Architecture & Flow Diagram)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   योजना मास्टर (Loan Scheme Master)                               │
│                                                                                                  │
│  [व्याज पोस्टींग प्रकार (Posting Type)]        [डायनॅमिक लेजर मॅपिंग (GL Accounts)]              │
│  ├── 'कर्जावर' (Capitalize to Loan)            ├── मुद्दल लेजर (LoanLedgerID)                     │
│  └── 'येणे व्याजावर' (Accrue to Receivable)   ├── येणे व्याज लेजर (ReceivableInterestLedgerID)   │
│                                                ├── व्याज उत्पन्न लेजर (InterestLedgerID)          │
│                                                └── थकीत व्याज लेजर (OverdueInterestLedgerID)      │
└─────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│ १. कर्ज आरंभिक शिल्लक नोंदणी    │       │ २. मासिक / बॅच कर्ज व्याज आकारणी│
│    (Loan Opening Balance)       │       │    (Batch Loan Interest Run)    │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ • शुद्ध मुद्दल (Pure Principal) │       │ • खात्याच्या योजनेनुसार स्वयं-   │
│ • मुद्दलात समाविष्ट व्याज       │       │   वर्गीकरण (Auto-Detection)      │
│   (Capitalized Interest)        │       │ • 'कर्जावर' ➔ मुद्दलात वाढ      │
│ • चालू येणे व्याज (Accrued Int) │       │ • 'येणे व्याजावर' ➔ व्याजात वाढ │
│ • व्याज तरतूद (Interest Prov.)  │       │ • योजनानिहाय डायनॅमिक व्हाऊचर्स │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             कोअर बँकिंग खतावणी व तेरीज पत्रक (GL & Trial Balance)                │
│                                                                                                  │
│  ❌ कोणतेही हार्ड-कोडेड लेजर नाव नाही!                                                          │
│  ✔️ थेट स्कीम आयडीनुसार १००% डायनॅमिक डेबिट / क्रेडिट                                            │
│  ✔️ वसुलीच्या वेळी प्राधान्य: खर्च ➔ थकीत/येणे व्याज ➔ समाविष्ट व्याज ➔ मूळ मुद्दल               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### ३. तपशीलवार घटक १: योजनानिहाय डायनॅमिक व्याज पोस्टींग इंजिन
#### (Component 1: Scheme-Driven Dynamic Interest Posting Engine)

#### ३.१ लेजर अकाउंटिंग मॅट्रिक्स (Dynamic Accounting Matrix)
कोणतीही स्ट्रिंग सर्च न करता खालीलप्रमाणे व्हाउचर्स तयार होतील:

| योजना प्रकार (InterestPostingType) | खात्यातील शिल्लक बदल | जर्नल व्हाऊचर लेजर नोंदी (Dynamic Journal Entries) |
|---|---|---|
| **'कर्जावर'** <br>*(Capitalize to Loan / मुद्दलात जमा)* | `acc.PrincipalBalance += CalculatedInterest` | • **Dr.** योजना मुद्दल लेजर (`rate.LoanLedgerID`)<br>• **Cr.** योजना व्याज उत्पन्न लेजर (`rate.InterestLedgerID`) |
| **'येणे व्याजावर'** <br>*(Accrue to Receivable / येणे व्याज)* | `acc.InterestBalance += CalculatedInterest` | • **Dr.** योजना येणे व्याज लेजर (`rate.ReceivableInterestLedgerID`)<br>• **Cr.** योजना व्याज उत्पन्न लेजर (`rate.InterestLedgerID`) |

#### ३.२ बॅकएंड बदल (`api/Bhisi.Api/Controllers/LoanAccountsController.cs`)
1. **हार्ड-कोडेड स्ट्रिंग्ज काढणे:** `"१३० कर्जावरील व्याज"` आणि `"१२ मुदत कर्ज"` शोधणारे सर्व कोड ब्लॉक्स कायमस्वरूपी डिलीट करणे.
2. **`PreviewInterestPosting` व `PostInterestBatch` मध्ये बदल:**
   - खात्याच्या योजनेतील `InterestPostingType` नुसार आपोआप निर्णय:
     ```csharp
     bool isCapitalize = (acc.LoanRate?.InterestPostingType?.Trim() == "कर्जावर") 
         || (acc.LoanRate?.InterestPostingType?.ToLower().Contains("capitalize") == true);
     
     if (isCapitalize) {
         acc.PrincipalBalance += calculatedInterest;
     } else {
         acc.InterestBalance += calculatedInterest;
     }
     ```
3. **योजनानिहाय ग्रुपिंग करून व्हाऊचर निर्मिती (Multi-Scheme Dynamic Voucher):**
   - एकाच कॉमन लेजरमध्ये सर्व रक्कम न ढकलता, खात्यांचे `LoanRateID` प्रमाणे ग्रुपिंग करून प्रत्येक योजनेच्या नेमून दिलेल्या लेजर्सना डेबिट/क्रेडिट करणे:
     ```csharp
     var schemeGroups = activeAccounts.GroupBy(a => a.LoanRateID);
     foreach (var group in schemeGroups)
     {
         var rate = await _context.LoanRates.FindAsync(group.Key);
         decimal schemeTotal = group.Sum(x => x.CalculatedInterest);
         if (schemeTotal <= 0) continue;

         bool isCapitalize = rate?.InterestPostingType == "कर्जावर";
         int debitLedgerId = isCapitalize 
             ? (rate?.LoanLedgerID ?? 0) 
             : (rate?.ReceivableInterestLedgerID ?? 0);
         int creditLedgerId = rate?.InterestLedgerID ?? 0;

         if (debitLedgerId == 0 || creditLedgerId == 0)
         {
             throw new Exception($"योजना '{rate?.LoanType}' ला आवश्यक लेजर जोडलेले नाहीत. कृपया कर्ज दर पत्रकात लेजर तपासा.");
         }

         voucher.VoucherDetails.Add(new VoucherDetail { 
             VoucherID = voucher.VoucherID, 
             LedgerID = debitLedgerId, 
             DrCr = "Dr", 
             Amount = schemeTotal 
         });
         voucher.VoucherDetails.Add(new VoucherDetail { 
             VoucherID = voucher.VoucherID, 
             LedgerID = creditLedgerId, 
             DrCr = "Cr", 
             Amount = schemeTotal 
         });
     }
     ```

#### ३.३ योजना मास्टर व्हॅलिडेशन (`LoanRateMaster.tsx` व `LoanRatesController.cs`)
1. **सक्तीचे नियम (Validation Locks):**
   - `LoanLedgerID` आणि `InterestLedgerID` निवडणे १००% बंधनकारक.
   - **जर ऑपरेटरने `InterestPostingType == "येणे व्याजावर"` निवडले, तर `ReceivableInterestLedgerID` (येणे व्याज खाते) निवडणे अनिवार्य (Required) असेल.** हे रिकामे असल्यास फॉर्म सबमिट होणार नाही.

#### ३.४ फ्रंटएंड स्क्रीन बदल (`LoanInterestPostingMaster.tsx`)
1. मॅन्युअल रेडिओ बटण बदलून तिथे डीफॉल्ट पर्याय देणे:
   - 🌟 **योजनेच्या धोरणानुसार स्वयंचलित (As per Scheme Policy - शिफारस केलेले)**
2. प्रिव्ह्यू टेबलमध्ये २ नवीन कॉलम्स:
   - **पोस्टिंग प्रकार:** (योजनेनुसार "कर्जावर" किंवा "येणे व्याजावर")
   - **प्रभावित लेजर (Impacted Ledger):** (कोणत्या लेजरला डेबिट होणार त्याचे नाव)

---

### ४. तपशीलवार घटक २: कर्ज आरंभिक शिल्लक नोंदणी - मुद्दलातील व्याज व व्याज तरतूद
#### (Component 2: Loan Opening Balance - Capitalized & Provisioned Interest)

#### ४.१ डेटाबेस मॉडेल बदल (`api/Bhisi.Api/Models/LoanAccount.cs`)
डेटाबेसमध्ये खालील नवीन फील्ड्स समाविष्ट करणे:
```csharp
// --- १. मुद्दल वर्गीकरण (Principal Bifurcation) ---
[Column(TypeName = "decimal(18,2)")]
public decimal PurePrincipalBalance { get; set; } = 0; // मूळ शुद्ध बाकी मुद्दल

[Column(TypeName = "decimal(18,2)")]
public decimal CapitalizedInterestAmount { get; set; } = 0; // मुद्दलात जमा झालेले व्याज

// PrincipalBalance = PurePrincipalBalance + CapitalizedInterestAmount (एकूण खतावणी मुद्दल)

// --- २. व्याज तरतूद व अनामत (Provisioning & Suspense) ---
[Column(TypeName = "decimal(18,2)")]
public decimal InterestProvisionBalance { get; set; } = 0; // थकीत व्याज तरतूद / अनामत

[StringLength(20)]
public string InitialNpaClassification { get; set; } = "Standard"; // Standard, SubStandard, Doubtful, Loss

public bool ChargeInterestOnCapitalizedAmount { get; set; } = true; // समाविष्ट व्याजावर पुढील व्याज आकारायचे का?
```

#### ४.२ `LoanOpeningBalanceDto` विस्तार (`LoanAccountsController.cs`)
```csharp
public class LoanOpeningBalanceDto
{
    // ... Existing properties ...
    public decimal PurePrincipalBalance { get; set; }
    public decimal CapitalizedInterestAmount { get; set; }
    public decimal PrincipalBalance { get; set; }
    
    public decimal InterestBalance { get; set; }
    public decimal OverdueInterestBalance { get; set; }
    public decimal InterestProvisionBalance { get; set; }
    
    public string InitialNpaClassification { get; set; } = "Standard";
    public bool ChargeInterestOnCapitalizedAmount { get; set; } = true;
}
```

#### ४.३ फ्रंटएंड UI पुनर्रचना (`LoanOpeningBalanceMaster.tsx`)
फॉर्मच्या **"३. बाकी रक्कम (Outstanding Balances)"** विभागात २ स्वतंत्र सब-कार्डे तयार करणे:

##### कार्ड अ: मुद्दल बाकी विभाग (Principal Breakdown)
- **शुद्ध मुद्दल बाकी (Pure Principal Balance):** कर्जदाराचे प्रत्यक्ष मूळ बाकी मुद्दल.
- **मुद्दलात समाविष्ट व्याज (Capitalized Interest Amount):** जुने मुद्दलात जोडलेले व्याज.
- **एकूण मुद्दल बाकी (Total Principal Balance):** `= Pure Principal + Capitalized Interest` (स्वयं-गणना).
- **माहिती बॅनर:** जर `Total Principal > Sanctioned Amount` असेल, तर एरर न येता निळ्या रंगाचा इन्फो मेसेज:  
  *ℹ️ नोंद: मुद्दलामध्ये ₹ X,XXX व्याज समाविष्ट झाल्यामुळे एकूण मुद्दल बाकी ही मंजूर रकमेपेक्षा जास्त आहे.*

##### कार्ड ब: व्याज व तरतूद विभाग (Interest & Provisioning)
- **चालू येणे व्याज (Accrued Interest):** चालू हप्त्यांचे न आलेले व्याज (⚡ स्वयं गणना बटणासह).
- **थकीत व्याज (Overdue Interest):** मुदत संपल्यानंतरचे किंवा दंडात्मक व्याज.
- **व्याज तरतूद / अनामत (Interest Provision / Suspense):** NPA किंवा ऑडिट तरतुदीसाठी सुरक्षित ठेवलेली व्याजाची रक्कम.
- **कर्ज वर्गवारी (NPA Classification):** Dropdown [नियमित (Standard), सब-स्टँडर्ड (Sub-Standard), संशयित (Doubtful), बुडीत (Loss)].

---

### ५. हप्ता वसुली वॉटरफॉल आणि कॉन्ट्रा लेजर रिव्हर्सल
#### (Component 3: Loan Collection Waterfall & Contra Entries)

जेव्हा कर्जदार वसुली भरेल (`LoanCollectionsController.cs`), तेव्हा खालीलप्रमाणे सीबीएस वॉटरफॉल नियमाने रक्कम जमा होईल:

```
[रक्कम जमा (Collection Amount Received)]
                 │
                 ▼
   १. कायदेशीर व वसुली खर्च (Legal / Recovery Expenses)
                 │
                 ▼
   २. थकीत व चालू येणे व्याज (Overdue Interest & Accrued Interest)
      (टीप: तरतूद असलेले व्याज वसूल झाल्यास 'थकीत व्याज अनामत' मधून 'नफ्यात' वर्ग होईल)
                 │
                 ▼
   ३. मुद्दलात समाविष्ट झालेले व्याज (Capitalized Interest)
                 │
                 ▼
   ४. मूळ शुद्ध मुद्दल बाकी (Pure Principal Balance)
                 │
                 ▼
   ५. जादा रक्कम / आगाऊ ठेव (Surplus / Advance Principal)
```

---

### ६. टप्पेनिहाय अंमलबजावणी वेळापत्रक (Sprint Roadmap & Execution Phases)

| टप्पा (Phase) | कार्य तपशील (Tasks) | आवश्यक फाईल्स (Target Files) | प्राधान्य |
|:---:|---|---|:---:|
| **Sprint 1** | **डेटाबेस व मॉडेल अपडेट**<br>• `LoanAccount.cs` मध्ये ५ नवीन फील्ड्स जोडणे.<br>• डेटाबेस मायग्रेशन तयार करून रन करणे.<br>• `LoanOpeningBalanceDto` अपडेट करणे. | • `LoanAccount.cs`<br>• `AppDbContext.cs`<br>• `LoanAccountsController.cs` | **P0 (Immediate)** |
| **Sprint 2** | **योजना मास्टर व लेजर व्हॅलिडेशन**<br>• 'येणे व्याजावर' असल्यास 'येणे व्याज खाते' अनिवार्य करणे.<br>• `LoanRateMaster.tsx` व `LoanRatesController.cs` सेव्ह व्हॅलिडेशन लॉक करणे. | • `LoanRateMaster.tsx`<br>• `LoanRatesController.cs` | **P0** |
| **Sprint 3** | **डायनॅमिक व्याज आकारणी इंजिन**<br>• `LoanAccountsController.cs` मधील हार्ड-कोडेड स्ट्रिंग्स डिलीट करणे.<br>• योजनानिहाय ग्रुपिंग व डायनॅमिक डेबिट/क्रेडिट व्हाऊचर तयार करणे.<br>• `LoanInterestPostingMaster.tsx` मध्ये योजना धोरण डीफॉल्ट करणे. | • `LoanAccountsController.cs`<br>• `LoanInterestPostingMaster.tsx` | **P0** |
| **Sprint 4** | **आरंभिक शिल्लक UI व सेव्हिंग**<br>• `LoanOpeningBalanceMaster.tsx` मध्ये मुद्दल बायफरकेशन व व्याज तरतूद कार्डे तयार करणे.<br>• सेव्ह आणि एडिट करताना ५ नवीन फील्ड्सचा प्रवाह सुरळीत करणे. | • `LoanOpeningBalanceMaster.tsx`<br>• `LoanAccountsController.cs` | **P1** |
| **Sprint 5** | **वसुली वॉटरफॉल व पडताळणी**<br>• `LoanCollectionsController.cs` मध्ये समाविष्ट व्याज आणि व्याज तरतूद रिव्हर्सल जोडणे.<br>• चाचणी खाती तयार करून डे बुक आणि तेरीज पत्रक (Trial Balance) तपासणे. | • `LoanCollectionsController.cs` | **P1** |

---

### ७. चाचणी व गुणवत्ता स्वीकृती निकष (QA & Acceptance Criteria Checklist)

- [ ] **चेक १:** 'कर्जावर' योजना असलेल्या खात्यावर व्याज आकारणी केल्यास खात्याची मुद्दल वाढते आणि व्हाऊचरमध्ये त्या योजनेचे **मुद्दल लेजर डेबिट** होते.
- [ ] **चेक २:** 'येणे व्याजावर' योजना असलेल्या खात्यावर व्याज आकारणी केल्यास मुद्दल स्थिर राहते, फक्त येणे व्याज वाढते आणि व्हाऊचरमध्ये त्या योजनेचे **येणे व्याज लेजर डेबिट** होते.
- [ ] **चेक ३:** खतावणीत लेजरचे नाव काहीही बदलले तरी सिस्टीम आयडीवरून अचूक लेजरलाच व्हाऊचर पडते (कोणतीही हार्ड-कोडेड स्ट्रिंग उरत नाही).
- [ ] **चेक ४:** आरंभिक शिल्लक नोंदवताना शुद्ध मुद्दल + समाविष्ट व्याज टाकल्यास एकूण मुद्दल आपोआप निघते आणि मंजूर रकमेपेक्षा जास्त असल्यास एरर न येता माहिती बॅनर येतो.
- [ ] **चेक ५:** थकीत खात्यांची व्याज तरतूद सुरक्षित राहते आणि वसुली झाल्यावर ती नफ्यात अचूक वर्ग होते.
- [ ] **चेक ६:** तेरीज पत्रक (Trial Balance) आणि ताळेबंद (Balance Sheet) १००% जुळतात.
