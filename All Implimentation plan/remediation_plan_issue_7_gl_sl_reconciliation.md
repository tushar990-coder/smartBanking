# 🛡️ वरिष्ठ सिस्टीम लेखापरीक्षक (Senior System Auditor) अहवाल व सुधारात्मक कृती योजना
## दोष क्र. ७ [मध्यम / MEDIUM]: खतावणी (GL) विरुद्ध उप-खाते (SL) जुळवणी (Reconciliation Alert) चा अभाव — तेरीज पत्रक (Trial Balance) व कर्ज लेजर फरक निवारण

---

### 📌 १. समस्या विश्लेषण व प्रत्यक्ष ऑडिट निरीक्षण (Forensic Audit Analysis)

#### अ. सद्यस्थितीतील त्रुटी:
1. **खतावणी (GL Control Account) आणि उप-खाती (Sub-Ledger) यांच्यात दुवा नसणे:**
   - नागरी सहकारी बँका व पतसंस्थांमध्ये आर्थिक वर्षाच्या सुरुवातीला अथवा सॉफ्टवेअर स्थलांतराच्या वेळी (Go-Live / Migration) दोन प्रमुख पातळ्यांवर आरंभिक शिल्लक नोंदवली जाते:
     1. **जनरल लेजर पातळी (GL Level):** संस्थेच्या मागील वर्षाच्या ऑडिटेड ताळेबंदानुसार कर्ज योजनेच्या मुख्य लेजरमध्ये (उदा. `Ledgers.OpeningBalance` - 'सोने तारण कर्ज खाते') एकूण ढोबळ रक्कम नोंदवली जाते.
     2. **उप-खाते पातळी (Sub-Ledger / SL Level):** `LoanOpeningBalanceMaster.tsx` मधून प्रत्येक वैयक्तिक कर्जदाराचे खाते (Borrower Account) व त्याची शिल्लक स्वतंत्रपणे नोंदवली जाते.
   - सध्याच्या प्रणालीत ऑपरेटर जेव्हा वैयक्तिक खाती नोंदवतो, तेव्हा **त्या कर्ज योजनेच्या खतावणीत (GL) किती रक्कम आहे आणि आतापर्यंत किती वैयक्तिक खाती नोंदवून किती रक्कम झाली, याचा कोणताही थेट ताळा किंवा पडताळा कार्ड (Real-Time Reconciliation Card)** फॉर्मवर दिसत नाही!

2. **अंधारात डेटा एन्ट्री (Blind Data Entry Vulnerability):**
   - ऑपरेटरला केवळ चालू नोंदवल्या जाणाऱ्या खात्याची माहिती दिसते.
   - संपूर्ण योजनेचे उद्दिष्ट किती होते, किती खाती बाकी आहेत किंवा चुकून ज्यादा रक्कम नोंदवली गेली आहे का, हे जाणून घेण्यासाठी ऑपरेटरला फॉर्म सोडून जनरल लेजर किंवा ट्रायल बॅलन्स रिपोर्टमध्ये जावे लागते.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   जनरल लेजर (GL Control Account)                       │
│           उदा. 'सोने तारण कर्ज खाते' = ₹ २५,००,०००.०० (Dr)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       (कोणताही थेट दुवा / ताळा नाही) ❌
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                वैयक्तिक उप-खाती (Sub-Ledger Accounts)                  │
│  खाते १: ₹ २,००,००० | खाते २: ₹ ३,५०,००० | खाते ३: ₹ १८,००,००० ...     │
│  एकूण नोंदवलेली बेरीज = ₹ २३,५०,०००.०० (१२ खाती)                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
       [तेरीज पत्रकात फरक (Trial Balance Opening Discrepancy)]
          ₹ २५,००,००० - ₹ २३,५०,००० = ₹ १,५०,००० चा फरक! ⚠️
          (ऑडिटमध्ये ताळेबंद असंतुलित होऊन 'ब' किंवा 'क' वर्ग मिळण्याची जोखीम)
```

---

#### ब. बँकिंग, ताळेबंद व वैधानिक लेखापरीक्षण जोखीम (Statutory Audit & Banking Risks):
* **तेरीज पत्रक असंतुलन (Trial Balance Discrepancy):** जोपर्यंत मुख्य खतावणी (GL) आणि सर्व वैयक्तिक कर्ज खात्यांची बेरीज (SL) तंतोतंत शून्य (Zero Difference) जुळत नाही, तोपर्यंत संस्थेचा कच्चा ताळेबंद व तेरीज पत्रक संतुलित होऊ शकत नाही.
* **वार्षिक वैधानिक ऑडिट आक्षेप (Statutory Audit Objection):** सहकार कायद्यान्वये 'खतावणी विरुद्ध उप-खतावणी मेळ' (GL vs SL Reconciliation) हा वैधानिक लेखापरीक्षकांचा (Auditor) अनिवार्य तपासणी मुद्दा असतो. यामध्ये फरक आढळल्यास ऑडिट रिपोर्टमध्ये गंभीर शेरा (Adverse Audit Remark) मारला जातो.
* **अपहार लपवण्याची किंवा मानवी चुकीची शक्यता:** ऑपरेटरकडून एखादे कर्ज खाते सुटल्यास अथवा एखाद्या खात्यात ज्यादा शून्य (उदा. ५०,००० ऐवजी ५,००,०००) टाईप झाल्यास ते जागेवरच लक्षात येत नाही.

---

### 🎯 २. प्रस्तावित थेट जुळवणी दर्शक आर्किटेक्चर (Real-Time GL vs SL Widget Architecture)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   🏛️ खतावणी आरंभिक शिल्लक जुळवणी (GL vs Sub-Ledger Reconciliation)                 │
├───────────────────┬───────────────────────────┬───────────────────────────┬──────────────────────┤
│ १. खतावणी शिल्लक  │ २. उप-खाती बेरीज (SL Sum) │ ३. नोंदवलेली खाती संख्या   │ ४. जुळवणी फरक (Diff) │
│ (GL Opening Bal)  │                           │ (Account Count)           │                      │
├───────────────────┼───────────────────────────┼───────────────────────────┼──────────────────────┤
│  ₹ २५,००,०००.००   │      ₹ २३,५०,०००.००       │          १२ खाती          │  🟡 ₹ १,५०,००० बाकी  │
│  (सोने तारण कर्ज) │   (शुद्ध: २१.५L + Cap: २L)│                           │ (Pending Allocation) │
└───────────────────┴───────────────────────────┴───────────────────────────┴──────────────────────┘
```

#### जुळवणी स्थिती निर्देशक (Reconciliation Status Matrix):
| स्थिती (Status) | फरक सूत्र (Difference Formula) | व्हिज्युअल इंडिकेटर (UI Badge) | अर्थ व संदेश |
|---|---|---|---|
| **🟢 तंतोतंत जुळले (100% Reconciled)** | `GL == SL (Diff = 0)` | **Emerald Green Card** | *"खतावणी व उप-खाती तंतोतंत जुळली आहेत. तेरीज पत्रक १००% संतुलित आहे."* |
| **🟡 नोंदवणे बाकी (Pending Entry)** | `GL > SL (Diff > 0)` | **Amber / Warning Card** | *"खतावणी शिल्लक जास्त आहे. अजून ₹ {Diff} मुद्दलाची खाती नोंदवणे बाकी आहे."* |
| **🔴 अति-नोंदणी / विसंगती (Excess Entry)** | `GL < SL (Diff < 0)` | **Rose / Danger Card** | *"लक्ष द्या! उप-खाती बेरीज खतावणीपेक्षा ₹ {Math.Abs(Diff)} ने जास्त झाली आहे!"* |

---

### 🛠️ ३. तांत्रिक अंमलबजावणी योजना (Technical Implementation Steps)

#### पाऊल १: बॅकएंड API मध्ये जुळवणी एंडपॉईंट तयार करणे (`LoanAccountsController.cs`)
- **पद्धत:** `GET /api/LoanAccounts/GlReconciliationSummary`
- **पॅरामीटर्स:** `branchId` (शाखा आयडी), `loanRateId` (कर्ज योजना आयडी)
- **तर्क (Logic):**
  1. `LoanRates` मधून योजनेशी जोडलेला `LoanLedgerID` शोधणे.
  2. `Ledgers` टेबलमधून त्या लेजरची `OpeningBalance` (GL मुद्दल शिल्लक) आणि लेजरचे नाव मिळवणे.
  3. `LoanAccounts` मधून त्या शाखेतील व योजनेतील सर्व `IsOpeningBalance == true` खात्यांची:
     - `SlTotalPrincipalBalance = Sum(PrincipalBalance)`
     - `SlTotalPurePrincipal = Sum(PurePrincipalBalance)`
     - `SlTotalCapitalizedInterest = Sum(CapitalizedInterestAmount)`
     - `TotalAccountsCount = Count()`
  4. फरक काढणे: `PrincipalDifference = GLOpeningBalance - SlTotalPrincipalBalance`.
  5. स्थिती ठरवणे (`Reconciled`, `Pending`, `Excess`).
  6. येणे व्याज लेजर (`ReceivableInterestLedgerID`) चाही अशाच प्रकारे ताळा देणे.

```csharp
[HttpGet("GlReconciliationSummary")]
public async Task<ActionResult<LoanGlReconciliationDto>> GetGlReconciliationSummary([FromQuery] int branchId = 1, [FromQuery] int loanRateId = 0)
{
    // १. योजना व लेजर शोधणे
    var loanRate = await _context.LoanRates.FindAsync(loanRateId);
    if (loanRate == null) return BadRequest("अवैध कर्ज योजना");

    var glLedger = loanRate.LoanLedgerID.HasValue ? await _context.Ledgers.FindAsync(loanRate.LoanLedgerID.Value) : null;
    decimal glOpening = glLedger?.OpeningBalance ?? 0m;

    // २. उप-खात्यांची बेरीज काढणे
    var slAccounts = await _context.LoanAccounts
        .Where(l => l.BranchID == branchId && l.LoanRateID == loanRateId && l.IsOpeningBalance)
        .ToListAsync();

    decimal slPrincipalSum = slAccounts.Sum(l => l.PrincipalBalance);
    decimal slPureSum = slAccounts.Sum(l => l.PurePrincipalBalance > 0 ? l.PurePrincipalBalance : l.PrincipalBalance);
    decimal slCapIntSum = slAccounts.Sum(l => l.CapitalizedInterestAmount);
    int accCount = slAccounts.Count;

    decimal diff = glOpening - slPrincipalSum;
    string status = Math.Abs(diff) < 0.01m ? "Reconciled" : (diff > 0 ? "Pending" : "Excess");

    return Ok(new LoanGlReconciliationDto
    {
        BranchID = branchId,
        LoanRateID = loanRateId,
        SchemeName = loanRate.LoanType,
        LoanLedgerName = glLedger?.LedgerName ?? "लेजर जोडलेले नाही",
        GlPrincipalOpeningBalance = glOpening,
        SlTotalPrincipalBalance = slPrincipalSum,
        SlTotalPurePrincipal = slPureSum,
        SlTotalCapitalizedInterest = slCapIntSum,
        TotalAccountsCount = accCount,
        PrincipalDifference = diff,
        PrincipalStatus = status
    });
}
```

#### पाऊल २: रिॲक्ट क्लायंट UI विजेट तयार करणे (`LoanOpeningBalanceMaster.tsx`)
- फॉर्मच्या वरच्या बाजूला (ब्रांच व योजना निवडल्यानंतर लगेच) **"खतावणी आरंभिक शिल्लक जुळवणी (GL vs SL)"** हे रिॲक्टिव्ह कार्ड दाखवणे.
- जेव्हा जेव्हा:
  1. ऑपरेटर शाखा किंवा कर्ज योजना बदलतो.
  2. नवीन कर्ज खाते सेव्ह होते.
  3. जुने कर्ज खाते अपडेट किंवा डिलीट होते.
- तेव्हा हा विजेट आपोआप री-फेच होऊन ताज्या स्थितीचा ताळा दाखवेल.

---

### 🧪 ४. पडताळणी व चाचणी आराखडा (Verification Matrix)

| चाचणी प्रसंग (Scenario) | परिस्थिती | अपेक्षित UI प्रतिसाद व बॅज |
|---|---|---|
| **१. नवीन योजना निवडणे (शून्य खाती)** | GL: ₹ १०,००,०००, SL: ₹ ० (० खाती) | 🟡 **₹ १०,००,०००.०० बाकी** (Pending Entry) |
| **२. अंशतः खाती भरणे** | GL: ₹ १०,००,०००, SL: ₹ ६,००,००० (३ खाती) | 🟡 **₹ ४,००,०००.०० बाकी** (प्रगती दर्शक) |
| **३. सर्व खाती तंतोतंत भरून पूर्ण होणे** | GL: ₹ १०,००,०००, SL: ₹ १०,००,००० (५ खाती) | 🟢 **₹ ०.०० (तंतोतंत जुळले / 100% Reconciled)** |
| **४. जास्त रकमेची नोंद होणे** | GL: ₹ १०,००,०००, SL: ₹ ११,००,००० | 🔴 **₹ -१,००,०००.०० (अति-नोंदणी / विसंगती इशारा)** |

---

### 📋 ५. वरिष्ठ लेखापरीक्षक निष्कर्ष (Auditor's Sign-Off)
सदर थेट जुळवणी दर्शक (GL vs SL Reconciliation Widget) लागू केल्यामुळे ऑपरेटरला डेटा भरताना प्रत्येक सेकंदाला संस्थेच्या तेरीज पत्रकाचा थेट ताळा दिसेल, ज्यामुळे **वार्षिक ऑडिटमधील तेरीज पत्रक विसंगती कायमची नष्ट होईल**.
