# 🛡️ वरिष्ठ सिस्टीम लेखापरीक्षक (Senior System Auditor) सुधारात्मक कृती योजना
## दोष क्र. ३ [उच्च / HIGH]: आरंभिक शिल्लक नोंदणी व दुरुस्तीमध्ये ऑडिट ट्रेल (Audit Trail) चा अभाव — फॉरेन्सिक ऑडिट व छेडछाड प्रतिबंध (Anti-Tampering)

---

### 📌 १. समस्या विश्लेषण व फॉरेन्सिक ऑडिट जोखीम (Forensic Audit & Risk Assessment)

#### अ. सद्यस्थितीतील त्रुटी:
1. **बॅकएंड (`LoanAccountsController.cs`):**
   - कर्ज आरंभिक शिल्लक नोंदवणे (`PostOpeningBalance`) आणि दुरुस्त करणे (`PutOpeningBalance`) या अत्यंत संवेदनशील आर्थिक कृती आहेत.
   - या पद्धतींमध्ये सद्यस्थितीत:
     1. **लॉग-इन युझरची खरी ओळख नाही:** ऑपरेटरचे खरे खाते (JWT Claims / User identity) न तपासता थेट `UserID = 1`, `Username = "Manager"` असे हार्डकोडेड व्हॅल्यूज वापरले जात आहेत.
     2. **मशीन आयपी ॲड्रेसचा अभाव (`IPAddress`):** ऑपरेटरने कोणत्या शाखेतून, कोणत्या संगणकावरून किंवा IP ॲड्रेसवरून नोंदी केल्या अथवा बदलल्या याचा कोणतीही नोंद होत नाही (`IPAddress = null`).
     3. **जुनी शिल्लक विरुद्ध नवीन शिल्लक (Old Balance vs New Balance Snapshot):** संपादन करताना (`PutOpeningBalance`) खात्याची आधीची मूळ शिल्लक काय होती आणि ती बदलून किती करण्यात आली (उदा. ₹ ५,००,००० ची मुद्दल परस्पर कमी करून ₹ ३,००,००० केली का?) याचा तुलनात्मक (Before vs After Diff) स्नॅपशॉट जतन होत नाही.
     4. **डिलीट क्रियेचा ऑडिट अभाव:** जर एखाद्या ऑपरेटरने आरंभिक कर्ज खाते डिलीट (`DeleteLoanAccount`) केले, तर त्याचा कोणताही ऑडिट ट्रेल सिस्टीममध्ये तयार होत नाही.

```
[सद्यस्थितीतील कमकुवत लॉग]
Action: LOAN_OPENING_BALANCE_UPDATED
UserID: 1 (हार्डकोडेड)
Username: "Manager" (खोटा युझर)
IPAddress: NULL (कोणत्या मशीनवरून बदलले अज्ञात)
Details: फक्त चालू नवीन आकडे (पूर्वीची शिल्लक काय होती याचा कोणताही पुरावा नाही!) ❌
```

#### ब. बँकिंग, कायदेशीर व फॉरेन्सिक ऑडिट जोखीम (Banking & Legal Risks):
* **डेटा छेडछाड व अपहाराचा धोका (Data Tampering & Fraud):** एखादा कर्मचारी अथवा ऑपरेटर संगनमताने कर्जदाराची जुनी शिल्लक कमी करू शकतो. मूळ शिल्लक काय होती याचा लॉग नसल्याने फॉरेन्सिक ऑडिटमध्ये आर्थिक अपहार सिद्ध करणे अशक्य होते.
* **आरबीआय आयटी गव्हर्नन्स मार्गदर्शक तत्त्वांचे उल्लंघन (RBI IT Governance Framework):** रिझर्व्ह बँकेच्या मास्टर डायरेक्शननुसार (Section 10.3 - Audit Trails) सर्व कोअर बँकिंग व्यवहारांवर **युझर आयडी, टाइमस्टॅम्प, क्लायंट आयपी आणि बिफोर-आफ्टर व्हॅल्यूज** नोंदवणे कायदेशीररीत्या अनिवार्य आहे.
* **जबाबदारी निश्चितीचा अभाव (Lack of Accountability):** सर्व बदल 'Manager' च्या नावाने दिसल्यास प्रत्यक्ष चूक किंवा अपहार कोणत्या ऑपरेटरने केला हे ठरवता येत नाही.

---

### 🎯 २. सुधारात्मक आर्किटेक्चर व डिझाइन (Remediation Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ऑपरेटर विनंती (HTTP Request)                          │
│   JWT Token (UserID, Username, Role) + RemoteIpAddress / X-Forwarded   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 GetAuditContext() खाजगी सहाय्यक पद्धत                  │
│    -> Claims मधून खरा UserID व Username मिळवणे                          │
│    -> HttpContext वरून मशीनचा खरा IP Address मिळवणे                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
┌───────────────────────────────┐   ┌────────────────────────────────────────┐
│  नवीन नोंद (POST Opening)     │   │  दुरुस्ती / संपादन (PUT Opening)        │
├───────────────────────────────┤   ├────────────────────────────────────────┤
│ • Full Snapshot तयार करणे     │   │ • चरण १: जुन्या स्थितीचा स्नॅपशॉट घेणे │
│ • UserID, Username, IP नोंदवणे│   │ • चरण २: नवीन डेटा अपडेट करणे          │
│ • "LOAN_OPENING_CREATED" लॉग  │   │ • चरण ३: जुने vs नवीन Diff काढणे      │
│                               │   │ • "LOAN_OPENING_UPDATED" लॉग करणे      │
└───────────────────────────────┘   └────────────────────────────────────────┘
```

---

### 📋 ३. प्रस्तावित ऑडिट डेटा मॉडेल रचना (Structured Audit Payload)

संपादन (`PUT`) क्रियेसाठी `AuditLogs.Details` मध्ये खालीलप्रमाणे संरचित (Structured JSON + Marathi Summary) जतन केले जाईल:

```json
{
  "event": "LOAN_OPENING_BALANCE_UPDATED",
  "loanAccountNo": "HQ0200004",
  "borrowerName": "प्रवीण विठ्ठल पाटील",
  "operator": "operator_pune",
  "ipAddress": "192.168.1.45",
  "timestamp": "2026-10-03T23:35:00",
  "differences": [
    {
      "field": "PrincipalBalance",
      "oldValue": "500000.00",
      "newValue": "450000.00",
      "diff": "-50000.00"
    },
    {
      "field": "InterestBalance",
      "oldValue": "25000.00",
      "newValue": "20000.00",
      "diff": "-5000.00"
    },
    {
      "field": "InitialNpaClassification",
      "oldValue": "Standard",
      "newValue": "Sub-Standard"
    }
  ],
  "oldSnapshot": { ... },
  "newSnapshot": { ... }
}
```

---

### 🛠️ ४. विस्तृत अंमलबजावणी कृती आराखडा (Step-by-Step Implementation Steps)

#### पाऊल १: `LoanAccountsController.cs` मध्ये नेमस्पेस व ऑडिट संदर्भ पद्धत जोडणे
1. `using System.Security.Claims;` जोडणे.
2. `GetAuditContext()` सहाय्यक पद्धत जोडणे:
   - `User.FindFirst(ClaimTypes.NameIdentifier)` / `User.FindFirst("UserID")` द्वारे प्रत्यक्ष युझर आयडी.
   - `User.FindFirst(ClaimTypes.Name)` / `User.FindFirst("Username")` द्वारे युझरनेम.
   - `HttpContext.Connection.RemoteIpAddress` व `X-Forwarded-For` द्वारे क्लायंट मशीनचा आयपी ॲड्रेस.

#### पाऊल २: `PostOpeningBalance` (नवीन आरंभिक नोंदणी) चे ऑडिट ट्रेल सक्षम करणे
1. कर्ज खाते तयार झाल्यानंतर `GetAuditContext()` वरून ऑपरेटरचा खरा आयडी व आयपी मिळवणे.
2. `Action = "LOAN_OPENING_BALANCE_CREATED"` सह:
   - खाते क्रमांक, कर्जदाराचे नाव, मंजूर रक्कम (`SanctionedAmount`), मुद्दल बाकी (`PrincipalBalance`), निव्वळ मुद्दल (`PurePrincipalBalance`), मुद्दलात रूपांतरित व्याज (`CapitalizedInterestAmount`), येणे व्याज (`InterestBalance`), थकीत व्याज (`OverdueInterestBalance`), तरतूद (`InterestProvisionBalance`), NPA वर्गवारी, दिनांक आणि मशीन आयपी जतन करणे.

#### पाऊल ३: `PutOpeningBalance` (संपादन / दुरुस्ती) मध्ये Before-After स्नॅपशॉट व Diff ट्रेल जोडणे
1. `_context.LoanAccounts.FindAsync(id)` द्वारे खाते लोड होताच, **कोणताही बदल करण्यापूर्वी जुन्या मूल्यांचा स्नॅपशॉट (`oldSnapshot`) तयार करणे**.
2. नवीन डेटा अपडेट केल्यानंतर **नवीन मूल्यांचा स्नॅपशॉट (`newSnapshot`) तयार करणे**.
3. दोन्ही स्नॅपशॉटमधील बदलांची तुलना (Comparison & Diff Engine) करून काय काय बदलले (उदा. मुद्दल, व्याज, वर्गवारी, हप्ता) याची स्वतंत्र यादी तयार करणे.
4. `Action = "LOAN_OPENING_BALANCE_UPDATED"` सह:
   - जुनी शिल्लक, नवीन शिल्लक, बदल, ऑपरेटरचे नाव व आयपी ॲड्रेस `AuditLogs` मध्ये जतन करणे.

#### पाऊल ४: `PerformLoanAccountCascadeDeleteAsync` मध्ये खाते डिलीट करतानाचा ऑडिट ट्रेल जोडणे
1. कर्ज खाते डेटाबेसवरून हटवण्यापूर्वी खात्याचा पूर्ण स्नॅपशॉट घेऊन:
   - `Action = "LOAN_ACCOUNT_DELETED"` / `"LOAN_OPENING_BALANCE_DELETED"`
   - डिलीट केलेली एकूण मुद्दल, येणे व्याज, कर्जदाराचे नाव, डिलीट करणारा ऑपरेटर व मशीन आयपी जतन करणे.

#### पाऊल ५: `EnsureInitialNpaStatusAsync` मधील ऑडिट लॉग अद्ययावत करणे
1. हार्डकोडेड `Manager` ऐवजी `GetAuditContext()` मधील खरा ऑपरेटर व आयपी ॲड्रेस वापरणे.

---

### 🧪 ५. पडताळणी व चाचणी आराखडा (Verification Matrix)

| क्र. | चाचणी प्रसंग (Scenario) | अपेक्षित ऑडिट नोंद (Expected Audit Entry) | पडताळणी पद्धत (Method) |
|---|---|---|---|
| **१** | ऑपरेटरने नवीन कर्ज आरंभिक शिल्लक नोंदवणे | `LOAN_OPENING_BALANCE_CREATED` ॲक्शन, ऑपरेटरचा आयडी, आयपी ॲड्रेस व मुद्दल/व्याज/NPA तपशील. | SQL: `SELECT TOP 1 * FROM AuditLogs ORDER BY AuditLogID DESC` |
| **२** | ऑपरेटरने शिल्लक रकमेत दुरुस्ती करणे (उदा. ₹ ५ लाखांचे ₹ ४ लाख करणे) | `LOAN_OPENING_BALANCE_UPDATED` ॲक्शन, `Details` मध्ये जुनी मुद्दल ₹ ५,००,००० व नवीन मुद्दल ₹ ४,००,००० चा स्पष्ट फरक (Diff). | SQL: `SELECT Details, IPAddress, Username FROM AuditLogs WHERE Action = 'LOAN_OPENING_BALANCE_UPDATED'` |
| **३** | आरंभिक कर्ज खाते डिलीट करणे | `LOAN_ACCOUNT_DELETED` ॲक्शन, हटवलेल्या खात्याचा क्रमांक, अंतिम शिल्लक व ऑपरेटरची माहिती. | SQL: `SELECT * FROM AuditLogs WHERE Action LIKE '%DELETED%'` |
| **४** | आयपी ॲड्रेस अचूकता | `127.0.0.1` किंवा प्रत्यक्ष लोकल नेटवर्क IP अचूक साठवला जाणे. | AuditLogs.IPAddress फील्ड तपासणे |

---

### 📋 ६. वरिष्ठ लेखापरीक्षक निष्कर्ष (Auditor's Conclusion)
सदर योजना अंमलात आल्यानंतर कोअर बँकिंगमधील कर्ज आरंभिक शिल्लक नोंदणी ही **फॉरेन्सिक ऑडिटसाठी १००% सुरक्षित, छेडछाड-प्रतिबंधित (Tamper-evident) आणि RBI सायबर सुरक्षा व IT नियमांशी पूर्णतः सुसंगत** बनेल.
