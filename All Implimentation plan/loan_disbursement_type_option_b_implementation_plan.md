# कर्ज वितरण / वाटप (Loan Disbursement Master)
## वितरण प्रकार (Type) पर्याय 'ब' अंमलबजावणी आराखडा (Implementation Plan)

---

### १. उद्दिष्ट व पार्श्वभूमी (Executive Summary)

**सद्यस्थिती:**
सध्या **कर्ज वितरण / वाटप (Loan Disbursement Master)** स्क्रीनवर पहिल्या ओळीमध्ये **"वितरण प्रकार (Type)"** हा ३ पर्यायांचा ड्रॉपडाऊन आहे:
1. `मंजूर अर्जावरून (Sanctioned App)`
2. `नवीन मसुदा (New Draft)`
3. `विद्यमान खात्यात (Existing A/c)`

**वापरकर्त्याची गरज (User Requirement - पर्याय 'ब'):**
- पतसंस्थेतील **९०% नियमित कर्ज वितरण** हे नेहमी **"मंजूर अर्जावरून"च (Sanctioned Application)** होते. त्यामुळे हा ड्रॉपडाऊन काढून फॉर्म कायम बाय-डिफॉल्ट **'मंजूर अर्जावरून'** सक्रिय ठेवणे.
- ज्या मोजक्या प्रसंगी आधीच उघडलेल्या खात्यामध्ये पुढील हप्ता/टप्पा (उदा. बांधकाम कर्ज / २रा-३रा टप्पा / Subsequent Tranche) वितरित करायचा असेल, त्यांच्यासाठी सर्च बॉक्सजवळ एक सोपा व सुटसुटीत चेकबॉक्स देणे:
  > **`[ ] विद्यमान खात्यात पुढील टप्पा वाटप (Subsequent Tranche to Existing Account)`**
- यामुळे ऑपरेटरचा गोंधळ संपेल, स्क्रीन अधिक स्वच्छ व वेगवान होईल, आणि बहु-टप्पा कर्ज वाटपाचे (Multi-Tranche) तांत्रिक सामर्थ्य पूर्णपणे अबाधित राहील.

---

### २. UI डिझाइन तुलना (Before vs After Layout Comparison)

#### पूर्वीची रचना (Current Layout):
```text
Row 1: [ वितरण दिनांक * ] | [ वितरण प्रकार (Type) Dropdown * ] | [ शाखा (Branch) * ]
Row 2: [ मंजूर कर्ज अर्ज निवडा * (किंवा प्रकार बदलल्यास: कर्ज खाते निवडा *) ]
```
*(तोटा: ऑपरेटरला प्रत्येक वेळी ३ पर्यायांचा क्लिष्ट ड्रॉपडाऊन दिसतो, ज्यामध्ये 'नवीन मसुदा' हा अंतर्गत पर्यायही विनाकारण निवडता येतो.)*

#### प्रस्तावित रचना - पर्याय 'ब' (Proposed Layout):
```text
Row 1: [ वितरण दिनांक (Date) * ]                  | [ शाखा (Branch) * ]
       (सुटसुटीत २-कॉलम ग्रीड)                      (अधिकृत बँक शाखा)

Row 2 Header: 
       [ मंजूर कर्ज अर्ज निवडा * ]    ---उजवीकडे---> [ ] विद्यमान खात्यात पुढील टप्पा वाटप (Subsequent Tranche)
Row 2 Input:  
       [ 🔍 अर्जदार नाव / अर्ज क्र. / CIF द्वारे शोधा... (SearchableSelect) ]
```
*(फायदा: बाय-डिफॉल्ट सर्व मंजूर अर्ज लोड होतात. ऑपरेटरने चेकबॉक्स टिक केला की तत्काळ लेबल 'विद्यमान कर्ज खाते निवडा (पुढील टप्पा)' होते व जुनी खाती लोड होतात.)*

---

### ३. तपशीलवार तांत्रिक कृती आराखडा (Step-by-Step Implementation Steps)

#### टप्पा १: Row 1 ग्रीडचे सरलीकरण (Row 1 Grid Simplification)
- **फाईल:** `client/src/components/LoanDisbursementMaster.tsx`
- **बदल:**
  - Row 1 मधील `grid-cols-1 sm:grid-cols-3` ऐवजी `grid-cols-1 sm:grid-cols-2 gap-3` करणे.
  - पहिला कॉलम: **वितरण दिनांक (Disbursement Date)**.
  - दुसरा कॉलम: **शाखा निवड (Branch Selector)**.
  - मध्यभागी असलेला क्लिष्ट `<select value={sourceType}>` ड्रॉपडाऊन Row 1 मधून पूर्णपणे काढून टाकणे.

#### टप्पा २: Row 2 सर्च हेडरमध्ये डायनॅमिक चेकबॉक्स टॉगल (Search Header Integration)
- **फाईल:** `client/src/components/LoanDisbursementMaster.tsx` (ओळ १५२२ च्या आसपास)
- **बदल:**
  - Row 2 च्या लेबल सेक्शनला `flex items-center justify-between` बनवणे.
  - डावीकडे: परिस्थितीनुसार डायनॅमिक लेबल:
    - जर `sourceType === 'ExistingAccount'` असेल तर: `विद्यमान कर्ज खाते निवडा (पुढील टप्पा वाटप) *`
    - जर `sourceType === 'Draft'` असेल तर: `नवीन मसुदा अर्ज *`
    - सर्वसाधारण (Default): `मंजूर कर्ज अर्ज निवडा *`
  - उजवीकडे: जेव्हा मसुदा (Draft) किंवा संपादन (Editing) चालू नसेल, तेव्हा चेकबॉक्स देणे:
    ```tsx
    {!editingId && !draftApplication && (
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-semibold text-gray-700 hover:text-primary transition">
            <input
                type="checkbox"
                checked={sourceType === 'ExistingAccount'}
                onChange={(e) => {
                    const isExisting = e.target.checked;
                    setSourceType(isExisting ? 'ExistingAccount' : 'Application');
                    setSelectedSourceId('');
                    setAlreadyDisbursedAmount(0);
                    setPendingSanctionedLimit(0);
                    setCurrentTrancheNo(1);
                }}
                className="rounded-sm border-gray-300 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
            />
            <span className={sourceType === 'ExistingAccount' ? 'font-bold text-primary' : 'text-gray-600'}>
                विद्यमान खात्यात पुढील टप्पा वाटप (Subsequent Tranche)
            </span>
        </label>
    )}
    ```

#### टप्पा ३: स्टेट आणि रीसेट लॉजिक सिंक्रोनायझेशन (State & Reset Handling)
- **Default State:** `useState<'Draft' | 'Application' | 'ExistingAccount'>('Application')` — हा नेहमी `'Application'` वरच सुरू राहील.
- **Form Reset (`handleResetForm`):**
  - फॉर्म सेव्ह झाल्यावर किंवा 'रद्द करा' दाबल्यावर `sourceType` आपोआप `'Application'` वर येईल आणि चेकबॉक्स अनचेक होईल.
- **टॉगल इफेक्ट:**
  - चेकबॉक्स अनचेक असताना: `applications` ड्रॉपडाऊन लोड राहील, नवीन कर्ज खाते उघडणी फॉर्म (`newAccountData`) दिसेल.
  - चेकबॉक्स चेक केल्यावर: `accounts` ड्रॉपडाऊन लोड होईल, नवीन खाते उघडणी फॉर्म आपोआप लपवला जाईल (कारण खाते आधीच अस्तित्वात आहे).

#### टप्पा ४: इतर विशेष मोड्सची सुरक्षा (Workflow Compatibility)
1. **मसुदा मोड (LoanProcessMaster Draft Workflow):**
   - जेव्हा वापरकर्ता Tab 1 (अर्ज) भरून "Next" दाबतो, तेव्हा `sourceType = 'Draft'` राहील.
   - या मोडमध्ये हा चेकबॉक्स लपवला जाईल, जेणेकरून मसुद्याचा प्रवाह विस्कळीत होणार नाही.
2. **व्हाउचर तपासणी (Checker / Passing Mode):**
   - चेकर मोडमध्ये व्हाउचर जुन्या खात्याशी लिंक असते (`sourceType = 'ExistingAccount'`), तिथेही चेकबॉक्स लॉक/रीड-ओन्ली राहील.
3. **संपादन (Editing Mode):**
   - जुने वितरण एडिट करताना मूळ खात्याचा प्रकार सुरक्षित राहील.

---

### ४. परिणाम व जोखीम विश्लेषण (Impact & Risk Assessment)

| घटक (Component) | बदल होणार का? | परिणाम व सुरक्षा (Impact Analysis) |
| :--- | :---: | :--- |
| **डेटाबेस स्कीमा (Database)** | **नाही (No)** | कोणत्याही टेबल किंवा कॉलममध्ये बदल नाही. `LoanDisbursements` व `LoanAccounts` पूर्वीप्रमाणेच चालतील. |
| **बॅकएंड API (Backend Controller)** | **नाही (No)** | `POST /api/LoanDisbursements` आधीपासूनच `LoanAccountID > 0` (Existing) व `LoanAccount` (New) दोन्ही अचूक हाताळते. |
| **व्हाउचर व अकाउंटिंग (Vouchers)** | **नाही (No)** | कर्ज मुद्दल डेबिट व बँक/रोख/बचत क्रेडिटच्या नोंदींमध्ये कोणताही बदल नाही. |
| **मल्टी-ट्रॅन्च मर्यादा (Pending Limit)** | **नाही (No)** | चेकबॉक्स टिक करून जुने खाते निवडताच मंजूर मर्यादा, पूर्वीचे वाटप व शिल्लक मर्यादा पूर्ववत कॅल्क्युलेट होईल. |
| **वापरकर्ता अनुभव (User Experience)** | **होय (Yes - सुधारणा)** | **९०% वेळेस ऑपरेटरला १ क्लिक कमी करावे लागेल.** फॉर्म अत्यंत सोपा व जलद वाटेल. |

---

### ५. चाचणी व पडताळणी चेकलिस्ट (Testing & Verification Checklist)

- [ ] **केस १ (बाय-डिफॉल्ट नवीन वाटप):** पेज उघडल्यावर थेट मंजूर अर्जांची यादी दिसते का आणि अर्ज निवडल्यावर नवीन खाते क्रमांक येतो का?
- [ ] **केस २ (पुढील टप्पा वाटप):** `[✓] विद्यमान खात्यात पुढील टप्पा वाटप` टिक केल्यावर मंजूर खात्यांची यादी येते का व शिल्लक मंजूर मर्यादा अचूक दिसते का?
- [ ] **केस ३ (टॉगल रीसेट):** चेकबॉक्स अनचेक केल्यावर पुन्हा अर्जांची यादी पूर्ववत येते का?
- [ ] **केस ४ (मसुदा प्रवाह):** `LoanProcessMaster` मधून "Next" दाबून आल्यावर मसुदा अचूक येतो का?
- [ ] **केस ५ (व्हाउचर तपासणी):** Checker मोडमध्ये व्हाउचर पासिंग व्यवस्थित चालते का?
- [ ] **केस ६ (Frontend Build):** `npm run build` मध्ये 0 एरर्स येतात का?
