# 🛡️ वरिष्ठ सिस्टीम लेखापरीक्षक (Senior System Auditor) सुधारात्मक कृती योजना
## दोष क्र. ६ [मध्यम / MEDIUM]: भांडवलीकृत व्याजावर व्याज आकारणी बंद केल्यास (ChargeInterestOnCapitalizedAmount = false) व्याज गणनेत शुद्ध मुद्दल न वापरणे — चक्रवाढ व्याज प्रतिबंध व कायदेशीर ताळेबंद संरक्षण

---

### 📌 १. समस्या विश्लेषण व ऑडिट निरीक्षण (Root Cause & Forensic Audit Analysis)

#### अ. सद्यस्थितीतील त्रुटी:
1. **भांडवलीकृत व्याज घटकाकडे (Capitalized Interest) दुर्लक्ष:**
   - नागरी सहकारी पतसंस्था व बँकांमध्ये कर्ज पुनर्रचना (Loan Restructuring), एकरकमी समझोता (OTS) अथवा मागील थकीत खाते आरंभिक शिल्लक म्हणून घेताना थकीत व्याज मुद्दलात समाविष्ट (Capitalize) केले जाते:
     $$\text{PrincipalBalance} = \text{PurePrincipalBalance} + \text{CapitalizedInterestAmount}$$
   - यापैकी अनेक प्रकरणांमध्ये संचालक मंडळाच्या ठरावानुसार किंवा सामंजस्य करारानुसार, **समाविष्ट केलेल्या व्याजावर पुढील व्याज आकारले जाणार नाही** अशी सवलत दिली जाते. यासाठी मॉडेलमध्ये `ChargeInterestOnCapitalizedAmount` (Bit/Boolean) हा फ्लॅग दिलेला आहे.
   - परंतु प्रत्यक्ष कोड तपासणीत आढळले की, [`LoanAccountsController.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/LoanAccountsController.cs#L1722-L1724) मधील मासिक व्याज बॅच पोस्टिंग (`PreviewInterestPosting` व `PostInterestBatch`), [`LoanCollectionsController.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/LoanCollectionsController.cs#L193) आणि [`ReportsController.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/ReportsController.cs#L88) मध्ये व्याजाची गणना करताना या फ्लॅगचा **कोणताही विचार न करता थेट `acc.PrincipalBalance` वरच व्याज आकारले जात आहे:**
     ```csharp
     // ❌ विद्यमान सदोष कोड:
     decimal calculatedInterest = Math.Round((acc.PrincipalBalance * rate * daysAccrued) / 36500m, 2, MidpointRounding.AwayFromZero);
     ```

```
[आरंभिक नोंदणी: ऑपरेटरने निवडले]
PurePrincipal = ₹ 1,00,000
CapitalizedInterest = ₹ 20,000 (मुद्दलात समाविष्ट व्याज)
ChargeInterestOnCapitalizedAmount = FALSE ❌ (व्याजावर व्याज आकारू नये)
Total PrincipalBalance = ₹ 1,20,000
                      │
                      ▼
[मासिक व्याज आकारणी इंजिन (Preview & Post Batch)]
व्याज गणना: (1,20,000 * 12% * 30) / 36500 = ₹ 1,183.56  ❌ (चक्रवाढ व्याज आकारले!)
अपेक्षित गणना: (1,00,000 * 12% * 30) / 36500 = ₹ 986.30   ✔️ (केवळ शुद्ध मुद्दलावर)
                      │
                      ▼
[जोखीम: दरमहा ₹ १९७.२६ अनधिकृत अतिरिक्त व्याज आकारणी!]
```

---

#### ब. बँकिंग, वैधानिक व ग्राहक संरक्षण जोखीम (Banking & Legal Risks):
* **अनधिकृत चक्रवाढ व्याज (Unauthorized Compound Interest):** सहकार निबंधक (RCS) व रिझर्व्ह बँक (RBI) च्या मार्गदर्शक तत्त्वानुसार, शेती व वैयक्तिक कर्ज पुनर्रचनेत समाविष्ट व्याजावर चक्रवाढ व्याज आकारणे बेकायदेशीर ठरते.
* **ग्राहक मंच व सहकार न्यायालयात (Co-operative Court) खटल्याचा धोका:** संस्थेने खातेदाराला सवलत दिल्याचे लेखी देऊनही संगणकीय प्रणालीत जादा व्याज आकारल्यास संस्था न्यायालयात अडचणीत येऊ शकते आणि दंड होऊ शकतो.
* **लेजर व पावती विसंगती (Audit & Ledger Dispute):** वार्षिक लेखापरीक्षणात (Statutory Audit) भांडवलीकृत व्याजाचा ताळा न बसल्याने ऑडिट वर्गीकरणात शेरा (Audit Qualification Mark) येऊ शकतो.

---

### 🎯 २. प्रस्तावित गणितीय व तांत्रिक मॉडेल (Mathematical & Technical Model)

#### अ. व्याज-पात्र मुद्दल सूत्र (Effective Interest-Bearing Principal Formula):
ज्या कर्जावर भांडवलीकृत व्याजावर व्याज आकारणी बंद (`ChargeInterestOnCapitalizedAmount == false`) आहे, तेथे:
$$\text{EffectivePrincipal} = \min(\text{PurePrincipalBalance}, \text{PrincipalBalance})$$
*टीप: जर कर्जदाराने अंशतः परतफेड केली आणि एकूण मुद्दल बाकी शुद्ध मुद्दलापेक्षाही कमी झाली, तर $\min(\dots)$ मुळे कर्जदार अस्तित्वात असलेल्या मुद्दलापेक्षा जास्त रक्कमेवर व्याज भरण्यास कधीही बांधील राहणार नाही.*

```
जर ChargeInterestOnCapitalizedAmount == true असेल:
    EffectivePrincipal = PrincipalBalance (सामान्य संपूर्ण मुद्दल)

जर ChargeInterestOnCapitalizedAmount == false आणि PurePrincipalBalance > 0 असेल:
    EffectivePrincipal = Max(0, Min(PurePrincipalBalance, PrincipalBalance))
```

---

### 📋 ३. सुधारात्मक अंमलबजावणी घटक (Affected Code Areas)

| क्र. | फाइल व पद्धत (File & Method) | सद्यस्थितीतील गणना | प्रस्तावित सुधारणा (Remediated Logic) |
|---|---|---|---|
| **१** | `LoanAccountsController.cs` -> `PreviewInterestPosting` (L1722) | `acc.PrincipalBalance` | `GetEffectiveInterestBearingPrincipal(acc)` |
| **२** | `LoanAccountsController.cs` -> `PostInterestBatch` (L1836) | `acc.PrincipalBalance` | `GetEffectiveInterestBearingPrincipal(acc)` |
| **३** | `LoanAccountsController.cs` -> `PostInterestBatch` Voucher (L1912) | `acc.PrincipalBalance` | `GetEffectiveInterestBearingPrincipal(acc)` (व्हाउचर आणि खात्यांचा अचूक ताळा) |
| **४** | `LoanCollectionsController.cs` -> पावती वसुली दैनिक व्याज (L193) | `loanAccount.PrincipalBalance` | `GetEffectiveInterestBearingPrincipal(loanAccount)` |
| **५** | `ReportsController.cs` -> लेजर व स्टेटमेंट रिपोर्ट (L88) | `la.PrincipalBalance` | `GetEffectiveInterestBearingPrincipal(la)` |
| **६** | `LoanInterestPostingItemDto` | केवळ CurrentPrincipal | `InterestBearingPrincipal` व `CapitalizedInterestAmount` डिस्प्ले जोडणे |

---

### 🛠️ ४. तपशीलवार कृती आराखडा (Step-by-Step Implementation Steps)

#### पाऊल १: केंद्रीय सहाय्यक पद्धत (Centralized Calculation Helper)
`LoanAccountsController.cs` (किंवा `Helpers/InterestCalculationHelper.cs`):
```csharp
public static decimal GetEffectiveInterestBearingPrincipal(LoanAccount acc)
{
    if (!acc.ChargeInterestOnCapitalizedAmount && acc.PurePrincipalBalance > 0)
    {
        return Math.Max(0m, Math.Min(acc.PurePrincipalBalance, acc.PrincipalBalance));
    }
    return Math.Max(0m, acc.PrincipalBalance);
}
```

#### पाऊल २: `PreviewInterestPosting` मध्ये सुधारणा
```csharp
decimal effectivePrincipal = GetEffectiveInterestBearingPrincipal(acc);
decimal calculatedInterest = daysAccrued > 0
    ? Math.Round((effectivePrincipal * rate * daysAccrued) / 36500m, 2, MidpointRounding.AwayFromZero)
    : 0m;
```
तसेच DTO मध्ये `InterestBearingPrincipal = effectivePrincipal` पाठवणे.

#### पाऊल ३: `PostInterestBatch` मध्ये खाती व व्हाउचर्स समक्रमण
- खात्यांवरील मुद्दल/येणे व्याज अपडेट करताना `GetEffectiveInterestBearingPrincipal(acc)` वापरणे.
- लेजर व्हाउचर (`VoucherDetails`) तयार करतानाही याच सूत्राने एकूण योजनेचे व्याज काढणे, जेणेकरून लेजर व सब-लेजर १००% मॅच होतील.

#### पाऊल ४: दैनिक वसुली व अहवाल (Collections & Reports) समक्रमण
- `LoanCollectionsController.cs` आणि `ReportsController.cs` मध्ये हेच सूत्र वापरणे.

---

### 🧪 ५. पडताळणी व चाचणी आराखडा (Verification Matrix)

| चाचणी प्रसंग (Scenario) | इनपुट पॅरामीटर्स | अपेक्षित व्याज-पात्र मुद्दल | अपेक्षित निकाल |
|---|---|---|---|
| **सामान्य कर्ज (Regular Loan)** | Principal: ₹ 1,00,000, ChargeOnCap: TRUE | ₹ 1,00,000 | 1 लाख वर नियमित व्याज आकारले जाईल. |
| **भांडवलीकृत व्याजावर सवलत (Cap Interest Exempt)** | Pure: ₹ 1,00,000, CapInt: ₹ 25,000, Total: ₹ 1,25,000, ChargeOnCap: FALSE | **₹ 1,00,000** | केवळ 1 लाख शुद्ध मुद्दलावर व्याज आकारले जाईल (₹ 25,000 वर ₹ ० व्याज). |
| **सवलत असलेल्या कर्जाची अंशतः परतफेड** | Total Principal कमी होऊन ₹ 70,000 झाले, Pure: ₹ 1,00,000, ChargeOnCap: FALSE | **₹ 70,000** | $\min(100000, 70000) = 70,000$ वरच व्याज आकारले जाईल. |
| **व्हाउचर व लेजर ताळा** | PostInterestBatch चालवणे | सर्व खात्यांची बेरीज = व्हाउचरची नावे/जमा रक्कम | तेरीज पत्रक व नफा-तोटा खात्यात ० पैशांचीही विसंगती नसेल. |

---

### 📋 ६. वरिष्ठ लेखापरीक्षक निष्कर्ष (Auditor's Conclusion)
सदर सुधारात्मक बदल लागू केल्याने पतसंस्थेचे व्याज आकारणी इंजिन कायदेशीरदृष्ट्या **१००% निर्दोष** होईल आणि अनधिकृत चक्रवाढ व्याजाची वसुली कायमची थांबेल.
