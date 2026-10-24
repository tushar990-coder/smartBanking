# अंमलबजावणी आराखडा (Implementation Plan)
## मासिक आरडी हप्ता संकलन: 'आरडी खाते क्रमांक निवडा' ड्रॉपडाउन व कार्डमध्ये जुना आरडी खाते क्रमांक (Legacy Account Number) दर्शविणे

**दिनांक:** २५ ऑक्टोबर २०२६  
**मॉड्यूल:** आवर्ती ठेव (RD Module) - मासिक हप्ता संकलन (RD Installment Collection)  
**घटक:** [RdInstallmentCollection.tsx](file:///d:/Bhisi%20Software/client/src/components/RdInstallmentCollection.tsx) व [RdAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/RdAccountsController.cs)  
**कामाचे स्वरूप:** प्लॅन तयार करणे (Do NOT code until approved)  

---

### १. समस्येचे विश्लेषण व मूळ कारण (Root Cause Analysis)

1. **डेटाबेस व मॉडेल स्थिती:**  
   * `[RdAccounts]` टेबलमध्ये `[LegacyAccountNumber]` कॉलम अस्तित्वात आहे आणि [RdAccount.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Models/RdAccount.cs) मॉडेलमध्ये `public string? LegacyAccountNumber { get; set; }` फील्ड उपलब्ध आहे. जुनी खाती उघडताना किंवा मायग्रेशन करताना जुना क्रमांक डेटाबेसमध्ये यशस्वीरीत्या जतन केला जातो.

2. **फ्रंटेंड कोड स्थिती:**  
   * [RdInstallmentCollection.tsx](file:///d:/Bhisi%20Software/client/src/components/RdInstallmentCollection.tsx) मध्ये ड्रॉपडाउन (Line 634), सिलेक्टेड कार्ड (Line 662-666), मल्टिपल आरडी मोडल (Line 1106-1110) आणि बल्क टेबल (Line 942-946) मध्ये `a.legacyAccountNumber` दाखवण्यासाठी कोड आधीच लिहिलेला आहे:
     ```tsx
     const legBadge = a.legacyAccountNumber ? ` [🏷️ जुने आरडी: ${a.legacyAccountNumber}]` : '';
     ```

3. **मूळ त्रुटी (The Root Cause):**  
   * बॅकएंड [RdAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/RdAccountsController.cs) मधील `GetRdAccounts` (Line 267-309) आणि `GetRdAccount(id)` (Line 350-380) या दोन्ही API एंडपॉईंट्सच्या LINQ `.Select(r => new { ... })` अनामिक प्रोजेक्शनमध्ये `r.LegacyAccountNumber` चा समावेश करणे राहून गेले होते.
   * परिणामी, जेव्हा फ्रंटेंड `/api/RdAccounts` ला कॉल करते, तेव्हा सर्व खात्यांसाठी `legacyAccountNumber` नेहमी `undefined` किंवा `null` परत येत होते. यामुळे UI मध्ये जुना आरडी क्रमांक दिसत नव्हता आणि जुन्या क्रमांकाने शोधणे शक्य होत नव्हते.

---

### २. प्रस्तावित बदल व कार्यपद्धती (Proposed Solution & Scope of Work)

#### पायरी १: बॅकएंड API मध्ये `LegacyAccountNumber` जोडणे
फाईल: [RdAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/RdAccountsController.cs)
1. **`GET: api/RdAccounts` (Line 284):**  
   प्रोजेक्शनमध्ये `r.LegacyAccountNumber` समाविष्ट करणे:
   ```csharp
   r.AccountNo,
   FormattedAccountNo = LuhnHelper.Format14Digit(r.AccountNo),
   r.LegacyAccountNumber, // ⚡ ADDED: जुना आरडी खाते क्रमांक
   r.OpeningDate,
   ```
2. **`GET: api/RdAccounts/{id}` (Line 363):**  
   `AccountDetails` ऑब्जेक्टमध्ये `r.LegacyAccountNumber` समाविष्ट करणे:
   ```csharp
   r.AccountNo,
   FormattedAccountNo = LuhnHelper.Format14Digit(r.AccountNo),
   r.LegacyAccountNumber, // ⚡ ADDED: जुना आरडी खाते क्रमांक
   r.OpeningDate,
   ```
3. **`GET: api/RdAccounts/installment-by-voucher/{voucherId}` (Line 2424):**  
   व्हाउचर पासिंग मोडसाठी `account.LegacyAccountNumber` समाविष्ट करणे.

---

#### पायरी २: फ्रंटेंड UI व सर्च अधिक समृद्ध करणे (Enhanced Dropdown & Search)
फाईल: [RdInstallmentCollection.tsx](file:///d:/Bhisi%20Software/client/src/components/RdInstallmentCollection.tsx)
1. **`SearchableSelect` मधील ऑप्शन्स अधिक स्पष्ट करणे (Line 632-645):**
   * केवळ लेबलमध्येच नव्हे, तर [SearchableSelect.tsx](file:///d:/Bhisi%20Software/client/src/components/SearchableSelect.tsx) च्या आधुनिक संरचनेचा पूर्ण लाभ घेऊन `subLabel` आणि `badge` जोडणे:
   ```tsx
   <SearchableSelect
     options={accounts.map((a) => {
       const legNo = a.legacyAccountNumber || (a as any).LegacyAccountNumber || '';
       const legBadge = legNo ? ` [🏷️ जुने आरडी: ${legNo}]` : '';
       return {
         value: a.rdAccountID,
         label: `${a.accountNo}${legBadge} - ${a.memberName} (${a.schemeName})`,
         subLabel: `खातेदार: ${a.memberName} | योजना: ${a.schemeName}${legNo ? ` | 🏷️ जुने खाते क्र.: ${legNo}` : ''}`,
         badge: legNo ? `जुने: ${legNo}` : undefined,
         badgeColor: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
       };
     })}
     value={selectedAccId}
     onChange={handleAccountChange}
     placeholder="नाव किंवा नवीन/जुने खाते क्रमांकाने शोधा..."
     disabled={isPassingMode}
   />
   ```
2. **जुन्या क्रमांकाने त्वरित शोध (Instant Search by Old RD No):**  
   * [SearchableSelect.tsx](file:///d:/Bhisi%20Software/client/src/components/SearchableSelect.tsx) मध्ये `normLabel` व `normSub` तपासणी असल्याने, ऑपरेटरने सर्च बॉक्समध्ये जुना क्रमांक (उदा. "104" किंवा "RD-45") टाईप करताच संबंधित खाते त्वरित फिल्टर होऊन समोर येईल.
3. **सिलेक्टेड खाते तपशील कार्ड (Selected Account Card - Line 662):**  
   * खाते निवडल्यानंतर खालील कार्डवर जुना क्रमांक स्पष्ट जांभळ्या बॅजमध्ये (`🏷️ जुने आरडी: 104`) दिसेल.
4. **मल्टिपल आरडी मोडल (Multi-RD Selection Modal - Line 1106):**  
   * एकाच खातेदाराची अनेक खाती असल्यास पॉपअप मोडलमध्ये प्रत्येक खात्याचा जुना क्रमांक ठळकपणे दिसेल.
5. **बल्क हप्ता संकलन टेबल (Bulk Collection Mode - Line 942):**  
   * टेबल कॉलममध्ये नवीन खात्याच्या खाली जुना क्रमांक दिसेल.

---

### ३. पडताळणी व चाचणी योजना (Verification & Test Plan)

| अ.क्र. | चाचणी प्रकार | अपेक्षित परिणाम |
|:---:|:---|:---|
| **१** | आरडी हप्ता संकलन स्क्रीन उघडणे | 'आरडी खाते क्रमांक निवडा' ड्रॉपडाउन उघडल्यावर ज्या खात्यांना जुना क्रमांक आहे, त्यांच्या समोर `[🏷️ जुने आरडी: xxx]` आणि जांभळा बॅज दिसणे. |
| **२** | जुन्या क्रमांकाने शोधणे (Search) | सर्च बॉक्समध्ये जुना आरडी क्रमांक टाईप केल्यास तेच खाते अचूक फिल्टर होऊन येणे. |
| **३** | खाते निवडणे | खाते निवडल्यावर खालील तपशील कार्डवर खातेदाराच्या नावाशेजारी `🏷️ जुने आरडी: xxx` स्पष्ट दिसणे. |
| **४** | एकापेक्षा जास्त खाती असणारा खातेदार | 'खातेदाराची X आरडी खाती उपलब्ध' बटण दाबल्यावर पॉपअपमध्ये सर्व खात्यांचे जुने क्रमांक दिसणे. |
| **५** | बल्क मोड (Bulk Mode) | बल्क हप्ता संकलन ग्रिडमध्ये जुना आरडी क्रमांक दिसणे. |
| **६** | पासिंग मोड (Checker Mode) | व्हाउचर पास करताना आरडी खात्याचा जुना क्रमांक पडताळणीसाठी उपलब्ध असणे. |

---

### ४. मंजुरी (Proceed Confirmation)

हा बदल अंमलात आणल्यास बॅकएंड किंवा डेटाबेसवर कोणताही अनपेक्षित परिणाम होणार नाही; फक्त `LegacyAccountNumber` डेटा फ्रंटेंडपर्यंत व्यवस्थित पोहोचेल आणि ऑपरेटर्सना जुन्या आरडी क्रमांकाने पावत्या बनवणे अत्यंत सोपे होईल.

आपण सहमत असल्यास **"proceed"** म्हणावे, जेणेकरून मी तात्काळ कोडिंग सुरू करेन.
