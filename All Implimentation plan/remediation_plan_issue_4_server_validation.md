# 🛡️ वरिष्ठ सिस्टीम लेखापरीक्षक (Senior System Auditor) सुधारात्मक कृती योजना
## दोष क्र. ४ [उच्च / HIGH]: बॅकएंड स्तरावर ऋणात्मक मूल्ये (Negative Values) व कट-ऑफ दिनांक मर्यादा व्हॅलिडेशनचा अभाव — सर्व्हर-साइड गार्ड क्लॉजेस व तेरीज पत्रक (Trial Balance) संरक्षण

---

### 📌 १. समस्या विश्लेषण व ऑडिट निरीक्षण (Root Cause & Audit Analysis)

#### अ. सद्यस्थितीतील त्रुटी:
1. **केवळ फ्रंटएंडवर अवलंबित्व (Client-Side Only Validation Vulnerability):**
   - कर्ज आरंभिक शिल्लक भरताना रकमा धन (Positive) असणे, मुद्दल मंजूर रक्कमेपेक्षा कमी असणे आणि दिनांक कट-ऑफ दिनांकाच्या आत असणे ही सर्व नियंत्रणे केवळ रिॲक्ट फॉर्म (`LoanOpeningBalanceMaster.tsx`) मध्ये लिहिलेली आहेत.
   - बॅकएंड API (`LoanAccountsController.cs`) मध्ये `PostOpeningBalance` किंवा `PutOpeningBalance` कॉल होताना खालीलपैकी एकाही नियमाची सर्व्हर-साइड तपासणी (Server-Side Guard Clause) अस्तित्वात नाही:
     - `SanctionedAmount <= 0` (शून्य किंवा उणे मंजूर रक्कम)
     - `PrincipalBalance < 0` (उणे मुद्दल बाकी)
     - `PrincipalBalance > SanctionedAmount` (मंजूर रक्कमेपेक्षा जास्त मुद्दल बाकी)
     - `PurePrincipalBalance < 0` अथवा `CapitalizedInterestAmount < 0` (उणे निव्वळ मुद्दल/समाविष्ट व्याज)
     - `InterestBalance < 0` अथवा `OverdueInterestBalance < 0` (उणे येणे व्याज)
     - `OpeningDate > CutoffDate` (कट-ऑफ दिनांकाच्या नंतरचा चालू आर्थिक वर्षातील दिनांक)
     - `LoanDisbursementDate > CutoffDate` (कट-ऑफ नंतरचा कर्ज वाटप दिनांक)

```
[पोस्टमन / स्क्रिप्ट / थेट API कॉल]
Payload: { PrincipalBalance: -50000, OpeningDate: "2026-10-03" }
           │
           ▼
[LoanAccountsController.cs] ───► कोणतीही रोख / गार्ड क्लॉज नाही! ❌
           │
           ▼
[SQL Server Database] ─────────► उणे शिल्लक व चालू वर्षातील तारीख थेट सेव्ह!
           │
           ▼
[तेरीज पत्रक / जनरल लेजर] ──────► कर्ज मालमत्ता लेजर उणे (Credit) होऊन तेरीज पत्रक (Trial Balance) बिघडले!
```

#### ब. बँकिंग व आर्थिक जोखीम (Banking & Financial Risks):
* **तेरीज पत्रक विसंगती (Trial Balance Distortion):** बँक खाती व लेजरच्या नियमानुसार कर्ज खाते हे 'मालमत्ता' (Asset) असल्याने त्याची शिल्लक नेहमी नावे (Debit / Positive) असायला हवी. उणे शिल्लक घुसल्यास मालमत्ता बाजूला जमा (Credit) शिल्लक दिसेल, ज्यामुळे ताळेबंद व तेरीज पत्रक संतुलित राहणार नाही.
* **व्हाउचर प्रणालीला बायपास (Voucher Approval Bypass):** जर ऑपरेटरने चालू आर्थिक वर्षातील तारीख (उदा. आजची तारीख) टाकून ओपनिंग बॅलन्स घुसवला, तर चालू वर्षात होणारे कर्ज वाटप नियमित व्हाउचर, रोख वाटप (Cash/Bank Payment) व संचालक मंडळ मंजुरी प्रक्रियेशिवाय परस्पर डेटाबेसमध्ये दाखल होईल.
* **अशक्य आर्थिक स्थिती (Impossible Financial State):** मंजूर कर्जापेक्षा शिल्लक मुद्दल जास्त असणे किंवा मुदत ० महिने असणे अशा सदोष नोंदींमुळे हप्ता तक्ता व व्याज आकारणी इंजिन (Interest Accrual Engine) रन-टाइम क्रॅश होऊ शकते.

---

### 🎯 २. प्रस्तावित सुरक्षा आर्किटेक्चर (Server-Side Guard Clause Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│               इनकमिंग HTTP विनंती (POST / PUT OpeningBalance)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             ValidateOpeningBalanceDtoAsync(dto) गार्ड क्लॉज            │
├────────────────────────────────────────────────────────────────────────┤
│ १. संख्यात्मक वैधता: SanctionedAmount > 0, Principal >= 0               │
│ २. तार्किक मर्यादा: PrincipalBalance <= SanctionedAmount              │
│ ३. उप-घटक ताळा: PurePrincipal + CapInt = PrincipalBalance           │
│ ४. व्याज व तरतूद: Interest >= 0, Overdue >= 0, Prov >= 0               │
│ ५. कट-ऑफ दिनांक मर्यादा: OpeningDate, DisbursementDate <= CutoffDate   │
│ ६. संदर्भ अखंडता: BranchID > 0, Customer/Member निवड अनिवार्य           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            │ त्रुटी आढळल्यास                               │ १००% वैध असल्यास
            ▼                                               ▼
┌───────────────────────────────┐           ┌────────────────────────────────┐
│ HTTP 400 Bad Request          │           │ व्यवहार पुढे सुरू ठेवणे        │
│ { message: "मंजूर रक्कम ₹ ०   │           │ (Database Save & Audit Log)    │
│  पेक्षा जास्त असणे आवश्यक..." }│           └────────────────────────────────┘
└───────────────────────────────┘
```

---

### 📋 ३. नियमावली व प्रमाणीकरण मॅट्रिक्स (Validation Rules Matrix)

| क्र. | फील्ड (Field) | वैधानिक नियम (Statutory Rule) | अयशस्वी झाल्यास एरर मेसेज (Error Message) |
|---|---|---|---|
| **१** | `SanctionedAmount` | `> 0` | `"कर्ज मंजूर रक्कम (Sanctioned Amount) ₹ ० पेक्षा जास्त असणे बंधनकारक आहे."` |
| **२** | `PrincipalBalance` | `>= 0` | `"मुद्दल बाकी (Principal Balance) उणे (Negative) असू शकत नाही."` |
| **३** | `PrincipalBalance` vs `SanctionedAmount` | `Principal <= Sanctioned` | `"मुद्दल बाकी मंजूर रक्कमेपेक्षा जास्त असू शकत नाही."` |
| **४** | `PurePrincipalBalance` | `>= 0` | `"निव्वळ मुद्दल बाकी (Pure Principal Balance) उणे असू शकत नाही."` |
| **५** | `CapitalizedInterestAmount` | `>= 0` | `"मुद्दलात समाविष्ट व्याज (Capitalized Interest) उणे असू शकत नाही."` |
| **६** | `InterestBalance` | `>= 0` | `"चालू येणे व्याज (Interest Balance) उणे असू शकत नाही."` |
| **७** | `OverdueInterestBalance` | `>= 0` | `"थकीत येणे व्याज (Overdue Interest) उणे असू शकत नाही."` |
| **८** | `InterestProvisionBalance` | `>= 0` | `"व्याज तरतूद शिल्लक (Interest Provision) उणे असू शकत नाही."` |
| **९** | `InterestRate` | `>= 0` आणि `<= 100` | `"व्याज दर (Interest Rate) ०% ते १००% दरम्यान असणे आवश्यक आहे."` |
| **१०** | `DurationMonths` | `> 0` | `"कर्ज कालावधी (Duration Months) ० पेक्षा जास्त असणे आवश्यक आहे."` |
| **११** | `SecurityValue` | `>= 0` | `"तारण मूल्य (Security Value) उणे असू शकत नाही."` |
| **१२** | `OpeningDate` | `<= CutoffDate` | `"आरंभिक शिल्लक दिनांक कट-ऑफ दिनांकाच्या नंतरचा असू शकत नाही."` |
| **१३** | `LoanDisbursementDate` | `<= CutoffDate` | `"कर्ज वाटप दिनांक कट-ऑफ दिनांकाच्या नंतरचा असू शकत नाही."` |
| **१४** | `Disbursement vs Opening` | `Disbursement <= Opening` | `"कर्ज वाटप दिनांक आरंभिक शिल्लक दिनांकाच्या नंतरचा असू शकत नाही."` |
| **१५** | `Customer / Member` | `CustomerID > 0 || MemberID > 0` | `"कर्जदार ग्राहक (Customer) किंवा सभासद (Member) निवडणे अनिवार्य आहे."` |

---

### 🛠️ ४. विस्तृत अंमलबजावणी योजना (Step-by-Step Implementation Plan)

#### पाऊल १: `LoanAccountsController.cs` मध्ये `ValidateOpeningBalanceDtoAsync` पद्धत तयार करणे
```csharp
private async Task<string?> ValidateOpeningBalanceDtoAsync(LoanOpeningBalanceDto dto)
{
    // १. प्राथमिक संदर्भ तपासणी
    if (dto.BranchID <= 0)
        return "अवैध शाखा (Invalid Branch ID).";

    if ((!dto.CustomerID.HasValue || dto.CustomerID.Value <= 0) && (!dto.MemberID.HasValue || dto.MemberID.Value <= 0))
        return "कर्जदार ग्राहक (Customer) किंवा सभासद (Member) निवडणे अनिवार्य आहे.";

    if (dto.LoanRateID <= 0)
        return "कर्ज योजना (Loan Scheme / Rate ID) निवडणे अनिवार्य आहे.";

    // २. रकमांची संख्यात्मक व ऋणात्मक तपासणी
    if (dto.SanctionedAmount <= 0)
        return "कर्ज मंजूर रक्कम (Sanctioned Amount) ₹ ० पेक्षा जास्त असणे बंधनकारक आहे.";

    if (dto.PrincipalBalance < 0)
        return "मुद्दल बाकी (Principal Balance) उणे (Negative) असू शकत नाही.";

    if (dto.PrincipalBalance > dto.SanctionedAmount)
        return $"मुद्दल बाकी (₹ {dto.PrincipalBalance:N2}) मंजूर रक्कमेपेक्षा (₹ {dto.SanctionedAmount:N2}) जास्त असू शकत नाही.";

    if (dto.PurePrincipalBalance < 0)
        return "निव्वळ मुद्दल बाकी (Pure Principal Balance) उणे (Negative) असू शकत नाही.";

    if (dto.CapitalizedInterestAmount < 0)
        return "मुद्दलात समाविष्ट व्याज (Capitalized Interest Amount) उणे (Negative) असू शकत नाही.";

    if (dto.InterestBalance < 0)
        return "चालू येणे व्याज शिल्लक (Interest Balance) उणे (Negative) असू शकत नाही.";

    if (dto.OverdueInterestBalance < 0)
        return "थकीत व्याज शिल्लक (Overdue Interest Balance) उणे (Negative) असू शकत नाही.";

    if (dto.InterestProvisionBalance < 0)
        return "व्याज तरतूद शिल्लक (Interest Provision Balance) उणे (Negative) असू शकत नाही.";

    if (dto.InterestRate < 0 || dto.InterestRate > 100)
        return "व्याज दर (Interest Rate) ०% ते १००% दरम्यान असणे आवश्यक आहे.";

    if (dto.DurationMonths <= 0)
        return "कर्ज कालावधी (Duration Months) ० पेक्षा जास्त असणे आवश्यक आहे.";

    if (dto.InstallmentAmount < 0)
        return "हप्ता रक्कम (Installment Amount) उणे (Negative) असू शकत नाही.";

    if (dto.SecurityValue < 0)
        return "तारण मूल्य (Security Value) उणे (Negative) असू शकत नाही.";

    // ३. कट-ऑफ दिनांक मर्यादा तपासणी
    var firstFy = await _context.FinancialYears.OrderBy(f => f.StartDate).FirstOrDefaultAsync();
    DateTime cutoffDate = firstFy != null ? firstFy.StartDate.AddDays(-1).Date : DateTime.Today;

    if (dto.OpeningDate.Date > cutoffDate.Date)
        return $"आरंभिक शिल्लक दिनांक ({dto.OpeningDate:dd/MM/yyyy}) कट-ऑफ दिनांकाच्या ({cutoffDate:dd/MM/yyyy}) नंतरचा असू शकत नाही.";

    if (dto.LoanDisbursementDate.HasValue && dto.LoanDisbursementDate.Value.Date > cutoffDate.Date)
        return $"कर्ज वाटप दिनांक ({dto.LoanDisbursementDate.Value:dd/MM/yyyy}) कट-ऑफ दिनांकाच्या ({cutoffDate:dd/MM/yyyy}) नंतरचा असू शकत नाही.";

    if (dto.LastInstallmentPaidDate.HasValue && dto.LastInstallmentPaidDate.Value.Date > cutoffDate.Date)
        return $"शेवटचा हप्ता भरल्याचा दिनांक ({dto.LastInstallmentPaidDate.Value:dd/MM/yyyy}) कट-ऑफ दिनांकाच्या ({cutoffDate:dd/MM/yyyy}) नंतरचा असू शकत नाही.";

    if (dto.LoanDisbursementDate.HasValue && dto.LoanDisbursementDate.Value.Date > dto.OpeningDate.Date)
        return $"कर्ज वाटप दिनांक ({dto.LoanDisbursementDate.Value:dd/MM/yyyy}) आरंभिक शिल्लक दिनांकाच्या ({dto.OpeningDate:dd/MM/yyyy}) नंतरचा असू शकत नाही.";

    return null; // सर्व अटी वैध आहेत!
}
```

#### पाऊल २: `PostOpeningBalance` च्या सुरुवातीला गार्ड क्लॉज लावणे
- कोणत्याही डेटाबेस ट्रॅन्झॅक्शनच्या आधी `ValidateOpeningBalanceDtoAsync` कॉल करणे.
- त्रुटी आढळल्यास तत्काळ `BadRequest(new { message = error })` परत करणे आणि ऑडिट लॉगमध्ये नोंदवणे.

#### पाऊल ३: `PutOpeningBalance` च्या सुरुवातीला गार्ड क्लॉज लावणे
- संपादन सुरू होताच `ValidateOpeningBalanceDtoAsync` कॉल करणे.
- त्रुटी आढळल्यास कोणताही बदल न करता तत्काळ `BadRequest(new { message = error })` परत करणे.

---

### 🧪 ५. पडताळणी व चाचणी आराखडा (Verification Matrix)

| क्र. | चाचणी प्रसंग (Scenario) | इनपुट पेलोड | अपेक्षित प्रतिसाद (Expected Result) |
|---|---|---|---|
| **१** | उणे मुद्दल शिल्लक पाठवणे | `PrincipalBalance: -5000` | HTTP 400 Bad Request: "मुद्दल बाकी उणे असू शकत नाही." |
| **२** | मुद्दल मंजूर रक्कमेपेक्षा जास्त पाठवणे | `Sanctioned: 50000, Principal: 60000` | HTTP 400 Bad Request: "मुद्दल बाकी मंजूर रक्कमेपेक्षा जास्त असू शकत नाही." |
| **३** | कट-ऑफ नंतरची चालू वर्षातील तारीख पाठवणे | `OpeningDate: 2026-10-03` (Cutoff: `2025-03-31`) | HTTP 400 Bad Request: "आरंभिक शिल्लक दिनांक कट-ऑफ दिनांकाच्या नंतरचा असू शकत नाही." |
| **४** | उणे येणे व्याज पाठवणे | `InterestBalance: -250` | HTTP 400 Bad Request: "चालू येणे व्याज उणे असू शकत नाही." |
| **५** | सर्व मूल्ये कायदेशीर व वैध असणे | `Sanctioned: 100000, Principal: 80000, Date: 2025-03-31` | HTTP 200 OK (यशस्वी नोंद) |

---

### 📋 ६. वरिष्ठ लेखापरीक्षक निष्कर्ष (Auditor's Conclusion)
सदर सर्व्हर-साइड गार्ड क्लॉजेस लागू केल्यामुळे बाह्य स्क्रिप्ट्स, पोस्टमन किंवा चुकीच्या नेटवर्क विनंत्यांद्वारे कोअर बँकिंगच्या **तेरीज पत्रक (Trial Balance) आणि जनरल लेजर अखंडतेला (General Ledger Integrity)** निर्माण झालेला गंभीर धोका कायमचा नष्ट होईल.
