# 📋 सुधारणा कृती आराखडा (Remediation Plan) - दोष क्र. ७ [मध्यम / MEDIUM]
## **व्याजदर बदलल्यास संचालक मंडळ ठराव (Board Resolution) व ऐतिहासिक स्लॅबचा अभाव (Rate Revision History)**

**ऑडिट संदर्भ:** दोष क्र. ७ (Issue #7)  
**मॉड्यूल:** कर्ज दर पत्रक व नियम (Loan Rate Master, Schemes & Rules)  
**फाइल संदर्भ:**
- `d:\Bhisi Software\api\Bhisi.Api\Models\LoanRateHistory.cs` (New Model - ऐतिहासिक दर नोंदवही)
- `d:\Bhisi Software\api\Bhisi.Api\Models\LoanRate.cs` (Updated Model with NotMapped resolution fields)
- `d:\Bhisi Software\api\Bhisi.Api\Data\AppDbContext.cs` (DbSet Registration)
- `d:\Bhisi Software\api\Bhisi.Api\Controllers\LoanRatesController.cs` (Revision Tracking & History Endpoints)
- `d:\Bhisi Software\api\Bhisi.Api\Program.cs` (Startup Migration & Table Auto-Creation)
- `d:\Bhisi Software\client\src\components\LoanRateMaster.tsx` (Resolution Capture UI & Rate History Modal)
- `d:\Bhisi Software\tools\add_loan_rate_histories_table.sql` (Database Migration Script)

**जोखीम पातळी:** 🟡 **मध्यम (MEDIUM - Regulatory Compliance & Statutory Audit Risk)**  
**ऑडिटर:** वरिष्ठ सिस्टीम लेखापरीक्षक (Senior System Auditor - Banking ERP)  
**दिनांक:** ०४ ऑक्टोबर २०२६  

---

### १. लेखापरीक्षण पार्श्वभूमी व समस्येचे मूळ (Root Cause Analysis)

१. **सहकारी संस्था कायदा व वैधानिक पार्श्वभूमी:**
   - महाराष्ट्र सहकारी संस्था कायदा १९६० (MCS Act 1960), सहकार आयुक्तांची मार्गदर्शक तत्त्वे व नाबार्ड/RBI नियमावलीनुसार:
     - सहकारी पतसंस्था किंवा बँकेमध्ये **संचालक मंडळाच्या अधिकृत ठरावाशिवाय (Board of Directors Resolution)** कोणत्याही कर्ज योजनेचा नियमित व्याजदर अथवा दंड व्याजदर बदलता येत नाही.
     - प्रत्येक व्याजदर बदलासाठी **ठराव क्रमांक (Resolution No.)**, **ठराव दिनांक (Resolution Date)**, **अंमलबजावणी लागू तारीख (Effective Date)**, आणि **बदलाचे कारण/परिपत्रक (Justification/Circular)** नोंदवून ठेवणे कायद्याने अनिवार्य असते.
     - वैधानिक लेखापरीक्षक (Statutory Auditor) किंवा सहकार खात्याचे अधिकारी तपासणीसाठी आल्यास त्यांना **"व्याजदर बदल नोंदवही" (Rate Revision Register)** सादर करावी लागते.

२. **सध्याच्या सॉफ्टवेअरमधील उणिवा:**
   - `LoanRatesController.cs` मधील `PutLoanRate` मेथडमध्ये जर ऑपरेटरने व्याजदर बदलला, तर डेटाबेसमध्ये थेट जुन्या मूल्यावर नवीन मूल्य ओव्हरराइट (Overwrite) होते.
   - सिस्टीममध्ये पूर्वीचा व्याजदर काय होता, नवीन दर कोणत्या ठरावानुसार लागू झाला, तो कोणत्या तारखेपासून लागू झाला, आणि कोणत्या अधिकाऱ्याने बदल केला, याची कोणतीही **स्ट्रक्चर्ड ऐतिहासिक नोंद (Structured Historical Record)** ठेवली जात नाही.
   - केवळ `AuditLogs` मध्ये एक साधी मजकूर ओळ पडते, परंतु ती फिल्टर करण्यायोग्य, अहवाल काढण्यायोग्य किंवा योजनानिहाय ट्रॅक करण्यायोग्य नाही.

३. **फ्रंटएंड UI मधील त्रुटी:**
   - `LoanRateMaster.tsx` मध्ये संपादन करताना व्याजदर बदलल्यास ऑपरेटरला संचालक मंडळ ठरावाची माहिती विचारली जात नाही.
   - ऑपरेटरला जुने ऐतिहासिक दर स्लॅब (Rate Revision History) पाहण्यासाठी कोणतीही स्क्रीन किंवा अहवाल उपलब्ध नाही.

---

### २. सुधारणा उद्दिष्टे (Remediation Objectives)

- [x] **डेटाबेस स्ट्रक्चर (`LoanRateHistories` Table):** प्रत्येक दर बदलाची सविस्तर नोंद ठेवणारे नवीन टेबल तयार करणे.
- [x] **स्वयंचलित स्टार्टअप मायग्रेशन (`Program.cs`):** ॲप सुरू होताच `LoanRateHistories` टेबल सर्व संस्थांच्या डेटाबेसवर स्वयंचलित तयार करणे.
- [x] **बॅकएंड API हार्डनिंग (`LoanRatesController.cs`):**
  - `PutLoanRate` मध्ये `InterestRate` किंवा `OverdueInterestRate` बदलल्यास स्वयंचलित `LoanRateHistories` मध्ये नोंद करणे.
  - नवीन एंडपॉइंट्स:
    - `GET api/LoanRates/{id}/History` - विशिष्ट योजनेचा संपूर्ण दर बदल इतिहास.
    - `GET api/LoanRates/AllHistory` - संस्थेच्या सर्व कर्ज योजनांची "व्याजदर बदल नोंदवही".
- [x] **मॉडेल अपडेट (`LoanRate.cs`):** `[NotMapped]` फील्ड्स (`ResolutionNo`, `ResolutionDate`, `EffectiveDate`, `RevisionReason`) जोडणे, ज्यामुळे विद्यमान API करार न मोडता माहिती स्वीकारता येईल.
- [x] **फ्रंटएंड UI सक्षमीकरण (`LoanRateMaster.tsx`):**
  - संपादन करताना दर बदलल्यास "संचालक मंडळ ठराव व अंमलबजावणी तपशील" कार्ड दृश्यमान करणे.
  - "📜 व्याजदर बदल नोंदवही (Rate Revision History)" चे आधुनिक पॉप-अप मोडल जोडणे (फिल्टर, एक्सेल एक्सपोर्ट व प्रिंटसह).

---

### ३. तपशीलवार तांत्रिक डिझाइन व अंमलबजावणी योजना

#### टप्पा १: डेटाबेस टेबल स्ट्रक्चर (`tools/add_loan_rate_histories_table.sql`)
```sql
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanRateHistories')
BEGIN
    CREATE TABLE [dbo].[LoanRateHistories] (
        [HistoryID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [LoanRateID] INT NOT NULL,
        [OldInterestRate] DECIMAL(18,2) NOT NULL,
        [NewInterestRate] DECIMAL(18,2) NOT NULL,
        [OldOverdueInterestRate] DECIMAL(18,2) NOT NULL,
        [NewOverdueInterestRate] DECIMAL(18,2) NOT NULL,
        [ResolutionNo] NVARCHAR(100) NOT NULL DEFAULT '',
        [ResolutionDate] DATETIME2 NULL,
        [EffectiveDate] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [Reason] NVARCHAR(500) NULL,
        [ChangedByUserID] INT NOT NULL DEFAULT 1,
        [ChangedByUsername] NVARCHAR(100) NOT NULL DEFAULT 'System',
        [ChangedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [IPAddress] NVARCHAR(50) NULL,
        CONSTRAINT [FK_LoanRateHistories_LoanRates] FOREIGN KEY ([LoanRateID]) 
            REFERENCES [dbo].[LoanRates]([LoanRateID]) ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX [IX_LoanRateHistories_LoanRateID] 
    ON [dbo].[LoanRateHistories]([LoanRateID] ASC);

    CREATE NONCLUSTERED INDEX [IX_LoanRateHistories_EffectiveDate] 
    ON [dbo].[LoanRateHistories]([EffectiveDate] DESC);
END
```

#### टप्पा २: C# मॉडेल निर्मिती (`LoanRateHistory.cs`) व मॉडेल अद्ययावत करणे
1. `d:\Bhisi Software\api\Bhisi.Api\Models\LoanRateHistory.cs` फाईल तयार करणे.
2. `LoanRate.cs` मध्ये `[NotMapped]` फील्ड्स जोडणे:
   ```csharp
   [NotMapped]
   public string? ResolutionNo { get; set; }

   [NotMapped]
   public DateTime? ResolutionDate { get; set; }

   [NotMapped]
   public DateTime? EffectiveDate { get; set; }

   [NotMapped]
   public string? RevisionReason { get; set; }
   ```
3. `AppDbContext.cs` मध्ये `public DbSet<LoanRateHistory> LoanRateHistories { get; set; }` जोडणे.

#### टप्पा ३: `LoanRatesController.cs` मध्ये हिस्ट्री ट्रॅकिंग व एंडपॉइंट्स
1. **`PutLoanRate` मध्ये दर बदल शोधणे व नोंदवणे:**
   ```csharp
   bool isInterestRateChanged = existing.InterestRate != loanRate.InterestRate;
   bool isOverdueRateChanged = existing.OverdueInterestRate != loanRate.OverdueInterestRate;

   if (isInterestRateChanged || isOverdueRateChanged)
   {
       var (userId, username, _, _, _) = GetCurrentUserContext();
       var history = new LoanRateHistory
       {
           LoanRateID = id,
           OldInterestRate = existing.InterestRate,
           NewInterestRate = loanRate.InterestRate,
           OldOverdueInterestRate = existing.OverdueInterestRate,
           NewOverdueInterestRate = loanRate.OverdueInterestRate,
           ResolutionNo = !string.IsNullOrWhiteSpace(loanRate.ResolutionNo) ? loanRate.ResolutionNo.Trim() : "ठराव प्रलंबित / मॅन्युअल बदल",
           ResolutionDate = loanRate.ResolutionDate ?? DateTime.Today,
           EffectiveDate = loanRate.EffectiveDate ?? DateTime.Today,
           Reason = !string.IsNullOrWhiteSpace(loanRate.RevisionReason) ? loanRate.RevisionReason.Trim() : "व्याजदर पुनरावलोकन",
           ChangedByUserID = userId,
           ChangedByUsername = username,
           ChangedAt = DateTime.Now,
           IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1"
       };
       _context.LoanRateHistories.Add(history);
   }
   ```
2. **इतिहास मिळवण्यासाठी नवीन एंडपॉइंट्स:**
   - `[HttpGet("{id:int}/History")]`: दिलेल्या कर्ज योजनेचा इतिहास.
   - `[HttpGet("AllHistory")]`: सर्व कर्ज योजनांचा इतिहास (तारीख उतरत्या क्रमाने).

#### टप्पा ४: `Program.cs` स्वयंचलित स्टार्टअप मायग्रेशन
`Program.cs` मधील डेटाबेस पॅचिंग विभागात `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanRateHistories')` ब्लॉक समाविष्ट करणे.

#### टप्पा ५: फ्रंटएंड `LoanRateMaster.tsx` मध्ये UI एकत्रीकरण
1. **ठराव तपशील फॉर्म सेक्शन्स:**
   - जेव्हा ऑपरेटर योजना संपादित करत असेल (`isEditing === true`), आणि व्याजदर किंवा थकीत व्याजदर बदलला असेल, तेव्हा त्याला "संचालक मंडळ ठराव नोंद (Board Resolution Details)" फील्ड्स दृश्यमान होतील:
     - ठराव क्रमांक (उदा. "ठराव क्र. १२/२०२६")
     - ठराव दिनांक
     - अंमलबजावणी लागू दिनांक
     - बदल करण्याचे कारण / शेरा
2. **"📜 दर बदल नोंदवही (Rate Revision History)" मोडल:**
   - मुख्य हेडर व लिस्ट मोडलमध्ये "दर बदल इतिहास पहा" बटण.
   - प्रत्येक रेकॉर्डमध्ये जुना दर, नवीन दर, ठराव क्रमांक, लागू तारीख, बदलणारा अधिकारी आणि शेरा स्पष्ट दिसेल.
   - एक्सेल एक्सपोर्ट (`.xlsx`) व प्रिंट सुविधा.

---

### ४. पडताळणी व चाचणी योजना (Verification & Acceptance Criteria)

| अ.नं. | चाचणी प्रकार | चाचणी कृती | अपेक्षित निकाल |
|:---:|:---|:---|:---|
| १ | **कम्पाइलेशन चाचणी** | `dotnet build /t:Compile` व `npm run build` | **0 Errors** सह यशस्वी बिल्ड |
| २ | **डेटाबेस पडताळणी** | `LoanRateHistories` टेबल व फॉरेन की तपासणी | टेबल व दोन नॉन-क्लस्टर्ड इंडेक्स सक्रिय दिसणे |
| ३ | **दर बदल न करता PUT** | फक्त योजनेचे नाव/मुदत बदलून PUT कॉल करणे | `LoanRateHistories` मध्ये कोणतीही अनावश्यक नोंद न होणे |
| ४ | **व्याजदर बदलून PUT** | व्याजदर १२% वरून १४% करून ठराव क्र. "ठराव १२" सह सेव्ह करणे | `LoanRateHistories` मध्ये जुना दर १२%, नवीन दर १४%, ठराव क्र. १२ अशी अचूक नोंद होणे |
| ५ | **हिस्ट्री API तपासणी** | `GET /api/LoanRates/{id}/History` कॉल करणे | नोंदवलेली संपूर्ण हिस्टरी JSON स्वरूपात परत मिळणे |
| ६ | **UI मोडल तपासणी** | फ्रंटएंडवर "दर बदल इतिहास" बटण क्लिक करणे | सुंदर CBS नोंदवही टेबलमध्ये सर्व ठराव व दर दिसणे |

---

**माझे वरिष्ठ सिस्टीम लेखापरीक्षक म्हणून निवेदन:**  
सदर कृती आराखडा मंजूर असल्यास कृपया **"proceed"** म्हणावे, जेणेकरून मी तात्काळ अंमलबजावणी सुरू करीन.
