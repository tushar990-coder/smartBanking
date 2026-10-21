# 📋 Smart Banking - Agent Doorstep Multi-Collection & Customer Privacy Architecture Specification
**दस्तऐवज नाव:** `AGENT_DOORSTEP_MULTI_COLLECTION_AND_PRIVACY_SPECIFICATION.md`  
**मॉड्युल:** Pigmy Agent Doorstep Banking (Pigmy + Saving + Loan EMI + RD Multi-Collection with Customer Privacy Matrix, Commission Management & Impact Analysis)  
**तारीख:** १९ ऑक्टोबर २०२६ (अद्ययावत)  
**स्थिती:** अंतिम आर्किटेक्चर व डिझाइन तपशील (Final Architecture & Implementation Plan)

---

## 📑 अनुक्रमणिका (Table of Contents)
1. [१. उद्दिष्ट व पार्श्वभूमी (Executive Summary)](#१-उद्दिष्ट-व-पार्श्वभूमी-executive-summary)
2. [२. CBS डोअरस्टेप बँकिंग आर्किटेक्चर (Core CBS Doorstep Banking Architecture)](#२-cbs-डोअरस्टेप-बँकिंग-आर्किटेक्चर-core-cbs-doorstep-banking-architecture)
3. [३. संपूर्ण कार्यप्रवाह सोप्या शब्दांत (The Complete End-to-End Workflow in Simple Words)](#३-संपूर्ण-कार्यप्रवाह-सोप्या-शब्दांत-the-complete-end-to-end-workflow-in-simple-words)
4. [४. ग्राहक गोपनीयता व परवानग्या सेटिंग्ज (Customer Privacy & Permission Matrix)](#४-ग्राहक-गोपनीयता-व-परवानग्या-सेटिंग्ज-customer-privacy--permission-matrix)
5. [५. डेटाबेस बदल व टेबल्सचा संपूर्ण तक्ता (Complete Database Schema & Tables Matrix)](#५-डेटाबेस-बदल-व-टेबल्सचा-संपूर्ण-तक्ता-complete-database-schema--tables-matrix)
6. [६. उत्पादननिहाय कमिशन व इन्सेंटिव्ह मॉडेल (Product-Wise Commission Architecture)](#६-उत्पादननिहाय-कमिशन-व-इन्सेंटिव्ह-मॉडेल-product-wise-commission-architecture)
7. [७. कमिशन कुठे सेट करायचे? (Where to Set Module Commission in Web CBS)](#७-कमिशन-कुठे-सेट-करायचे-where-to-set-module-commission-in-web-cbs)
8. [८. ग्राहकानुसार मॉड्युल परवानग्या कुठे सेट करायच्या? (Where to Configure Customer Permissions in Web CBS)](#८-ग्राहकानुसार-मॉड्युल-परवानग्या-कुठे-सेट-करायच्या-where-to-configure-customer-permissions-in-web-cbs)
9. [९. सिस्टीम प्रभाव विश्लेषण अहवाल (System Impact Analysis Report - 0% Disruption)](#९-सिस्टीम-प्रभाव-विश्लेषण-अहवाल-system-impact-analysis-report---0-disruption)
10. [१०. 'NULL' व भविष्यातील सुरक्षितता धोरण (Forward-Compatible & Nullable Strategy)](#१०-null-व-भविष्यातील-सुरक्षितता-धोरण-forward-compatible--nullable-strategy)
11. [११. रेस्ट APIs तपशील (REST API Specifications)](#११-रेस्ट-apis-तपशील-rest-api-specifications)
12. [१२. मोबाईल ॲप इंटरफेस व फ्लो (Android Mobile App Flow - `pat App`)](#१२-मोबाईल-ॲप-इंटरफेस-व-फ्लो-android-mobile-app-flow---pat-app)
13. [१३. एजंट डे-बुक व एकत्रित रोख भरणा (Unified Day-Book & Cash Remittance)](#१३-एजंट-डे-बुक-व-एकत्रित-रोख-भरणा-unified-day-book--cash-remittance)
14. [१४. टप्प्याटप्प्याने अंमलबजावणी आराखडा (Step-by-Step Implementation Roadmap)](#१४-टप्प्याटप्प्याने-अंमलबजावणी-आराखडा-step-by-step-implementation-roadmap)

---

## १. उद्दिष्ट व पार्श्वभूमी (Executive Summary)

### सध्याची अडचण (Current Limitation):
सध्याच्या `PigmyMobileApiController.cs` आणि मोबाईल ॲपमध्ये एजंट **केवळ दैनिक पिग्मी (Daily Pigmy Deposit)** गोळा करू शकतो. परंतु प्रत्यक्षात:
* ग्राहक एकाच वेळी एजंटकडे बचत ठेव (Saving Deposit), आवर्ती ठेव (RD Installment) आणि कर्ज हप्ता (Loan EMI) भरण्याची मागणी करतात.
* कोणत्याही एजंटला बँकेचे कोणतेही कर्ज किंवा खाती **रॅन्डमली गोळा करण्याची परवानगी देणे बँकिंग सुरक्षेचा व गोपनीयतेचा भंग** ठरेल.
* अनेक ग्राहकांना आपली कर्जे (Loans) किंवा मुदत ठेवी (FD/RD) गल्लीत फिरणाऱ्या एजंटला दाखवणे पसंत नसते (सामाजिक प्रतिष्ठा व आर्थिक गोपनीयता).
* कर्जावर पिग्मीप्रमाणे सरसकट ३-४% कमिशन दिले तर पतसंस्थेचे मोठे नुकसान होईल; त्यामुळे कर्जावर नाममात्र इन्सेंटिव्ह किंवा स्वतंत्र नियम असणे आवश्यक आहे.

### प्रस्तावित उपाय (The Proposed Solution):
शाखा व्यवस्थापकाला वेब CBS मध्ये **"ग्राहक डोअरस्टेप वसुली सेटिंग्ज" (Customer Doorstep Banking Permissions Matrix)** उपलब्ध करून देणे. व्यवस्थापक प्रत्येक ग्राहकाच्या खात्यानुसार ठरवेल:
1. कोणत्या खात्याची वसुली एजंट करू शकतो (Allowed Products: Pigmy / Saving / Loan / RD).
2. कोणती खाती एजंटच्या मोबाईलवर **संपूर्णपणे अदृश्य (Hidden/Private)** राहतील.
3. कोणत्या खात्यासाठी कोणता विशिष्ट एजंट जबाबदार असेल.
4. कमिशन सेटिंग्जमध्ये `ProductType` जोडून पिग्मी, कर्ज आणि आरडीचे कमिशन नियम स्वतंत्र ठेवणे (आणि सुरुवातीला कर्जाचे कमिशन `NULL` ठेवून चालू सिस्टीम सुरक्षित ठेवणे).

---

## २. CBS डोअरस्टेप बँकिंग आर्किटेक्चर (Core CBS Doorstep Banking Architecture)

```
                            [बँक शाखा व्यवस्थापक (Branch Manager)]
                                          │
                   [वेब CBS: ग्राहक डोअरस्टेप परवानग्या सेट करणे]
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 ▼                                                 ▼
      [परवानगी दिलेली खाती (Allowed)]                 [खाजगी / प्रतिबंधित खाती (Blocked)]
       - पिग्मी खाते: PGM-101 (ON)                     - कर्ज खाते: LN-502 (OFF - ग्राहक स्वतः भरेल)
       - बचत खाते: SB-204   (ON)                     - मुदत ठेव: FD-801 (OFF - काउंटर व्यवहार)
                 │                                                 │
                 ▼                                                 ▼
      [एजंट मोबाईल ॲपवर दिसणार]                         [एजंट मोबाईल ॲपवर १००% अदृश्य]
     (Pigmy Card + Saving Card)                        (कोणताही डेटा लीक होणार नाही)
```

### मूलभूत कोर बँकिंग नियम (Core Banking Rules):
1. **एकाच CIF चे एकाधिक खाते व्यवस्थापन (Unified CIF Model):**
   * ग्राहकाचा CIF क्रमांक एकच राहील. त्या अंतर्गत पिग्मी, सेव्हिंग, लोन आणि आरडी मॅप असतील.
2. **एजंट रोख शिल्लक नियंत्रण (Agent Cash-in-Hand Float):**
   * एजंटने गोळा केलेले पैसे (पिग्मी असो, बचत असो की कर्ज) हे बँकेच्या तिजोरीत जमा होईपर्यंत **"एजंट रोख शिल्लक" (Agent Cash in Hand)** म्हणून नोंदवले जातील.
   * `AgentLockService` सर्व प्रकारच्या वसुलीची एकत्रित बेरीज करेल. जर एकूण रोख रक्कम ठरवून दिलेल्या मर्यादेपेक्षा (उदा. ₹ २०,०००) जास्त झाली, तर एजंट लॉक होईल.
3. **कर्ज वसुली प्राधान्य नियम (Loan Waterfall Rule):**
   * एजंटने आणलेला कर्ज हप्ता थेट मुद्दलात जमा न होता विद्यमान Waterfall प्रमाणे वाटप होईल:
     1. थकीत वसुली खर्च (Overdue Recovery Expenses)
     2. थकीत दंड व्याज (Overdue/Penal Interest)
     3. चालू नियमित व्याज (Current Scheduled Interest)
     4. मुद्दल बाकी (Principal Repayment)
4. **बचत खात्यासाठी केवळ जमा (Deposit-Only Rule):**
   * एजंटला बचत खात्यातून **पैसे काढण्याची (Withdrawal) परवानगी नसेल.** केवळ ठेव स्वीकारण्याची (Deposit) परवानगी असेल.

---

## ३. संपूर्ण कार्यप्रवाह सोप्या शब्दांत (The Complete End-to-End Workflow in Simple Words)

> 💡 **टीमसाठी मार्गदर्शक कथा (A Day in the Life of the System):**  
> हा विभाग कोणत्याही टीम मेंबरला (डेव्हलपर, टेस्टर, मॅनेजर) संपूर्ण कार्यप्रवाह सकाळपासून संध्याकाळपर्यंत कसा चालतो, हे अगदी सोप्या शब्दांत समजावून देतो.

```
[१. सकाळ: मॅनेजर परवानग्या सेट करतो] ➔ [२. एजंट ॲप सुरू करतो व सिंक करतो]
                                                     │
                                                     ▼
[४. संध्याकाळ: बँकेत रोख भरणा व डे-बुक टॅली] ◄── [३. फील्डवर ग्राहकांना भेटून वसुली]
          │
          ▼
[५. महिनाअखेर: कमिशन कॅल्क्युलेशन व एजंटच्या बचत खात्यात थेट जमा]
```

---

### टप्पा १: सकाळी शाखेत - व्यवस्थापकाची पूर्वतयारी (Morning at Branch)
* **पात्रे:** शाखा व्यवस्थापक (Branch Manager), ग्राहक १ (रमेश जाधव - दुकानदार), ग्राहक २ (सुरेश शिंदे - शेतकरी).
* **कृती:**
  1. व्यवस्थापक संगणकावर **Customer Master** उघडतो.
  2. **ग्राहक १ (रमेश जाधव):** रमेशने स्वतः बँकेला सांगितले आहे की "माझा पिग्मी आणि कर्ज हप्ता एजंट आनंदकडे द्या." व्यवस्थापक रमेशच्या खात्यावर जातो आणि:
     * पिग्मी: `[ON]` | कर्ज हप्ता: `[ON]` | बचत ठेव: `[ON]` | नेमलेला एजंट: **आनंद पाटील (AGT-02)**.
  3. **ग्राहक २ (सुरेश शिंदे):** सुरेशने सांगितले आहे की "माझे कर्ज एजंटला दाखवू नका, मी स्वतः बँकेत येऊन भरेन." व्यवस्थापक सुरेशच्या खात्यावर जातो आणि:
     * पिग्मी: `[ON]` | **कर्ज हप्ता: `[OFF]`** | नेमलेला एजंट: **आनंद पाटील (AGT-02)**.
  4. हे बदल सेव्ह होतात. डेटाबेसमध्ये फक्त `IsAgentCollectionAllowed` आणि `AssignedAgentID` अपडेट होतात.

---

### टप्पा २: सकाळी ९:०० - एजंट ॲप सुरू करतो (`pat App`)
* **पात्र:** एजंट आनंद पाटील.
* **कृती:**
  1. आनंद आपल्या मोबाईलमध्ये **`pat App`** उघडतो आणि पासवर्ड/पिन टाकून लॉगिन करतो.
  2. ॲप सर्व्हरशी कनेक्ट होते (`GET /api/agent/lock-status`).
  3. सिस्टीम तपासते: "आनंदकडे कालची काही जुनी थकीत रोख आहे का?" नाही. आनंदचे **Pending Cash = ₹ 0.00** आहे, त्यामुळे स्टेटस **ALLOWED** (हिरवा) येतो.
  4. ॲप आनंदच्या बीटमधील ग्राहकांची यादी डाऊनलोड करते.

---

### टप्पा ३: सकाळी १०:३० - ग्राहक १ (रमेश जाधव) कडे भेट (Multi-Product Collection)
* **कृती:**
  1. आनंद रमेशच्या दुकानात जातो. ॲपमध्ये "रमेश जाधव" शोधतो.
  2. रमेशच्या नावाला स्पर्श करताच ॲप स्क्रीनवर **३ कार्डे** उघडतात:
     * 🪙 **दैनिक पिग्मी:** देय ₹ २०० | चालू शिल्लक ₹ १५,४००
     * 💰 **कर्ज हप्ता (EMI):** आजचा देय हप्ता ₹ १,००० (मुद्दल ₹ ८०० + व्याज ₹ २००)
     * 💳 **बचत खाते:** शिल्लक ₹ ३,२००
  3. रमेश आनंदच्या हातात ₹ १,५०० रोख देतो आणि म्हणतो: *"₹ २०० पिग्मी टाका, ₹ १,००० कर्जाचा हप्ता टाका, आणि उरलेले ₹ ३०० माझ्या बचत खात्यात टाका."*
  4. आनंद ॲपमध्ये तिन्ही रकमा भरतो. ॲप एकूण रक्कम दाखवते: **₹ १,५००**.
  5. आनंद **"पावती तयार करा" (Collect & Print)** दाबतो.
  6. **पडद्यामागे काय घडते? (Backend Process):**
     * सर्व्हर `POST /api/PigmyApp/collect-multi` कॉल करतो.
     * १ पावती क्रमांक जनरेट होतो (`REC-APP-20261019-001`).
     * पिग्मीत ₹ २०० वाढतात, बचतीत ₹ ३०० वाढतात, आणि कर्जाच्या इंजिनमध्ये Waterfall नियमाने ₹ १,००० पैकी व्याज व मुद्दल वजा होते.
     * आनंदच्या चालू रोख शिलकीत (Pending Cash) ₹ १,५०० जमा होतात.
  7. ब्लूटूथ थर्मल प्रिंटरमधून पावती निघते आणि रमेशला त्वरित बँकेचा अधिकृत **SMS/WhatsApp** मेसेज जातो.

---

### टप्पा ४: सकाळी ११:१५ - ग्राहक २ (सुरेश शिंदे) कडे भेट (Privacy Flow)
* **कृती:**
  1. आनंद पुढील ग्राहक सुरेश शिंदेच्या दुकानात जातो आणि ॲपमध्ये सुरेशचे नाव उघडतो.
  2. **जादू येथे घडते (The Privacy Magic):** व्यवस्थापकाने सुरेशचे कर्ज `OFF` ठेवले असल्यामुळे आनंदच्या मोबाईलवर **फक्त आणि फक्त दैनिक पिग्मीचे कार्ड** दिसते.
  3. सुरेशचे बँकेत ₹ २ लाखांचे कर्ज आहे किंवा त्याचा हप्ता थकला आहे, याचा **किंचितही मागमूस आनंदला लागत नाही!** सुरेशची गोपनीयता १००% सुरक्षित राहते.
  4. आनंद सुरेशकडून ₹ १०० पिग्मी स्वीकारतो आणि पावती देतो.
  5. आनंदचे Pending Cash आता **₹ १,५०० + ₹ १०० = ₹ १,६००** होते.

---

### टप्पा ५: दुपारी १:०० - नेटवर्क नसलेला भाग (Offline Collection)
* आनंद बाजारातील तळघरात जातो जिथे इंटरनेट रेंज नाही.
* ग्राहक रोख देतो. ॲप ऑफलाइन मोडमध्ये पावती सेव्ह करते आणि फोनच्या लोकल SQLite मध्ये एक युनिक `TransactionId` (UUID) तयार करून पावती प्रिंट करते.
* आनंद जेव्हा दुकानातून बाहेर रस्त्यावर येतो आणि रेंज येते, तेव्हा ॲप आपोआप पार्श्वभूमीत (Background) सर्व पावत्या सर्व्हरवर सिंक करते. युनिक UUID असल्यामुळे एकाच पावतीची दोनदा नोंद होण्याचा धोका शून्य राहतो.

---

### टप्पा ६: दुपारी ३:०० - कॅश मर्यादा आणि ऑटोमॅटिक लॉक (Agent Cash Lock Safety)
* दुपारपर्यंत आनंदने अनेक ग्राहकांकडून पिग्मी, कर्ज हप्ते आणि बचत मिळून एकूण **₹ २०,५००** गोळा केले.
* बँकेने आनंदसाठी ठरवून दिलेली कमाल कॅश मर्यादा **₹ २०,०००** आहे.
* आनंद पुढील पावती करायला जातो, तेव्हा ॲप स्क्रीन लाल होते आणि मेसेज येतो:
  > *"सूचना: आपल्या हातातील रोख शिल्लक (₹ २०,५००) ही ठरवून दिलेल्या मर्यादेपेक्षा (₹ २०,०००) जास्त झाली आहे. पुढील वसुलीसाठी कृपया शाखेत जाऊन पैसे जमा करा."*
* यामुळे एजंट जास्त रोख रक्कम स्वतःजवळ बाळगू शकत नाही आणि बँकेची आर्थिक जोखीम (Financial Risk) टळते.

---

### टप्पा ७: संध्याकाळी ५:०० - शाखेत रोख भरणा (Evening Remittance & Day-End)
* **कृती:**
  1. आनंद संध्याकाळी बँकेच्या शाखेत येतो आणि कॅशियरच्या काउंटरवर जातो.
  2. कॅशियर आपल्या संगणकावर **Agent Day-Book (एजंट डे-बुक)** उघडतो आणि आनंद पाटील (AGT-02) निवडतो.
  3. कॅशियरच्या स्क्रीनवर संपूर्ण दिवसाचा ताळेबंद दिसतो:
     * *पिग्मी वसुली:* ₹ १०,००० (३० पावत्या)
     * *कर्ज हप्ता वसुली:* ₹ ८,००० (०८ पावत्या)
     * *बचत ठेव वसुली:* ₹ २,१०० (०५ पावत्या)
     * **एकूण रोख भरणा आवश्यक:** **₹ २०,१००**
  4. आनंद काउंटरवर रोख ₹ २०,१०० मोजून देतो.
  5. कॅशियर **"रोख स्वीकारा व व्हाउचर पास करा" (Approve Remittance)** बटण दाबतो.
  6. **लेजर परिणाम:**
     * *Debit:* बँकेची मुख्य तिजोरी कॅश (Branch Vault Cash) ➔ ₹ २०,१०० ने वाढली.
     * *Credit:* आनंद पाटील एजंट रोख लेजर ➔ ₹ २०,१०० ने वजा झाले.
  7. आनंदचे **Pending Cash आता ₹ ०.०० (निरंक)** होते आणि त्याचा मोबाईल ॲप पुन्हा मोकळा (UNLOCKED) होतो.

---

### टप्पा ८: महिन्याचा शेवट - कमिशन गणना व थेट वाटप (Month-End Payout)
* **कृती:**
  1. महिन्याच्या ३० तारखेला मॅनेजर **Agent Commission Master** उघडतो आणि **"कमिशन गणना करा" (Calculate)** बटण दाबतो.
  2. सिस्टीम आनंदचे कमिशन मोजते:
     * पिग्मी वसुली (₹ ३,००,००० वर ३%): **₹ ९,०००**
     * कर्ज हप्ता इन्सेंटिव्ह (१२० पावत्या x ₹ १०): **₹ १,२००**
     * **एकूण देय कमिशन:** **₹ १०,२००**
  3. मॅनेजर **"Pay via AGENT_SB"** निवडतो.
  4. एका सेकंदात आनंदच्या पतसंस्थेतील बचत खात्यात (SB Account) **₹ १०,२०० थेट जमा** होतात आणि कमिशन खर्चाचे व्हाउचर जनरल लेजरमध्ये आपोआप पोस्ट होते.

---

## ४. ग्राहक गोपनीयता व परवानग्या सेटिंग्ज (Customer Privacy & Permission Matrix)

प्रत्येक ग्राहकासाठी (Customer Profile / Customer 360) खालीलप्रमाणे नियंत्रण राहील:

| खाते प्रकार (Product) | डीफॉल्ट स्थिती (Default) | एजंट परवानगी (Agent Permission) | मोबाईलवर काय दिसेल? (Mobile App Visibility) |
| :--- | :---: | :---: | :--- |
| **दैनिक पिग्मी (Pigmy)** | 🟢 चालू (Enabled) | नेमलेला पिग्मी एजंट | आजची वसुली कार्ड, चालू शिल्लक |
| **बचत खाते (Saving)** | ⚪ ऐच्छिक (Optional) | चालू केल्यास नेमलेला एजंट | बचत जमा कार्ड, चालू शिल्लक (फक्त Deposit) |
| **कर्ज खाते (Loan EMI)** | 🔴 बंद (Disabled) | केवळ व्यवस्थापकाने मंजुरी दिल्यास | चालू देय हप्ता (Due EMI), दंड व्याज, मुद्दल |
| **आवर्ती ठेव (RD)** | ⚪ ऐच्छिक (Optional) | चालू केल्यास नेमलेला एजंट | मासिक हप्ता (RD Monthly Installment) |
| **मुदत ठेव (FD)** | ⛔ प्रतिबंधित (Restricted)| एजंट वसुली बंद (Counter Only) | मोबाईलवर कधीही दिसणार नाही |

---

## ५. डेटाबेस बदल व टेबल्सचा संपूर्ण तक्ता (Complete Database Schema & Tables Matrix)

डेटाबेसमध्ये नवीन स्वतंत्र गुंतागुंतीचे टेबल न बनवता **मुख्य ६ ते ८ टेबल्समध्ये** मोजके सुरक्षित कॉलम्स जोडले जातील:

| क्र. | टेबलचे नाव (Table Name) | जोडले जाणारे कॉलम्स (New Columns) | डेटा प्रकार (Data Type) | उद्देश / काम (Purpose) |
| :---: | :--- | :--- | :--- | :--- |
| **१** | **`LoanAccounts`**<br>*(कर्ज खाते मास्तर)* | • `IsAgentCollectionAllowed`<br>• `AssignedAgentID` | `BIT (Default 0)`<br>`INT NULL` | • एजंटने कर्ज गोळा करायचे की नाही (ON/OFF)<br>• कोणत्या एजंटला हे कर्ज नेमले आहे (FK to PigmyAgents) |
| **२** | **`SavingAccountMasters`**<br>*(बचत खाते मास्तर)* | • `IsAgentCollectionAllowed`<br>• `AssignedAgentID` | `BIT (Default 0)`<br>`INT NULL` | • एजंटने बचत ठेव स्वीकारायची की नाही (ON/OFF)<br>• नेमलेला एजंट आयडी |
| **३** | **`LoanCollections`**<br>*(कर्ज वसुली पावती)* | • `AgentID`<br>• `CollectionSource`<br>• `TransactionId`<br>• `SyncReferenceId` | `INT NULL`<br>`VARCHAR(20) Default 'COUNTER'`<br>`VARCHAR(100) NULL`<br>`VARCHAR(100) NULL` | • कोणत्या एजंटने वसुली आणली<br>• वसुली कुठून झाली ('COUNTER' की 'APP')<br>• मोबाईल ऑफलाइन पावतीचा UUID (डुप्लिकेशन रोखण्यासाठी) |
| **४** | **`SavingTransactions`**<br>*(बचत व्यवहार नोंद)* | • `AgentID`<br>• `CollectionSource`<br>• `TransactionId` | `INT NULL`<br>`VARCHAR(20) Default 'COUNTER'`<br>`VARCHAR(100) NULL` | • बचत ठेव आणणाऱ्या एजंटची नोंद<br>• व्यवहार मार्ग ('COUNTER' / 'APP')<br>• ऑफलाइन ट्रॅन्झॅक्शन UUID |
| **५** | **`PigmyCommissionSettings`**<br>*(कमिशन दर पत्रक)* | • `ProductType` | `VARCHAR(20) Default 'PIGMY'` | • कमिशन कशावर आहे? ('PIGMY', 'LOAN', 'RD') |
| **६** | **`PigmyAgentCommissions`**<br>*(एजंट कमिशन पावती)* | • `ProductType` | `VARCHAR(20) Default 'PIGMY'` | • हे कमिशन कोणत्या वसुलीचे आहे ते दर्शवणे |
| **७** | **`RdAccounts`** *(ऐच्छिक RD)* | • `IsAgentCollectionAllowed`<br>• `AssignedAgentID` | `BIT (Default 0)`<br>`INT NULL` | • RD हप्ता एजंटने गोळा करण्याची परवानगी |
| **८** | **`RdTransactions`** *(ऐच्छिक RD)* | • `AgentID`<br>• `CollectionSource`<br>• `TransactionId` | `INT NULL`<br>`VARCHAR(20) Default 'COUNTER'`<br>`VARCHAR(100) NULL` | • RD व्यवहारात एजंट व पावती ट्रॅकिंग |

### DDL स्क्रिप्ट (SQL Commands):
```sql
-- १. कर्ज खाते व पावत्या
ALTER TABLE LoanAccounts ADD IsAgentCollectionAllowed BIT NOT NULL DEFAULT 0, AssignedAgentID INT NULL FOREIGN KEY REFERENCES PigmyAgents(PigmyAgentID);
ALTER TABLE LoanCollections ADD AgentID INT NULL FOREIGN KEY REFERENCES PigmyAgents(PigmyAgentID), CollectionSource VARCHAR(20) DEFAULT 'COUNTER', TransactionId VARCHAR(100) NULL, SyncReferenceId VARCHAR(100) NULL;
CREATE UNIQUE INDEX UQ_LoanCollections_TransactionId ON LoanCollections(TransactionId) WHERE TransactionId IS NOT NULL;

-- २. बचत खाते व व्यवहार
ALTER TABLE SavingAccountMasters ADD IsAgentCollectionAllowed BIT NOT NULL DEFAULT 0, AssignedAgentID INT NULL FOREIGN KEY REFERENCES PigmyAgents(PigmyAgentID);
ALTER TABLE SavingTransactions ADD AgentID INT NULL FOREIGN KEY REFERENCES PigmyAgents(PigmyAgentID), CollectionSource VARCHAR(20) DEFAULT 'COUNTER', TransactionId VARCHAR(100) NULL;
CREATE UNIQUE INDEX UQ_SavingTransactions_TransactionId ON SavingTransactions(TransactionId) WHERE TransactionId IS NOT NULL;

-- ३. कमिशन सेटिंग्ज व पावत्या
ALTER TABLE PigmyCommissionSettings ADD ProductType VARCHAR(20) NOT NULL DEFAULT 'PIGMY';
ALTER TABLE PigmyAgentCommissions ADD ProductType VARCHAR(20) NOT NULL DEFAULT 'PIGMY';

-- ४. आवर्ती ठेव (RD)
ALTER TABLE RdAccounts ADD IsAgentCollectionAllowed BIT NOT NULL DEFAULT 0, AssignedAgentID INT NULL FOREIGN KEY REFERENCES PigmyAgents(PigmyAgentID);
ALTER TABLE RdTransactions ADD AgentID INT NULL FOREIGN KEY REFERENCES PigmyAgents(PigmyAgentID), CollectionSource VARCHAR(20) DEFAULT 'COUNTER', TransactionId VARCHAR(100) NULL;
```

---

## ६. उत्पादननिहाय कमिशन व इन्सेंटिव्ह मॉडेल (Product-Wise Commission Architecture)

सहकारी बँकिंगमध्ये उत्पादनानुसार कमिशन खालीलप्रमाणे आकारले जाते:

| उत्पादन (Product) | कमिशन प्रकार (Type) | सरासरी दर (Market Rate) | कारण / बँकिंग तत्त्व |
| :--- | :---: | :---: | :--- |
| **दैनिक पिग्मी (Pigmy)** | `PERCENTAGE` | २.५% ते ४.००% | नवीन लहान बचत गोळा करण्यासाठी मुख्य कमिशन. |
| **आवर्ती ठेव (RD)** | `PERCENTAGE` | १.००% ते १.५०% | मासिक ठेव (पिग्मीपेक्षा कमी श्रम). |
| **कर्ज हप्ता (Loan EMI)** | `FIXED` किंवा `PERCENTAGE` | ₹ १० ते ₹ २० प्रति पावती (किंवा ०.२५% - ०.५%) | **महत्त्वाचा नियम:** कर्जावर कधीही पिग्मीएवढे कमिशन नसते. ₹ ५०,००० च्या हप्त्यावर ३% म्हणजे ₹ १,५०० कमिशन दिले तर पतसंस्थेचे नुकसान होईल. म्हणून कर्ज वसुलीवर नाममात्र फिक्स इन्सेंटिव्ह दिला जातो. |
| **बचत ठेव (Saving)** | `NONE` | ०.००% | बचत ठेव ही ग्राहकाची सोय मानली जाते; यावर कमिशन नसते. |

---

## ७. कमिशन कुठे सेट करायचे? (Where to Set Module Commission in Web CBS)

📍 **वेब CBS नेव्हिगेशन:**  
**`मुख्य मेनू (Sidebar)`** ➔ **`पिग्मी मॉड्युल`** ➔ **`एजंट कमिशन व्यवस्थापन (Agent Commission Master)`** ➔ **`टॅब २: कमिशन दर (Rates / Settings)`**  
*(सोर्स कोड स्थान: `client/src/components/AgentCommissionMaster.tsx`)*

---

## ८. ग्राहकानुसार मॉड्युल परवानग्या कुठे सेट करायच्या? (Where to Configure Customer Permissions in Web CBS)

प्रत्येक ग्राहकासाठी (Customer-by-Customer) एजंटने काय गोळा करायचे:
* **ग्राहक १ (रमेश):** पिग्मी + कर्ज + आरडी गोळा करायचे.
* **ग्राहक २ (सुरेश):** फक्त पिग्मी गोळा करायची (कर्ज व आरडी गुप्त राहील).

हे सेट करण्यासाठी वेब सॉफ्टवेअरमध्ये **२ सुटसुटीत पर्याय** उपलब्ध आहेत:

### पर्याय १: ग्राहक मास्तर / प्रोफाइल स्क्रीनवर (Customer Profile Modal)
📍 **नेव्हिगेशन:** **`ग्राहक व्यवस्थापन (Customer Master)`** ➔ **`ग्राहकाचे नाव शोधा`** ➔ **`"🛡️ डोअरस्टेप परवानग्या"` बटण**  
*(सोर्स कोड स्थान: `client/src/components/CustomerMaster.tsx`)*

### पर्याय २: एकत्रित मॅनेजर ग्रिड (Bulk Assignment Matrix Grid)
📍 **नेव्हिगेशन:** **`पिग्मी मॉड्युल`** ➔ **`एजंट ग्राहक वाटप सूची (Agent Allocation Matrix)`**

---

## ९. सिस्टीम प्रभाव विश्लेषण अहवाल (System Impact Analysis Report - 0% Disruption)

**प्रश्न:** *या बदलांमुळे विद्यमान कर्ज किंवा इतर कोणत्याही मॉड्युलच्या कामकाजावर काही विपरीत परिणाम होईल का?*  
**अहवाल:** **नाही, विद्यमान काउंटर किंवा बॅक-ऑफिस कामकाजावर ०% (Zero) परिणाम होईल.**

| विभाग / कार्य | सध्याचे कामकाज | बदलांनंतरचे वर्तन | प्रभाव |
| :--- | :--- | :--- | :---: |
| **कर्ज वाटप (Disbursement)** | काउंटरवरून कर्ज वाटप होते. | `AssignedAgentID = NULL` राहते. पूर्वीप्रमाणेच चालते. | 🟢 ०% |
| **काउंटर हप्ता वसुली (Counter Collection)** | टेलर नेहमीप्रमाणे कर्ज पावती फाडतो. | `CollectionSource = 'COUNTER'`, `AgentID = NULL`. नेहमीसारखेच व्हाउचर. | 🟢 ०% |
| **व्याज गणना व Waterfall** | Daily Reducing, EMI, समान मुद्दल. | विद्यमान `LoanScheduleGenerator` व Waterfall इंजिनच वापरले जाते. | 🟢 ०% |
| **NPA वर्गीकरण (NPA Run)** | ९० दिवस थकीत नियम व तरतूद. | एजंट फील्ड्समुळे NPA मोजणीत काहीही फरक पडत नाही. | 🟢 ०% |
| **बचत ठेवी व व्याज** | काउंटर ठेवी व तिमाही व्याज. | ठेवी नेहमीप्रमाणे शिल्लकेत जातात; व्याज गणनेवर ०% परिणाम. | 🟢 ०% |
| **तिजोरी कॅश टॅली (EOD Cash)** | शाखा मुख्य रोख हिशोब. | एजंटने आणलेली रोख काउंटरवर जमा होईपर्यंत शाखेच्या तिजोरीत फरक पडत नाही. | 🟢 ०% |
| **ट्रायल बॅलन्स (General Ledger)** | डेबिट-क्रेडिट जुळवणी. | एजंट रोख लेजर आणि खाते लेजर समान रकमेने बॅलन्स राहतात. | 🟢 ०% |

---

## १०. 'NULL' व भविष्यातील सुरक्षितता धोरण (Forward-Compatible & Nullable Strategy)

> 💡 **"जर आपण हे बदल आताच करून ठेवले आणि पुढील निर्णयापर्यंत `NULL` ठेवले, तर काही अडचण येईल का?"**  
> **उत्तर:** अजिबात कोणतीही अडचण (0% Regression) येणार नाही! हे इंडस्ट्री-स्टँडर्ड सुरक्षित तंत्र आहे.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   🛡️ 'NULL' सुरक्षितता मॅट्रिक्स                       │
├────────────────────────────────┬───────────────────────────────────────┤
│ फील्ड आणि चालू व्हॅल्यू         │ सिस्टीममधील वर्तन (Runtime Behavior)  │
├────────────────────────────────┼───────────────────────────────────────┤
│ LoanAccount.AssignedAgentID    │ कर्ज फक्त बँकेच्या काउंटरवर भरले जाईल.│
│ = NULL                         │ एजंटच्या ॲपमध्ये अजिबात दिसणार नाही.  │
├────────────────────────────────┼───────────────────────────────────────┤
│ LoanCollection.AgentID         │ काउंटर कॅशियरने घेतलेली नेहमीची पावती.│
│ = NULL                         │ जुने व नवीन रिपोर्ट्स १००% योग्य.     │
├────────────────────────────────┼───────────────────────────────────────┤
│ IsAgentCollectionAllowed       │ "Secure by Default": व्यवस्थापकाने    │
│ = 0 (false)                    │ ऑन करेपर्यंत ग्राहकाचा डेटा सुरक्षित. │
├────────────────────────────────┼───────────────────────────────────────┤
│ PigmyCommissionSetting         │ केवळ पिग्मी ठेवींचे कमिशन कॅल्क्युलेट │
│ .ProductType = 'PIGMY'         │ होईल; कर्ज व आरडीवर ०% कमिशन राहील.   │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## ११. रेस्ट APIs तपशील (REST API Specifications)

### १. ग्राहकाचे वसुली प्रोफाईल मिळवणे (Get Customer 360 Collection Profile)
**Route:** `GET /api/PigmyApp/customer-profile/{customerId}?agentId={agentId}`  
**वर्णन:** एजंटने ग्राहकाचा शोध घेतल्यावर फक्त परवानगी दिलेली सक्रिय खाती परत करणे.

#### Response (JSON):
```json
{
  "customerId": 105,
  "customerName": "रमेश दिलीप जाधव",
  "cifNo": "CIF-01-000105",
  "mobileNo": "9822114455",
  "address": "गांधी चौक, सांगली",
  "accounts": {
    "pigmy": {
      "isAllowed": true,
      "pigmyAccountId": 12,
      "accountNo": "PGM-01-2026-0012",
      "dailyTargetAmount": 200.00,
      "currentBalance": 15400.00
    },
    "saving": {
      "isAllowed": true,
      "savingAccountId": 45,
      "accountNo": "SB-01-00045",
      "currentBalance": 3200.00,
      "minDeposit": 50.00
    },
    "loan": {
      "isAllowed": false,
      "message": "या खात्याची वसुली एजंटसाठी बंद आहे (Counter Only)"
    },
    "rd": {
      "isAllowed": true,
      "rdAccountId": 8,
      "accountNo": "RD-01-0008",
      "monthlyInstallment": 1000.00,
      "currentBalance": 6000.00,
      "dueInstallments": 1
    }
  }
}
```

---

### २. कर्ज हप्ता वसुली API (Collect Loan EMI)
**Route:** `POST /api/PigmyApp/collect-loan-emi`  
**Headers:** `Authorization: Bearer <Token>`, `X-Agent-Id: <AgentId>`

#### Request Body (JSON):
```json
{
  "agentId": 2,
  "loanAccountId": 55,
  "amount": 2500.00,
  "transactionId": "TXN-LN-UUID-998877",
  "paymentMode": "CASH",
  "timestamp": "2026-10-18T14:30:00"
}
```

---

### ३. बचत ठेव जमा API (Collect Saving Deposit)
**Route:** `POST /api/PigmyApp/collect-saving`

#### Request Body (JSON):
```json
{
  "agentId": 2,
  "savingAccountId": 45,
  "amount": 500.00,
  "transactionId": "TXN-SB-UUID-445566",
  "paymentMode": "CASH",
  "timestamp": "2026-10-18T14:35:00"
}
```

---

### ४. एकत्रित वसुली API (Multi-Product Single Receipt Collection)
एकाच ग्राहकाकडून एकाच वेळी पिग्मी + बचत + कर्ज अशी एकत्रित रोख स्वीकारल्यास:  
**Route:** `POST /api/PigmyApp/collect-multi`

#### Request Body (JSON):
```json
{
  "agentId": 2,
  "customerId": 105,
  "totalAmount": 1700.00,
  "paymentMode": "CASH",
  "items": [
    { "productType": "PIGMY", "accountId": 12, "amount": 200.00 },
    { "productType": "SAVING", "accountId": 45, "amount": 500.00 },
    { "productType": "LOAN", "accountId": 55, "amount": 1000.00 }
  ],
  "transactionId": "TXN-MULTI-UUID-112233",
  "timestamp": "2026-10-18T14:40:00"
}
```

---

## १२. मोबाईल ॲप इंटरफेस व फ्लो (Android Mobile App Flow - `pat App`)

`AgentDashboard.tsx` मधील ग्राहकाच्या कलेक्शन स्क्रीनवर डायनॅमिक कार्ड्स:

```
┌──────────────────────────────────────────────┐
│  ← ग्राहक वसुली (Collection)                 │
│  रमेश दिलीप जाधव | 9822114455                │
├──────────────────────────────────────────────┤
│  [🪙 दैनिक पिग्मी]       शिल्लक: ₹ 15,400    │
│  दैनिक हप्ता: ₹ २००                          │
│  रक्कम: [ ₹ २००        ]   [✓] निवडा        │
├──────────────────────────────────────────────┤
│  [💳 बचत ठेव]           शिल्लक: ₹ 3,200     │
│  रक्कम: [ ₹ ५००        ]   [✓] निवडा        │
├──────────────────────────────────────────────┤
│  [📑 आवर्ती ठेव - RD]    हप्ता: ₹ १,०००      │
│  रक्कम: [ ₹ १,०००      ]   [✓] निवडा        │
├──────────────────────────────────────────────┤
│  (कर्ज खाते येथे दिसणार नाही कारण व्यवस्थापकाने │
│   सेटिंगमध्ये OFF ठेवले आहे)                 │
├──────────────────────────────────────────────┤
│  एकूण रोख स्वीकारली: ₹ १,७००                │
│  [ 🖨️ पावती तयार करा व जमा करा (Collect) ]  │
└──────────────────────────────────────────────┘
```

---

## १३. एजंट डे-बुक व एकत्रित रोख भरणा (Unified Day-Book & Cash Remittance)

दिवसअखेर एजंटने शाखेत भरणा करताना `AgentDayBookController.cs` मध्ये सर्व वसुली एकत्र दिसेल:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📅 एजंट दैनिक डे-बुक सारांश (Agent Day-Book Summary)                        │
│ एजंट: आनंद विनायक पाटील (AGT-02)                     दिनांक: १८/१०/२०२६     │
├─────────────────────────────────────────────────────────────────────────────┤
│  वसुली प्रकार          पावत्यांची संख्या     एकूण गोळा झालेली रक्कम         │
├─────────────────────────────────────────────────────────────────────────────┤
│  १. दैनिक पिग्मी ठेवी        ४२                   ₹ २२,४००.००               │
│  २. बचत खाते ठेवी            ०८                   ₹  ६,५००.००               │
│  ३. कर्ज हप्ता वसुली         ०५                   ₹ १४,०००.००               │
│  ४. आवर्ती ठेव (RD)          ०३                   ₹  ३,०००.००               │
├─────────────────────────────────────────────────────────────────────────────┤
│  एकूण रोख शिल्लक (Total Pending Cash in Hand):   ₹ ४५,९००.००               │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ 📥 रोख बँकेत जमा करा (Remit Cash to Branch Vault) ]                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

* **कॅशियर ॲक्शन:** कॅशियरने ₹ ४५,९०० स्वीकारून एका क्लिकवर सिंगल व्हाउचर पास केले की एजंटची रोख निरंक (Zero) होईल.

---

## १४. टप्प्याटप्प्याने अंमलबजावणी आराखडा (Step-by-Step Implementation Roadmap)

| टप्पा | कार्य (Task) | फाइल / स्थान | स्थिती |
| :---: | :--- | :--- | :---: |
| **टप्पा १** | **डेटाबेस कॉलम्स जोडणे (६ ते ८ टेबल्स)** | `LoanAccounts`, `SavingAccountMasters`, `RdAccounts`, `LoanCollections`, `SavingTransactions`, `PigmyCommissionSettings` | **तयार (NULL Safe)** |
| **टप्पा २** | **C# मॉडेल्स अपडेट करणे** | `LoanAccount.cs`, `SavingAccountMaster.cs`, `LoanCollection.cs`, `PigmyCommissionSetting.cs`, `AppDbContext.cs` | **तयार (NULL Safe)** |
| **टप्पा ३** | **वेब CBS मॅनेजर स्क्रीन** | `CustomerMaster.tsx` मध्ये Doorstep Permissions पॉपअप आणि `AgentCommissionMaster.tsx` मध्ये ProductType | **प्रस्तावित** |
| **टप्पा ४** | **बॅकएंड APIs तयार करणे** | `PigmyMobileApiController.cs` मध्ये `customer-profile`, `collect-loan-emi`, `collect-saving` | **प्रस्तावित** |
| **टप्पा ५** | **AgentLock & DayBook अपडेट** | `AgentLockService.cs` मध्ये पिग्मी + बचत + कर्ज अशी एकत्रित रोख बेरीज | **प्रस्तावित** |
| **टप्पा ६** | **मोबाईल ॲप UI अपडेट** | `pat App/src/screens/agent/AgentDashboard.tsx` मध्ये डायनॅमिक कार्ड्स व पावती जनरेशन | **प्रस्तावित** |
| **टप्पा ७** | **ऑडिट व चाचणी (Testing)** | आयडेंटिकल डुप्लिकेट्स, ऑफलाइन सिंक आणि व्हॉउचर पोस्टिंगची पडताळणी | **प्रस्तावित** |

---
**दस्तऐवज तयारकर्ता:** Antigravity AI Banking Pair Programmer  
**प्रकल्प:** SmartBanking Core Banking Solution (CBS)
