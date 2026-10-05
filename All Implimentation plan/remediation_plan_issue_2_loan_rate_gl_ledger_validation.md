# 📋 सुधारणा कृती आराखडा (Remediation Plan) - दोष क्र. २ [अति-गंभीर / CRITICAL]
## **GL खतावणी लेजर ग्रुप पडताळणीचा अभाव (Risk of Balance Sheet Corruption)**

**ऑडिट संदर्भ:** दोष क्र. २ (Issue #2)  
**मॉड्यूल:** कर्ज दर पत्रक व नियम (Loan Rate Master, Schemes & Rules Engine)  
**फाइल संदर्भ:**
- `d:\Bhisi Software\api\Bhisi.Api\Controllers\LoanRatesController.cs` (Backend Controller)
- `d:\Bhisi Software\api\Bhisi.Api\Program.cs` (Startup Database Auto-Healing & Integrity Checks)
- `d:\Bhisi Software\client\src\components\LoanRateMaster.tsx` (Frontend Master Form & Ledger Filtering)
- `d:\Bhisi Software\tools\heal_account_groups_and_rate_ledgers.sql` (Database Repair & Verification Script)

**जोखीम पातळी:** 🔴 **अति-गंभीर (CRITICAL - Financial Ledger & Balance Sheet Integrity Risk)**  
**ऑडिटर:** मुख्य सिस्टीम व बँकिंग प्रक्रिया लेखापरीक्षक (Chief CBS & Systems Auditor)  
**दिनांक:** ०४ ऑक्टोबर २०२६  

---

### १. लेखापरीक्षण पार्श्वभूमी व समस्येचे मूळ (Root Cause Analysis)

१. **फॉरेन्सिक तपासणी व धक्कादायक वस्तुस्थिती (Forensic Evidence):**
   - डेटाबेसवरील थेट फॉरेन्सिक तपासणीमध्ये असे आढळून आले की `SmartBanking_Gurudev` डेटाबेसमध्ये:
     - कर्ज योजना क्र. ६, ८, ९, १३ (`विनातारणी`, `ठेव तारण`, `सोने तारण`) यांचे मुद्दल खाते (`LoanLedgerID: 17`) हे **`इतर देणे` (Liabilities)** या गटात जोडले गेले होते!
     - व्याज खाते (`InterestLedgerID: 32`) हे **`अधिकृत भागभांडवल` (Liabilities)** या गटात जोडले गेले होते!
     - योजना क्र. ७ मध्ये व्याज खाते (`InterestLedgerID: 38`) चा लेजर ग्रुप `मिळालेले व्याज` हा डेटाबेसमध्ये चुकून **`Expenses` (खर्च)** म्हणून नोंदवला गेला होता!
   
२. **बॅकएंड API मधील असुरक्षितता (`LoanRatesController.cs`):**
   - `PostLoanRate` व `PutLoanRate` मध्ये केवळ:
     ```csharp
     bool loanLedgerExists = await _context.Ledgers.AnyAsync(l => l.LedgerID == loanRate.LoanLedgerID.Value);
     ```
     अशी साधी अस्तित्वाची तपासणी आहे. **लेजरचा ग्रुप (`NatureOfGroup`) काय आहे याची कोणतीही तपासणी नाही!**
   - जर ऑपरेटरने चुकून बचत ठेव (Liability), भागभांडवल (Liability) किंवा खर्च (Expense) लेजर मुद्दल किंवा व्याज म्हणून निवडले, तरी बॅकएंड ते विनातक्रार स्वीकारतो.

३. **फ्रंटएंड UI मधील त्रुटी (`LoanRateMaster.tsx`):**
   - `LoanRateMaster.tsx` मध्ये सर्व प्रकारची खाती (Assets, Liabilities, Income, Expenses) एकाच सरमिसळ `ledgerOptions` ड्रॉपडाऊनमध्ये दाखवली जातात.
   - ऑपरेटरला कोणता लेजर कोणत्या ग्रुपचा आहे (उदा. मालमत्ता आहे की उत्पन्न), याची कोणतीही स्पष्ट खूण (Badges) किंवा फिल्टर उपलब्ध नाही.

४. **बँकिंग व वैधानिक जोखीम (Banking & Statutory Risks):**
   - **ताळेबंद विकृती (Balance Sheet Distortion):** मुद्दल हे संस्थेची **मालमत्ता (Asset)** असते. ते जर 'देणे (Liability)' म्हणून नोंदवले गेले तर संस्थेचा ताळेबंद, तेरीज पत्रक (Trial Balance) आणि भांडवल पर्याप्तता (CRAR) पूर्णपणे फसवी ठरेल.
   - **सहकार ऑडिट आक्षेप (Statutory Audit Objections):** सहकार कायद्यान्वये (Section 81) व नागरी बँकिंग नियमावलीनुसार मुद्दल खाते हे *Loans & Advances (मालमत्ता)* आणि व्याज खाते हे *Interest Income (उत्पन्न)* गटातच असणे अनिवार्य आहे.

---

### २. सुधारणा उद्दिष्टे (Remediation Objectives)

- [x] **डेटाबेस ऑटो-हीलिंग (Auto-Healing of Groups in `Program.cs`):** `मिळालेले व्याज` किंवा `व्याज उत्पन्न` यांसारखे ग्रुप्स जर चुकून `Expenses` म्हणून नोंदवले गेले असतील, तर ते स्वयंचलितरीत्या `Income` मध्ये दुरुस्त करणे.
- [x] **बॅकएंड कडक पडताळणी (Server-Side Nature Enforcement):**
  - **कर्ज मुद्दल खाते (`LoanLedgerID`):** `NatureOfGroup == "Assets"` अनिवार्य.
  - **व्याज खाते (`InterestLedgerID`):** `NatureOfGroup == "Income"` अनिवार्य.
  - **थकीत व्याज खाते (`OverdueInterestLedgerID`):** दिले असल्यास `NatureOfGroup == "Income"` अनिवार्य.
  - **येणे व्याज खाते (`ReceivableInterestLedgerID`):** दिले असल्यास `NatureOfGroup == "Assets"` अनिवार्य (व्याज पोस्टिंग 'येणे' असल्यास अनिवार्य).
  - **इतर फी खाती (`Surcharge`, `RecoveryFee`, `ProcessingFee`):** दिले असल्यास `NatureOfGroup == "Income"` अनिवार्य.
- [x] **फ्रंटएंड सुसूत्रीकरण व वर्गवारी (Category-Filtered Dropdowns with Badges):**
  - मुद्दल खात्यासाठी फक्त **मालमत्ता (Assets)** खाती दर्शवणे व प्राधान्य देणे.
  - व्याज व फी खात्यांसाठी फक्त **उत्पन्न (Income)** खाती दर्शवणे व प्राधान्य देणे.
  - प्रत्येक लेजरच्या पुढे `[मालमत्ता / Asset]` किंवा `[उत्पन्न / Income]` असा स्पष्ट रंगीत बॅज दाखवणे.
  - चुकीचा लेजर निवडल्यास तात्काळ लाल रंगाचा चेतावणी अलर्ट दाखवणे.
- [x] **शून्य एरर व लाइव्ह पडताळणी (Zero Compile Errors & Integration Tests):**
  - बॅकएंड व फ्रंटएंड यशस्वी बिल्ड आणि वैध/अवैध लेजर कॉम्बिनेशनची थेट API टेस्ट.

---

### ३. तपशीलवार तांत्रिक अंमलबजावणी योजना (Step-by-Step Technical Plan)

#### टप्पा १: डेटाबेस ऑटो-हीलिंग पॅच (`tools/heal_account_groups_and_rate_ledgers.sql` व `Program.cs`)
1. डेटाबेसमधील चुकीच्या `NatureOfGroup` नोंदी दुरुस्त करणे:
   ```sql
   UPDATE AccountGroups 
   SET NatureOfGroup = 'Income' 
   WHERE (GroupName LIKE N'%मिळालेले व्याज%' OR GroupName LIKE N'%व्याज उत्पन्न%' OR GroupName LIKE N'%कमिशन जमा%') 
     AND NatureOfGroup = 'Expenses';

   UPDATE AccountGroups 
   SET NatureOfGroup = 'Assets' 
   WHERE GroupName LIKE N'%कर्जे%' AND NatureOfGroup <> 'Assets';
   ```
2. हे लॉजिक `Program.cs` मधील स्टार्टअप मायग्रेशन ब्लॉकमध्ये समाविष्ट करणे.

#### टप्पा २: बॅकएंड कडक प्रमाणीकरण (`LoanRatesController.cs`)
1. `ValidateLedgersAsync(LoanRate loanRate)` ही स्वतंत्र प्रायव्हेट मेथड तयार करणे:
   - `LoanLedgerID` चा लेजर लोड करून `l.AccountGroup.NatureOfGroup` तपासणे. जर `assets` नसेल तर मराठी संदेशासह ४०० BadRequest देणे:  
     `"अवैध खतावणी गट: कर्ज मुद्दल खाते '{loanLedger.LedgerName}' हे 'मालमत्ता (Assets)' गटातील असणे अनिवार्य आहे. (सध्याचे स्वरूप: {nature})"`
   - `InterestLedgerID` चा लेजर लोड करून `income` तपासणे.
   - `OverdueInterestLedgerID` चा लेजर दिल्यास `income` तपासणे.
   - `ReceivableInterestLedgerID` चा लेजर दिल्यास `assets` तपासणे.
   - फी लेजर्स (`SurchargeLedgerID`, `RecoveryFeeLedgerID`, `ProcessingFeeLedgerID`) दिल्यास `income` तपासणे.
2. ही पद्धत `PostLoanRate` आणि `PutLoanRate` दोन्हीमध्ये जोडणे.

#### टप्पा ३: फ्रंटएंड UI सुधारणा (`LoanRateMaster.tsx`)
1. `Ledger` इंटरफेस अपडेट करणे:
   ```typescript
   interface Ledger {
     ledgerID: number;
     ledgerName: string;
     accountGroup?: {
       groupID?: number;
       groupName?: string;
       natureOfGroup?: string;
     };
   }
   ```
2. स्वतंत्र पर्याय याद्या (Filtered Ledger Options):
   - `assetLedgerOptions`: फक्त `NatureOfGroup === 'Assets'` असलेली खाती (उदा. `[मालमत्ता] 523 - सभासद मध्यम मुदत कर्ज`).
   - `incomeLedgerOptions`: फक्त `NatureOfGroup === 'Income'` असलेली खाती (उदा. `[उत्पन्न] 525 - मेंबर व्याज मध्यम मुदत कर्ज`).
3. लेजर निवड विभागामध्ये रिअल-टाइम व्हॅलिडेशन बॅजेस जोडणे:
   - जर निवडलेला लेजर योग्य गटाचा असेल तर हिरवा `✓ वैध मालमत्ता खाते` किंवा `✓ वैध उत्पन्न खाते` बॅज.
   - चुकीचा असल्यास लाल `✗ अवैध गट: ताळेबंद दूषित होईल!` बॅज.
4. क्लायंट-साइड `handleSubmit` मध्ये लेजर ग्रुप व्हॅलिडेशन जोडणे.

#### टप्पा ४: पडताळणी व ऑडिट रिपोर्ट
1. `dotnet build /t:Compile` व `npm run build` शून्य त्रुटींसह धावणे.
2. लाइव्ह API वर चुकीचा ग्रुप पाठवून ४०० एरर आणि योग्य ग्रुप पाठवून २००/२०४ यश तपासणे.
3. वरिष्ठ सिस्टीम लेखापरीक्षक पूर्तता अहवाल तयार करणे.
