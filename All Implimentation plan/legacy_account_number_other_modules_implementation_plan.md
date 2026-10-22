# कोअर बँकिंग सिस्टीम (CBS) - सर्व मॉड्यूल्समध्ये 'जुने खाते क्र. / जुना सभासद क्र.' (Legacy Account & Member Number) शोध व व्हिज्युअल बॅज एकात्मिकरण अंमलबजावणी आराखडा

> **दस्तऐवज संदर्भ:** `LEGACY-ACCOUNT-ACROSS-ALL-MODULES-PLAN-v1.0`  
> **तारीख:** २२ ऑक्टोबर २०२६  
> **स्थिती:** नियोजित (Architecture & Implementation Plan - No Code Executed)  
> **उद्देश:** ज्याप्रमाणे 'कर्ज वसुली' (Loan Collection) मध्ये जुना कर्ज खाते क्रमांक (`legacyAccountNumber`) शोध, ड्रॉपडाऊन बॅज व कार्डवर दाखवला, त्याच धर्तीवर CBS च्या उर्वरित सर्व मॉड्यूल्समध्ये (शेअर्स, लॉकर, गुंतवणूक, कर्ज इतर उप-मॉड्यूल्स, पिग्मी, आरडी व बचत) जुने खाते/सभासद क्रमांक शोध व दृश्यमानतेचा सर्वंकष आराखडा तयार करणे.

---

## १. पार्श्वभूमी व आवश्यकता (Business Context)

सहकारी पतसंस्था, नागरी बँका व सोसायट्यांमध्ये जेव्हा जुन्या मॅन्युअल नोंदवह्या किंवा जुन्या DOS/FoxPro/VB सॉफ्टवेअरमधून CBS मध्ये स्थलांतर (Data Migration) होते, तेव्हा:
1. **ग्राहकांची सवय:** बहुतांश जुने खातेदार व सभासद आपल्या जुन्या पासबुकवरील किंवा जुन्या ठेव पावतीवरील जुना हस्तलिखित क्रमांक (उदा. `१०२०`, `५५`, `१२५`) लक्षात ठेवतात.
2. **काउंटरवरील अडचण:** कॅशियर किंवा ऑपरेटरकडे ग्राहक आल्यावर नवीन १४-अंकी CBS खाते क्रमांक (उदा. `001-201-0000001-4`) ऐवजी जुना क्रमांक सांगतो.
3. **सद्यस्थितीतील त्रुटी:** 'कर्ज वसुली' (Loan Collection) मध्ये ही सुविधा नुकतीच यशस्वीरित्या दिली गेली, परंतु शेअर्स परतावा, लॉकर भाडे/समर्पण, बँक गुंतवणूक, पिग्मी क्लोजर, आरडी हप्ता, कर्ज खतावणी, जामीनदार अहवाल व बचत खाते बंद यांसारख्या इतर दैनंदिन मॉड्यूल्समध्ये जुना क्रमांक शोधता येत नाही किंवा समोर दिसत नाही.

---

## २. संपूर्ण CBS मॉड्यूल ऑडिट व गॅप विश्लेषण (Module-by-Module Gap Analysis)

| अ.क्र. | मॉड्यूल / घटक | वापरण्यात येणारा घटक | सध्याची स्थिती (Current Status) | आवश्यक सुधारणा (Proposed Enhancement) |
|---|---|---|---|---|
| **१** | **सभासद व शेअर्स (Member & Shares)** | `MemberSearchSelect.tsx` | मॉडेलमध्ये `legacyMemberNo` आहे व सर्च होते, पण ड्रॉपडाऊन व व्हॅल्यू पिलमध्ये **बॅज दिसत नाही**. | `[🏷️ जुना सभासद क्र: ...]` जांभळा बॅज ड्रॉपडाउन व सिलेक्टेड इनपुटमध्ये दाखवणे. |
| **२** | **शेअर परतावा (Share Withdrawal)** | `ShareWithdrawal.tsx` | शेअर खात्याचा जुना क्रमांक (`legacyAccountNumber`) कार्डवर दिसत नाही. | 'चालू शेअर माहिती' कार्डमध्ये `🏷️ जुने शेअर खाते क्र.` ठळक बॅज जोडणे. |
| **३** | **शेअर हस्तांतरण (Share Transfer)** | `ShareTransferMaster.tsx` | हस्तांतरण फॉर्ममध्ये दोन्ही सभासदांचे जुने सभासद/शेअर क्रमांक दिसत नाहीत. | From व To सभासदांच्या माहिती कार्डमध्ये जुने क्रमांक ठळकपणे प्रदर्शित करणे. |
| **४** | **लॉकर भाडे नूतनीकरण (Locker Rent Renewal)** | `LockerRentRenewal.tsx` | सर्च फक्त नवीन लॉकर खात्याने होते. जुना CIF किंवा जुना सभासद नंबरने सर्च होत नाही. | `legacyCustomerNo`, `legacyMemberNo` सर्चमध्ये समाविष्ट करणे व कार्डवर बॅज देणे. |
| **५** | **लॉकर समर्पण (Locker Surrender)** | `LockerSurrenderMaster.tsx` | ड्रॉपडाऊन पर्यायांमध्ये जुना सभासद/CIF क्रमांक दिसत नाही. | ड्रॉपडाउन आणि सिलेक्टेड ऑलॉटमेंट कार्डमध्ये जुना संदर्भ दाखवणे. |
| **६** | **बँक गुंतवणूक मुदतपूर्ती (Investment Maturity Claim)** | `InvestmentMaturityClaim.tsx` | मॉडेलमध्ये `OldInvestmentNo` आहे, परंतु ड्रॉपडाउन व माहिती कार्डमध्ये दिसत नाही. | ड्रॉपडाउन लेबलमध्ये `[जुना क्र: ...]` आणि सिलेक्टेड कार्डमध्ये `🏷️ जुना गुंतवणूक क्र.` जोडणे. |
| **७** | **कर्ज पुढील टप्पा वाटप (Loan Disbursement - Tranche)** | `LoanDisbursementMaster.tsx` | Subsequent Tranche च्या ड्रॉपडाऊनमध्ये जुना कर्ज क्रमांक दिसत नाही. | ड्रॉपडाऊन पर्यायांमध्ये `[जुने कर्ज: ...]` बॅज व प्रोफाइल रिबनमध्ये प्रदर्शन. |
| **८** | **जामीनदार अहवाल (Guarantor Audit Report)** | `GuarantorReport.tsx` | जामीनदार ड्रॉपडाऊन व गॅरंटीड कर्जांच्या यादीत जुने कर्ज/सभासद क्रमांक नाहीत. | जामीनदाराचा जुना सभासद क्र. व मुख्य कर्जदाराचा जुना कर्ज खाते क्र. तक्त्यात व एक्सेलमध्ये दाखवणे. |
| **९** | **कर्ज खतावणी अहवाल (Loan Ledger Report)** | `LoanLedgerReport.tsx` | खाते शोधताना जुन्या क्रमांकाने शोधता येत नाही व प्रिंटवर जुना क्रमांक येत नाही. | ड्रॉपडाऊन शोध व पासबुक/खतावणी प्रिंट हेडरमध्ये `(जुने खाते क्र.: ...)` समाविष्ट करणे. |
| **१०** | **कर्ज येणे बाकी अहवाल (Loan Outstanding Report)** | `LoanOutstandingReport.tsx` & `ReportsController.cs` | DTO मध्ये `LegacyAccountNumber` नाही. एक्सेल/प्रिंटमध्ये जुना क्रमांक नाही. | बॅकएंड DTO मध्ये कॉलम मॅप करून अहवालात 'जुने कर्ज क्र.' कॉलम उपलब्ध करणे. |
| **११** | **पिग्मी विड्रॉल व क्लोजर (Pigmy Closure)** | `PigmyClosureMaster.tsx` & `PigmyClosureController.cs` | बॅकएंड फक्त अचूक `AccountNo` तपासतो; जुना नंबर टाकल्यास ४०४ येतो. | बॅकएंडला `LegacyAccountNumber` / `OldAccountNo` फॉलबॅक देणे व कार्डवर बॅज दाखवणे. |
| **१२** | **आरडी हप्ता भरणा (RD Collection)** | `RdInstallmentCollection.tsx` | ड्रॉपडाऊन पर्यायांमध्ये जुना आरडी / पावती क्रमांक दिसत नाही. | ड्रॉपडाउनमध्ये `[जुने आरडी क्र: ...]` जोडून सर्च सक्षम करणे. |
| **१३** | **आरडी मुदतपूर्ती व बंद (RD Withdrawal/Maturity)** | `RdWithdrawalMaturity.tsx` | ड्रॉपडाउनमध्ये जुना खाते क्र. दिसत नाही. | ड्रॉपडाउन व सिलेक्टेड कार्डमध्ये जुना आरडी क्रमांक प्रदर्शित करणे. |
| **१४** | **बचत खाते बंद (Saving Account Closing)** | `SavingAccountClosingMaster.tsx` | ड्रॉपडाऊनमध्ये `(जुना: ...)` दिसत नाही. | ड्रॉपडाउन व क्लोजर स्लिपमध्ये जुना बचत खाते क्रमांक समाविष्ट करणे. |

---

## ३. सविस्तर तांत्रिक अंमलबजावणी आराखडा (Technical Architecture)

### टप्पा १: सामाईक सभासद शोध घटक (`MemberSearchSelect.tsx`)
हा घटक संपूर्ण प्रणालीत शेअर्स, सभासद नोंदणी व इतर अनेक ठिकाणी वापरला जातो.
- **बदल:**
  1. `formatOptionLabel` मधील `context !== 'value'` (ड्रॉपडाऊन पर्याय):
     ```tsx
     {m.legacyMemberNo && (
       <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] shrink-0 bg-purple-100 text-purple-950 border border-purple-300">
         🏷️ जुना सभासद: {m.legacyMemberNo}
       </span>
     )}
     ```
  2. `formatOptionLabel` मधील `context === 'value'` (निवडलेली व्हॅल्यू):
     ```tsx
     {m.legacyMemberNo && (
       <span className="text-[10px] font-mono font-bold shrink-0 px-1 py-0.5 rounded bg-purple-50 text-purple-900 border border-purple-200">
         [जुना: {m.legacyMemberNo}]
       </span>
     )}
     ```
  3. `filterOption`: आधीपासूनच `member.legacyMemberNo` सर्च करते; व्हिज्युअल बॅजमुळे आता निवडताना ऑपरेटरला १००% खात्री पटेल.

---

### टप्पा २: शेअर्स मॉड्यूल्स (`ShareTransferMaster.tsx` & `ShareWithdrawal.tsx`)
- **`ShareWithdrawal.tsx` (शेअर परतावा):**
  1. `MemberSearchSelect` आपोआप वरीलप्रमाणे जुना सभासद क्रमांक दाखवेल.
  2. चालू शेअर माहिती कार्डमध्ये (ओळ ४२९):
     ```tsx
     <p className="text-gray-700 mb-1 font-bold text-xs flex items-center gap-2">
       खाते क्र. (Account No): <span className="text-primary font-extrabold text-sm">{shareAccount.accountNo}</span>
       {shareAccount.legacyAccountNumber && (
         <span className="bg-purple-100 text-purple-950 border border-purple-300 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
           🏷️ जुने शेअर खाते क्र.: {shareAccount.legacyAccountNumber}
         </span>
       )}
     </p>
     ```
- **`ShareTransferMaster.tsx` (शेअर हस्तांतरण):**
  1. हस्तांतरण देणारा सभासद (From Member) व घेणारा सभासद (To Member) या दोन्ही कार्डांवर `shareAccount.legacyAccountNumber` चे बॅज लावणे.

---

### टप्पा ३: लॉकर मॉड्यूल्स (`LockerRentRenewal.tsx` & `LockerSurrenderMaster.tsx`)
- **`LockerRentRenewal.tsx` (लॉकर भाडे नूतनीकरण):**
  1. सर्च फिल्टरमध्ये `legacyMemberNo` व `legacyCustomerNo` जोडणे:
     ```tsx
     const matchesSearch = !term ||
       (r.lockerAccountNo && r.lockerAccountNo.toLowerCase().includes(term)) ||
       (r.lockerNo && r.lockerNo.toLowerCase().includes(term)) ||
       (r.memberName && r.memberName.toLowerCase().includes(term)) ||
       ((r as any).legacyMemberNo && String((r as any).legacyMemberNo).toLowerCase().includes(term)) ||
       ((r as any).legacyCustomerNo && String((r as any).legacyCustomerNo).toLowerCase().includes(term));
     ```
  2. रिन्युअल टेबलच्या सभासद कॉलममध्ये:
     ```tsx
     <div className="font-bold text-slate-800">{r.memberName}</div>
     {(r as any).legacyMemberNo && (
       <span className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-1 py-0.2 rounded font-mono font-semibold">
         जुना सभासद: {(r as any).legacyMemberNo}
       </span>
     )}
     ```
- **`LockerSurrenderMaster.tsx` (लॉकर समर्पण):**
  1. `allotmentDropdownOptions` मध्ये सभासदाचा जुना क्रमांक समाविष्ट करणे:
     ```tsx
     label: `${a.lockerAccountNo}${legPart} | लॉकर: ${a.cabinetNo}-${a.lockerNo} | ${a.memberName}`
     ```

---

### टप्पा ४: बँक गुंतवणूक मॉड्यूल (`InvestmentMaturityClaim.tsx`)
- **डेटा मॉडेल:** `InvestmentAccount.cs` मध्ये आधीच `OldInvestmentNo` (जुना गुंतवणूक खाते क्रमांक) उपलब्ध आहे.
- **सुधारणा:**
  1. `InvestmentMaturityClaim.tsx` मधील `SearchableSelect` ऑप्शन्स (ओळ ४०२):
     ```tsx
     options={[
       { value: 0, label: '-- मुदत ठेव खाते निवडा --' },
       ...accounts.map((a: any) => {
         const oldPart = a.oldInvestmentNo ? ` [जुना क्र: ${a.oldInvestmentNo}]` : '';
         return {
           value: a.investmentAccountID,
           label: `${a.investmentNo}${oldPart} | पावती क्र: ${a.depositReceiptNo || '-'} | ${a.institutionName} | ₹${formatCurrency(a.principalAmount)} (${a.interestRate}%) | मुदतपूर्ती: ${formatDate(a.maturityDate)}`
         };
       })
     ]}
     ```
  2. सिलेक्टेड खाते माहिती कार्ड (ओळ ४१७):
     ```tsx
     <span>खाते तपशील: <span className="font-mono text-primary">{selectedAccount.investmentNo}</span></span>
     {selectedAccount.oldInvestmentNo && (
       <span className="bg-purple-100 text-purple-950 border border-purple-300 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
         🏷️ जुना गुंतवणूक क्र.: {selectedAccount.oldInvestmentNo}
       </span>
     )}
     ```

---

### टप्पा ५: कर्ज उप-मॉड्यूल्स (Disbursement Tranche, Guarantor, Ledger & Outstanding)
- **`LoanDisbursementMaster.tsx` (पुढील टप्पा वाटप):**
  1. `LoanAccount` इंटरफेसमध्ये `legacyAccountNumber?: string;` जोडणे.
  2. ओळ १५६१ मधील Subsequent Tranche सर्च ऑप्शन्स:
     ```tsx
     const legPart = a.legacyAccountNumber ? ` [जुने कर्ज: ${a.legacyAccountNumber}]` : '';
     label: `${name} (${format14DigitDisplay(a.loanAccountNo)})${legPart} - ${a.loanRate?.shortName || ''} - मंजूर: ₹...`
     ```
  3. निवडलेल्या कर्जदाराच्या प्रोफाइल रिबनमध्ये जुना क्रमांक प्रदर्शित करणे.
- **`GuarantorReport.tsx` (जामीनदार अहवाल):**
  1. सभासद फिल्टर ड्रॉपडाऊनमध्ये `m.legacyMemberNo` चा समावेश:
     ```tsx
     label: `${m.firstName} ${m.lastName} (${m.memberCode})${m.legacyMemberNo ? ` [जुना: ${m.legacyMemberNo}]` : ''} [CIF: ${m.cifNo || 'N/A'}]`
     ```
  2. जामीन राहिलेल्या कर्जांच्या तपशीलात `legacyAccountNumber` कॉलम / ब्रॅकेट दाखवणे:
     `कर्ज खाते क्र.: L-2026-130 (जुने: 1020)`
- **`LoanLedgerReport.tsx` (कर्ज खतावणी अहवाल):**
  1. खाते निवड ड्रॉपडाउनमध्ये:
     ```tsx
     const legPart = a.legacyAccountNumber ? ` [जुने कर्ज: ${a.legacyAccountNumber}]` : '';
     label: `${a.loanAccountNo}${legPart} - ${name}`
     ```
  2. खतावणी हेडर, मुद्रित प्रत (Print Sheet) व एक्सेल एक्सपोर्टमध्ये:
     `कर्ज खाते क्र.: L-2026-130 | जुने खाते क्र.: 1020`
- **`LoanOutstandingReport.tsx` & `ReportsController.cs` (कर्ज येणे बाकी अहवाल):**
  1. `LoanOutstandingReportRowDto` मध्ये `public string? LegacyAccountNumber { get; set; }` जोडणे.
  2. `ReportsController.cs` च्या लूपमध्ये `LegacyAccountNumber = la.LegacyAccountNumber ?? ""` मॅप करणे.
  3. फ्रंटएंड अहवाल तक्त्यात, प्रिंट लेआउटमध्ये आणि एक्सेल एक्सपोर्टमध्ये 'जुने कर्ज क्र.' कॉलम उपलब्ध करणे.

---

### टप्पा ६: पिग्मी क्लोजर व विड्रॉल (`PigmyClosureMaster.tsx` & `PigmyClosureController.cs`)
- **बॅकएंड बदल (`PigmyClosureController.cs`):**
  1. `PreviewClosure` (ओळ १५०) व `WithdrawalPreview` (ओळ ९०) मध्ये:
     ```csharp
     var account = await _context.PigmyAccounts
         .Include(a => a.Customer)
         .Include(a => a.PigmyScheme)
             .ThenInclude(s => s!.Slabs)
         .FirstOrDefaultAsync(a => a.AccountNo == accountNo 
             || a.LegacyAccountNumber == accountNo 
             || a.OldAccountNo == accountNo);
     ```
  2. `ClosurePreviewResult` मध्ये `public string? LegacyAccountNumber { get; set; }` समाविष्ट करणे.
- **फ्रंटएंड बदल (`PigmyClosureMaster.tsx`):**
  1. शोध इनपुटच्या प्लेसहोल्डरमध्ये: `उदा. PG-1234 किंवा जुना नंबर 105`.
  2. खाते माहिती कार्डमध्ये (ओळ ५१६):
     ```tsx
     <p className="font-mono font-bold text-xs text-blue-900 flex items-center gap-1.5">
       <span>{closurePreview.accountNo}</span>
       {closurePreview.legacyAccountNumber && (
         <span className="bg-purple-100 text-purple-950 border border-purple-300 px-1.5 py-0.2 rounded text-[10px]">
           जुना क्र: {closurePreview.legacyAccountNumber}
         </span>
       )}
     </p>
     ```

---

### टप्पा ७: आवर्ती ठेव (RD) व बचत (Saving) मॉड्यूल्स
- **`RdInstallmentCollection.tsx` (आरडी हप्ता भरणा):**
  1. ओळ ६२९ मधील ऑप्शन्स:
     ```tsx
     const legPart = a.legacyAccountNumber ? ` [जुने आरडी: ${a.legacyAccountNumber}]` : '';
     label: `${a.accountNo}${legPart} - ${a.memberName} (${a.schemeName})`
     ```
  2. निवडलेल्या कार्डमध्ये `🏷️ जुने आरडी क्र.` बॅज.
- **`RdWithdrawalMaturity.tsx` (आरडी मुदतपूर्ती):**
  1. ओळ ४४९ मधील ऑप्शन्समध्ये `[जुने: ${a.legacyAccountNumber}]` जोडणे.
- **`SavingAccountClosingMaster.tsx` (बचत खाते बंद):**
  1. ओळ २६७ मधील ऑप्शन्स:
     ```tsx
     const oldPart = (a.oldAccountNo || a.legacyAccountNumber) ? ` (जुना: ${a.oldAccountNo || a.legacyAccountNumber})` : '';
     label: `${a.accountNo}${oldPart}${cifPart} - ${namePart} (शिल्लक: ₹...)`
     ```

---

## ४. अंमलबजावणी क्रम व टप्पे (Phased Execution Roadmap)

| टप्पा | लक्ष्य मॉड्यूल्स | स्वरूप | अपेक्षित परिणाम |
|---|---|---|---|
| **Phase A** | `MemberSearchSelect.tsx`, `ShareWithdrawal.tsx`, `ShareTransferMaster.tsx` | UI बॅज व सिलेक्ट सुधारणा | सभासद व शेअर्स मॉड्यूल्समध्ये जुना सभासद क्र. व जुना शेअर खाते क्र. थेट दृश्यमान होईल. |
| **Phase B** | `LockerRentRenewal.tsx`, `LockerSurrenderMaster.tsx`, `InvestmentMaturityClaim.tsx` | सर्च फिल्टर व ऑप्शन्स | लॉकर व बँक गुंतवणूक मॉड्यूल्समध्ये जुना खाते/पावती नंबर शोधणे व पडताळणे शक्य होईल. |
| **Phase C** | `LoanDisbursementMaster.tsx`, `GuarantorReport.tsx`, `LoanLedgerReport.tsx`, `LoanOutstandingReport.tsx` | DTO, रिपोर्ट व टप्पा वाटप | कर्ज वाटप, जामीनदार अहवाल, खतावणी व येणे बाकी अहवालात जुना कर्ज नंबर सर्वत्र उपलब्ध होईल. |
| **Phase D** | `PigmyClosureController.cs`, `PigmyClosureMaster.tsx`, `RdInstallmentCollection.tsx`, `SavingAccountClosingMaster.tsx` | API सर्च फॉलबॅक व क्लोजर UI | पिग्मी क्लोजरला जुन्या नंबरने ४०४ येणार नाही, थेट खाते उघडेल; आरडी व बचत बंद सुलभ होईल. |

---

## ५. पडताळणी व गुणवत्ता चाचणी निकष (Verification & Quality Gates)

1. **सर्च अचूकता चाचणी (Search Precision Test):**
   - जुना नंबर (उदा. `1020` किंवा `55`) टाईप केल्यावर संबंधित खातेदार थेट फिल्टर होतो का?
2. **व्हिज्युअल बॅज सुसंगतता (UI Consistency):**
   - सर्व मॉड्यूल्समध्ये CBS मानकांनुसार जांभळा बॅज (`bg-purple-100 text-purple-950 border-purple-300 font-mono`) दिसेल.
3. **प्रिंट व पीडीएफ सुसंगतता (Print Parity):**
   - खतावणी, पावत्या, व एक्सेल डाऊनलोडमध्ये जुना क्रमांक कंसात किंवा स्वतंत्र कॉलममध्ये योग्य प्रकारे येईल.
4. **बॅकएंड अखंडता (Backward Compatibility):**
   - ज्या खात्यांना जुना क्रमांक नाही (नवीन उघडलेली खाती), तेथे रिकामा किंवा अनावश्यक बॅज दिसणार नाही.

---

> **टीप:** वापरकर्त्याच्या सूचनेनुसार (`do not code`) या टप्प्यावर कोणताही कोड बदलण्यात आलेला नाही. वापरकर्त्याच्या मंजुरीनंतर वरील Phase A ते Phase D प्रमाणे प्रत्यक्ष कोडिंग व डिप्लॉयमेंट हाती घेतली जाईल.
