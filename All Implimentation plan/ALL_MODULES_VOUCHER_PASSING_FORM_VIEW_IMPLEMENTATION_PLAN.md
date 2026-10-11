# कोअर बँकिंग सर्व मॉड्यूल्स: व्हाउचर पासिंग "फॉर्म व्ह्यू" (Checker Read-Only & Direct Approval) महा-अंमलबजावणी आराखडा
## All Modules Voucher Passing Form View Checker Architecture & Implementation Plan

---

### १. उद्दिष्ट व पार्श्वभूमी (Executive Summary & Objective)
कोअर बँकिंग प्रणालीमध्ये (CBS) **दुहेरी नियंत्रण (Maker-Checker Dual Control)** ही सर्वात महत्त्वाची सुरक्षितता मानली जाते.
ऑपरेटर किंवा लिपिक (Maker) जेव्हा कोणत्याही शाखेतून किंवा काउंटरवरून व्यवहार नोंदवतो (उदा. कर्ज वाटप, कर्ज वसुली, बचत ठेव/उपसा, मुदत ठेव, पिग्मी वसुली, शेअर्स खरेदी इत्यादी), तेव्हा तो व्यवहार तातडीने मंजूर (Post) न होता **प्रलंबित व्हाउचर (Pending Voucher)** म्हणून सेव्ह होतो.

तपासनीस किंवा शाखा व्यवस्थापक (Checker) जेव्हा **"व्हाउचर पासिंग, मंजुरी व व्यवस्थापन" (`VoucherPosting.tsx`)** स्क्रीनवर येतो, तेव्हा त्याला फक्त आकड्यांची रोजकीर्द न दिसता **"फॉर्म व्ह्यू (Form View)"** बटणावर क्लिक करताच:
1. ज्या मूळ फॉर्ममध्ये ती नोंद झाली आहे, **त्याच मूळ फॉर्ममध्ये संपूर्ण व्यवहार (सर्व खाती, तपशील, नियम, व्याज, जामीनदार, सभासद प्रोफाईल)** हुबेहूब दिसावा.
2. तो फॉर्म तपासनीससाठी **पूर्णपणे केवळ वाचन (Strict View-Only / Read-Only)** मोडमध्ये लॉक असावा (कोणताही डेटा बदलता/एडिट करता येणार नाही किंवा नवीन नोंद करता येणार नाही).
3. फॉर्मच्या शीर्षस्थानी **"व्हाउचर पासिंग तपासणी मोड" (Amber Checker Alert Banner)** दिसावा.
4. फॉर्मवरच थेट **`[✅ मंजूर व पास करा (Approve & Pass)]`**, **`[❌ नामंजूर / रद्द करा (Reject)]`** आणि **`[↩️ पासिंग यादीवर परत जा (Back to Queue)]`** ची बटणे उपलब्ध असावीत. पास किंवा रिजेक्ट होताच सिस्टीम आपोआप व्हाउचर पासिंगच्या मूळ स्क्रीनवर परतावी.

---

### २. आर्किटेक्चरल स्टँडर्ड्स व घटक (Standardized Architecture Pattern)

सर्व मॉड्यूल्समध्ये खालील **४-स्तरीय मानक (Standard 4-Layer Pattern)** लागू केले जाईल:

```
[ व्हाउचर पासिंग यादी (VoucherPosting.tsx) ]
           │
           ▼ (१. Dispatcher Routing: ?voucherId={id}&passingMode=true)
[ मूळ व्यवहार फॉर्म (Target Component e.g. SavingTransactionEntry.tsx) ]
           │
           ├─► (२. Backend Fetch: GET /api/{Module}/by-voucher/{voucherId})
           ├─► (३. UI Lockdown: <fieldset disabled={isPassingMode}> + Dropdown Locks)
           └─► (४. Checker Passing Controls: [मंजूर व पास] | [नामंजूर] | [परत जा])
```

#### मानक १: डिस्पॅचर राऊटिंग (Routing Protocol)
`VoucherPosting.tsx` मधील `handleOpenFormView(v: Voucher)` फंक्शन व्हाउचरच्या **Narration, VoucherNo आणि Ledgers** चे विश्लेषण करून अचूक मॉड्यूल व सब-टॅबवर रिडायरेक्ट करेल:
- URL पॅरामीटर्स: `?voucherId=${v.voucherID}&passingMode=true`

#### मानक २: बॅकएंड एंडपॉइंट्स (Dedicated Backend Endpoints)
प्रत्येक मॉड्यूलच्या कंट्रोलरमध्ये एक समर्पित एंडपॉइंट असेल:
- `[HttpGet("by-voucher/{voucherId}")]`
- हा एंडपॉइंट संबंधित टेबलमधून व्हाउचर आयडीशी जोडलेली नोंद (उदा. `SavingTransaction`, `FdAccount`, `LoanDisbursement` इत्यादी) शोधून, त्याचे संपूर्ण रिलेशन ग्राफ (Customer, Member, Ledgers, Deductions, Voucher) परत पाठवेल.

#### मानक ३: फ्रंटएंड लॉकडाऊन प्रोटोकॉल (Frontend View-Only Protocol)
- `const isPassingMode = Boolean(isReadOnly || queryParams.get('passingMode') === 'true');`
- मुख्य फॉर्म `<fieldset disabled={isPassingMode} className="contents space-y-2.5">` मध्ये बंदिस्त असेल.
- सर्व कस्टम घटक जसे `CustomerSearchSelect`, `MemberSearchSelect`, `SearchableSelect` यांना `isDisabled={isPassingMode}` किंवा `disabled={isPassingMode}` दिले जाईल.
- फॉर्ममधील नवीन नोंद (`+ नवीन नोंद`), सेव्ह (`Save`), रिसेट (`Reset`), आणि एडिट बटणे पासिंग मोडमध्ये पूर्णपणे लपवली जातील.

#### मानक ४: पासिंग बॅनर व अ‍ॅक्शन बार (Checker Header & Action Controls)
- फॉर्मच्या वर **अंबर रंगाचा चेकर अलर्ट बॅनर**: व्हाउचर क्रमांक, तारीख, व्यवहार प्रकार व रक्कम स्पष्ट दाखवेल.
- फॉर्मच्या तळाशी खालील ३ कृती बटणे:
  1. **`[ ↩️ पासिंग यादीवर परत जा ]`**: व्हाउचर यादीवर विनाबदल सुरक्षित परत नेण्यासाठी.
  2. **`[ ✅ मंजूर व पास करा ]`**: थेट पासिंग कॉल (`/api/VoucherPosting/Post`), दैनिक स्क्रॉल नंबर वाटप व परत जाणे.
  3. **`[ ❌ नामंजूर / रद्द करा ]`**: कारण विचारून व्हाउचर रिजेक्ट/डिलीट करणे व ऑडिट लॉग नोंदवणे.

---

### ३. मॉड्यूलनिहाय सविस्तर अंमलबजावणी टप्पे (Step-by-Step Implementation Matrix)

| टप्पा क्र. | विभाग / मॉड्यूल (Module Name) | मूळ फॉर्म कॉम्पोनंट (Frontend Component) | बॅकएंड कंट्रोलर (Backend Controller) | सद्यस्थिती (Status) |
|---|---|---|---|---|
| **टप्पा ०** | **कर्ज विभाग (Loan Process)** | `LoanApplicationMaster.tsx`<br>`LoanDisbursementMaster.tsx`<br>`LoanCollectionMaster.tsx` | `LoanApplicationsController.cs`<br>`LoanDisbursementsController.cs`<br>`LoanCollectionsController.cs` | ✅ **पूर्ण (Completed)** |
| **टप्पा ०.१**| **सामान्य व्हाउचर्स (General Vouchers)** | `VoucherMaster.tsx` | `VouchersController.cs`<br>`VoucherPostingController.cs` | ✅ **पूर्ण (Completed)** |
| **टप्पा १** | **सेंट्रल डिस्पॅचर इंजिन (Dispatcher)** | `VoucherPosting.tsx` | `VoucherPostingController.cs` | 🔄 **अपग्रेड करणे** |
| **टप्पा २** | **बचत खाते विभाग (Saving Module)** | `SavingTransactionEntry.tsx`<br>`SavingAccountClosingMaster.tsx` | `SavingTransactionsController.cs`<br>`SavingAccountClosingsController.cs` | ⏳ **प्रलंबित (Next)** |
| **टप्पा ३** | **मुदत ठेव विभाग (Fixed Deposit - FD)** | `FdAccountOpening.tsx`<br>`FdWithdrawalMaturity.tsx` | `FdAccountsController.cs` | ⏳ **प्रलंबित** |
| **टप्पा ४** | **आवर्ती ठेव विभाग (Recurring Deposit - RD)**| `RdAccountOpening.tsx`<br>`RdInstallmentCollection.tsx`<br>`RdWithdrawalMaturity.tsx` | `RdAccountsController.cs` | ⏳ **प्रलंबित** |
| **टप्पा ५** | **पिग्मी ठेव विभाग (Pigmy Deposit)** | `PigmyCollectionMaster.tsx`<br>`AgentDayBookMaster.tsx`<br>`PigmyClosureMaster.tsx` | `PigmyCollectionsController.cs`<br>`AgentDayBookController.cs`<br>`PigmyClosureController.cs` | ⏳ **प्रलंबित** |
| **टप्पा ६** | **भाग भांडवल विभाग (Share Capital)** | `ShareMaster.tsx`<br>`ShareTransferMaster.tsx`<br>`ShareWithdrawal.tsx` | `ShareAccountsController.cs`<br>`ShareCertificatesController.cs` | ⏳ **प्रलंबित** |
| **टप्पा ७** | **लॉकर विभाग (Locker Module)** | `LockerAllotmentMaster.tsx`<br>`LockerRentRenewal.tsx`<br>`LockerSurrenderMaster.tsx` | `LockerAllotmentsController.cs`<br>`LockerRentController.cs`<br>`LockerSurrenderController.cs` | ⏳ **प्रलंबित** |
| **टप्पा ८** | **मालमत्ता व गुंतवणूक (Assets & Investments)** | `AssetPurchaseForm.tsx`<br>`InvestmentAccountOpening.tsx` | `AssetPurchasesController.cs`<br>`InvestmentAccountsController.cs` | ⏳ **प्रलंबित** |

---

### ४. तपशीलवार तांत्रिक कृती आराखडा (Detailed Step-by-Step Technical Execution)

---

#### टप्पा १: सेंट्रल डिस्पॅचर इंजिन अपडेट (`VoucherPosting.tsx`)
**उद्दिष्ट:** व्हाउचरच्या नोंदीवरून अचूक फॉर्म ओळखणे आणि नेव्हिगेट करणे.
- **फाइल:** `client/src/components/VoucherPosting.tsx`
- **कृती:**
  `handleOpenFormView(v: Voucher)` मध्ये इंटेलिजंट पॅटर्न डिटेक्शन समाविष्ट करणे:
  1. **कर्ज वितरण (Loan Disbursement):** `isLoanDisbursement` -> `loan-process?subTab=2&voucherId=...&passingMode=true`
  2. **कर्ज वसुली (Loan Collection):** `isLoanCollection` -> `loan-collection?voucherId=...&passingMode=true`
  3. **बचत ठेव/उपसा (Saving Deposit/Withdrawal):** 
     - Narration मध्ये `बचत जमा`, `बचत नावे`, `Saving Deposit`, `Saving Withdrawal` असल्यास -> `saving-transaction?voucherId=...&passingMode=true`
  4. **बचत खाते बंद (Saving Account Closing):**
     - Narration मध्ये `बचत खाते बंद`, `Saving Account Closed` असल्यास -> `saving-closing?voucherId=...&passingMode=true`
  5. **मुदत ठेव उघडणे (FD Account Opening):**
     - Narration मध्ये `मुदत ठेव खाते उघडले`, `FD Account Opened`, `REC-FD-` असल्यास -> `fd-account?voucherId=...&passingMode=true`
  6. **मुदत ठेव बंद/मुदतपूर्ती (FD Closure / Maturity):**
     - Narration मध्ये `मुदत ठेव बंद`, `FD Closed`, `FD Withdrawal` असल्यास -> `fd-withdrawal?voucherId=...&passingMode=true`
  7. **आवर्ती ठेव उघडणे/हप्ता (RD Opening / Collection):**
     - Narration मध्ये `आवर्ती ठेव खाते उघडले` -> `rd-account?voucherId=...&passingMode=true`
     - Narration मध्ये `RD Installment`, `आवर्ती ठेव हप्ता` -> `rd-collection?voucherId=...&passingMode=true`
     - Narration मध्ये `RD Closed`, `आवर्ती ठेव बंद` -> `rd-withdrawal?voucherId=...&passingMode=true`
  8. **पिग्मी दैनिक वसुली (Pigmy Collection / Agent Daybook):**
     - Narration मध्ये `पिग्मी वसुली`, `Pigmy Collection`, `एजंट डे-बुक` -> `pigmy-collection?voucherId=...&passingMode=true`
  9. **पिग्मी खाते बंद (Pigmy Closure):**
     - Narration मध्ये `पिग्मी खाते बंद`, `Pigmy Closed` -> `pigmy-closure?voucherId=...&passingMode=true`
  10. **भाग भांडवल (Share Capital / Purchase / Transfer):**
      - Narration मध्ये `भाग भांडवल`, `Share Capital`, `Share Purchase` -> `shares?voucherId=...&passingMode=true`
      - Narration मध्ये `भाग हस्तांतरण`, `Share Transfer` -> `share-transfer?voucherId=...&passingMode=true`
  11. **लॉकर वाटप व भाडे (Locker Allotment / Rent):**
      - Narration मध्ये `लॉकर भाडे`, `Locker Rent` -> `locker-rent?voucherId=...&passingMode=true`
      - Narration मध्ये `लॉकर वाटप`, `Locker Allotment` -> `locker-allotment?voucherId=...&passingMode=true`
  12. **सामान्य व्हाउचर (General Voucher):**
      - वरील कशातही न बसणारे रोख/बँक व्यवहार -> `voucher?voucherId=...&passingMode=true`

---

#### टप्पा २: बचत खाते विभाग (Saving Module)

##### २.१ बचत ठेव व उपसा व्यवहार (`SavingTransactionEntry.tsx`)
- **बॅकएंड बदल:**
  - `SavingTransactionsController.cs` मध्ये `[HttpGet("by-voucher/{voucherId}")]` जोडणे.
  - रिटर्न: `SavingTransaction` + `SavingAccount` + `Customer` + `Ledger` + `Voucher`.
- **फ्रंटएंड बदल (`SavingTransactionEntry.tsx`):**
  - URL मधील `voucherId` व `passingMode` वाचणे.
  - ट्रान्झॅक्शन ऑटो-लोड करणे (तारीख, बचत खाते क्र., खातेदाराचे नाव, जमा/नावे प्रकार, रक्कम, शेरा, स्लिप नंबर).
  - फॉर्मवर `<fieldset disabled={isPassingMode}>` लॉक करणे.
  - सेव्ह व क्लिअर बटणे लपवून **[मंजूर व पास करा]**, **[नामंजूर / रद्द करा]** व **[व्हाउचर यादीवर परत जा]** जोडणे.

##### २.२ बचत खाते बंद नोंदणी (`SavingAccountClosingMaster.tsx`)
- **बॅकएंड बदल:**
  - `SavingAccountClosingsController.cs` मध्ये `[HttpGet("by-voucher/{voucherId}")]` जोडणे.
- **फ्रंटएंड बदल:**
  - बंद खात्याची बाकी शिल्लक, जमा केलेले व्याज, कापलेले चार्जेस, अंतिम देय रक्कम पूर्णपणे लॉक मोडमध्ये दाखवणे.

---

#### टप्पा ३: मुदत ठेव विभाग (Fixed Deposit - FD Module)

##### ३.१ नवीन मुदत ठेव खाते उघडणे (`FdAccountOpening.tsx`)
- **बॅकएंड बदल:**
  - `FdAccountsController.cs` मध्ये `[HttpGet("by-voucher/{voucherId}")]` जोडणे.
  - रिटर्न: `FdAccount` + `Customer` + `FdScheme` + `Voucher`.
- **फ्रंटएंड बदल (`FdAccountOpening.tsx`):**
  - डिपॉझिट पावती क्रमांक, ठेव रक्कम, व्याज दर (उदा. ९.५०%), मुदत महिने, मुदतपूर्ती दिनांक, मुदतपूर्ती रक्कम, वारसदार (Nominee) चे नाव अचूक लोड करणे.
  - नवीन पावती क्रमांक जनरेट होणे पासिंग मोडमध्ये रोखणे.
  - सर्व इनपुट्स लॉक करून पासिंग अ‍ॅक्शन बार देणे.

##### ३.२ मुदत ठेव मुदतपूर्व / मुदतपूर्ती बंद (`FdWithdrawalMaturity.tsx`)
- **बॅकएंड बदल:**
  - `FdAccountsController.cs` मध्ये `[HttpGet("closure-by-voucher/{voucherId}")]` जोडणे.
- **फ्रंटएंड बदल:**
  - मुद्दल रक्कम, प्रत्यक्ष दिलेले व्याज, मुदतपूर्व दंडात्मक व्याज वजावट (Premature Penalty), निव्वळ रोख/बँक प्रदान रक्कम लॉक करून पासिंग मोडमध्ये दाखवणे.

---

#### टप्पा ४: आवर्ती ठेव विभाग (Recurring Deposit - RD Module)

##### ४.१ नवीन आवर्ती ठेव खाते उघडणे (`RdAccountOpening.tsx`)
- **बॅकएंड बदल:** `RdAccountsController.cs` मध्ये `[HttpGet("by-voucher/{voucherId}")]`
- **फ्रंटएंड बदल:** मासिक हप्ता रक्कम, मुदत, व्याज दर, अपेक्षित मुदतपूर्ती रक्कम लॉक मोडमध्ये लोड करणे.

##### ४.२ आवर्ती ठेव मासिक हप्ता भरणा (`RdInstallmentCollection.tsx`)
- **बॅकएंड बदल:** `RdAccountsController.cs` मध्ये `[HttpGet("installment-by-voucher/{voucherId}")]`
- **फ्रंटएंड बदल:** भरलेले हप्ते, थकबाकी दंड (Late Fee / Penalty), एकूण पावती रक्कम लॉक मोडमध्ये दाखवणे.

##### ४.३ आवर्ती ठेव मुदतपूर्ती बंद (`RdWithdrawalMaturity.tsx`)
- **बॅकएंड बदल:** `RdAccountsController.cs` मध्ये क्लोजर व्हाउचर शोधणे व लॉक मोडमध्ये दाखवणे.

---

#### टप्पा ५: पिग्मी / दैनिक ठेव विभाग (Pigmy Daily Deposit Module)

##### ५.१ पिग्मी दैनिक वसुली / एजंट डे-बुक (`PigmyCollectionMaster.tsx` / `AgentDayBookMaster.tsx`)
- **बॅकएंड बदल:**
  - `PigmyCollectionsController.cs` व `AgentDayBookController.cs` मध्ये `[HttpGet("by-voucher/{voucherId}")]` जोडणे.
- **फ्रंटएंड बदल:**
  - एजंट कोड व नाव, वसुली तारीख, एकूण गोळा झालेली रक्कम आणि कोणत्या पिग्मी खात्यात किती रक्कम जमा झाली याची संपूर्ण ग्रिड (Grid) **केवळ वाचन** मोडमध्ये दाखवणे.
  - चेकरला एजंटच्या पावती पुस्तकातील एकूण वसुली व रोजकीर्द तपासून १-क्लिकमध्ये पास करण्याची सुविधा देणे.

##### ५.२ पिग्मी खाते बंद / उपसा (`PigmyClosureMaster.tsx`)
- **बॅकएंड बदल:** `PigmyClosureController.cs` मध्ये `[HttpGet("by-voucher/{voucherId}")]`
- **फ्रंटएंड बदल:** एकूण जमा शिल्लक, व्याज, एजंट कमिशन कपात आणि खातेदाराला अदा केलेली रक्कम लॉक मोडमध्ये दाखवणे.

---

#### टप्पा ६: भाग भांडवल विभाग (Share Capital Module)

##### ६.१ नवीन भाग वाटप / शेअर्स खरेदी (`ShareMaster.tsx`)
- **बॅकएंड बदल:**
  - `ShareAccountsController.cs` मध्ये `[HttpGet("by-voucher/{voucherId}")]` जोडणे.
  - रिटर्न: `ShareAccount` + `Member` + `ShareCertificates` + `Voucher`.
- **फ्रंटएंड बदल (`ShareMaster.tsx`):**
  - सभासद नाव व CIF, खरेदी केलेले शेअर्स (संख्या), दर्शनी मूल्य (Face Value), प्रवेश फी (Entrance Fee), इमारत निधी (Building Fund), आणि एकूण व्हाउचर रक्कम लॉक मोडमध्ये दाखवणे.

##### ६.२ भाग हस्तांतरण व परतावा (`ShareTransferMaster.tsx` व `ShareWithdrawal.tsx`)
- **बॅकएंड बदल:** `ShareAccountsController.cs` मध्ये ट्रान्सफर/विड्रॉल व्हाउचर एंडपॉइंट्स.
- **फ्रंटएंड बदल:** हस्तांतरक व स्वीकारक सभासद माहिती व मंजुरी ठराव क्रमांक लॉक मोडमध्ये दाखवणे.

---

#### टप्पा ७: लॉकर व इतर विभाग (Locker, Assets & Investments)

##### ७.१ लॉकर वाटप व भाडे नूतनीकरण (`LockerAllotmentMaster.tsx` व `LockerRentRenewal.tsx`)
- **बॅकएंड बदल:** `LockerAllotmentsController.cs` व `LockerRentController.cs` मध्ये व्हाउचर एंडपॉइंट्स.
- **फ्रंटएंड बदल:** लॉकर क्रमांक, डिपॉझिट रक्कम, वार्षिक भाडे, जीएसटी, कालावधी लॉक मोडमध्ये दाखवणे.

##### ७.२ स्थिर मालमत्ता खरेदी (`AssetPurchaseForm.tsx`)
- **बॅकएंड बदल:** `AssetPurchasesController.cs` मध्ये `by-voucher` एंडपॉइंट.
- **फ्रंटएंड बदल:** मालमत्ता नाव, व्हेंडर नाव, बीजक (Invoice) क्र., खरेदी किंमत, घसारा दर लॉक मोडमध्ये दाखवणे.

---

### ५. सुरक्षितता, ऑडिट व अखंडता पडताळणी (Security, Audit & Integrity Checks)

1. **मेकर-चेकर विलगता (Maker-Checker Segregation):**
   - ज्या युझरने (Maker) एन्ट्री तयार केली आहे, त्याच युझरला ती स्वतः पास करता येणार नाही (बँकिंग नियमानुसार चेकर दुसरा अधिकारी असावा).
2. **स्क्रॉल नंबर ऑटो-अलोकेशन (Sequential Scroll Numbering):**
   - फॉर्मवरून पास बटण दाबताच त्या दिवशीच्या रोजकीर्दीचा पुढील सलग **स्क्रॉल नंबर (`ScrollNo`)** व्हाउचरला दिला जाईल.
3. **अनधिकृत बदल प्रतिबंध (Zero-Tamper Guarantee):**
   - पासिंग मोडमध्ये डेटाबेसला कोणताही `PUT`, `POST` (नवीन डेटा निर्मिती) किंवा `DELETE` पाठवता येणार नाही; फक्त मंजूर (`/api/VoucherPosting/Post`) किंवा नामंजूर (`/api/VoucherPosting/{id}`) हेच दोन सुरक्षित कॉल्स होतील.
4. **कारण नोंदणी ऑडिट ट्रेल (Mandatory Rejection Audit Log):**
   - चेकरने व्यवहार नामंजूर केल्यास त्याला **नामंजूरीचे कारण (Reason)** टाकणे सक्तीचे असेल, जे भविष्यातील ऑडिटसाठी सिस्टममध्ये नोंदवले जाईल.

---

### ६. अंमलबजावणी वेळापत्रक व प्राधान्यक्रम (Phased Rollout Schedule)

- **टप्पा १ (दिवस १):** `VoucherPosting.tsx` सेंट्रल डिस्पॅचर व पॅटर्न मॅचिंग अपग्रेड.
- **टप्पा २ (दिवस २):** बचत खाते विभाग (`SavingTransactionEntry` व `SavingAccountClosing`).
- **टप्पा ३ (दिवस ३):** मुदत ठेव (FD) विभाग (`FdAccountOpening` व `FdWithdrawalMaturity`).
- **टप्पा ४ (दिवस ४):** आवर्ती ठेव (RD) विभाग (`RdAccountOpening` व `RdInstallmentCollection`).
- **टप्पा ५ (दिवस ५):** पिग्मी विभाग (`PigmyCollectionMaster`, `AgentDayBook` व `PigmyClosure`).
- **टप्पा ६ (दिवस ६):** भाग भांडवल व शेअर्स विभाग (`ShareMaster` व `ShareTransfer`).
- **टप्पा ७ (दिवस ७):** लॉकर, मालमत्ता व संपूर्ण CBS एंड-टू-एंड टेस्टिंग व ऑडिट सर्टिफिकेशन.

---
**नोंद:** हा आराखडा कोअर बँकिंगच्या सर्वोच्च सुरक्षा व वापरकर्त्याच्या सुलभतेच्या मानकांवर आधारित तयार करण्यात आला आहे.
