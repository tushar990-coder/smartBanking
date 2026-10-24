# 📑 कर्ज वसुली NPA ४०४ एरर व पावती जतन (Save) न होणे - सखोल तांत्रिक विश्लेषण व ऑडिट अहवाल
## Diagnostic Report: Loan Collection NPA 404 (Not Found) & Save Failure Analysis

**तारीख:** २५ ऑक्टोबर २०२६  
**शाखा:** श्री जोतिर्लिंग नागरी सहकारी पतसंस्था (पडवळवाडी) - `padvalwadi.hellomindspace.in`  
**मॉड्यूल:** कर्ज विभाग -> कर्ज वसुली (`/karjvibhag/vasuli`)  
**आवृत्ती:** SmartBanking CBS v2.5.90  
**स्थिती:** केवळ विश्लेषण व अहवाल (Do Not Code)

---

### 📌 १. समस्येचा सारांश (Executive Summary)

स्क्रीनशॉट व ब्राऊझर कन्सोल नोंदीनुसार युझरने कर्ज वसुली स्क्रीनवर:
1. कर्ज प्रकार / योजना: **मेंबर कर्जे** निवडली.
2. कर्जदार खातेदार: **अभिजीत रामचंद्र खोत** (CIF000020, जुने कर्ज खाते क्र. ४०५) निवडले.
3. कर्जदार निवडताच कन्सोलमध्ये खालील लाल रंगाची त्रुटी दिसली:
   ```http
   GET https://api-padvalwadi.hellomindspace.in/api/Npa/status/405 404 (Not Found)
   ```
4. रक्कम भरून (उदा. ₹६९,०००) पावती **जतन (Save)** करण्याचा प्रयत्न केला असता पावती सिस्टीममध्ये सेव्ह होत नाही.

---

### 🔍 २. भाग १: `GET /api/Npa/status/405` ला ४०४ एरर का येत आहे? (NPA 404 Root Cause)

#### अ) कॉल कोठून व का होतो?
`client/src/components/LoanCollectionMaster.tsx` मधील `selectLoanAccountById` (ओळ ९६०):
```typescript
// जेव्हा कर्ज खाते (accId = 405) निवडले जाते:
try {
    const npaRes = await axios.get(`/api/Npa/status/${accId}`);
    if (npaRes.data) {
        setNpaStatus(npaRes.data);
    }
} catch (err: any) {
    if (err.response?.status !== 404) {
        console.error("Failed to fetch NPA status", err);
    }
}
```
सिस्टीम हे तपासण्याचा प्रयत्न करत आहे की हे कर्ज खाते थकीत (NPA) आहे का, जेणेकरून स्क्रीनवर एनपीए वर्गवारी (Substandard/Doubtful/Loss) किंवा तरतूद दाखवता येईल.

#### ब) बॅकएंडमध्ये काय घडते?
`api/Bhisi.Api/Controllers/NpaController.cs` (ओळ ५४ ते ६६):
```csharp
// GET: api/npa/status/{loanAccountId}
[HttpGet("status/{loanAccountId}")]
public async Task<IActionResult> GetAccountNpaStatus(int loanAccountId)
{
    var status = await _context.LoanAccountNpaStatuses
        .Where(s => s.LoanAccountID == loanAccountId)
        .OrderByDescending(s => s.AsOfDate)
        .FirstOrDefaultAsync();

    if (status == null)
    {
        return NotFound(); // <--- येथे ४०४ (Not Found) फेकला जातो!
    }

    return Ok(new
    {
        status.Category,
        status.OverdueDays,
        CategoryMarathi = GetCategoryMarathi(status.Category)
    });
}
```

#### क) ४०४ चे मूळ कारण (Technical Defect):
1. **खाते नियमित (Standard) असणे:**  
   'अभिजीत रामचंद्र खोत' यांचे कर्ज खाते एनपीए नसून **नियमित (Standard)** आहे. किंवा संस्थेच्या डेटाबेसमध्ये एनपीए क्लासिफिकेशन रन झालेला नाही.
2. **REST API डिझाईन दोष:**  
   डेटाबेस टेबल `LoanAccountNpaStatuses` मध्ये जर त्या खात्याची नोंद नसेल, तर याचा अर्थ **"हे खाते एनपीए नाही, ते नियमित आहे"** असा होतो. परंतु कंट्रोलरने `return NotFound();` (HTTP 404) कोड पाठवला.
3. **ब्राउझर कन्सोलमधील लाल रंग:**  
   जरी जावास्क्रिप्टमध्ये `catch (err)` लावले असले, तरी क्रोम ब्राऊझरचा **Network Engine कोणत्याही ४०४ रिस्पॉन्सला कन्सोलमध्ये ठळक लाल अक्षरात आपोआप नोंदवतो**. त्यामुळे ऑपरेटर किंवा युझरला वाटते की सिस्टीममध्ये मोठा बिघाड झाला आहे.

---

### ⚠️ ३. भाग २: कर्ज वसुली पावती जतन (Save) का होत नाही? (Root Causes of Save Failure)

युझरने जेव्हा 'जतन (Save)' बटण दाबले, तेव्हा खालीलपैकी एका किंवा अधिक कारणांमुळे पावती सेव्ह होत नाही:

#### 🔴 कारण १: पडवळवाडीच्या लाईव्ह डेटाबेसवर नवीन SQL स्कीमा नसणे (सर्वात मुख्य कारण)
* **तपशील:** मागील अपडेटमध्ये कर्ज वसुली मॉडेलमध्ये खालील नवीन कॉलम्स जोडले गेले होते:
  - `ReceivableInterestCollected` (येणे व्याज जमा)
  - `InterestWaived` (माफ केलेले व्याज)
  - `PenaltyWaived` (माफ केलेला दंड)
  - `IsOTS` (एकरकम तडजोड फ्लॅग)
  - `ResolutionNo` (ठराव क्रमांक)
  - `ApprovedByUserID`
  - `HomeBranchVoucherID`
  - `AgentID`, `CollectionSource`, `TransactionId`, `SyncReferenceId`
  - तसेच `LoanCollectionFees` हे नवीन टेबल.
* **परिणाम:**  
  जर पडवळवाडीच्या `SmartBanking_padvalwadi` या थेट डेटाबेसवर `patch_loan_collections_padvalwadi.sql` ही स्क्रिप्ट एक्झिक्युट झाली नसेल, तर Entity Framework जेव्हा `INSERT INTO LoanCollections` चालवतो, तेव्हा SQL Server थेट अपवाद फेकतो:
  ```sql
  Invalid column name 'ReceivableInterestCollected'.
  Invalid column name 'InterestWaived'.
  ```
  आणि `LoanCollectionsController.cs` मधील ओळ ९३८ चा `catch` ब्लॉक संपूर्ण ट्रॅन्झॅक्शन रोलबॅक करतो व `500 Server Error` देतो.

#### 🔴 कारण २: तारीख व्हॅलिडेशन त्रुटी (`DateTime.Today` vs Business Date)
* **तपशील:** `LoanCollectionsController.cs` मधील ओळ २०५:
  ```csharp
  // Core Banking Date Safeguards: Prevent future dating
  if (collection.CollectionDate.Date > DateTime.Today)
  {
      return BadRequest("पावतीची दिनांक भविष्यातील (Future Date) असू शकत नाही.");
  }
  ```
* **परिणाम:**  
  स्क्रीनशॉटमध्ये दाखवल्याप्रमाणे पतसंस्थेची **चालू व्यवसाय तारीख (Active Business Date)** ही `३०/०६/२०२६` आहे.  
  जर व्हीपीएस (VPS) सर्व्हरच्या ऑपरेटिंग सिस्टीमचे प्रत्यक्ष घड्याळ (OS Clock) या तारखेच्या आधीचे असेल, तर `collection.CollectionDate.Date > DateTime.Today` ही अट खरी (True) ठरते आणि बॅकएंड पावती नाकारून **`BadRequest: पावतीची दिनांक भविष्यातील असू शकत नाही`** असा एरर मेसेज देतो.

#### 🔴 कारण ३: कर्ज योजनेचे खाते खतावणी (Ledger Mapping) गहाळ असणे
* **तपशील:** `LoanCollectionsController.cs` मधील ओळ ५४८ व ५७४:
  ```csharp
  if (loanLedgerId == 0)
      return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType}' ला कर्ज मुद्दल खाते (Loan Ledger) जोडलेले नाही..." });

  if (interestLedgerId == 0)
      return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType}' ला कर्ज व्याज खाते (Interest Ledger) जोडलेले नाही..." });
  ```
* **परिणाम:**  
  पडवळवाडी शाखेतील 'मेंबर कर्जे' या योजनेला जर खतावणीत (Chart of Accounts) मुद्दल किंवा व्याज लेजर अचूक मॅप केलेले नसेल, तर व्हाउचर बनू शकत नाही आणि पावती जतन होत नाही.

#### 🔴 कारण ४: रक्कम विभाजन (Amount Apportionment & Validation)
* स्क्रीनशॉटमध्ये:
  - एकूण जमा रक्कम: **₹६९,०००**
  - मुद्दल जमा: **₹६०,०००**
  - चालू व्याज जमा: **₹९,०००**
  - मुद्दल बाकी: **₹६४,५१२.००** (६०,००० हे बाकी मुद्दलापेक्षा कमी असल्याने मुद्दल व्हॅलिडेशन पास होते).
  - परंतु जर एकूण रक्कम आणि घटकांची बेरीज यात तफावत झाली किंवा आवश्यक बँक खाते निवडलेले नसेल, तर फ्रंटएंड फॉर्म सबमिशन थांबवतो.

---

### 📋 ४. समस्येचा तुलनात्मक तक्ता (Issue Diagnostic Matrix)

| घटक | सद्यस्थिती (Current Behavior) | अपेक्षित शास्त्रीय वर्तन (Expected Behavior) | निवारणाचा मार्ग |
| :--- | :--- | :--- | :--- |
| **१. NPA Status API** | खाते NPA नसल्यास `404 Not Found` फेकते | खाते NPA नसल्यास `200 OK` सह `category: "Standard"` देणे | `NpaController.cs` मध्ये `NotFound()` ऐवजी सुरक्षित `Standard` ऑब्जेक्ट पाठवणे |
| **२. SQL Table Schema** | पडवळवाडी DB वर नवीन कॉलम्स उपलब्ध नसण्याची शक्यता | सर्व ११ नवीन कॉलम्स व `LoanCollectionFees` टेबल उपस्थित असणे | `patch_loan_collections_padvalwadi.sql` पडवळवाडी DB वर रन करणे |
| **३. तारीख पडताळणी** | `DateTime.Today` (सर्व्हर घड्याळ) वर कडक तपासणी | सिस्टीमच्या 'सक्रिय व्यवसाय दिनांक' (Business Date) नुसार तपासणी | कंट्रोलरमध्ये `BusinessDate` किंवा `FinancialYear` नुसार पडताळणी |
| **४. योजना लेजर लिंकिंग** | लेजर आयडी शून्य असल्यास सेव्ह रोखणे | सर्व कर्ज योजनांना मुद्दल व व्याज लेजर स्वयंचलित जोडणे | 'कर्ज दर पत्रक' मध्ये लेजर मॅपिंगची तपासणी करणे |

---

### 🛠️ ५. शिफारस केलेला पुढील कृती आराखडा (Recommended Action Plan)

> [!IMPORTANT]
> वापरकर्त्याच्या सूचनेनुसार (`Do not code`) सध्या कोणताही कोड बदललेला नाही. हा केवळ तांत्रिक तपासणी अहवाल आहे.

आपण **"Proceed"** आदेश दिल्यानंतर खालील ३ सोप्या टप्प्यांत ही समस्या कायमची दूर केली जाईल:

1. **टप्पा १ (NPA 404 फिक्स):**  
   `NpaController.cs` मधील `GetAccountNpaStatus` मध्ये सुधारणा करून एनपीए रेकॉर्ड नसलेल्या सर्व खात्यांना `200 OK` सह `Standard (नियमित)` स्टेटस देणे. यामुळे ब्राऊझर कन्सोलमधील लाल ४०४ एरर पूर्णपणे बंद होईल.
2. **टप्पा २ (डेटाबेस दुरुस्ती):**  
   पडवळवाडी डेटाबेसवर `sql_patches/patch_loan_collections_padvalwadi.sql` रन करून सर्व आवश्यक कॉलम्स अपडेट करणे.
3. **टप्पा ३ (सेव्ह प्रक्रिया तारीख लवचिकता):**  
   `LoanCollectionsController.cs` मधील तारीख तपासणी पतसंस्थेच्या आर्थिक वर्षातील बॅक-डेटेड / बिझनेस डेट नोंदींना सुरक्षितपणे परवानगी देईल अशी करणे.

---
*अहवाल तयार केला: २५ ऑक्टोबर २०२६ | SmartBanking CBS Core Engineering Team*
