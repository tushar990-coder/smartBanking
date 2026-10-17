# SmartBanking ERP - तपशीलवार आवृत्ती व बदल नोंदी (Changelog)

---

## 📅 [2026-10-18] - आवृत्ती v2.5.68 (Regulatory Board MIS Engine, CRR Liquidity Report & Universal Legacy Account Numbers v2.5.68)

### 🌟 प्रमुख वैशिष्ट्ये व निवारण (Key Highlights)
* **महाराष्ट्र राज्य पतसंस्था नियामक मंडळ, पुणे MIS अहवाल (Maharashtra State Regulatory Board MIS Report Engine):**
  * **शासकीय नियमांनुसार सर्व ७ अधिकृत टॅब्स (All 7 Official Regulatory Tabs):**
    * सहकार आयुक्त व निबंधक, सहकारी संस्था, महाराष्ट्र राज्य, पुणे यांच्या अधिकृत पोर्टल (`patsansthaniyamakmandal.in`) च्या नमुन्यांनुसार ७ अधिकृत टॅब्स विकसित:
      1. `टॅब १: प्राथमिक माहिती (General Info)`: संस्थेचे नाव, नोंदणी क्र. व तारीख, कार्यक्षेत्र, लेखापरीक्षण वर्ग (Audit Class), शाखा संख्या, प्रत्यक्ष संगणकीकृत शाखा, अध्यक्ष/व्यवस्थापक संपर्क, इत्यादी.
      2. `टॅब २: भांडवल व ठेवी (Capital & Deposits)`: अधिकृत व वसूल भागभांडवल, राखीव व इतर निधी, स्वनिधी, एकूण ठेवींचे वर्गवारीनुसार वर्गीकरण (मुदत, बचत, चालू, रिकरिंग, पिग्मी, इतर).
      3. `टॅब ३: कर्ज व येणेबाकी (Loans, Advances & Recovery)`: कर्ज वाटप, प्रत्यक्ष कर्ज येणेबाकी (सुरक्षित, विनातारण, सुवर्णतारण, वाहन, गृहकर्ज), थकीत व एनपीए वर्गीकरण (अ, ब, क, ड), आणि वसुली प्रमाण.
      4. `टॅब ४: गुंतवणूक (Investments)`: जिल्हा मध्यवर्ती बँक, राज्य बँक, राष्ट्रीयीकृत बँका, मुदत ठेवी, शेअर्स आणि रोखे यांमधील गुंतवणूक.
      5. `टॅब ५: आर्थिक प्रमाणे व गुणोत्तरे (Financial Ratios)`: सीआरआर (CRR %), सीडी रेशो (CD Ratio %), एनपीए प्रमाण (Gross & Net NPA %), भांडवल पर्याप्तता (CRAR %), स्वनिधी ते कर्ज गुणोत्तर.
      6. `टॅब ६: अंशदान ०.१% (Board Contribution 0.1%)`: ठेवी व कार्यक्षम भांडवलावर आधारित नियामक मंडळाचे ०.१०% वैधानिक अंशदान हिशोब व चलन माहिती.
      7. `टॅब ७: इतर माहिती व स्वयंघोषणा (Other Compliance & Declaration)`: संचालक मंडळ, वैधानिक सभा, आयकर व टीडीएस, एनपीए तरतूद, व चेअरमन/सचिवांची अधिकृत स्वाक्षरी स्वयंघोषणा.
  * **थेट सीबीएस डेटाबेस ऑटो-कंप्युट (Live CBS Real-time Calculation):**
    * '⚡ डेटाबेसवरून आकडेवारी भरा (Auto Fetch CBS Data)' या १-क्लिक सुविधेने लेजर व खात्यांमधून थेट वास्तविक आकडेवारी स्वयंचलित भरली जाते.
  * **मसुदा व लॉक व्यवस्था (Draft vs Final Lock Status):**
    * मसुदा (Draft) स्थितीत आकडेवारी संपादित व तात्पुरती सेव्ह करता येते; अंतिम लॉक (Locked) झाल्यावर अहवाल अनधिकृत फेरबदलापासून सुरक्षित होतो.
  * **एक्सेल एक्सपोर्ट व प्रिंट लेआउट (Excel Export & Official Print Template):**
    * `xlsx` लायब्ररीद्वारे १-क्लिक एक्सेल डाऊनलोड व ए४ शासकीय प्रिंट लेआउट.

* **CRR (Cash Reserve Ratio / रोख राखीव प्रमाण व रोख तरलता अहवाल):**
  * **शासकीय १% ते ५% वैधानिक तरलता अनुपालन (Statutory CRR Compliance Engine):**
    * संस्थेच्या एकूण ठेवींच्या (FD, RD, Pigmy, Saving) तुलनेत उपलब्ध रोख तरलता (Cash in Hand + Bank Current Accounts) चे प्रमाण मोजून हिरवा (सुरक्षित >= ३%), पिवळा (सावध १%-३%), लाल (धोकादायक < १%) अलर्ट्स.
  * **३०-दिवसीय दैनंदिन व पंधरवडानिहाय ट्रेंड (30-Day Liquidity Trend Statement):**
    * दररोजची किंवा पंधरवड्याची रोख शिल्लक, बँक शिल्लक, एकूण ठेवी व प्रत्यक्ष सीआरआर टक्केवारीचा तुलनात्मक तक्ता.
  * **शाखा रोख मर्यादा ऑडिट (Branch Cash Retention Limit Audit):**
    * प्रत्येक शाखेची प्रत्यक्ष रोख शिल्लक मंजूर तिजोरी मर्यादेपेक्षा (Retention Limit) जास्त असल्यास चेतावणी बॅज.
  * **एक्सेल व ३-स्वाक्षरी अधिकृत प्रिंट (Excel Export & Printable Signatures):**
    * लेखापाल (Accountant), अंतर्गत लेखापरीक्षक (Internal Auditor) आणि मुख्य कार्यकारी अधिकारी / व्यवस्थापक (CEO / Manager) यांच्या अधिकृत स्वाक्षऱ्यांसह शासकीय प्रिंट.

* **वरिष्ठ प्रणाली व वैधानिक लेखापरीक्षण अहवाल (Senior System Audit Report):**
  * प्रणाली ऑडिटमध्ये 'अ' वर्ग (Class 'A' 94.6/100) मानांकन प्राप्त. ताळेबंद व उप-खाते शून्य तफावत (Zero GL-SL Gap), अचूक IBT ड्युअल व्हाउचर, आणि डेटा सुरक्षा मानके प्रमाणित.

* **सार्वत्रिक जुने खाते क्र. व संपादनक्षम आयडी (Universal Legacy Account Numbers & Editable ID Integration):**
  * जुन्या सॉफ्टवेअरमधील किंवा हस्तलिखित पासबुकातील खाते क्रमांक (Old / Legacy Account Number) द्वारे थेट सर्च आणि ड्रॉपडाऊनमध्ये प्राधान्य प्रदर्शन.
  * मुदत ठेव (FD), आवर्ती ठेव (RD), पिग्मी (Pigmy), बचत खाते (Saving), भागभांडवल (Share) आणि कर्ज (Loan) या सर्व प्रमुख मॉड्यूल्समध्ये जुना खाते क्र. शोध व संपादनक्षम खाते आयडीची एकात्मिक सोय.

* **कर्ज वाटप व नोंदणी फॉर्म ऑटो-रीसेट (Loan Disbursement Form Reset):**
  * कर्ज वाटप फॉर्मवर नवीन नोंदणी सेव्ह झाल्यावर जुना 'कर्ज अर्ज नोंदणी व मंजुरी' फॉर्म संपूर्ण रीसेट व रिक्त होऊन ऑपरेटरसाठी तात्काळ नवीन नोंदीस सज्ज.

* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (VPS Multi-App Master Patch v2.5.68):**
  * सर्व संस्थांच्या शाखांसाठी थेट डेटाबेस व फ्रंटएंड पॅच तयार.

---

## 📅 [2026-10-17] - आवृत्ती v2.5.67 (FD Closures & Renewals Layout Alignment, Cash Badge Overlap Elimination & 1-Screen Cockpit Parity v2.5.67)

### 🌟 प्रमुख वैशिष्ट्ये व निवारण (Key Highlights)
* **कोअर बँकिंग सिस्टीम (CBS) - मुदत ठेव क्लोजर व नूतनीकरण संरेखन, रोख लेजर बॅज ओव्हरलॅप निवारण व १-स्क्रीन कॉकपिट परिपूर्णता (FD Closures & Renewals Layout Alignment & 1-Screen Cockpit Parity v2.5.67):**
  * **रोख लेजर बॅज ओव्हरलॅप संपूर्ण निवारण (CashLedgerReflectBadge Overflow & Header Collision Fix):**
    * `CashLedgerReflectBadge` वरील कृत्रिम `h-[32px]` आणि `items-end` कंटेनर काढून टाकले.
    * रोख खात्याच्या स्तंभाला ७ कॉल्स (`sm:col-span-7`) ची पुरेशी रुंदी देऊन नैसर्गिक उंची दिली; ज्यामुळे बॅजेस ३-४ ओळींत दुमडणे बंद होऊन वरील '२ परतावा पेमेंट पद्धत व खाती' शीर्षकावर होणारा ओव्हरलॅप १००% नष्ट झाला.
  * **संतुलित २-ओळ पेआउट मांडणी (Balanced 2-Row Payout Layout):**
    * ओळ १: पेमेंट मोड (`sm:col-span-5`) आणि संबंधित रोख लेजर / बँक लेजर / बचत खाते (`sm:col-span-7`).
    * ओळ २: संपूर्ण रुंदीचा शेरा/तपशील (`Narration`) इनपुट बॉक्स; ज्यामुळे टायपिंगसाठी भरपूर जागा मिळते आणि फॉर्मचे स्वरूप अत्यंत सुबक दिसते.
  * **क्रमवार पायऱ्यांचे शुद्ध नामांकन (Sequential Step Numbering):**
    * पायरी १: खाते व तारीख निवड -> पायरी २: व्यवहाराचा प्रकार व कृती -> पायरी ३: परतावा पेमेंट पद्धत व तपशील.
  * **थेट सेटलमेंट कॉकपिटमध्ये मुख्य कृती बटणाचे एकात्मिकरण (Integrated Submit Action Button in Live Cockpit):**
    * अंतिम देय रक्कम (`Net Payable Payout`) च्या खालीच मुख्य सबमिट बटण (`मुदतपूर्व परतावा / मुदतपूर्ती पेमेंट / नूतनीकरण`) समाविष्ट केले.
    * व्हाउचर्स नोंदी लपवा/पाहा काहीही केले तरी सबमिट बटण कायमस्वरूपी डोळ्यांसमोर राहते; ऑपरेटरला खाली स्क्रोल करण्याची शून्य गरज.
  * **व्याज माहिती व वेळापत्रक क्विक-कार्ड (Interest Snapshot & Schedule Quick Card):**
    * लागू व्याजदर, मुदतपूर्ती व ओव्हरड्यू दिवस सुबक बॅजेसमध्ये आणि शेजारीच वेळापत्रक तक्ता व १-क्लिक प्रिंट बटणे.
  * **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (VPS Multi-App Master Patch v2.5.67):**
    * सर्व ९ संस्थांसाठी (माउली, यशवंत, समर्थ, धन्वंतरी, इ.) स्वयंचलित पॅच तयार.

---

## 📅 [2026-10-17] - आवृत्ती v2.5.66 (FD Closures & Renewals No-Tabs Minimal-Scroll Single-Screen Cockpit Redesign v2.5.66)

### 🌟 प्रमुख वैशिष्ट्ये व निवारण (Key Highlights)
* **कोअर बँकिंग सिस्टीम (CBS) - मुदत ठेव क्लोजर व नूतनीकरण नो-टॅब (No-Tabs) व स्क्रोल-मुक्त (Minimal-Scroll Single Screen) कॉकपिट पुनर्रचना (FD Closures & Renewals No-Tabs Single-Screen Cockpit Redesign v2.5.66):**
  * **सर्व टॅब्स काढून थेट युनिफाईड इनपुट पॅनेल (Zero Tabs Unified Operational Workspace):**
    * वापरकर्त्याच्या मागणीनुसार तिन्ही टॅब्स (`overview`, `interest`, `payout`) काढून टाकून सर्व पर्याय डाव्या बाजूच्या पॅनेलमध्ये एकाच वेळी थेट समोर दृश्यमान केले.
    * १) कृती निवड (मुदत संपली असल्यास 'मुदतपूर्ती पेमेंट' किंवा 'नूतनीकरण' चे २ शेजारील रेडिओ पर्याय; मुदत चालू असल्यास ऑटो-अ‍ॅम्बर अलर्ट).
    * २) नूतनीकरण पर्याय (नूतनीकरण निवडल्यावरच १ कॉम्पॅक्ट ओळीत नवीन योजना व प्रकार).
    * ३) पेआउट पद्धत व खाती (रोख, बँक, बचत खात्यात वर्ग, संबंधित लेजर/बचत खाते निवड, धनादेश/UTR क्र. व शेरा).
  * **स्क्रोल-मुक्त हाय-डेन्सिटी बँकिंग कॉकपिट (Minimal-Scroll Single Screen):**
    * जुन्या टॅब २ मधील ४ मोठे डुप्लिकेट बॉक्सेस काढून टाकल्याने संपूर्ण फॉर्मची उंची केवळ ~४००px ते ४५०px वर नियंत्रित.
    * सामान्य डेस्कटॉप किंवा लॅपटॉपवर (1366x768 किंवा 1920x1080) कोणत्याही उभ्या स्क्रोलिंगशिवाय संपूर्ण व्यवहार एकाच स्क्रीनवर संपन्न.
  * **थेट सेटलमेंट सारांश व नेट पेआउट बॅनर (Real-time Live Settlement Cockpit):**
    * ठेव मुद्दल, देय व्याज, मुदतपूर्व व्याज कपात (Clawback) व ओव्हरड्यू व्याज हिशोब थेट डोळ्यांसमोर ठळक हिरव्या बॅजमध्ये.
  * **१-क्लिक वेळापत्रक तक्ता व प्रिंट (Schedule Drawer & Modal):**
    * व्याज वेळापत्रक पाहण्यासाठी स्वतंत्र टॅबऐवजी इनलाइन कोलॅप्सिबल ड्रॉवर आणि १-क्लिक प्रिंट मोडल.
  * **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.66`).**

---

## 📅 [2026-10-17] - आवृत्ती v2.5.65 (FD Closures & Renewals 2-Column Compact Cockpit Workspace & Schedule Periods Typing Fix v2.5.65)

### 🌟 प्रमुख वैशिष्ट्ये व निवारण (Key Highlights)
* **कोअर बँकिंग सिस्टीम (CBS) - मुदत ठेव क्लोजर व नूतनीकरण २-कॉलम कॉम्पॅक्ट फायनान्शियल कॉकपिट व वेळापत्रक त्रुटी निवारण (FD Closures & Renewals 2-Column Compact Cockpit Workspace & Schedule Periods Typing Fix v2.5.65):**
  * **२-कॉलम स्प्लिट कॉकपिट लेआउट (2-Column Minimal-Scroll Workspace):**
    * जुनी ३२००px उभी रचना बदलून स्क्रीन २ स्तंभांमध्ये विभागली.
    * डावा स्तंभ (७ कॉलम्स): ३ सुलभ टॅब्स — १. कृती व नूतनीकरण (Overview & Renewal), २. व्याज व स्लॅब हिशोब (Interest & Schedule), ३. पेआउट पद्धत व खाती (Payout & Accounts).
    * उजवा स्तंभ (५ कॉलम्स - Sticky Real-Time Cockpit): थेट सेटलमेंट कार्ड, व्हाउचर ताळेबंद आणि त्वरित सबमिट/पासिंग बटणे.
  * **थेट सेटलमेंट सारांश व नेट पेआउट बॅज (Live Net Payout Banner):**
    * मुदत मुद्दल, देय व्याज, मुदतपूर्व दंड (Clawback) व ओव्हरड्यू व्याज यांनुसार अंतिम देय परतावा रक्कम (Net Payable Payout) मोठ्या ठळक हिरव्या बॉक्समध्ये स्क्रीन स्क्रोल न करता त्वरित दृश्यमान.
  * **व्हाउचर बॅलन्सिंग व जर्नल ड्रॉवर (Voucher Dr/Cr Check & Drawer):**
    * ताळेबंद संतुलित/असंतुलित बॅज आणि गरजेनुसार विस्तृत लेजर नोंदी पाहण्यासाठी सुबक ड्रॉवर.
  * **स्टिकी अ‍ॅक्शन बार (Sticky Command Bar):**
    * ऑपरेटर सबमिट बटणे (मुदतपूर्व परतावा, नूतनीकरण, मुदतपूर्ती पेमेंट), मेकर-चेकर पासिंग बटणे (मंजूर व पास करा, नामंजूर करा), आणि व्याज वेळापत्रक प्रिंट बटणे एकाच ठिकाणी उपलब्ध.
  * **टाईपस्क्रिप्ट त्रुटींचे संपूर्ण निवारण (Schedule Periods Typing Parity):**
    * `scheduleSummary.quarters` ऐवजी `scheduleSummary.periods` चे योग्य मॅपिंग करून सर्व ४ प्रकारच्या TypeScript त्रुटी पूर्णपणे दूर.
  * **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.65`).**

---

## 📅 [2026-10-16] - आवृत्ती v2.5.61 (Financial Access Control, Granular RBAC, Maker-Checker & Customer360 Schema Fix v2.5.61)

### 🌟 प्रमुख वैशिष्ट्ये व निवारण (Key Highlights)
* **कोअर बँकिंग सिस्टीम (CBS) सुरक्षा मजबुतीकरण व P0 क्रिटिकल निवारण (Financial Access Control & P0 Remediation):**
  * **वित्तीय नियंत्रक सुरक्षा (Vouchers & Cash Management Authorization):**
    * `VouchersController.cs` आणि `CashManagementController.cs` वरील `[AllowAnonymous]` पूर्णपणे हटवून `[Authorize]` बंधनकारक केले. सर्व विना-लॉगिन प्रवेश तात्काळ `401 Unauthorized` ने ब्लॉक.
  * **ग्रॅन्युलर RBAC व मेकर-चेकर (Maker-Checker Enforcement):**
    * व्हाउचर्स मंजुरी (`POST /api/Vouchers/{id}/Approve`) वर Maker ID != Approver ID चे कडक बंधन. स्वतःचे व्हाउचर स्वतः मंजूर करण्यास `400 Bad Request` सह बंदी.
    * व्हाउचर्स मंजुरी, रद्दबातल (`Cancel`) आणि हटवणे (`Delete`) चे अधिकार केवळ `Manager`, `Admin`, `SuperAdmin` या अधिकृत पदांपुरते मर्यादित.
  * **कॅशियर व्यवहार मर्यादा व दिवसअखेर लॉक (EOD Closed Lock & Cashier Role Scope):**
    * ज्या शाखेचा दिवस बंद (`BranchDayEndStatuses.IsDayClosed`) झाला आहे, त्यामध्ये नवीन व्हाउचर तयार करणे किंवा रोख वाटप करणे पूर्णपणे प्रतिबंधित.
    * कॅशियरला केवळ 'Receipt' (जमा) व 'Payment' (नावे) करण्याची मुभा; 'Journal' (JV) व 'Contra' व्हाउचर तयार करण्यास बंदी.
  * **कॅश मॅनेजमेंट सुरक्षा (Cash Management Hardening):**
    * तिजोरी ते काउंटर रोख वाटप (`Allocations`) केवळ शाखा व्यवस्थापक करू शकतील; कॅशियर स्वतःला रोख वाटप करू शकत नाही.
    * कॅश सेटिंग्ज, लेजर मॅपिंग व सीडिंग केवळ `SuperAdmin/Admin` पुरते मर्यादित.
  * **डेटाबेस बॅकअप व बल्क इम्पोर्ट संरक्षण (Backup & DataImport Hardening):**
    * `BackupController`, `DataImportController`, `LegacyDataImportController` व `SeedController` वर `[Authorize(Roles = "SuperAdmin,Admin,SystemAdmin")]` बंधनकारक.
  * **डेटाबेस स्कीमा ५०० एरर निवारण (SavingPassbooks CustomerID & Customer 360 Fix):**
    * `SavingPassbooks` टेबलमध्ये `CustomerID INT NULL` कॉलम जोडला, `SavingAccountMasters` मधून डेटा बॅकफिल केला आणि `IX_SavingPassbooks_CustomerID` इंडेक्स तयार केला.
    * `GET /api/Reports/Customer360/{id}` एरर पूर्णपणे दूर होऊन २०० OK यशस्वी.
    * `tools/master_vps_update_schema.sql` (Section 50.3.1) अद्ययावत.
  * **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.61`).**

---

## 📅 [2026-10-16] - आवृत्ती v2.5.60 (Branch-wise EOD Cash Tally & Multi-Cash Ledger Reconciliation v2.5.60)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **कोअर बँकिंग सिस्टीम (CBS) - शाखानिहाय दिवसअखेर रोख ताळमेळ (Branch-wise EOD Cash Tally & Multi-Cash Ledger Reconciliation):**
  * **कॅश लेजर हार्डकोडिंगचे संपूर्ण निर्मूलन (Zero Hardcoded Cash Ledger ID):** EOD/BOD प्रक्रियेमधील मुख्य कार्यालय रोख खाते (`LedgerID = 1` किंवा `branchId == 1`) हार्डकोडिंग पूर्णपणे काढून टाकले. `CashLedgerHelper.GetCashLedgerIdsForBranchAsync` द्वारे संबंधित शाखेच्या सर्व रोख खात्यांचा (Primary Cash Ledger + Counter Cash / Petty Cash Ledgers) अचूक ताळमेळ.
  * **शाखानिहाय आरंभिक शिल्लक व व्हाउचर हालचाल (Branch Opening Balance & Voucher Movements):** `BranchLedgerOpeningBalances` मधील शाखेची अचूक आरंभिक रोख शिल्लक (Opening Balance) घेऊन आजचे रोख भरणा (Receipts) व रोख उपसा (Payments) यांनुसार अचूक क्लोजिंग कॅश शिल्लक गणना.
  * **प्रत्यक्ष नोटा मोजदाद पडताळणी (Physical Cash Denomination Verification):** दिवसअखेर करताना प्रत्यक्ष मोजलेली रोख रक्कम (`CashDenominations`) पुस्तकी शिल्लक (Book Balance) शी जुळवून फरक (Difference / Tally Status) पडताळणी.
  * **कॅशियर खिडकी/ड्रॉवर सेटलमेंट गार्ड (Cashier Drawer Settlement Check):** तिजोरी/खिडकी बंद न केलेल्या कॅशियर्सचा (`CashierBalances`) शोध घेऊन दिवसअखेरीपूर्वी सर्व खिडक्या बंद असल्याची खात्री.
  * **दिवसअखेर डॅशबोर्ड (DayEndDashboard.tsx UI Polish):** शाखानिहाय रोख खाते नाव, लेजर आयडी, पावती/पेमेंट ब्रेकडाउन, नोटा मोजदाद स्थिती व कॅशियर सेटलमेंटसह अत्याधुनिक प्री-चेकलिस्ट व रंगीत बॅजेस.
  * **ट्रान्सफर व्हाउचर पडताळणी शुद्धीकरण:** आंतर-खाते ट्रान्सफर व्हाउचर्स तपासताना शाखेच्या सर्व रोख खात्यांचा समावेश करून अचूक ताळमेळ.
  * **डेटाबेस स्वयं-दुरुस्ती (Schema Self-Healing):** `master_vps_update_schema.sql` (Section 7.12) मध्ये `Branches` टेबलवरील `DefaultCashLedgerID` स्वयंचलित मॅपिंग.
  * **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.60`).**

---

## 📅 [2026-10-15] - आवृत्ती v2.5.59 (Trial Balance IBT Columns & Cross-Branch Loan Collections v2.5.59)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **कोअर बँकिंग सिस्टीम (CBS) - शाखा ताळेबंद ५०० एरर निवारण व IBT कॉलम्स (Trial Balance HTTP 500 Fix):**
  * `Vouchers` टेबलवर `IsIbtVoucher`, `RelatedVoucherID`, आणि `TargetBranchID` हे तीन IBT कॉलम्स डेटाबेस स्तरावर जोडून `GET /api/Reports/TrialBalance` मधील SQL Server Error 207 क्रॅश पूर्णपणे दूर केला.
  * शाखा १ (HO), उप-शाखा आणि सर्वंकष (Consolidated) ताळेबंद १००% अचूक, संतुलित (Total Debit == Total Credit = ₹५,८३,९५४.११) आणि विना-त्रुटी सुरू.
  * जलद अहवाल निर्मितीसाठी `IX_Vouchers_IsIbtVoucher` व `IX_Vouchers_RelatedVoucherID` नॉन-क्लस्टर्ड इंडेक्स तयार केले.
* **कर्ज वसुली क्रॉस-ब्राँच परिपूर्ण सक्षमीकरण (Cross-Branch Loan Collections Dual-Voucher & HomeBranchVoucherID):**
  * `LoanCollections` टेबलवर `HomeBranchVoucherID` कॉलम आणि इंडेक्स जोडून ॲप्लिकेशन स्टार्टअप स्वयंचलित दुरुस्ती क्वेरी यशस्वी केली.
  * काऊंटर शाखा पावती व्हाउचर (`Receipt`) व मूळ शाखा तडजोड व्हाउचर (`Journal`) चे द्विमार्गी परस्पर संलग्नन (`RelatedVoucherID`).
* **पावती डिलीट व रोलबॅक सर्क्युलर डिपेंडन्सी निवारण (Delete Rollback Circular Dependency Elimination):**
  * परस्पर जोडलेले दोन IBT व्हाउचर डिलीट करताना EF Core मधील परस्परावलंबित्व (Foreign Key Cycle) मोडून स्वच्छ व सुरक्षित रोलबॅकची हमी.
* **रोख शिल्लक चालू आर्थिक वर्ष पडताळणी (Cash Opening Balance FinancialYearID Scope):**
  * `VouchersController.cs` मध्ये सक्रिय आर्थिक वर्षाचा (`activeFyId`) अचूक संदर्भ जोडून मागील आर्थिक वर्षाची रोख शिल्लक उचली जाण्याचा धोका पूर्णपणे रोखला.
* **मास्टर VPS स्कीमा अद्ययावतीकरण (`tools/master_vps_update_schema.sql` Section 7.10):**
  * सर्व ९ VPS क्लायंट संस्थांच्या डेटाबेसला पॅच करताना IBT कॉलम्स स्वयंचलित जोडण्याची हमी.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.59`).**

---

## 📅 [2026-10-15] - आवृत्ती v2.5.58 (CBS Inter-Branch Transfer Clearing & Reconciliation Matrix Report v2.5.58)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **कोअर बँकिंग सिस्टीम (CBS) - आंतर-शाखा ताळमेळ व क्लिअरिंग अहवाल (Inter-Branch Transfer Clearing & Reconciliation Matrix Report):**
  * **आंतर-शाखा १-स्क्रीन N × N मॅट्रिक्स अहवाल (1-Screen Multi-Branch Clearing Matrix Grid):**
    * सर्व शाखांमधील परस्पर येणे/देणे (Net Receivables / Payables) एकाच स्क्रीनवर आंतरराष्ट्रीय बँकिंग दर्जाच्या N × N ग्रिड स्वरूपात.
    * शाखा अ कडून शाखा ब ला किती रक्कम येणे (हिरवा बॅज, Receivable) किंवा देणे (लाल बॅज, Payable) हे स्पष्ट रंगात व १-क्लिकमध्ये दृश्यमान.
    * एकूण आंतर-शाखा उलाढाल, एकूण येणे, एकूण देणे, आणि सिस्टीम नेट इमबॅलन्स (CBS Net Imbalance) दर्शक KPI कार्ड्स.
  * **कॉन्ट्रा पडताळणी व सविस्तर खातावणी (Pair-wise Contra Drilldown & Statement):**
    * कोणत्याही दोन शाखांच्या जोडीवर क्लिक करून दोन्ही शाखांचे IBT लेजर, व्हाउचर्स, आणि 'शाखा अ चे येणे + शाखा ब चे देणे = ०.००' हा सीबीएस सुवर्ण नियम (CBS Golden Rule Zero-Difference Check) पडताळण्याची सोय.
    * दोन्ही बाजूंचे व्हाउचर्स समोरासमोर (Dual-View Voucher Statement) दाखवून फरक असणाऱ्या व्हाउचर्सवर तत्काळ लाल रंगाचा इशारा.
  * **अनरिकॉन्सिल्ड व इन-ट्रॅन्झिट व्हाउचर्स रडार (Unreconciled / In-Transit Vouchers Radar):**
    * एकतर्फी (One-sided), विना-संलग्न (Missing `RelatedVoucherID`) किंवा रक्कम तफावत असणारे व्हाउचर्स शोधून त्वरित लाल रंगात धोक्याचा इशारा.
    * व्यवहार प्रकार (FD, RD, Pigmy, Saving, Loan, Transfer) नुसार फिल्टर आणि थेट संबंधित मूळ व्हाउचर्सकडे नेव्हिगेशन.
  * **१-क्लिक आंतर-शाखा सेटलमेंट व्हाउचर्स (1-Click IBT Settlement Engine):**
    * दोन शाखांमधील येणे/देणे शिल्लक शून्य करण्यासाठी दोन्ही शाखांमध्ये समक्रमित सेटलमेंट बँक/कॅश पेमेंट्स व पावती व्हाउचर्स स्वयंचलित तयार करणे (`IsIbtVoucher = true`).
  * **उप-शाखा रोख शिल्लक पडताळणी सुधारणा (VouchersController Negative Cash Balance Fix):**
    * व्हाउचर सेव्ह करताना उप-शाखांच्या रोख खात्यांची शिल्लक मोजताना `BranchLedgerOpeningBalances` मधून अचूक ओपनिंग बॅलन्स घेऊन अनावश्यक 'कॅश शिल्लक उणे' त्रुटी रोखली.
  * **मुद्रण व एक्सेल एक्सपोर्ट:**
    * सीबीएस मानकांनुसार अधिकृत ए४ प्रिंट लेआउट आणि १-क्लिक एक्सेल (`.xlsx`) एक्सपोर्ट.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.58`).**

---

## 📅 [2026-10-15] - आवृत्ती v2.5.57 (Cross-Branch IBT Dual-Voucher for Pigmy, RD & FD Closures v2.5.57)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **कोअर बँकिंग सिस्टीम (CBS) - आंतर-शाखा IBT ड्युअल-व्हाउचर इंजिन (Cross-Branch Dual-Voucher Architecture):**
  * **मुदत ठेव आंतर-शाखा परतावा व मुदतपूर्व बंद (Cross-Branch FD Maturity & Premature Close):**
    * मुदत ठेव खाते ज्या शाखेत आहे (उदा. शाखा ब) त्याऐवजी इतर शाखेच्या (उदा. शाखा अ) काऊंटरवर खातेदार पावती वटवण्यासाठी आल्यास आंतर-शाखा ड्युअल-व्हाउचर इंजिन कार्यान्वित.
    * **काऊंटर शाखा (Branch A, Payment):** काऊंटरच्या प्रत्यक्ष कॅश खात्यातून रोख अदा (`Dr IBT(B)`, `Cr Cash(A)`).
    * **मूळ शाखा (Branch B, Journal):** ठेवीदाराचे दायित्व व व्याज तरतूद बंद करून IBT खात्याला क्रेडिट (`Dr FD Liability`, `Dr Interest Payable`, `Dr Interest Expense`, `Cr Penalty/Clawback`, `Cr IBT(A)`).
    * दोन्ही व्हाउचर्स `RelatedVoucherID`, `IsIbtVoucher = true`, व `TargetBranchID` ने परस्पर संलग्न.
  * **पिग्मी आंतर-शाखा विड्रॉल व क्लोजर (Cross-Branch Pigmy Withdrawal & Account Closure):**
    * पिग्मी खात्याची अंशतः विड्रॉल किंवा संपूर्ण खाते बंद करण्याची प्रक्रिया दुसऱ्या शाखेच्या काऊंटरवर सुलभ व सुरक्षित.
    * **काऊंटर शाखा (Payment):** `Dr IBT`, `Cr Cash` (निव्वळ अदा रक्कम `netPaid` / `netPayable`).
    * **गृह शाखा (Journal):** `Dr Pigmy Liability`, `Dr Interest Expense`, `Cr Penalty Income`, `Cr IBT`.
  * **आरडी हप्ता भरणा, मुदतपूर्ती व मुदतपूर्व बंद (Cross-Branch RD Collection & Closures):**
    * **हप्ता भरणा (Counter Receipt):** काऊंटर शाखेत `Dr Cash`, `Cr IBT` आणि मूळ शाखेत `Dr IBT`, `Cr RD Liability`, `Cr Penalty Income`.
    * **क्लोजर (Matured & Premature):** काऊंटर शाखेतून परतावा पेमेंट व्हाउचर व मूळ शाखेत दायित्व व व्याजाचे परिपूर्ण समायोजन.
  * **आंतर-शाखा ताळेबंद शून्य ताळमेळ (Zero GL-SL Imbalance):**
    * दोन्ही शाखांचे स्वतंत्र ताळेबंद (Branch Trial Balance) आणि कन्सॉलिडेटेड ताळेबंद (Consolidated Balance Sheet) पैशा-पैशाने शून्य तफावत (0.00) राहणे हमीबद्ध.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.57`).**

---

## 📅 [2026-10-15] - आवृत्ती v2.5.56 (User Branch Isolation, JWT Claims Enforcement & Privilege Escalation Hardening v2.5.56)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **कोअर बँकिंग सुरक्षा व युजर शाखा अलगीकरण (User Branch Isolation & Security Hardening):**
  * **टोकन-आधारित पडताळणी (Token-Based Claims Enforcement & Zero Escalation):** शाखा कर्मचाऱ्यांकडून URL क्वेरी पॅरामीटर (`?branchId=...`) अथवा विनंती पेलोडमध्ये अन्य शाखेचा आयडी पाठवून दुसऱ्या शाखेचा गोपनीय वित्तीय डेटा पाहणे किंवा बदलणे पूर्णपणे ब्लॉक केले. आता प्रत्येक विनंती कॉलरच्या कडक ऑथेंटिकेशन टोकनमधील (`User.Claims`) `BranchID` शी पडताळली जाते.
  * **`EnforceBranchScope` ऍक्शन फिल्टर (Automated Action Filter):** `ReportsController`, `VouchersController`, `SavingAccountsController`, `LoanAccountsController`, `CashManagementController` व `LoanApplicationsController` वर स्वयंचलित स्कोप फिल्टर लागू केला. सामान्य शाखा कर्मचाऱ्यांसाठी पॅरामीटर आपोआप त्याच्या ऑथेंटिकेटेड शाखेशी संरेखित होतो, तर अधिकार नसलेल्या क्रॉस-शाखा विनंत्या ब्लॉक केल्या जातात.
  * **मुख्य कार्यालय / प्रशासकीय लवचिकता (HO & Administrative Freedom):** `Admin`, `SuperAdmin`, `HO_Manager`, `CEO`, `Auditor`, `GeneralManager` या प्रशासकीय पदांसाठी 'सर्व शाखा (All Branches / Consolidated)' किंवा कोणत्याही एका शाखेचे विवरण पाहण्याचे अधिकार पूर्ववत अबाधित ठेवले.
  * **रोख व्यवस्थापन व तिजोरी सुरक्षा (Cash Management Scope Enforcement):** कॅशियर बॅलन्स, रोख तिजोरी वाटप (Cash Allocation) व नोटांची मोजदाद (Denomination Entry) मध्ये टोकन-आधारित अनिवार्य शाखा आयडी सक्ती लागू केली.
  * **दिवसअखेर (EOD/BOD) ताळमेळ व अचूकता:** दिवसअखेर तपासणीत शाखा-स्तरीय रोख खात्यांचा (`BranchLedgerOpeningBalances` / `CashLedgerHelper`) वापर करून त्या त्या शाखेची प्रत्यक्ष तिजोरी शिल्लक तंतोतंत पडताळली जाणे सुनिश्चित केले.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.56`).**

---

## 📅 [2026-10-15] - आवृत्ती v2.5.55 (Branch Ledger Opening Balances AccountNature Bug Fix, Null-Safety & VPS Master Patch v2.5.55)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **शाखानिहाय लेजर शिल्लक (Branch Ledger Opening Balances) - AccountNature नमुना दोष निराकरण, कन्सोल क्रॅश व ब्लँक स्क्रीन निवारण (`BranchLedgerOpeningMaster.tsx`):**
  * **ब्लँक स्क्रीन व क्रॅश निवारण (`BranchLedgerOpeningMaster.tsx:778 includes` Fix):** `accountNature` अनडिफाइन्ड (`undefined`) असल्यामुळे येणारा `Cannot read properties of undefined (reading includes)` एरर पूर्णपणे दूर करून सुरक्षित फॉलबॅक (`r.accountNature || r.natureOfGroup || 'Asset'`) लागू केला.
  * **बॅकएंड DTO व मॅपिंग संरेखन (`BranchLedgerOpeningBalancesController.cs`):** API रिस्पॉन्समध्ये `AccountNature`, `MasterOpeningBalance` व `MasterOpeningBalanceType` फील्ड्स समाविष्ट करून संस्था मुख्य शिल्लक आणि ग्रुप नेचर दोन्ही उपलब्ध केले.
  * **फ्रंटएंड फिल्टर व एक्सेल एक्सपोर्ट सुरक्षितता:** स्वरूप फिल्टर (Asset, Liability, Income, Expense) व एक्सेल फाईल जनरेशन पूर्णपणे नल-सेफ केले.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.55`).**

---

## 📅 [2026-10-15] - आवृत्ती v2.5.54 (LoginForm Background Geometry SVG Numeric Compliance & Console Error Fix v2.5.54)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **लॉगिन स्क्रीन पार्श्वभूमी SVG मानकीकरण व कन्सोल त्रुटी निवारण (`LoginForm.tsx`):**
  * **कन्सोल त्रुटी निवारण (`Error: <path> attribute d: Expected number` Fix):** W3C SVG नियमांनुसार `<path d="...">` मध्ये टक्केवारी (`%`) चे निर्देशांक अवैध ठरून ब्राउझर कन्सोलमध्ये येणारा लाल एरर पूर्णपणे बंद केला.
  * **रिस्पॉन्सिव्ह व्ह्यूबॉक्स मानकीकरण (`viewBox="0 0 1000 1000"` & `preserveAspectRatio="none"`):** पाथ व वर्तुळांचे निर्देशांक शुद्ध संख्यात्मक (उदा. `150 200`, `850 250`, `500 100`) मध्ये रूपांतरित करून सर्व प्रकारच्या स्क्रीनवर (मोबाईल, टॅबलेट, डेस्कटॉप) एकसमान व कुरकुरीत (`vectorEffect="non-scaling-stroke"`) प्रदर्शन सुनिश्चित केले.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.54`).**

---

## 📅 [2026-10-15] - आवृत्ती v2.5.53 (Authentication & Core Schema Self-Healing, DefaultIbtLedgerID & BranchLedgerOpeningBalances Automated Migration v2.5.53)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **लॉगिन क्रॅशचे संपूर्ण कायमस्वरूपी निवारण (`Invalid column name 'DefaultIbtLedgerID'` Fix):**
  * संस्थांच्या डेटाबेसवर (उदा. `SmartBanking_maharshiyadrav`) ॲडमिन लॉगिन करताना `Invalid column name 'DefaultIbtLedgerID'` असा एरर येत होता.
  * `Program.cs` मध्ये सिस्टीम सुरू होताच आणि कोणत्याही लॉगिन किंवा API विनंतीपूर्वी स्वतंत्र `Isolated Early Schema Self-Heal` ब्लॉक समाविष्ट केला. हा ब्लॉक `Branches` टेबलमध्ये `DefaultIbtLedgerID` आणि `DefaultCashLedgerID` हे आवश्यक कॉलम्स १००% हमीने लगेच निर्माण करतो.
* **`BranchLedgerOpeningBalances` टेबल व कन्सॉलिडेटेड इंडेक्स स्वयं-सक्षमीकरण:**
  * सर्व संस्था डेटाबेसेसमध्ये `BranchLedgerOpeningBalances` टेबल, योग्य विदेशी की (Foreign Keys) व कंपोझिट युनिक इंडेक्स सुरक्षितपणे तयार होतात.
  * आधीच्या मोठ्या ३,००० ओळींच्या स्क्रिप्टमधील कोणत्याही एका एररमुळे संपूर्ण मायग्रेशन अडकून पडणे कायमचे थांबवले.
* **व्हीपीएस मल्टी-ॲप पॅच इन्स्टॉलर सुधारणा (`apply_patch.ps1` Step 2.0 & Step 2.5):**
  * पॅच रन होताना मुख्य स्कीमा चालण्याच्या आधीच **Step 2.0** मध्ये सर्व संस्थांच्या डेटाबेसेसवर थेट कोअर कॉलम्स सुनिश्चित केले जातात (`instant_fix_default_ibt_ledger_id.sql`).
  * **Step 2.5** मध्ये शाखानिहाय लेजर सुरुवातीची शिल्लक स्थलांतर (`create_branch_ledger_opening_balance_table.sql`) स्वयंचलित चालवले जाते.
* **आपत्कालीन स्वतंत्र SQL स्क्रिप्ट (`tools/instant_fix_default_ibt_ledger_id.sql`):**
  * सर्व्हरवर कोणत्याही डेटाबेसमध्ये त्वरित चालवून एका सेकंदात समस्या सोडवण्यासाठी स्वतंत्र आयडेम्पोटंट स्क्रिप्ट उपलब्ध.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (`VPS Multi-App Master Patch v2.5.53`).**

---

## 📅 [2026-10-15] - आवृत्ती v2.5.52 (Investment Opening Balance & New Account Date Validation, 4-Digit Year Enforcement, Safe Range Bounds & HttpPut Endpoint v2.5.52)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **गुंतवणूक सुरुवातीची शिल्लक स्थलांतर व नवीन खाते तारीख व्हॅलिडेशन (HTML5 yyyy-MM-dd Date Safety):**
  * तारीख इनपुट बॉक्समध्ये कीबोर्डने तारीख टाईप करताना अर्धवट वर्ष (उदा. `203`, `3-01-18`) स्टेटमध्ये गेल्याने येणारी ब्राउझर कन्सोल चेतावणी (`The specified value does not conform to the required format, "yyyy-MM-dd"`) पूर्णपणे रोखली.
  * **क्लायंट-साइड व्हॅलिडेशन (`isValidIsoDate`):** वर्ष अचूक ४ अंकी (`1950` ते `2100`) आणि महिना/दिवस वैध असल्याची खात्री केल्याशिवाय फॉर्म सबमिट होण्यास प्रतिबंध. अपूर्ण तारीख असल्यास स्पष्ट मराठी इशारा प्रदर्शित.
  * **सुरक्षित तारीख मर्यादा (Date Range Bounds):** इनपुट बॉक्सला `min="1980-01-01"` व `max="2099-12-31"` ॲट्रिब्यूट्स लागू.
  * **वापरकर्ता-स्नेही UI (Helper UI):** निवडलेली तारीख हिरव्या अक्षरात सुवाच्य मराठी स्वरूपात (उदा. `३१/०३/२०२६`) दाखवणे आणि `📅 कॅलेंडर आयकॉनवरून निवडा` मदत मजकूर समाविष्ट.
* **अचूक बॅकएंड API त्रुटी संदेश पार्सिंग (Accurate Error Parsing):**
  * सेव्ह करताना जेनेरिक मेसेज ऐवजी सर्व्हरकडून आलेला खरा व्हॅलिडेशन मेसेज स्क्रीनवर स्पष्ट दिसणे.
* **बॅकएंड एंडपॉइंट्स व डेटाबेस सुरक्षा (`InvestmentAccountsController.cs`):**
  * `PostInvestmentAccount` आणि `MigrateInvestmentAccount` वर तारीख मर्यादा तपासणी समाविष्ट, ज्यामुळे SQL Server `datetime` ओव्हरफ्लो एरर टळेल.
  * यापूर्वी गहाळ असलेला `[HttpPut("{id}")]` एंडपॉइंट समाविष्ट केला, ज्यामुळे स्थलांतरित खात्यांचे संपादन (Edit/Update) निर्दोषपणे कार्य करेल.

---

## 📅 [2026-10-13] - आवृत्ती v2.5.49 (Investment & Asset Management Multi-Branch Isolation, Branch Cash Drawer Alignment, Consolidated Batch Depreciation & Passing Revert v2.5.49)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **मालमत्ता व्यवस्थापन बहु-शाखा सक्षमीकरण (Fixed Asset Multi-Branch Readiness):**
  * **रोख खरेदी लेजर (Branch Cash Drawer Alignment):** मालमत्ता खरेदी करताना `CashLedgerHelper.GetCashLedgerIdAsync` लागू केले. शाखा क्र. २ ची रोख खरेदी शाखा १ च्या कॅश लेजरला जमा होणे १००% बंद होऊन संबंधित शाखेचा अधिकृत रोख लेजर आपोआप क्रेडिट होतो.
  * **संस्था-स्तरीय मालमत्ता वर्ग (Asset Categories):** मुख्य शाखा/संस्था स्तरावरील वर्ग सर्व शाखांसाठी खुले (`BranchID == branchId || BranchID == 1 || BranchID == 0`).
  * **शाखा हस्तांतरण (Asset Branch Transfer):** हस्तांतरण सूचीमध्ये `branchId` फिल्टर आणि UI मध्ये चालू शाखा वगळून थेट इतर शाखांची स्वयंचलित निवड.
  * **एकत्रित वार्षिक घसारा आकारणी (Consolidated Batch Depreciation Engine):** अहवाल व Depreciations Controller मध्ये `🌟 सर्व शाखा एकत्रित (All Branches - Consolidated)` पर्याय जोडला. सर्व शाखांचा घसारा एका क्लिकवर मोजता येतो व प्रत्येक शाखेच्या खात्यात स्वतंत्र संतुलित जर्नल व्हाउचर (Branch-wise JV) पोस्ट होऊन शाखा नफा-तोटा व तेरीज अचूक जुळते.
  * **देखभाल, विल्हेवाट व पडताळणी:** सर्व उप-मॉड्यूल्समध्ये शाखा-स्तरीय फिल्टर व रोख लेजर मॅपिंग लागू केले.
  * **UI/UX डायनॅमिक शाखा संदर्भ:** `useAuth()` (`user.branchID` / `globalBranchId`) द्वारे ओपनिंग बॅलन्स, खरेदी आणि अहवाल वापरकर्त्याच्या सक्रिय शाखेशी सिंक केले; मालमत्ता यादीत 'शाखा' स्तंभ समाविष्ट.
* **गुंतवणूक व्यवस्थापन बहु-शाखा स्वायत्तता (Investment Module Multi-Branch Capability):**
  * गुंतवणूक खात्यांची आरंभिक शिल्लक, नवीन खाते उघडणे व मासिक व्याज आकारणी (Monthly Accrual) मध्ये शाखा-स्तरीय रोख/बँक लेजर मॅपिंग.
  * संस्था-स्तरीय बँका/संस्था सर्व शाखांमध्ये उपलब्ध.
  * सर्व शाखा एकत्रित मासिक व्याज आकारणी (`AllBranches: true`) व व्हाउचर मॅपिंग फॉलबॅक.
* **व्हाउचर पासिंग व अन-पास सुधारणा (Voucher Passing & Unpass Fix):**
  * मंजूर व्हाउचर्स स्क्रीनवर अन-पास प्रक्रिया व त्रुटी हाताळणी सुधारणा.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (VPS Multi-App Master Patch v2.5.49):**
  * सर्व ९+ संस्थांसाठी एकत्रित मास्टर अपडेट पॅकेज उपलब्ध.

---

## 📅 [2026-10-13] - आवृत्ती v2.5.48 (Voucher Passing & Management Unpass Feature, Dual-Tab Pending/Approved Workspace, Atomic Scroll Revert, EOD Day-End Protection & VPS Master Patch v2.5.48)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **मंजूर व्हाउचर्स अन-पास (Revert to Pending) करण्याची अधिकृत सीबीएस सुविधा:**
  * व्हाउचर पासिंग, मंजुरी व व्यवस्थापन स्क्रीनवर पूर्वी पास केलेले व्हाउचर्स आवश्यकतेनुसार पुन्हा अन-पास (मंजुरी मागे घेणे / Revert Approval) करण्याची परिपूर्ण सुविधा समाविष्ट केली.
* **ड्युअल-टॅब कार्यक्षेत्र (Dual-Tab Pending vs Approved Workspace):**
  * **[⏳ प्रलंबित व्हाउचर्स (Pending Vouchers)]** आणि **[✅ मंजूर व्हाउचर्स / अन-पास सुविधा (Approved Vouchers)]** या दोन स्वतंत्र व सुस्पष्ट टॅबची निर्मिती.
  * वापरकर्ता कोणत्याही क्षणी मंजूर झालेल्या व्हाउचर्सच्या टॅबमध्ये जाऊन दिनांकनिहाय मंजूर नोंदी तपासू शकतो.
* **एकल व एकत्रित अन-पास (Single & Bulk Unpass with Confirmation):**
  * **एकल अन-पास:** प्रत्येक मंजूर व्हाउचरच्या ओळीसमोर `[↩️ अन-पास (Unpass)]` बटण, ज्यावर क्लिक केल्यास तपशीलवार पॉपअप उघडून कारण विचारले जाते.
  * **एकत्रित अन-पास:** एकापेक्षा जास्त व्हाउचर्स सिलेक्ट करून शीर्षकावरील `[↩️ निवडलेले अन-पास करा]` बटनाद्वारे एकत्रितपणे अन-पास करण्याची सोय.
* **सुरक्षित स्क्रॉल क्र. व खातावणी प्रभाव (Atomic Scroll & Financial Revert):**
  * व्हाउचर अन-पास होताच त्याचा `Status = 'Pending'`, `ScrollNo = null`, `ApprovedBy = null` व `ApprovedOn = null` तात्काळ रीसेट होतो.
  * यामुळे हे व्हाउचर पक्क्या रोजकीर्द (Official Daybook) आणि दिवसअखेर (EOD) प्रक्रियेतून सुरक्षितपणे वगळले जाते व मूळ फॉर्ममध्ये जाऊन त्यात संपादन किंवा दुरुस्ती करता येते.
  * दुरुस्तीनंतर जेव्हा हे व्हाउचर पुन्हा पास केले जाते, तेव्हा त्या दिवसाचा पुढील योग्य स्क्रॉल क्र. (Next Scroll No) आपोआप दिला जातो.
* **दिवसअखेर (EOD) सुरक्षितता व लॉक तपासणी (EOD Day-Closed Guard):**
  * ज्या तारखेचा दिवसअखेर (Branch Day-End Close) झालेला असेल, त्या बंद तारखेचे व्हाउचर प्रशासकीय परवानगीशिवाय अन-पास होण्यास १००% प्रतिबंध.
* **संपूर्ण कोअर बँकिंग सुरक्षा ऑडिट नोंद (Audit Trail Logging):**
  * प्रत्येक अन-पास केलेल्या व्हाउचरची `AuditLogs` टेबलमध्ये मूळ स्क्रॉल क्र., रक्कम, तारीख, अन-पास करण्याचे कारण, वापरकर्ता व वेळेसह अपरिवर्तनीय ऑडिट नोंद ठेवली जाते.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (VPS Multi-App Master Patch v2.5.48):**
  * सर्व ९+ संस्थांसाठी एकत्रित मास्टर अपडेट पॅकेज उपलब्ध.

---

## 📅 [2026-10-13] - आवृत्ती v2.5.47 (Voucher Passing Date-Wise Isolation, Strict Date Filter, Multi-Date Backlog Pills, Date-Scoped Metrics & VPS Master Patch v2.5.47)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **तारीख प्रविष्ट केल्यावर केवळ त्याच तारखेचे प्रलंबित व्हाउचर दिसणे (Strict Date-Wise Voucher Passing):**
  * व्हाउचर पासिंग, मंजुरी व व्यवस्थापन (`VoucherPosting.tsx`) स्क्रीनवर तारीख प्रविष्ट केल्यावर केवळ आणि केवळ त्याच तारखेचे प्रलंबित व्हाउचर्स स्क्रीनवर दिसण्याची अधिकृत कोअर बँकिंग कार्यपद्धती लागू केली.
* **तारीख निवड टूलबार व क्विक नेव्हिगेशन (Date Selection Toolbar & Quick Filters):**
  * स्क्रीनच्या शीर्षस्थानी कॅलेंडर आयकॉनसह तारीख निवडक (Date Picker) समाविष्ट.
  * **'आज (Today)'**, **'काल (Yesterday)'** आणि **'सर्व तारखा (All Dates)'** या एका-क्लिक क्विक बटणांची सुविधा.
* **बॅकलॉग चेतावणी व इतर प्रलंबित तारखा जंप पिल्स (Backlog Warning & Quick-Jump Pills):**
  * निवडलेल्या तारखेव्यतिरिक्त इतर कोणत्याही तारखांचे व्हाउचर प्रलंबित असल्यास स्पष्ट चेतावणी (उदा. 'इतर तारखांचे एकूण १२ व्हाउचर मंजुरीसाठी प्रलंबित आहेत').
  * प्रत्येक प्रलंबित तारखेचा बॅज (उदा. `[12/10/2026 (5)]`, `[10/10/2026 (2)]`) थेट दृश्यमान; क्लिक करताच त्या तारखेचे व्हाउचर्स तात्काळ फिल्टर होतात.
* **दिवसानिहाय सारांश व मेट्रिक्स ताळमेळ (Date-Scoped Metrics):**
  * एकूण प्रलंबित व्हाउचर्स, रिसिप्ट्स, पेमेंट्स आणि एकूण प्रलंबित रक्कम आता निवडलेल्या तारखेनुसारच अचूक मोजली जाते.
* **सुरक्षित 'सर्व व्हाउचर्स निवडा' (Secure Select All):**
  * 'सर्व व्हाउचर्स निवडा' वर टिक केल्यास केवळ स्क्रीनवर सक्रिय असलेल्या तारखेचेच व्हाउचर निवडले जातात, ज्यामुळे इतर तारखांचे व्हाउचर चुकून पोस्ट किंवा डिलीट होणे १००% रोखले गेले.
* **बॅकएंड क्वेरी ऑप्टिमायझेशन (Backend Query Filter):**
  * `VoucherPostingController.cs` मधील `GetUnpostedVouchers` मध्ये `voucherDate` आणि `allDates` पॅरामीटर्स जोडून डेटाबेस पातळीवरही दिनांक अलगीकरण पूर्ण केले.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (VPS Multi-App Master Patch v2.5.47):**
  * सर्व ९+ संस्थांसाठी एकत्रित मास्टर अपडेट पॅकेज उपलब्ध.

---

## 📅 [2026-10-13] - आवृत्ती v2.5.46 (FD Outstanding Report Legacy Accrued Interest Double-Counting Fix, Capitalization Math Alignment & VPS Multi-App Master Patch v2.5.46)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **मुदत ठेव बाकी अहवाल मुद्दल + पोस्ट व्याज दुप्पट मोजणी दोष निराकरण (Double-Counting Fix):**
  * मुदत ठेव बाकी अहवाल (FD Reports -> Outstanding / मुदत ठेव बाकी अहवाल) मध्ये 'मुद्दल + पोस्ट व्याज (₹)' कॉलममध्ये जुने साचलेले व्याज (उदा. ₹ २७,७७३/-) दोनदा जुळून चुकीची फुगलेली शिल्लक (उदा. ₹ १,०५,५४६/-) दिसत होती.
* **मूळ कारण व गणितीय ताळमेळ (Root Cause & Math Alignment):**
  * मायग्रेशनच्या वेळी `FdTransactions` मध्ये `TransactionType = 'Accrual'` ने `LegacyAccruedInt` आधीच सेव्ह असताना `ReportsController.cs` (Line 5480) मधील `GetFdOutstandingReport` मध्ये पुन्हा `systemAccrued + f.LegacyAccruedInt` जोडल्याने जुने व्याज दोनदा (२७,७७३ + २७,७७३ = ५५,५४६) मोजले जात होते.
  * येथे सुरक्षित `Math.Max(txSum, logSum + f.LegacyAccruedInt)` पद्धत लागू करून ५०,००० मुद्दलावर अचूक **२७,७७३** व्याज व **७७,७७३** मुद्दल + पोस्ट व्याज बाकी प्रदर्शित केली.
* **खातावणी व तिमाही चक्रवाढ व्याज गणना सुरक्षितता (Member Ledger & Accrual Engine):**
  * `ReportsController.cs` (`GetFdMemberLedgerReport`) आणि `FdAccountsController.cs` (`GetMemberFdLedger`, `CalculateInterest`, `PostQuarterlyAccrual`) या सर्व ठिकाणी सुरक्षित `Math.Max(txAccrualSum, acc.LegacyAccruedInt)` पद्धत लागू केली.
  * यामुळे भविष्यातील तिमाही चक्रवाढ भांडवलीकरणात (Quarterly Compounding Capitalization) अथवा खातावणी अहवालातही जुने व्याज दुप्पट मोजले जाण्याचा धोका १००% नाहीसा झाला.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (VPS Multi-App Master Patch v2.5.46):**
  * सर्व ९+ संस्थांसाठी एकत्रित मास्टर अपडेट पॅकेज उपलब्ध.

---

## 📅 [2026-10-13] - आवृत्ती v2.5.45 (FD Member Ledger Report Narration Marathi Font Restoration, Full Unicode N'' Healing Across All Sanstha Databases, Backend In-Memory Fallback & UI Sanitizer v2.5.45)

### 🌟 प्रमुख वैशिष्ट्ये व निराकरण (Key Highlights)
* **मुदत ठेव खातावणी विवरणपत्र तपशील (Narration) मधील मराठी फॉन्ट त्रुटीचे संपूर्ण निराकरण:**
  * मुदत ठेव अहवाल (FD Reports -> MemberLedger / मुदत ठेव खातावणी विवरणपत्र) मध्ये तपशील (Narration) कॉलममध्ये `???? ??? ?????? ?????? ???????? (FD Opening Balance Migration)...` असा प्रश्नचिन्हांचा मजकूर दिसण्याचा दोष १००% दूर करण्यात आला.
* **मूळ कारण व कायमस्वरूपी युनिकोड (N'') दुरुस्ती (Root Cause Fix):**
  * जुन्या स्थलांतर स्क्रिप्ट्स (`tools/heal_migrated_fd_account_numbers.sql`, `tools/FD_14Digit_CBS_Account_Standardization.sql`) मध्ये मराठी टेक्स्ट स्ट्रिंगच्या आधी `N` युनिकोड प्रीफिक्स नसल्यामुळे डेटाबेसमध्ये प्रश्नचिन्ह (`?`) सेव्ह झाले होते. सर्व संबंधित SQL स्क्रिप्ट्समध्ये `N'मुदत ठेव...'` युनिकोड प्रीफिक्स लावून कायमचे सुरक्षित केले.
* **सर्व १३ संस्था डेटाबेसमध्ये १-क्लिक थेट स्वयं-दुरुस्ती (Direct Database Unicode Healing):**
  * `tools/heal_corrupted_fd_voucher_narrations.sql` आणि `tools/apply_fd_narration_heal_all_sansthas.ps1` तयार करून सर्व १३ संस्था डेटाबेसवर रन करण्यात आले.
  * **१,४३७ हून अधिक व्हाउचर्सचे तपशील** एका क्लिकवर शुद्ध मराठीत (`मुदत ठेव आरंभिक शिल्लक स्थलांतर (FD Opening Balance Migration): 001-xxx... (जुना पावती क्र. ...)`) पूर्ववत पुनर्स्थापित केले गेले.
* **बॅकएंड सी-शार्प इन-मेमरी ऑटो-हील फॉलबॅक (Backend C# Auto-Heal):**
  * `ReportsController.cs` (`GetFdMemberLedgerReport`) आणि `FdAccountsController.cs` (`GetMemberFdLedger`) मध्ये इन-मेमरी सेफगार्ड लागू; भविष्यात कोणत्याही कारणाने डेटामध्ये `????` आढळल्यास API लेव्हलवरच तो स्वच्छ मराठी मजकुरात रूपांतरित होऊन फ्रंटएंडला पाठवला जातो.
* **फ्रंटएंड अहवाल व एक्सेल एक्सपोर्ट सॅनिटायझर (Frontend UI & Excel Sanitizer):**
  * `client/src/components/FdReports.tsx` मध्ये `formatSafeFdNarration` फलन समाविष्ट करून स्क्रीनवरील खातावणी तक्ता आणि डाऊनलोड होणाऱ्या एक्सेल (.xlsx) फाईलमध्ये सर्व व्हाउचर्सचा तपशील नेहमी सुवाच्य मराठीत दिसण्याची हमी.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (VPS Multi-App Master Patch v2.5.45):**
  * सर्व ९+ संस्थांसाठी एकत्रित मास्टर अपडेट पॅकेज उपलब्ध.

---

## 📅 [2026-10-13] - आवृत्ती v2.5.44 (Multi-Branch Isolation, Cross-Branch Loan Collection & Cash Drawer Alignment, FD Lien Protection & Security Hardening v2.5.44)

### 🌟 प्रमुख वैशिष्ट्ये व सुधारणा (Key Highlights)
* **बहु-शाखा स्वायत्तता व सुरक्षा अलगीकरण (Multi-Branch Isolation & Security Scoping):**
  * कर्ज मागणी अर्ज (`LoanApplications`), कर्ज वाटप (`LoanDisbursements`) आणि कर्ज वसुली (`LoanCollections`) या सर्व मॉड्यूल्समध्ये `BranchID` सक्तीचे करून शाखास्तरीय अलगीकरण लागू.
  * शाखा कर्मचाऱ्यांना केवळ त्यांच्या स्वतःच्या शाखेचे कर्ज अर्ज, वाटप व वसुली पाहण्याची, संपादन व डिलीट करण्याची परवानगी; मुख्यालयातील (Head Office / Admin) वापरकर्त्यांनाच संपूर्ण संस्थेचे अधिकार.
* **काऊंटर रोख ताळमेळ व क्रॉस-शाखा कर्ज वसुली (Collecting Branch Cash Drawer Alignment & Cross-Branch Recovery):**
  * कर्ज वसुली पावती ज्या शाखेच्या काऊंटरवर जमा होते, त्याच शाखेच्या `BranchID` नुसार आर्थिक व्हाउचर (`Vouchers`) तयार होणे; ज्यामुळे त्या शाखेच्या दैनंदिनी (Daybook) व रोख नोंदवहीत प्रत्यक्ष जमा झालेली रोख शिल्लक अचूक दर्शवली जाते.
  * पर-शाखेच्या कर्जदारासाठी क्रॉस-शाखा वसुली (`IsCrossBranch`, `HomeBranchID`, `HomeBranchName`) सुविधा; पावती व अहवालात मूळ शाखा व जमा शाखा स्पष्ट दर्शवणे.
* **शाखा रोख खाते व दैनंदिनी ताळमेळ अचूकता (Branch-Specific Cash Ledger & Daybook Alignment):**
  * `CashLedgerHelper` द्वारे मुख्य शाखा (मेन, H.O.) व इतर शाखांची रोख खाती अचूक शोधून दैनंदिनी (Daybook), Daybook Summary व कॅश बुक अहवालांमध्ये शाखा रोख शिल्लक ताळमेळ सुनिश्चित.
  * व्हाउचर्स नसलेली थेट कर्ज वाटप व वसुली ट्रान्झॅक्शन्स प्रत्यक्ष ऑपरेटिंग शाखेनुसार अचूक फिल्टर होणे.
* **मुदत ठेव तारण संरक्षण व नूतनीकरण निर्बंध (FD Lien Protection & Renewal Guard):**
  * कर्ज खात्यावर तारण बोजा (`IsLienMarked = true`) असलेल्या मुदत ठेव पावत्यांचे मॅन्युअल अथवा स्वयंचलित नूतनीकरण (Auto-Renewal) पूर्णतः प्रतिबंधित.
  * मुदत ठेव नूतनीकरण केवळ खात्याच्या मूळ शाखेतून (Home Branch) अथवा मुख्य कार्यालयातूनच करण्याची सुरक्षा मर्यादा.
  * मुदत ठेव त्रैमासिक व्याज तरतूद (FD Accrual Posting) केवळ निवडलेल्या शाखेपुरती मर्यादित करून पर-शाखा खाती पोस्ट होण्यावर कडक निर्बंध.
* **डेटाबेस स्कीमा स्वयं-अद्ययावतीकरण व मायग्रेशन स्क्रिप्ट्स (Startup Auto-Migration & SQL Tools):**
  * `Program.cs` मध्ये `LoanApplications`, `LoanCollections`, `LoanDisbursements` वर `BranchID`, `HomeBranchID`, `IsCrossBranch` कॉलम तपासणी व इंडेक्स निर्मितीची स्वयंचलित सुविधा.
  * `tools/add_branch_id_to_loan_applications.sql`, `tools/add_branch_id_to_loan_collections.sql`, `tools/add_branch_id_to_loan_disbursements.sql`, `tools/align_daybook_voucher_branches.sql` स्क्रिप्ट्स समाविष्ट.

---

## 📅 [2026-10-12] - आवृत्ती v2.5.43 (User Management & Security Master Hardening, Backdoor Elimination, Self-Service & Mandatory First-Login Password Change, Admin Audit Logging & Role Authorization Enforced v2.5.43)

### 🌟 प्रमुख वैशिष्ट्ये व सुरक्षा सुधारणा (Key Highlights)
* **ॲडमिन बॅकडोअर व हार्डकोडेड बायपास पूर्णतः बंद (Admin Backdoor & Hardcoded Bypass Elimination):**
  * `AuthController.cs` मधील `"admin123"`, `"admin"` सारखे अनधिकृत पासवर्ड्स व आपोआप खाते अनलॉक होणे पूर्णतः काढून टाकले.
  * केवळ `BCrypt.Net` सुरक्षित हॅश पडताळणी सक्तीची; सलग ३ चुकीच्या प्रयत्नांनंतर खाते कडकपणे लॉक होणे.
* **UsersController वर रोल-आधारित ऑथोरायझेशन ([Authorize(Roles = 'Admin,HO_Manager,HO Manager')]):**
  * विना-टोकन किंवा सामान्य कर्मचाऱ्यांद्वारे युजर व्यवस्थापन, पासवर्ड रिसेट व खाते अनलॉकिंगची छेडछाड पूर्णतः ब्लॉक.
  * क्लायंट `UserMaster.tsx` मधील सर्व विनंत्यांमध्ये Bearer Token पडताळणी व अनधिकृत विनंत्यांवर स्पष्ट मराठी संदेश.
* **कर्मचाऱ्यांसाठी स्वयं-सेवा व पहिल्या लॉगिनवेळी अनिवार्य पासवर्ड बदल (Self-Service & Mandatory Password Change Modal):**
  * प्रत्येक कर्मचाऱ्याला टॉप हेडरमधील 'पासवर्ड बदला' बटणावरून स्वतःचा पासवर्ड बदलण्याची सुविधा.
  * नवीन युजर किंवा पासवर्ड रिसेट झालेल्या खात्यांसाठी पहिल्या लॉगिनला अनिवार्य पासवर्ड बदलल्याशिवाय डॅशबोर्ड ब्लॉक राहण्याची सुरक्षा तरतूद.
  * पासवर्ड काठिण्य निकष: किमान ८ अक्षरे, किमान १ मोठा वर्ण (A-Z), १ लहान वर्ण (a-z), १ अंक (0-9) व १ विशेष चिन्ह (@, #, $, इ.).
* **प्रशासकीय कृतींचे ऑडिट लॉगिंग (Admin Action Audit Trail):**
  * युजर तयार करणे, अद्ययावत करणे, पासवर्ड रिसेट करणे व खाते लॉक/अनलॉक करणे या प्रत्येक हालचालीची `AuditLogs` मध्ये प्रशासकाचे युझरनेम, IP व वेळेसह नोंद.

---

## 📅 [2026-10-12] - आवृत्ती v2.5.42 (Loan Opening Balance Manual Interest Entry & Edit Fix, Premium Modern Sidebar Scrollbar & Codebase TypeScript Type Strictness v2.5.42)

### 🌟 प्रमुख वैशिष्ट्ये व सुधारणा (Key Highlights)
* **कर्ज आरंभिक शिल्लक - चालू येणे व्याज मॅन्युअल नोंदणी व संपादन (Loan Opening Balance Manual Interest Entry & Edit Fix):**
  * चालू येणे व्याज बाकी (Interest) चे स्वयंचलित बॅकग्राउंड ओव्हरराईट (`useEffect`) पूर्णपणे काढून १००% मॅन्युअल संपादन सुविधा.
  * आधी सेव्ह केलेली नोंद एडिट करताना मूळ व्याज सुरक्षित राहणे व इच्छेनुसार बदल करून डेटाबेस व मुख्य खतावणीत (GL) अचूक जतन होणे.
  * ऑटो-कॅल्क्युलेशन केवळ आणि केवळ '⚡ स्वयं गणना' बटनावर क्लिक केल्यासच ऐच्छिकरीत्या उपलब्ध.
* **अल्ट्रा-स्लीक मॉडर्न साईडबार स्क्रोलबार (Premium Ultra-Sleek Modern Sidebar Scrollbar & Theme Accents):**
  * ५px स्लिम गोलाकार पिल डिझाईन, पारदर्शक ट्रॅक आणि हॉव्हरवर एमराल्ड-टील ग्रेडियंट ग्लो इफेक्ट.
  * क्रॉस-ब्राउझर सुसंगतता (Chrome, Edge, Safari, Firefox).
* **TypeScript प्रकार शुद्धीकरण व कोडबेस स्थिरीकरण (TypeScript Type Strictness & Zero-Error Codebase):**
  * `AgentDayBookMaster.tsx`, `PigmyClosureMaster.tsx`, `PigmyCollectionMaster.tsx`, `FdWithdrawalMaturity.tsx`, `RdInstallmentCollection.tsx`, `SavingTransactionEntry.tsx`, `ShareWithdrawal.tsx`, `LoanCollectionMaster.tsx` मधील सर्व प्रकारच्या टाइप मिसमॅच, मिसिंग इंपोर्ट्स व एरर्सचे संपूर्ण निराकरण.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (VPS Multi-App Master Patch v2.5.42).**

---

## 📅 [2026-10-11] - आवृत्ती v2.5.38 (Swanidhi Rule 35, Voucher Passing Form View Checker, Agent Day Book 3-Date Remittance & VPS Multi-App Master Patch)

### 🌟 प्रमुख वैशिष्ट्ये व सुधारणा (Key Highlights)
* **महाराष्ट्र शासन परिपत्रक नियम ३५ स्वनिधी अहवाल (Swanidhi Rule 35 Report Engine & Ledger Mappings):**
  * वसूल भाग भांडवल (Paid-up Capital), वैधानिक राखीव निधी (Statutory Reserve), इमारत निधी (Building Fund), मुक्त व विकास निधी (Free & Development Reserves), उत्तम जिंदगी तरतूद (Standard Asset Provision) चे अचूक एकत्रीकरण आणि संचित तोटा व बाह्य देयता वजा करून निव्वळ स्वनिधी (Net Swanidhi / Owned Funds) गणन.
  * स्वनिधीच्या १० पट (किंवा संस्था नियमानुसार) कमाल कर्ज उभारणी मर्यादा (Total Borrowing Capacity) व प्रत्यक्ष घेतलेली कर्जे व ठेवी यांच्याशी तुलना.
  * गेल्या ३ वर्षांच्या लाभांश दराची सरासरी (3-Year Dividend Average) काढून स्वनिधी गणना.
  * डायनॅमिक लेजर मॅपिंग मोडल (Dynamic Swanidhi Ledger Mappings) द्वारे संस्था गरजेनुसार कोणतेही लेजर स्वनिधीत जोडणे किंवा वगळणे (`ExcludeFromRule35Swanidhi`).
* **सर्व २०+ ट्रान्झॅक्शन मॉड्यूल्समध्ये व्हाउचर्स मंजुरी फॉर्म व्ह्यू चेकर (Universal Voucher Passing Form View Checker):**
  * व्हाउचर्स मंजुरी स्क्रीनवरून (Voucher Passing) प्रत्येक प्रकारच्या व्हाउचरसाठी (बचत, ठेवी, कर्ज वाटप, कर्ज वसुली, पिग्मी, आरडी, लॉकर, मालमत्ता खरेदी, शेअर हस्तांतरण) थेट संबंधित मूळ फॉर्म व्ह्यू उघडून तपशील तपासण्याची व मंजुरी देण्याची सुविधा.
* **पिग्मी एजंट दैनंदिनी ३-दिनांक ताळमेळ (Pigmy Agent Day Book 3-Date Remittance & Strict Date Reconciliation):**
  * संकलन दिनांक (`CollectionDateFrom` / `CollectionDateTo`) आणि प्रत्यक्ष बँक जमा दिनांक यांचे स्वतंत्र व्यवस्थापन व डुप्लिकेट रोख जमा प्रतिबंध.
* **सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (VPS Multi-App Master Patch v2.5.38):**
  * सर्व संस्थांसाठी (Testing, Testing1, Template, Bambavade, Padawalwadi, Yadravkar, RITEMP, Sahyadri Bambavade, Sahyadri Karmachari) १-क्लिक सुरक्षित रोलआउट, रिव्हर्स पॅच इंजिन आणि डेटाबेस स्कीमा स्वयं-सक्षमीकरण.

---

## 📅 [2026-09-15] - आवृत्ती v2.4.9 (Share Opening Balance & Member Code Alignment Master Patch)

### 🌟 प्रमुख वैशिष्ट्ये व सुधारणा (Key Highlights)
* **शेअर्स व सभासद कोड अचूक सिंक (Share Opening Balance & Member Code Alignment):**
  * शेअर्स वाटप झालेल्या सर्व अधिकृत सभासदांना `MEM0001` ते `MEMxxxx` सलग कोड वाटप सुनिश्चित करणे.
  * डेटाबेसमधील सभासदांचा कोड सुटला असल्यास तो स्वयं-दुरुस्त करण्यासाठी `ResequenceMemberCodes` सुधारणा व सेव्ह/अपडेट करताना स्वयंचलित कोड पर्सिस्टन्स.
  * खातेदार ड्रॉपडाऊन (`MemberSearchSelect`): शेअर्सधारक नसलेल्या शुद्ध ग्राहकांना फक्त निळा `[CIFxxxxxx]` बॅज दिसणे व शेअर्स वाटप झालेल्यांना हिरवा `[MEMxxxx]` बॅज दिसण्याचे दुहेरी सुरक्षा लॉजिक.
* **शेअर्स ओपनिंग बॅलन्स फॉर्म आधुनिकीकरण (CBS Layout Redesign):**
  * ५-भागीय सुटसुटीत रचना (खातेदार निवड, सभासद तपशील, शेअर्स प्रमाण, शेअर्स रक्कम गणन, अतिरिक्त माहिती).
  * रिअल-टाईम एकूण शेअर्स भांडवल लाइव्ह कार्ड आणि स्टेटस बॅजेस.
* **कर्ज हप्ता वेळापत्रक व वसुली एकत्रीकरण (Unified Loan Schedule & Collection):**
  * `LoanScheduleGenerator` व `LoanCollectionsController` मधील हप्ता गणन आणि दंडात्मक व्याज ताळमेळ.
* **युनिव्हर्सल व्हीपीएस मल्टी-ॲप पॅच (Master VPS Multi-App Patch v2.4.9):**
  * सर्व ६ संस्थांसाठी (Testing, Template, Padawalwadi, Bambavade, Yadravkar, RITEMP) १-क्लिक सुरक्षित रोलआउट व स्वयंचलित डेटाबेस स्कीमा दुरुस्ती.

---

## 📅 [2026-09-08] - आवृत्ती v2.4.5 (Core Banking CIF-First Master Patch)

### 🌟 प्रमुख वैशिष्ट्ये व वास्तुशास्त्रीय सुधारणा (Architectural Highlights)
* **मुदत ठेव (Fixed Deposit - FD) १००% Pure Customer-First (CIF-First):**
  * `FdAccounts` टेबलमधून `MemberID` कॉलम, त्याचा फॉरेन की कन्स्ट्रेंट आणि इंडेक्स कायमस्वरूपी निष्कासित (Dropped).
  * `CustomerID` अनिवार्य (`INT NOT NULL`) करून त्यावर क्लस्टर्ड/नॉन-क्लस्टर्ड ऑप्टिमाईज्ड इंडेक्स लागू.
  * मुदत ठेव उघडणे, मुदत समाप्ती (Maturity), मुदतपूर्व बंद (Premature Close) आणि नूतनीकरण (Renewal) या सर्व आर्थिक व्हाउचर्समध्ये `VoucherDetail.CustomerID = account.CustomerID` सब-लेजर टॅगिंग लागू.
  * मुदत ठेव नूतनीकरण करताना (Renewal) नवीन खात्यात ग्राहकाचा `CustomerID` वारसा (Inheritance) कायम राहणारा बग कायमस्वरूपी दुरुस्त.

* **आवर्ती ठेव (Recurring Deposit - RD) १००% Pure Customer-First (CIF-First):**
  * `RdAccounts` टेबलमधून `MemberID` कॉलम व संबंधित फॉरेन की कन्स्ट्रेंट्स पूर्णपणे वगळले.
  * `CustomerID` अनिवार्य (`INT NOT NULL`) आणि संयुक्त खातेदारासाठी `JointCustomerID INT NULL` समाविष्ट.
  * आरडी हप्ता संकलन (Installment Collection), दंड (Penalty), त्रैमासिक व्याज चक्रवाढ तरतूद (Accrual), मुदतपूर्व बंद (Premature) आणि आरडी ते एफडी नूतनीकरण (RD to FD Renewal) सर्व व्यवहारांत आंतरराष्ट्रीय कोअर बँकिंग मानकांनुसार परिपूर्ण **Dr == Cr दुहेरी नोंद (Double-Entry Balance)** स्थापित.
  * मुदतपूर्व आरडी बंद करताना न तरतूद केलेले व्याज (Unaccrued Interest Difference) व्याज खर्च खात्याला डेबीट देऊन व्हाउचर संतुलित केले.

* **क्रॉस-मॉड्यूल सुसंगतता (Cross-Module Integrity):**
  * `CustomersController`, `MembersController`, `ShareAccountsController`, `ReportsController` (Customer 360) आणि `NotificationEngineService` या सर्व ६ सेवांमध्ये थेट `CustomerID` आधारित शोध व लिंकेज.
  * सभासदत्व (Membership) हे केवळ कायदेशीर/मतदान हक्कांपुरते मर्यादित ठेवून आर्थिक खाती थेट ग्राहकाशी जोडली.

* **डेटाबेस स्वयं-सक्षमीकरण व पॅचिंग (Startup Auto-Migration & VPS Patch):**
  * [Program.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Program.cs) आणि `tools/master_vps_update_schema.sql` मध्ये स्वयंचलित स्कीमा मायग्रेशन जोडले; ज्यामुळे कोणत्याही शाखेचा सर्व्हर सुरू होताच स्कीमा आपोआप अपडेट होतो.
  * **३४ पैकी ३४ स्वयंचलित QA चाचण्या (100% Pass Rate)** यशस्वी.
  * 1-Click Multi-App Master VPS Patch `SmartBanking_VPS_Multi_App_Master_Patch_v2.4.5.zip` तयार करण्यात आला.

---

## 📅 [2026-09-07] - आवृत्ती v2.4.4 (Pigmy CIF & Session Security)

* **पिग्मी (Pigmy / Daily Collection) १००% Pure CIF-First स्थलांतर:**
  * पिग्मी खात्यांमधील `MemberID` कॉलम पूर्णपणे वगळला; दैनंदिन संकलन, एजंट ऑनबोर्डिंग व खाते उघडणे थेट `CustomerID` वर आधारित.
  * सर्व व्हाउचर्समध्ये सब-लेजर `CustomerID` टॅगिंग.
* **बँकिंग सत्र सुरक्षा (Banking Session Security Policy):**
  * ब्राऊझर बंद होताच युझरचे सत्र तात्काळ संपुष्टात येणे (`sessionStorage` स्थलांतर).
  * क्रॉस-टॅब सुरक्षा व अनधिकृत वापर प्रतिबंध.
* **लॉगिन सुरक्षा सुधारणा:**
  * लॉगिन फॉर्म उघडल्यावर पासवर्ड फील्ड स्वयंचलितपणे रिकामी ठेवणे आणि ब्राऊझर ऑटो-फिल प्रतिबंध.
* **ग्राहक नोंदणी मास्टर (Customer / CIF Master):**
  * `CIF000000` व `CustomerID #0` त्रुटींचे कायमस्वरूपी निवारण व सेल्फ-हीलिंग ऑटो-रिपेअर.
  * Customer व Member Master मधील PUT API संपादन एरर्सचे निराकरण.

---

## 📅 [2026-09-05] - आवृत्ती v2.4.2 / v2.4.3 (Share Rollback & Pure Customer Integrity)

* **शेअर्स व सभासद अणू रोलबॅक (Atomic Rollback):**
  * शेअर्स ओपनिंग बॅलन्स डिलीट केल्यास संबंधित `MemberID` आणि `MemberCode` स्वयंचलितपणे -1 रोलबॅक करणे.
  * शुद्ध ग्राहकांचा (Pure Customers) `MemberCode` जोपर्यंत शेअर्स वाटप होत नाही तोपर्यंत `NULL` ठेवणे.
* **कॅश व्यवस्थापन व डिनॉमिनेशन ट्रॅकिंग:**
  * तिजोरी व काउंटर कॅशिअर रोख मर्यादा, डिनॉमिनेशन नोंदी व पडताळणी सुधारणा.

---

## 📅 [2026-09-04] - आवृत्ती v2.4.1 (Universal Multi-App Engine)

* **युनिव्हर्सल कस्टमर-टू-मेंबर सिंक:**
  * बांबवडे व सर्व व्हीपीएस डेटाबेसेससाठी स्वयंचलित डेटा सिंक व दुरुस्ती.
* **1-क्लिक व्हीपीएस पॅच बिल्डर:**
  * सर्व संस्थांसाठी एकत्रित पॅकेजिंग व उपयोजन (Deployment) प्रणाली.
