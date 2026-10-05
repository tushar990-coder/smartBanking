# 📋 सुधारणा कृती आराखडा (Remediation Plan) - दोष क्र. १ [अति-गंभीर / CRITICAL]
## **LoanCode व LoanType वर डेटाबेस स्तरावर Unique Constraint नसणे**

**ऑडिट संदर्भ:** दोष क्र. १ (Issue #1)  
**मॉड्यूल:** कर्ज दर पत्रक व नियम (Loan Rate Master, Schemes & Rules)  
**फाइल संदर्भ:**
- `d:\Bhisi Software\api\Bhisi.Api\Controllers\LoanRatesController.cs` (Backend Controller)
- `d:\Bhisi Software\api\Bhisi.Api\Program.cs` (Startup Migration & Database Hardening)
- `d:\Bhisi Software\client\src\components\LoanRateMaster.tsx` (Frontend Master Form)
- `d:\Bhisi Software\tools\add_unique_index_loan_rates.sql` (Database Migration Script)
- `d:\Bhisi Software\tools\apply_loan_rate_unique_index_all_sansthas.ps1` (Multi-Sanstha VPS Deployer)

**जोखीम पातळी:** 🔴 **अति-गंभीर (CRITICAL - Architectural & Data Integrity Risk)**  
**ऑडिटर:** वरिष्ठ सिस्टीम लेखापरीक्षक (Senior System Auditor - Banking ERP)  
**दिनांक:** ०४ ऑक्टोबर २०२६  

---

### १. लेखापरीक्षण पार्श्वभूमी व समस्येचे मूळ (Root Cause Analysis)

१. **डेटाबेस स्तरावरील तफावत:**
   - `LoanRates` टेबलच्या इंडेक्स तपासणीमध्ये (`SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('LoanRates')`) केवळ `PK_LoanRates` (Primary Key on `LoanRateID`) अस्तित्वात आहे.
   - `LoanCode` (उदा. `LN01`) आणि `LoanType` (उदा. "वैयक्तिक कर्ज") यावर कोणताही **UNIQUE NONCLUSTERED INDEX** अथवा **UNIQUE CONSTRAINT** अस्तित्वात नाही.
   - जर दोन वेगवेगळ्या ऑपरेटरनी एकाच वेळी किंवा पोस्टमन/स्क्रिप्टद्वारे एकाच कोडवर किंवा एकाच नावावर दोन कर्ज योजना तयार केल्या, तर डेटाबेस कोणतीही आडकाठी न करता दोन्ही नोंदी स्वीकारतो.

२. **बॅकएंड API स्तरावरील तफावत:**
   - `LoanRatesController.cs` च्या `PostLoanRate` मध्ये:
     - जर `LoanCode` पाठवला असेल, तर तो डेटाबेसमध्ये आधीच उपलब्ध आहे की नाही हे तपासणारा **एकही गार्ड क्लॉज नाही**.
     - `LoanType` (कर्ज प्रकार) आधीच नोंदवलेला आहे की नाही, हे तपासणारा कोड नाही.
   - `PutLoanRate` मध्ये:
     - संपादन करताना जर ऑपरेटरने आधीच इतर योजनेचा असलेला कोड किंवा नाव दिले, तर डुप्लिकेट संघर्ष (Duplicate Conflict) अडवणारी तपासणी नाही.

३. **बँकिंग व वित्तीय जोखीम (Banking & System Risks):**
   - **खाते क्रमांक विस्कळीत होणे (Account Number Collisions):** `LoanAccountsController.cs` मध्ये नवीन खाते क्रमांक जनरेट करताना `LoanCode` मधील संख्यात्मक मूल्य (उदा. `LN01` -> 20100001, `LN02` -> 20200001) वापरले जाते. एकाच कोडवर दोन योजना असल्यास खाते क्रमांकांची मालिका एकमेकांवर आदळेल (Collision).
   - **लेजर मॅपिंग व अहवाल गोंधळ:** एकाच नावाच्या दोन योजना तयार झाल्यास शाखा व्यवस्थापक व कॅशियर चुकीच्या योजनेत कर्ज वाटप करू शकतात, ज्यामुळे खतावणी (GL Ledger) आणि उप-खाते (SL) मध्ये प्रचंड तफावत निर्माण होईल.

---

### २. सुधारणा उद्दिष्टे (Remediation Objectives)

- [x] **डेटाबेस युनिकनेस (Database Level Guarantee):** `LoanRates(LoanCode)` व `LoanRates(LoanType)` वर `UNIQUE NONCLUSTERED INDEX` लागू करणे.
- [x] **स्वयंचलित स्टार्टअप मायग्रेशन (Startup Auto-Healing):** `Program.cs` मध्ये डेटाबेस इनिशिएलायझेशन ब्लॉक अंतर्गत हे युनिक इंडेक्स समाविष्ट करणे, जेणेकरून सर्व पतसंस्थांच्या डेटाबेसवर ही सुरक्षा स्वयंचलित लागू होईल.
- [x] **बॅकएंड डुप्लिकेट गार्ड क्लॉजेस (Backend Controller Hardening):** `LoanRatesController.cs` च्या `POST` आणि `PUT` मेथड्समध्ये केस-इन्सेंसिटिव्ह (`Trim().ToLower()`) डुप्लिकेट चेक्स व `DbUpdateException` हँडलिंग जोडणे.
- [x] **फ्रंटएंड प्री-व्हॅलिडेशन (Client-Side Feedback):** `LoanRateMaster.tsx` मध्ये फॉर्म सेव्ह करण्यापूर्वीच युनिकनेस पडताळणी करून ऑपरेटरला तात्काळ मराठी सूचना देणे.
- [x] **मल्टी-संस्था स्क्रिप्ट (Multi-Sanstha Patch):** सर्व लाइव्ह संस्थांच्या डेटाबेसवर इंडेक्स लागू करणारी पॉवरशेल स्क्रिप्ट तयार करणे.

---

### ३. तपशीलवार अंमलबजावणी योजना (Step-by-Step Implementation Plan)

#### टप्पा १: डेटाबेस युनिक इंडेक्स स्क्रिप्ट (`tools/add_unique_index_loan_rates.sql`)
1. रिकामे किंवा नल असलेले कोड असल्यास त्यांना तात्पुरते `LN + ID` असा योग्य कोड देणे:
   ```sql
   UPDATE LoanRates 
   SET LoanCode = 'LN' + RIGHT('00' + CAST(LoanRateID AS VARCHAR(10)), 2)
   WHERE LoanCode IS NULL OR LTRIM(RTRIM(LoanCode)) = '';
   ```
2. `LoanCode` वर युनिक इंडेक्स तयार करणे:
   ```sql
   IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanRates_LoanCode' AND object_id = OBJECT_ID(N'[LoanRates]'))
   BEGIN
       CREATE UNIQUE NONCLUSTERED INDEX [IX_LoanRates_LoanCode] 
       ON [LoanRates]([LoanCode]) 
       WHERE [LoanCode] IS NOT NULL AND [LoanCode] <> '';
   END
   ```
3. `LoanType` वर युनिक इंडेक्स तयार करणे:
   ```sql
   IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanRates_LoanType' AND object_id = OBJECT_ID(N'[LoanRates]'))
   BEGIN
       CREATE UNIQUE NONCLUSTERED INDEX [IX_LoanRates_LoanType] 
       ON [LoanRates]([LoanType]) 
       WHERE [LoanType] IS NOT NULL AND [LoanType] <> '';
   END
   ```

#### टप्पा २: `Program.cs` मध्ये स्वयंचलित स्टार्टअप मायग्रेशन
`Program.cs` मधील डेटाबेस पॅचिंग विभागात `IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanRates')` अंतर्गत वरील इंडेक्स निर्मिती लॉजिक जोडणे, जेणेकरून ॲप्लिकेशन सुरू होताच सर्व डेटाबेस सुरक्षित होतील.

#### टप्पा ३: `LoanRatesController.cs` चे सक्षमीकरण (Hardening)
1. **`PostLoanRate` मेथडमध्ये:**
   ```csharp
   loanRate.LoanCode = loanRate.LoanCode?.Trim() ?? string.Empty;
   loanRate.LoanType = loanRate.LoanType?.Trim() ?? string.Empty;

   // 1. Case-insensitive LoanCode check
   bool codeExists = await _context.LoanRates.AnyAsync(r => r.LoanCode.ToLower() == loanRate.LoanCode.ToLower());
   if (codeExists)
   {
       return BadRequest(new { message = $"कर्ज योजना कोड '{loanRate.LoanCode}' आधीपासून अस्तित्वात आहे. कृपया दुसरा कोड वापरा." });
   }

   // 2. Case-insensitive LoanType check
   bool typeExists = await _context.LoanRates.AnyAsync(r => r.LoanType.ToLower() == loanRate.LoanType.ToLower());
   if (typeExists)
   {
       return BadRequest(new { message = $"कर्ज योजना प्रकार / नाव '{loanRate.LoanType}' आधीपासून अस्तित्वात आहे. कृपया वेगळे नाव द्या." });
   }
   ```
2. **`PutLoanRate` मेथडमध्ये:**
   ```csharp
   loanRate.LoanCode = loanRate.LoanCode?.Trim() ?? string.Empty;
   loanRate.LoanType = loanRate.LoanType?.Trim() ?? string.Empty;

   // 1. Case-insensitive LoanCode conflict check
   bool codeConflict = await _context.LoanRates.AnyAsync(r => r.LoanRateID != id && r.LoanCode.ToLower() == loanRate.LoanCode.ToLower());
   if (codeConflict)
   {
       return BadRequest(new { message = $"कर्ज योजना कोड '{loanRate.LoanCode}' इतर कर्ज योजनेसाठी आधीपासून वापरला गेला आहे." });
   }

   // 2. Case-insensitive LoanType conflict check
   bool typeConflict = await _context.LoanRates.AnyAsync(r => r.LoanRateID != id && r.LoanType.ToLower() == loanRate.LoanType.ToLower());
   if (typeConflict)
   {
       return BadRequest(new { message = $"कर्ज योजना प्रकार / नाव '{loanRate.LoanType}' इतर कर्ज योजनेसाठी आधीपासून वापरले गेले आहे." });
   }
   ```
3. **`DbUpdateException` कॅच ब्लॉक:**
   डेटाबेस स्तरावरील युनिक व्हायलेशन एरर (Error 2601 / 2627) पकडून ५०० एरर ऐवजी यूजरला स्पष्ट मराठी संदेश देणे.

#### टप्पा ४: `LoanRateMaster.tsx` क्लायंट-साइड व्हॅलिडेशन
- `handleSubmit` फंक्शनमध्ये नेटवर्क कॉल जाण्याआधीच `loanRates` ॲरेमध्ये कोड व नाव तपासणे.
- डुप्लिकेट आढळल्यास थेट अलर्ट दाखवून फॉर्म सबमिशन थांबवणे.

#### टप्पा ५: मल्टी-संस्था VPS डिप्लॉयमेंट स्क्रिप्ट
`tools/apply_loan_rate_unique_index_all_sansthas.ps1` तयार करणे आणि `vps_multi_app_config.json` मधील सर्व संस्थांवर चालवणे.

---

### ४. पडताळणी व चाचणी योजना (Verification & Acceptance Criteria)

| अ.नं. | चाचणी प्रकार | चाचणी कृती | अपेक्षित निकाल |
|:---:|:---|:---|:---|
| १ | **कम्पाइलेशन चाचणी** | `dotnet build /t:Compile` व `npm run build` | **0 Errors, 0 Warnings** |
| २ | **डेटाबेस इंडेक्स** | `sys.indexes` मध्ये `IX_LoanRates_LoanCode` व `IX_LoanRates_LoanType` तपासणे | दोन्ही युनिक इंडेक्स सक्रिय दिसणे |
| ३ | **डुप्लिकेट कोड अडवणे** | आधीच असलेल्या `LN01` कोडवर नवीन योजना सेव्ह करण्याचा प्रयत्न | **400 Bad Request: कर्ज योजना कोड आधीपासून अस्तित्वात आहे** |
| ४ | **डुप्लिकेट नाव अडवणे** | आधीच असलेल्या `वैयक्तिक कर्ज` नावावर नवीन योजना सेव्ह करण्याचा प्रयत्न | **400 Bad Request: कर्ज योजना प्रकार आधीपासून अस्तित्वात आहे** |
| ५ | **संपादन संघर्ष (PUT)** | योजनेचा कोड बदलून दुसऱ्या अस्तित्वात असलेल्या योजनेचा कोड देणे | **400 Bad Request: कोड इतर योजनेसाठी वापरला गेला आहे** |
| ६ | **वैध निर्मिती व संपादन** | नवीन अद्वितीय कोड (`LN02`) व अद्वितीय नावासह योजना तयार करणे | **201 Created व 204 NoContent सह यशस्वी सेव्ह** |

---

**माझे वरिष्ठ सिस्टीम लेखापरीक्षक म्हणून निवेदन:**  
सदर कृती आराखडा मंजूर असल्यास कृपया **"proceed"** म्हणावे, जेणेकरून मी तात्काळ अंमलबजावणी सुरू करीन.
