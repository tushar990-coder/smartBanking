# SmartBanking ERP - तपशीलवार आवृत्ती व बदल नोंदी (Changelog)

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
