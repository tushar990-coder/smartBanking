# कर्ज वितरण / वाटप (Loan Disbursement Master)
## नवीन कर्ज खाते क्र. (Loan A/c No) १००% स्वयंचलित व सिस्टीम जनरेटेड अंमलबजावणी आराखडा (Implementation Plan)

---

### १. उद्दिष्ट व पार्श्वभूमी (Objective & Business Context)

**वापरकर्त्याची गरज (User Requirement):**
> "कर्ज वितरण / वाटप (Loan Disbursement Master)-->नवीन कर्ज खाते क्र. (Loan A/c No) * हा ऑटो यायला पाहिजे आणि सिस्टीम जनरेटेड असला पाहिजे."

**सद्यस्थिती विश्लेषण (Current State Analysis):**
1. सध्या `LoanDisbursementMaster.tsx` मध्ये **"नवीन कर्ज खाते क्र. (Loan A/c No) *"** हे फील्ड मॅन्युअली एडिट करता येण्याजोगे (Editable Textbox) आहे.
2. त्यावर `कस्टम / ऑटो` असा टॉगल दिलेला आहे, ज्यामुळे ऑपरेटरला स्वतः मॅन्युअली नंबर टाईप करण्याचा पर्याय मिळतो. यामुळे:
   - ऑपरेटर स्वतःच्या हाताने चुकीचा किंवा विसंगत खाते नंबर टाईप करू शकतो.
   - कोअर बँकिंगच्या १४-अंकी मानक फॉरमॅटशी (`001-201-0000001-4`) विसंगती निर्माण होते.
   - कर्ज अर्ज Tab 1 (Draft) मधून आल्यास तात्पुरता डमी नंबर (उदा. `L-2026-834`) जनरेट होत होता.
3. संस्थेला जुन्या वहीचा नंबर जतन करण्यासाठी शेजारी आधीच **"जुना कर्ज खाते क्र. (Old/Legacy Loan No)"** हे स्वतंत्र पर्यायी फील्ड उपलब्ध आहे.
4. म्हणून अधिकृत **"नवीन कर्ज खाते क्र. (Loan A/c No)"** हा १००% **सिस्टीम जनरेटेड (System-Generated)**, **स्वयंचलित (Auto)** आणि **रीड-ओन्ली / लॉक (Read-Only)** असणे बँकिंग मानकांनुसार अत्यंत आवश्यक आहे.

---

### २. प्रस्तावित तांत्रिक उपाययोजना (Proposed Technical Solution)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ नवीन कर्ज खाते उघडणी माहिती (New Loan Account Details)                                  │
├────────────────────────────────────────────────────┬───────────────────────────────────┤
│ नवीन कर्ज खाते क्र. (Loan A/c No) *                 │ जुना कर्ज खाते क्र. (Legacy No)  │
│ [ 001-201-0000005-9                   ] [↺ रिफ्रेश] │ [ LN-101 / 45                  ]  │
│ ⚡ सिस्टीम जनरेटेड (System Generated & Locked)     │ 📝 जुन्या वहीतील क्रमांक (पर्यायी) │
└────────────────────────────────────────────────────┴───────────────────────────────────┘
```

1. **स्वयंचलित फेचिंग (Auto Fetching on Selection):**
   - जेव्हा ऑपरेटर **मंजूर कर्ज अर्ज** निवडतो, तेव्हा सिस्टीम तात्काळ बॅकएंड API ला कॉल करून त्या शाखेचा व कर्ज योजनेचा पुढील अधिकृत १४-अंकी CBS क्रमांक (`001-201-0000001-4`) प्राप्त करेल:
     `GET /api/LoanAccounts/next-account-no?branchId={bId}&loanRateId={rateId}`
   - जेव्हा कर्ज अर्ज **मसुद्यावरून (Draft Application)** येतो, तेव्हा डमी `L-2026-xxx` ऐवजी याच अधिकृत API द्वारे तत्काळ वैध खाते क्रमांक लोड केला जाईल.
   - जेव्हा ऑपरेटर वरून **शाखा (Branch)** बदलतो, तेव्हा त्या शाखेनुसार खाते क्रमांक आपोआप रिफ्रेश होईल.

2. **रीड-ओन्ली व सिस्टीम-लॉक्ड दृश्य (Read-Only & Locked Field):**
   - इनपुट बॉक्स `readOnly` केला जाईल (`bg-slate-100 font-mono font-bold text-primary cursor-not-allowed`).
   - वापरकर्ता चुकूनही त्यात बदल करू शकणार नाही.
   - फील्डच्या मथळ्यात हिरवा अधिकृत बॅज दिसेल:
     `⚡ सिस्टीम जनरेटेड (System Generated)`
   - शेजारी एक सोपे `[↺ रिफ्रेश]` बटण दिले जाईल, जेणेकरून गरज पडल्यास ऑपरेटर थेट सर्व्हरवरून तत्काळ रिफ्रेश करू शकेल.

3. **अणु-स्तरीय बॅकएंड दुहेरी सुरक्षा (Atomic Server-Side Fallback):**
   - जर नेटवर्क अत्यंत स्लो असेल आणि नंबर फेच होण्यास विलंब झाला, तरी सिस्टीम फॉलबॅक म्हणून `"AUTO"` हा सुरक्षित टोकन पाठवेल.
   - `LoanDisbursementsController.cs` मध्ये आधीपासूनच डेटाबेस ट्रॅन्झॅक्शनच्या आत `AccountNumberHelper.Generate14DigitAccountNo` लॉजिक आहे, जे सेव्ह करताना अणू-स्तरावर युनिक नंबरची खात्री करते.

---

### ३. तपशीलवार अंमलबजावणी पायऱ्या (Step-by-Step Implementation Steps)

#### पायरी १: `LoanDisbursementMaster.tsx` मधील इनपुट बॉक्स रीड-ओन्ली करणे
- **फाईल:** `client/src/components/LoanDisbursementMaster.tsx` (ओळ १६०१ ते १६३८)
- जुने `isCustomLoanAccountNo` आणि मॅन्युअल टेक्स्ट इनपुट काढून टाकणे.
- त्याऐवजी स्वच्छ, रीड-ओन्ली व ऑटो-लॉक CBS घटक लागू करणे:
  ```tsx
  <div>
      <div className="flex items-center justify-between mb-0.5">
          <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
              <span>नवीन कर्ज खाते क्र. (Loan A/c No)</span>
              <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-800 border-emerald-300 flex items-center gap-1">
                  <span>⚡ सिस्टीम जनरेटेड</span>
              </span>
              <button
                  type="button"
                  onClick={() => fetchNextLoanAccountNo(newAccountData.branchID || selectedBranchId, newAccountData.loanRateID)}
                  title="नवीन खाते क्र. रिफ्रेश करा"
                  className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
              >
                  ↺ रिफ्रेश
              </button>
          </div>
      </div>
      <input 
          type="text"
          value={autoLoanAccountNo || newAccountData.loanAccountNo || 'क्रमांक लोड होत आहे...'}
          readOnly
          placeholder="उदा. 001-201-0000001-4"
          className="w-full text-[11px] border border-gray-300 bg-slate-100 rounded-sm px-2.5 py-1 font-mono font-bold text-primary select-all cursor-not-allowed h-[30px]"
      />
  </div>
  ```

#### पायरी २: मसुदा अर्जामधील (Draft Workflow) डमी नंबर काढून टाकणे
- **फाईल:** `client/src/components/LoanDisbursementMaster.tsx` (ओळ ३४२)
- जुना डमी कोड `loanAccountNo: L-2026-xxx` काढून त्याऐवजी `loanAccountNo: 'AUTO'` करणे आणि तत्काळ `fetchNextLoanAccountNo` कॉल करणे.

#### पायरी ३: अर्ज निवड व शाखा बदलावर ऑटो-सिंक (Auto-Sync on Selection & Branch Change)
- जेव्हा अर्ज निवडला जातो (`handleSourceSelection`):
  `fetchNextLoanAccountNo(app.branchID || selectedBranchId, app.loanRateID);`
- जेव्हा शाखा बदलली जाते:
  जर अर्ज निवडलेला असेल किंवा मसुदा असेल, तर नवीन शाखेचा क्रमांक आपोआप फेच करणे.
- फॉर्म सेव्ह करताना (`handleSave`):
  `loanAccountNo: (autoLoanAccountNo || newAccountData.loanAccountNo || 'AUTO').trim()` पाठवणे.

---

### ४. परिणाम व जोखीम विश्लेषण (Impact & Risk Assessment)

| घटक (Component) | बदल | परिणाम व सुरक्षितता (Impact & Safety) |
| :--- | :---: | :--- |
| **डेटाबेस स्कीमा (Database)** | **नाही (No)** | कोणताही बदल नाही. `LoanAccounts.LoanAccountNo` मध्ये आधीप्रमाणेच मानक १४-अंकी नंबर राहील. |
| **बॅकएंड API (Controllers)** | **नाही (No)** | `/api/LoanAccounts/next-account-no` आणि `POST /api/LoanDisbursements` आधीच १४-अंकी व `"AUTO"` चे समर्थन करतात. |
| **खाते नंबर अखंडता (Integrity)** | **होय (सुधारणा)** | **मॅन्युअल टायपिंग त्रुटी ०% होतील.** सर्व खात्यांना अखंड क्रमवारी (001, 002, 003...) मिळेल. |
| **जुने क्रमांक (Legacy Loans)** | **होय (सुरक्षित)** | शेजारील **"जुना कर्ज खाते क्र."** मध्ये जुना वही नंबर सुरक्षित साठवला जाईल. |

---

### ५. चाचणी व पडताळणी चेकलिस्ट (Testing & Verification Checklist)

- [ ] **केस १:** मंजूर कर्ज अर्ज निवडताच "नवीन कर्ज खाते क्र." मध्ये तत्काळ अधिकृत १४-अंकी फॉरमॅट (उदा. `001-201-0000001-4`) आपोआप येतो का?
- [ ] **केस २:** सदर इनपुट बॉक्समध्ये ऑपरेटरला मॅन्युअली काहीही टाईप करता येत नाही (Read-Only) याची खात्री करणे.
- [ ] **केस ३:** मसुद्यावरून (LoanProcessMaster Draft) आल्यावर डमी नंबरऐवजी अधिकृत CBS खाते क्रमांक येतो का?
- [ ] **केस ४:** `↺ रिफ्रेश` बटणावर क्लिक केल्यावर नवीन खाते क्र. पुन्हा लोड होतो का?
- [ ] **केस ५:** कर्ज वाटप सेव्ह झाल्यावर तयार झालेले कर्ज खाते बरोबर त्याच क्रमांकाने तयार होते का आणि व्हाउचर पासिंग सुरळीत होते का?
- [ ] **केस ६:** `npm run build` मध्ये ० त्रुटी (0 errors) येतात का?
