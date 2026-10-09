# 🛡️ कोअर बँकिंग प्रकल्प पूर्तता अहवाल (Core Banking Implementation Report)
## अहवाल: "कर्ज येणे बाकी" (Loan Outstanding Report As-On-Date)

---

### 📋 १. प्रकल्प तपशील (Project Summary)

| तपशील | सविस्तर माहिती |
|---|---|
| **मॉड्यूल / विभाग** | कर्ज विभाग अहवाल (Loan Department Reports) |
| **नवीन अहवाल नाव** | **कर्ज येणे बाकी** (Loan Outstanding Balance As-On-Date Report) |
| **मुख्य निकष १** | **कर्ज रक्कम**: खात्याची मूळ संमत/प्रत्यक्ष वाटप केलेली रक्कम (`SanctionedAmount` / `DisbursementAmount`) |
| **मुख्य निकष २** | **येणे बाकी**: निवडलेल्या तारखेअखेरची प्रत्यक्ष शिल्लक मुद्दल बाकी (`As-On-Date Outstanding Balance`) |
| **मुख्य निकष ३** | **कर्ज प्रकार निहाय व एकत्रित**: सर्व कर्ज प्रकार एकत्रित (Consolidated with Subtotals) तसेच विशिष्ट स्कीम निवड |
| **UI मांडणी** | सहकारी पतसंस्था अधिकृत ७-स्तंभ (7 Columns) फॉरमॅट व `CbsReportLayout` प्रिंट/एक्सेल एकत्रीकरण |
| **स्थिती** | ✅ **यशस्वीरित्या अंमलात व पूर्ण (Fully Implemented & Verified)** |

---

### 🔍 २. तांत्रिक अंमलबजावणी तपशील (Technical Implementation)

#### अ. बॅकएंड API (`ReportsController.cs`):
* **एन्डपॉइंट:** `GET /api/Reports/LoanOutstandingReport`
* **पॅरामीटर्स:**
  * `asOnDate` (तारीख अखेर)
  * `loanRateId` (कर्ज प्रकार आयडी — ऐच्छिक)
  * `branchId` (शाखा — ऐच्छिक)
  * `includeZeroBalance` (शून्य बाकी खाती समाविष्ट करायची का?)
* **दिनांक अखेर बाकी काढण्याचे बँकिंग लॉजिक:**
  * जर निवडलेली तारीख ऐतिहासिक असेल (`asOnDate < Today`), तर त्या तारखेनंतर झालेली मुद्दल वसुली परत मिळवून (Rollback) आणि नंतरचे वाटप वजा करून अचूक ऐतिहासिक बाकी काढली जाते:
    $$\text{Balance}_{\text{AsOnDate}} = \text{Current PrincipalBalance} + \sum_{\text{Date} > \text{AsOnDate}} \text{PrincipalCollected} - \sum_{\text{Date} > \text{AsOnDate}} \text{DisbursementAmount}$$
  * कट-ऑफ तारखेनंतर वाटप झालेली कर्जे या अहवालात समाविष्ट केली जात नाहीत.
  * खाती कर्ज प्रकारानुसार गटवार (Scheme Groups) आणि कर्ज नंबरानुसार संख्यात्मक (Numeric sort) क्रमवारीने लावली जातात.

#### ब. फ्रंटएंड कॉम्पोनंट (`LoanOutstandingReport.tsx`):
* **तंतोतंत ७ स्तंभ मांडणी (Matching Provided Screenshot):**
  1. अनु. क्र. (Sr. No.)
  2. कर्ज प्रकार (Loan Scheme)
  3. कर्ज नं. (Loan Account No.)
  4. कर्जदाराचे नाव (Borrower Full Name)
  5. कर्ज दिनांक (Disbursement Date)
  6. कर्ज रक्कम (Sanctioned / Disbursed Amount)
  7. येणे बाकी (Outstanding Balance as on Cut-off Date)
* **वैशिष्ट्ये:**
  * प्रकारानुसार गटवार (Grouped by Scheme with Sub-totals) व एकत्रित यादी (Flat List) टॉगल
  * Excel (.xlsx) एक्सपोर्ट (उप-एकूण व सर्वसमावेशक एकूण बेरजेसह)
  * `CbsReportLayout` द्वारे A4 Landscape/Portrait अधिकृत पतसंस्था हेडर व स्वाक्षरीसह छपाई (Direct Print)
  * शोध (Search) बॉक्स व जलद फिल्टर

#### क. नेव्हिगेशन एकत्रीकरण:
* `ReportDashboard.tsx` : 'कर्ज विभाग (Loan)' अंतर्गत **'कर्ज येणे बाकी अहवाल (Loan Outstanding Report)'** लिंक उपलब्ध.
* `Sidebar.tsx` व `App.tsx` : `activeTab === 'loan-outstanding-report'` द्वारे थेट ओपन होण्याची सोय.

---

### 🏁 ३. पडताळणी निकाल (Verification Results)
* **बॅकएंड (.NET C#):** `dotnet build` यशस्वी (0 Errors, 42 Warnings).
* **फ्रंटएंड (Vite React TypeScript):** `npm run build` यशस्वी (0 Errors).
