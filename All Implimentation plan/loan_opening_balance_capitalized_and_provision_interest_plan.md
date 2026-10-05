# कोअर बँकिंग कर्ज आरंभिक शिल्लक नोंदणी (Loan Opening Balance): भांडवलीकृत व्याज (Capitalized Interest) व व्याज तरतूद (Interest Provision) व्यवस्थापन आराखडा
## Core Banking System (CBS) Loan Opening Balance Architecture & Implementation Plan

---

### १. प्रकल्प व्यवस्थापक कार्यकारी सारांश (Executive Summary & Objective)

सहकारी पतसंस्था व बँकिंग प्रणालीमध्ये (Cooperative Credit Societies & Urban Banks) जुन्या लेगसी सिस्टीममधून किंवा हस्तलिखित खतावणीतून (Manual Ledgers) कोअर बँकिंग सिस्टीममध्ये (CBS) स्थलांतर (Data Migration) करताना **"कर्ज आरंभिक शिल्लक नोंदणी" (Loan Opening Balance Master)** हा सर्वात संवेदनशील आणि आर्थिक ऑडिटच्या दृष्टीने अत्यंत महत्त्वाचा टप्पा असतो.

सध्याच्या प्रणालीचे सखोल परीक्षण केले असता, कर्ज खात्यांमध्ये दोन मुख्य बँकिंग परिस्थितींचा (Banking Scenarios) सामना होतो:
1. **मुद्दलात समाविष्ट/भांडवलीकृत झालेले व्याज (Interest Capitalized / Posted into Principal):** अनेकदा थकीत किंवा नूतनीकरण (Renewed/Restructured) झालेल्या कर्जांमध्ये मागील वर्षाचे येणे व्याज मुद्दलात जमा (debit) करून एकत्रीकरण केलेले असते. त्यामुळे खतावणीतील मुद्दल बाकी (Principal Balance) ही मूळ मंजूर रकमेपेक्षा (Sanctioned Amount) जास्त दिसते.
2. **व्याज तरतूद केलेले व्याज (Interest Provision / Accrued Interest / Suspense):** कट-ऑफ दिनांकापर्यंत खात्यावर येणे झालेले व्याज (Accrued Interest) आणि विशेषतः एन.पी.ए. (NPA/थकीत) खात्यांचे व्याज ज्याची सहकार/आरबीआय नियमांनुसार नफ्यात गणना न करता **"व्याज अनामत / थकीत व्याज तरतूद" (Interest Suspense / Provision Reserve)** म्हणून नोंद करणे बंधनकारक असते.

या आराखड्याचा मुख्य उद्देश सीबीएस (CBS) नियमांनुसार **शुद्ध मुद्दल (Pure Principal)**, **मुद्दलात समाविष्ट व्याज (Capitalized Interest)** आणि **व्याज तरतूद (Interest Provision)** यांची अचूक खतावणी, हप्ता वेळापत्रक (Amortization) आणि वसुली वॉटरफॉल (Recovery Waterfall) स्थापित करणे हा आहे.

---

### २. बँकिंग व हिशोब शास्त्र विश्लेषण (Banking & Accounting Gap Analysis)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    कर्ज आरंभिक शिल्लक वर्गीकरण (CBS Loan Balance Structure)             │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │
               ┌─────────────────────────────┴─────────────────────────────┐
               ▼                                                           ▼
┌──────────────────────────────┐                           ┌──────────────────────────────┐
│  १. एकूण मुद्दल शिल्लक       │                           │  २. येणे व्याज व तरतूद       │
│  (Total Principal Balance)   │                           │  (Interest & Provisioning)   │
└──────────────┬───────────────┘                           └──────────────┬───────────────┘
               │                                                           │
       ┌───────┴───────┐                                           ┌───────┴───────┐
       ▼               ▼                                           ▼               ▼
┌──────────────┐┌──────────────┐                           ┌──────────────┐┌──────────────┐
│१.१ मूळ मुद्दल ││१.२ समाविष्ट  │                           │२.१ चालू येणे  ││२.२ व्याज     │
│(Pure         ││    व्याज     │                           │    व्याज     ││    तरतूद     │
│ Principal)   ││(Capitalized) │                           │(Accrued Int) ││(Suspense/Prov│
└──────────────┘└──────────────┘                           └──────────────┘└──────────────┘
```

#### २.१ मुद्दलात समाविष्ट झालेले व्याज (Capitalized Interest)
- **बँकिंग अडचण:** जेव्हा पतसंस्था जुने कर्ज नूतनीकरण करते किंवा चक्रीवाढ व्याजाची आकारणी मुद्दलात खतवते, तेव्हा सिस्टीममधील मुद्दल वाढते.
- **ऑडिट आक्षेप:** ऑडिटर विचारतात की मूळ कर्ज किती होते आणि व्याजाचे रूपांतर मुद्दलात किती झाले? जर मुद्दलावर पुन्हा व्याज आकारले तर ते "व्याजावर व्याज" (Interest on Interest / Usury) ठरते का?
- **सीबीएस तोडगा:** मुद्दल बाकी नोंदवताना दोन भाग करणे:
  1. `PurePrincipalBalance` (मूळ बाकी मुद्दल)
  2. `CapitalizedInterestAmount` (मुद्दलात पोस्ट झालेले व्याज)
  3. `PrincipalBalance` = `PurePrincipalBalance` + `CapitalizedInterestAmount` (एकूण लेजर मुद्दल)

#### २.२ व्याज तरतूद (Interest Provision / Suspense)
- **बँकिंग अडचण:** स्टँडर्ड (Standard/नियमित) खात्यांचे येणे व्याज हे संस्थेचे उत्पन्न असते; परंतु सब-स्टँडर्ड, संशयित किंवा बुडीत (NPA) खात्यांचे येणे व्याज हे उत्पन्न म्हणून नफा-तोटा पत्रकात (P&L) दाखवता येत नाही (As per Prudential Norms on Income Recognition).
- **सीबीएस तोडगा:** 
  - आरंभिक शिल्लक नोंदणीत **व्याज बाकी (Accrued Interest)** सोबतच **"व्याज तरतूद / अनामत रक्कम" (Interest Provision / Suspense)** प्रविष्ट करण्याची सुविधा देणे.
  - यामुळे बॅलन्स शीटमध्ये `Loan Asset` वाढतानाच समोर `Interest Suspense Reserve` चे लायबिलिटी/कंट्रा लेजर संतुलित राहील.

---

### ३. डेटाबेस व सिस्टीम मॉडेल विस्तार (Database & Model Enhancements)

#### ३.१ `LoanAccount` मॉडेलमधील बदल (`api/Bhisi.Api/Models/LoanAccount.cs`)
```csharp
// --- CAPITALIZED INTEREST & PURE PRINCIPAL BIFURCATION ---
[Column(TypeName = "decimal(18,2)")]
public decimal PurePrincipalBalance { get; set; } = 0; // मूळ शुद्ध मुद्दल बाकी

[Column(TypeName = "decimal(18,2)")]
public decimal CapitalizedInterestAmount { get; set; } = 0; // मुद्दलात समाविष्ट झालेले व्याज

// PrincipalBalance = PurePrincipalBalance + CapitalizedInterestAmount (खतावणी मुद्दल)

// --- INTEREST PROVISIONING & SUSPENSE ---
[Column(TypeName = "decimal(18,2)")]
public decimal AccruedInterestBalance { get; set; } = 0; // चालू येणे व्याज

[Column(TypeName = "decimal(18,2)")]
public decimal InterestProvisionBalance { get; set; } = 0; // थकीत व्याज तरतूद / अनामत (Suspense)

[StringLength(20)]
public string InitialNpaClassification { get; set; } = "Standard"; // Standard, SubStandard, Doubtful, Loss

public bool ChargeInterestOnCapitalizedAmount { get; set; } = true; // मुद्दलातील व्याजावर पुढील व्याज आकारायचे का?
```

#### ३.२ `LoanOpeningBalanceDto` मॉडेल विस्तार
```csharp
public class LoanOpeningBalanceDto
{
    // विद्यमान फील्ड्स...
    public decimal PurePrincipalBalance { get; set; }
    public decimal CapitalizedInterestAmount { get; set; }
    public decimal PrincipalBalance { get; set; } // Total Ledger Principal
    
    public decimal InterestBalance { get; set; }
    public decimal OverdueInterestBalance { get; set; }
    public decimal InterestProvisionBalance { get; set; } // व्याज तरतूद
    
    public string InitialNpaClassification { get; set; } = "Standard";
    public bool ChargeInterestOnCapitalizedAmount { get; set; } = true;
    
    // Schedule, Guarantors, Securities...
}
```

---

### ४. वापरकर्ता इंटरफेस (UI/UX) सुधारणा योजना (`LoanOpeningBalanceMaster.tsx`)

`LoanOpeningBalanceMaster.tsx` मधील **"३. बाकी रक्कम (Outstanding Balances)"** या विभागाची पुनर्रचना खालीलप्रमाणे करण्यात येईल:

#### ४.१ मुद्दल विभाग (Principal Bifurcation Card)
1. **शुद्ध मुद्दल बाकी (Pure Principal Balance):** 
   - कर्जदाराचे मूळ येणे बाकी असलेले मुद्दल.
2. **मुद्दलात समाविष्ट व्याज (Capitalized Interest Posted):**
   - पूर्वीच्या वर्षांचे मुद्दलात जमा केलेले व्याज (डिफॉल्ट: ₹ 0.00).
   - वापरकर्त्याने येथे रक्कम टाकल्यास:
     $$\text{एकूण मुद्दल बाकी (Principal Balance)} = \text{Pure Principal} + \text{Capitalized Interest}$$
   - जर एकूण मुद्दल > मंजूर रक्कम झाली, तर सिस्टम लाल रंगाचा एरर न दाखवता निळ्या रंगाचा इन्फो बॅनर दाखवेल:
     > ℹ️ *नोंद: मुद्दलामध्ये ₹ X,XXX व्याज समाविष्ट झाल्यामुळे एकूण मुद्दल मंजूर रकमेपेक्षा जास्त आहे.*

#### ४.२ व्याज व तरतूद विभाग (Interest & Provisioning Card)
1. **चालू येणे व्याज (Accrued Regular Interest):** नियमित हप्त्यांचे न आलेले व्याज.
2. **थकीत व्याज (Overdue/Penal Interest):** मुदत संपल्यानंतरचे किंवा थकीत दंडात्मक व्याज.
3. **व्याज तरतूद / अनामत (Interest Provision / Suspense Amount):**
   - खाते NPA असल्यास किंवा ऑडिट नियमांनुसार व्याजाची तरतूद असल्यास ही रक्कम टाकावी.
   - सोबत **कर्ज वर्गवारी (Asset Classification Dropdown):** [नियमित (Standard), सब-स्टँडर्ड (Sub-Standard), संशयित (Doubtful), बुडीत (Loss)].

---

### ५. लेजर व तेरीज पत्रक अकाउंटिंग नोंदी (General Ledger & Trial Balance Accounting Entries)

आरंभिक शिल्लक नोंदवताना सिस्टीम खालीलप्रमाणे बॅकएंड जर्नल व्हाउचर्स (Opening JV) पोस्ट करेल:

#### ५.१ नियमित खाते (Standard Account Migration)
| खाते (Account / Ledger) | Dr / Cr | रक्कम (Amount) | तपशील (Particulars) |
|---|:---:|:---:|---|
| **संबंधित कर्ज खाते (Loan A/c)** | **Dr** | मुद्दल (Principal) | आरंभिक शिल्लक मुद्दल नोंद (Pure + Capitalized) |
| **कर्ज येणे व्याज खाते (Loan Interest Receivable)** | **Dr** | येणे व्याज (Interest) | कट-ऑफ दिनांकापर्यंतचे येणे व्याज |
| **आरंभिक शिल्लक जुळवणी खाते (Opening Balance Migration Reserve A/c)** | **Cr** | एकूण रक्कम | तेरीज जुळवणीसाठी क्रेडिट |

#### ५.२ थकीत/NPA खाते (NPA Account with Interest Provision)
| खाते (Account / Ledger) | Dr / Cr | रक्कम (Amount) | तपशील (Particulars) |
|---|:---:|:---:|---|
| **संबंधित कर्ज खाते (Loan A/c)** | **Dr** | मुद्दल (Principal) | मुद्दल शिल्लक नोंद |
| **थकीत कर्ज व्याज खाते (Overdue Interest Receivable)** | **Dr** | थकीत व्याज | थकीत व्याज नोंद |
| **थकीत व्याज अनामत तरतूद (Overdue Interest Suspense/Reserve A/c)** | **Cr** | तरतूद रक्कम | **उत्पन्न न मानता केलेली सुरक्षित तरतूद** |
| **आरंभिक शिल्लक जुळवणी खाते (Opening Balance Migration A/c)** | **Cr** | उर्वरित मुद्दल | तेरीज जुळवणीसाठी क्रेडिट |

---

### ६. हप्ता वसुली वॉटरफॉल लॉजिक (Recovery Waterfall Priority)

जेव्हा कर्जदार वसुलीची रक्कम जमा करेल (`LoanCollectionsController.cs`), तेव्हा सिस्टीम खालील सीबीएस नियमानुसार पैसे वळते करेल:

```
[रक्कम जमा (Collection Amount)]
              │
              ▼
   १. कायदेशीर व वसुली खर्च (Legal & Recovery Expenses)
              │
              ▼
   २. थकीत व चालू व्याज (Overdue Interest & Accrued Interest)
      (यातील तरतूद असलेले व्याज फिटल्यास तेवढी रक्कम 'व्याज अनामत' मधून 'नफ्यात' वर्ग होईल)
              │
              ▼
   ३. मुद्दलात समाविष्ट व्याज (Capitalized Interest)
              │
              ▼
   ४. मूळ शुद्ध मुद्दल (Pure Principal)
              │
              ▼
   ५. जादा रक्कम / आगाऊ ठेव (Surplus / Advance Principal)
```

---

### ७. टप्पेनिहाय अंमलबजावणी आराखडा व माइलस्टोन्स (Implementation Sprints)

| टप्पा (Phase) | कार्य (Tasks) | आउटपुट (Deliverable) |
|---|---|---|
| **Phase 1: डेटाबेस व बॅकएंड एपीआय** | - `LoanAccount.cs` मध्ये `PurePrincipalBalance`, `CapitalizedInterestAmount`, `InterestProvisionBalance` जोडणे.<br>- मायग्रेशन स्क्रिप्ट तयार करणे.<br>- `LoanAccountsController.PostOpeningBalance` अपडेट करणे. | डेटाबेस स्कीमा व DTO तयार. |
| **Phase 2: फ्रंटएंड UI पुनर्रचना** | - `LoanOpeningBalanceMaster.tsx` मध्ये मुद्दल बायफरकेशन (Bifurcation Inputs) तयार करणे.<br>- मुद्दलातील व्याज व तरतूद रकमेची स्वयं-गणना जोडणे.<br>- कट-ऑफ तारीख व मंजूर रकमेचे व्हॅलिडेशन सुधारणे. | वापरकर्ता-स्नेही व स्पष्ट UI. |
| **Phase 3: हप्ता वेळापत्रक व हिशोब इंजिन** | - `LoanScheduleGenerator.cs` मध्ये जर व्याजावर व्याज आकारायचे नसेल तर फक्त शुद्ध मुद्दलावर हप्ता काढणे किंवा एकत्रित मुद्दलावर हप्ता काढण्याचा पर्याय देणे. | अचूक हप्ता चार्ट. |
| **Phase 4: वसुली व लेजर मॅपिंग** | - `LoanCollectionsController.cs` मध्ये मुद्दलातील समाविष्ट व्याज आणि व्याज तरतुदीचे रिव्हर्सल लॉजिक अपडेट करणे. | १००% ऑडिट-सुसंगत वसुली. |
| **Phase 5: चाचणी व पडताळणी** | - टेस्ट डेटासह जुनी कर्जे भरून तेरीज पत्रक (Trial Balance) आणि नफा-तोटा पत्रक तपासणे. | गो-लाइव्ह मंजुरी. |
