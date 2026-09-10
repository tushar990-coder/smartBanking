# FIXED DEPOSIT (मुदत ठेव - FD) MODULE SPECIFICATION & RULE BOOK
**System:** SmartBanking Core Banking Solution (सहकारी पतसंस्था कोअर बँकिंग प्रणाली)  
**Document Version:** 1.0.0  
**Effective Date:** 2026-09-09  
**Status:** **STRICT & MANDATORY (अपरिवर्तनीय व बंधनकारक नियमावली)**  

---

> [!IMPORTANT]
> **CONSTITUTIONAL SYSTEM DIRECTIVE:**  
> हे दस्तऐवज (Document) मुदत ठेव (Fixed Deposit - FD) मॉड्युलचे संपूर्ण कार्यपद्धती (Working), आर्किटेक्चर आणि **कठोर व्यावसायिक नियम (Non-Negotiable Business & Technical Rules)** निर्धारित करते.  
> **कोणत्याही परिस्थितीत या नियमांचे उल्लंघन करून कोणताही कोड, API एंडपॉइंट किंवा डेटाबेस बदल करण्यास सक्त मनाई आहे.** नवीन नियम ठरल्यास तो याच फाईलमध्ये नोंदवूनच पुढील काम केले जाईल.

---

## १. मॉड्युलची मूळ रचना व कार्यप्रणाली (End-to-End Working)

मुदत ठेव मॉड्युल हे ठेवीदारांच्या (Customers) मुदत ठेवींचे संकलन, व्याज तरतूद, मुदतपूर्ती, मुदतपूर्व बंद आणि नूतनीकरण सांभाळणारे मुख्य बँकिंग मॉड्युल आहे.

### संपूर्ण जीवनचक्र (Lifecycle Steps):

```
+-----------------------------------------------------------------------------------+
| 1. FD Scheme Master (योजना निर्मिती)                                              |
|    - कालावधी, दर, कंपाऊंडिंग वारंवारता, आणि ४ खातावही (GL Ledgers) निश्चित करणे. |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 2. FD Account Opening & Bulk Split (खाते उघडणे व बल्क पावती निर्मिती)            |
|    - ऑटो पावती क्र. (उदा. KOP-001-FD-000001) तयार होतो.                           |
|    - रोख (Cash) / बँक (Bank) / बचत खात्यातून वर्ग (SB Transfer).                  |
|    - लेखा व्हाऊचर: Dr Cash / Bank / SB  -->  Cr FD Liability                      |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 3. Periodic Interest Accrual (नियमित मासिक/तिमाही व्याज तरतूद)                    |
|    - मागील तारखेपासून अचूक दिवसांची गणना (Elapsed Days: Principal x R x T / 36500)|
|    - एकत्रित बॅच व्हाऊचर: Dr 132 मुदत ठेव व्याज खर्च  -->  Cr 23 देणे ठेव व्याज     |
|    - FdTransactions (Accrual, Cr) व FdInterestAccruals मध्ये नोंद.                |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          +-----------------------+
                                          |                       |
                                          v                       v
+---------------------------------------------------+ +-----------------------------+
| 4A. Matured Close (मुदत संपल्यावर पूर्ण परतावा)    | | 4B. Premature Close         |
|    - Payout = DepositAmount + All Accrued Interest| |    (मुदतपूर्व बंद)          |
|    - Dr FD Liability (मुद्दल)                     | | - प्रत्यक्ष दिवसांचे व्याज  |
|    - Dr Interest Payable (व्याज)                  | | - दंडात्मक व्याजदर कपात     |
|    - Cr Payout (Cash / Bank / SB Transfer)        | | - जास्तीचे व्याज मुद्दलातून |
+---------------------------------------------------+ |   कपात (Clawback Income)    |
                                                      +-----------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 5. FD Renewal (मुदत ठेव नूतनीकरण)                                                 |
|    - जुने खाते Closed होते आणि नव्या योजनेखाली नवीन पावती क्र. सह खाते उघडले जाते. |
|    - PrincipalOnly (केवळ मुद्दल नूतनीकरण - साचलेले व्याज ग्राहकाला अदा) किंवा      |
|    - PrincipalPlusInterest (मुद्दल + साचलेले व्याज मिळून एकत्रित नवीन ठेव पावती). |
+-----------------------------------------------------------------------------------+
```

---

## २. गैर-तडजोड नियम पुस्तिका (NON-NEGOTIABLE RULES REGISTRY)

या मॉड्युलवर काम करताना खालील नियम **१००% पाळलेच पाहिजेत**:

### [RULE-FD-001] ग्राहक-केंद्रितता (Pure CIF / Customer-First Architecture)
1. `FdAccounts` टेबल आणि मॉडेलमध्ये मुख्य ओळखकर्ता नेहमी **`CustomerID`** च असेल.
2. `FdAccounts` मध्ये `MemberID` कॉलम **नाही आणि जोडला जाणार नाही**.
3. फ्रंटएंड मधील प्रत्येक फॉर्मने (`FdAccountOpening`, `FdOpeningBalanceMigration`, इत्यादी) ग्राहकाचा **`customerID`** बॅकएंडला पाठवलाच पाहिजे. `customerID = 0` किंवा रिकामे पाठवणे गुन्हा मानले जाईल.
4. `MemberID` हा केवळ जर ग्राहक सभासद असेल, तरच जर्नल व्हाऊचरमध्ये उप-लेजर (Sub-ledger reference) म्हणून पर्यायी टॅग केला जाईल. ग्राहक नाममात्र (Nominal) किंवा गैर-सभासद (Customer) असला तरीही FD सुरळीत उघडली जाईल.

---

### [RULE-FD-002] दुहेरी नोंद खातावही संतुलन (Double-Entry Balance: Total Dr == Total Cr)
प्रत्येक मुदत ठेव व्यवहारात संस्थेची खातावही संतुलित (Balanced) राहिलीच पाहिजे:
1. **खाते उघडताना (Receipt Voucher):**
   - $\sum \text{Debit (Cash / Bank / SB Liability)} = \sum \text{Credit (FD Liability)}$
2. **व्याज तरतूद (Journal Voucher):**
   - $\sum \text{Debit (Interest Expense GL)} = \sum \text{Credit (Interest Payable GL)}$
3. **मुदतपूर्ती परतावा (Payment / Transfer Voucher):**
   - $\text{Debit (FD Liability [मुद्दल])} + \text{Debit (Interest Payable [व्याज])} = \text{Credit (Cash / Bank / SB Payout [एकूण परतावा])}$
4. **मुदतपूर्व बंद (Premature Close Voucher):**
   - $\text{Debit (FD Liability)} + \text{Debit (Interest Payable)} = \text{Credit (Net Payout)} + \text{Credit (Premature Penalty Clawback Income)}$

---

### [RULE-FD-003] बचत खात्यातून वर्ग करताना शिल्लक तपासणी (SB Transfer Balance Invariance)
1. जर पेमेंट मोड `Transfer` असेल, तर ग्राहकाच्या बचत खात्यात पुरेशी शिल्लक असणे अनिवार्य आहे:
   $$\text{CurrentBalance} \ge \text{DepositAmount}$$
2. बल्क स्प्लिट असल्यास:
   $$\text{CurrentBalance} \ge (\text{AmountPerReceipt} \times \text{SplitCount})$$
3. बचत खात्यातून रक्कम तात्काळ कपात होऊन `SavingTransaction` मध्ये **Withdrawal (Transfer)** नोंद झाली पाहिजे आणि पासबुक बॅलन्स अचूक अपडेट झाला पाहिजे.

---

### [RULE-FD-004] मुदतपूर्व बंद व दंडात्मक कपात नियम (Premature Interest Clawback Rule)
1. मुदतपूर्व खात्यावर ठेव जितके दिवस राहिली (Actual Days) तितक्याच दिवसांचे व्याज दिले जाईल.
2. व्याजदर योजनेतील `PrematureInterestRate` (किंवा मूळ दर उणे १.००%) लागू होईल.
3. जर यापूर्वीच मासिक/तिमाही तरतुदीद्वारे जास्त व्याज खात्यावर क्रेडिट झाले असेल:
   $$\text{Clawback Amount} = \text{Already Accrued Interest} - \text{Recalculated Interest}$$
4. हा फरक मुद्दलातून वजा करून संस्थेच्या दंडात्मक उत्पन्न खात्याला (`PrematurePenaltyLedgerID`) क्रेडिट होईल आणि ग्राहकाला निव्वळ रक्कम दिली जाईल:
   $$\text{Net Payout} = \text{DepositAmount} - \text{Clawback Amount}$$

---

### [RULE-FD-005] नूतनीकरण पावित्र्य (FD Renewal Integrity)
1. नूतनीकरण करताना मूळ खाते `Status = 'Closed'` होईल आणि त्याच्या रिमार्कमध्ये नूतनीकरणाची तारीख व नवीन पावती क्र. नोंदवला जाईल.
2. नवीन खात्याला स्वतंत्र नवीन ऑटो-पावती क्रमांक दिला जाईल आणि त्याच्या रिमार्कमध्ये जुन्या पावतीचा स्पष्ट संदर्भ असेल (`Renewed from: ...`).
3. `PrincipalOnly` मोड असल्यास जुने साचलेले व्याज रोख/बँक किंवा बचत खात्यात तात्काळ अदा केले जाईल; ते हवेत सोडून चालणार नाही.

---

### [RULE-FD-006] व्यवहार असलेले खाते हटवण्यास सक्त मनाई (Zero Deletion With Transactions)
1. जर कोणत्याही FD खात्यावर सुरुवातीच्या व्हाऊचर व्यतिरिक्त कोणताही पुढील व्यवहार (उदा. Interest Accrual, Payout, Premature Payout) झालेला असेल, तर ते खाते **डिलीट करता येणार नाही**.
2. केवळ चुकीने उघडलेले आणि कोणताही पुढील व्यवहार नसलेले खातेच सुपर-ॲडमिनद्वारे डिलीट केले जाऊ शकते.
3. जर शाखेतील पहिली आणि एकमेव एन्ट्री डिलीट झाली, तर सिक्वेन्स ऑटो-रिसीड (Auto-Reseed) सुरक्षितपणे झाला पाहिजे.

---

### [RULE-FD-007] आरंभिक शिल्लक मायग्रेशन (Opening Balance Migration Invariance)
1. जुनी खाती मायग्रेट करताना `IsLegacyAccount = true` आणि `LegacyAccruedInt` अचूक भरले गेले पाहिजे.
2. मायग्रेशन करताना कोणत्याही परिस्थितीत `CustomerID = 0` राहू नये. ग्राहकाचा योग्य CIF आयडी जोडलाच पाहिजे.
3. जुन्या खात्यांचे व्याज काढताना `LegacyAccruedInt` धरूनच पुढील दिवसांचे व्याज काढले जाईल जेणेकरून ३१ मार्च पूर्वीचे व्याज दुबार मोजले जाणार नाही.

---

### [RULE-FD-008] फ्रंटएंड-बॅकएंड एंडपॉइंट सुसंगतता (Endpoint URL Uniformity)
1. अहवाल आणि लेजर पाहण्यासाठी चुकीचे किंवा अस्तित्वात नसलेले URLs (उदा. `/api/Reports/fd-member-ledger/...`) कॉल करता येणार नाहीत.
2. अधिकृत एंडपॉइंट्स:
   - लेजर: `GET /api/FdAccounts/CustomerLedger/{customerId}` किंवा `GET /api/FdAccounts/MemberLedger/{memberId}`
   - बचत खाती शोधणे: `GET /api/SavingAccounts?customerId={customerId}` (नेहमी `customerId` पाठवणे अनिवार्य आहे).
   - मुदत ठेव यादी: `GET /api/FdAccounts?branchId={branchId}`

---

### [RULE-FD-009] मुदत ठेव स्थलांतर मुदतपूर्ती रक्कम स्वयं-गणना व संपादन स्वातंत्र्य (Migration Maturity Auto-Calculation with Override)
1. जुनी मुदत ठेव खाती स्थलांतरित करताना (`FdOpeningBalanceMigration`), ठेव मुद्दल (`depositAmount`), व्याजदर (`interestRate`), ठेव तारीख (`openingDate`), आणि मुदतपूर्ती तारीख (`maturityDate`) भरल्यावर सिस्टीमने मुदतपूर्ती रक्कम (`maturityAmount`) आपोआप (Auto-calculate) मोजलीच पाहिजे.
2. योजनानिहाय गणना सूत्रे:
   - **मासिक व्याज योजना (MIS / Monthly Interest):** $\text{MaturityAmount} = \text{DepositAmount}$ (कारण व्याज दरमहा आधीच ग्राहकाला अदा केले जाते).
   - **चक्रवाढ मुदत ठेव (Cumulative / Reinvestment / Damduppat):** $A = P \times \left(1 + \frac{r}{400}\right)^{4 \times t}$ (त्रैमासिक चक्रवाढ, राऊंडेड टू होल रुपी).
   - **साधी मुदत ठेव (Simple / Quarterly Payout):** $A = P + \left(\frac{P \times r \times t}{100}\right)$
3. **संपादन स्वातंत्र्य (Manual Override):** जुन्या छापील पावतीवरील मुदतपूर्ती रक्कम ही कायदेशीर करार असल्याने, जर जुन्या पावतीवर राउंडिंगमुळे काही रुपयांचा फरक असेल, तर ऑपरेटरला तो आकडा मॅन्युअली एडिट करण्याची पूर्ण मुभा असेल. तसेच पुन्हा ऑटो-कॅल्क्युलेट करण्यासाठी 🔄 चिन्ह उपलब्ध असेल.
4. **सुरक्षा नियम (Validation Guardrails):** कोणत्याही परिस्थितीत मुदतपूर्ती रक्कम ही मुद्दलापेक्षा कमी असता कामा नये:
   $$\text{MaturityAmount} \ge \text{DepositAmount}$$
   तसेच मुदतपूर्ती रक्कम रिकामी किंवा ० राहिल्यास सिस्टीमने ऑटो-कॅल्क्युलेटेड व्हॅल्यू आपोआप गृहीत धरली पाहिजे.

---

### [RULE-FD-010] मुदत ठेव स्थलांतर मुदतपूर्ती तारीख स्वयं-गणना व संपादन स्वातंत्र्य (Migration Maturity Date Auto-Calculation with Override)
1. **स्वयं-गणना नियम (Auto-Calculation Invariance):** मुदत ठेव सुरुवातीची शिल्लक स्थलांतर फॉर्ममध्ये ठेव तारीख (`openingDate`) निवडताच किंवा बदलताच, निवडलेल्या योजनेच्या कालावधीनुसार (`DurationMonths`) मुदतपूर्ती तारीख (`maturityDate`) आपोआप मोजली गेली पाहिजे:
   $$\text{MaturityDate} = \text{OpeningDate} + \text{Scheme.DurationMonths}$$
2. **दिनदर्शिका अचूकता (Calendar & Leap Year Overflow Safety):** तारीख वाढवताना महिना ओव्हरफ्लो (उदा. ३१ जानेवारी + १ महिना = २८/२९ फेब्रुवारी, २ मार्च नव्हे) आणि टाइमझोन शिफ्ट होऊ नये म्हणून स्ट्रिंग-आधारित सुरक्षित दिनदर्शिका अल्गोरिदम वापरला जाईल.
3. **संपादन स्वातंत्र्य (Manual Override Freedom):** जुन्या छापील पावतीवरील मुदतपूर्ती तारीख काही कारणास्तव (उदा. बँक सुट्टी, ३०/३१ दिवसांचा फरक) १-२ दिवस वेगळी असल्यास ऑपरेटरला ती मॅन्युअली एडिट करण्याची पूर्ण मुभा असेल.
4. **मूळ मुदत री-कॅल्क बटण (Recalculate Button):** मॅन्युअल संपादन केल्यानंतर पुन्हा एका क्लिकवर योजनेच्या मूळ मुदतीनुसार तारीख आणण्यासाठी 🔄 'री-कॅल्क' बटण उपलब्ध असेल.
5. **रक्कम लिंकेज (Amount Linkage):** मुदतपूर्ती तारीख ऑटो किंवा मॅन्युअल बदलल्यास, त्यानुसार मुदतपूर्ती रक्कम (`maturityAmount`) सुद्धा रिअल-टाईम री-कॅल्क्युलेट झाली पाहिजे.
6. **सुरक्षा नियम (Validation):** मुदतपूर्ती तारीख ही ठेव तारखेपेक्षा नेहमी पुढीलच असली पाहिजे ($\text{MaturityDate} > \text{OpeningDate}$).

---

### [RULE-FD-011] मुदत ठेव शेवटची व्याज पोस्टिंग तारीख व अचूक तरतूद नियम (FD Last Interest Posting Date & Accrual Invariance Rule)
1. **दुबार व्याज प्रतिबंध नियम (Zero Duplicate Accrual Invariance):** जुनी मुदत ठेव खाती स्थलांतरित करताना (`FdOpeningBalanceMigration`), ज्या तारखेपर्यंत जुन्या सॉफ्टवेअरमध्ये व्याज पोस्टिंग/तरतूद/अदायगी झाली होती, ती तारीख `LastInterestPostingDate` म्हणून नोंदवली जाणे आवश्यक आहे (उदा. ३१/०३/२०२६ पूर्वीच्या खात्यांसाठी डिफॉल्ट `31/03/2026`).
2. **व्याज गणना प्रारंभ तारीख (Accrual Start Date Hierarchy):** नवीन आर्थिक वर्षात त्रैमासिक व्याज तरतूद (Accrual Run) करताना दिवस मोजण्याची सुरुवातीची तारीख खालील प्राधान्यक्रमानेच ठरवली जाईल:
   $$\text{FromDate} = \text{LastAccrual.AccrualDate} \;\;??\;\; \text{Account.LastInterestPostingDate} \;\;??\;\; \text{Account.OpeningDate}$$
3. **अखंड अद्ययावतीकरण (Auto-Update on Provision):** जेव्हा सिस्टीममध्ये कोणत्याही मुदत ठेव खात्यावर व्याज तरतूद किंवा अदायगी यशस्वीरीत्या पोस्ट होते, तेव्हा त्या खात्याचा `LastInterestPostingDate = AccrualDate` तात्काळ ऑटो-अपडेट झालाच पाहिजे.
4. **लेखापरीक्षण ताळेबंद सुसंगतता (Audit Liability Pairing):**
   - `LegacyAccruedInt` = ३१ मार्च २०२६ पर्यंत संस्थेने देणे असलेले एकूण साचलेले व्याज (Amount ₹ - ताळेबंद देयता).
   - `LastInterestPostingDate` = हे व्याज ज्या तारखेपर्यंत मोजले गेले ती तारीख (Timeline Cut-off).

---

## ३. संबंधित फाइल्स आणि जबाबदाऱ्या (Files Inventory)

| फाईल मार्ग (File Path) | प्रकार | जबाबदारी |
|---|---|---|
| [`api/Bhisi.Api/Models/FdAccount.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Models/FdAccount.cs) | Backend Model | मुदत ठेव खाते मुख्य मॉडेल (`CustomerID` फॉरेन की सह) |
| [`api/Bhisi.Api/Models/FdScheme.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Models/FdScheme.cs) | Backend Model | ठेव योजना व ४ खातावही मॅपिंग |
| [`api/Bhisi.Api/Models/FdTransaction.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Models/FdTransaction.cs) | Backend Model | खात्याचे सर्व आर्थिक व्यवहार (Opening, Accrual, Payout) |
| [`api/Bhisi.Api/Models/FdInterestAccrual.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Models/FdInterestAccrual.cs) | Backend Model | नियमित व्याज तरतूद लॉग |
| [`api/Bhisi.Api/Controllers/FdAccountsController.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/FdAccountsController.cs) | Backend Controller | खाते उघडणे, बल्क स्प्लिट, व्याज, क्लोजर, रिन्यूअल |
| [`api/Bhisi.Api/Controllers/FdSchemesController.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/FdSchemesController.cs) | Backend Controller | योजना CRUD व लेजर असाइनमेंट |
| [`client/src/components/FdAccountOpening.tsx`](file:///d:/Bhisi%20Software/client/src/components/FdAccountOpening.tsx) | Frontend Form | नवीन ठेव खाते व बल्क स्प्लिट फॉर्म |
| [`client/src/components/FdWithdrawalMaturity.tsx`](file:///d:/Bhisi%20Software/client/src/components/FdWithdrawalMaturity.tsx) | Frontend Form | मुदतपूर्ती परतावा, मुदतपूर्व बंद आणि नूतनीकरण |
| [`client/src/components/FdAccrualPosting.tsx`](file:///d:/Bhisi%20Software/client/src/components/FdAccrualPosting.tsx) | Frontend Form | एकत्रित व्याज तरतूद आणि पोस्टिंग |
| [`client/src/components/FdOpeningBalanceMigration.tsx`](file:///d:/Bhisi%20Software/client/src/components/FdOpeningBalanceMigration.tsx) | Frontend Form | जुन्या चालू खात्यांचे स्थलांतर |
| [`client/src/components/FdReports.tsx`](file:///d:/Bhisi%20Software/client/src/components/FdReports.tsx) | Frontend Reports | नोंदवही, बाकी, मुदतपूर्ती व लेजर अहवाल |
| [`client/src/components/FdReceiptPrintModal.tsx`](file:///d:/Bhisi%20Software/client/src/components/FdReceiptPrintModal.tsx) | Frontend Print | कोऱ्या कागदावर / छापील पावतीवर प्रिंटींग व WhatsApp |

---

## ४. नियम बदल किंवा जोडणी प्रक्रिया (Rule Modification Protocol)

जेव्हा कधी संस्थेच्या धोरणात किंवा सॉफ्टवेअरमध्ये FD संदर्भात कोणताही नवीन नियम (New Rule) जोडायचा असेल:
1. तो नियम थेट कोडमध्ये टाकण्यापूर्वी **याच फाईलमध्ये [RULE-FD-XXX] या क्रमाने जोडला जाईल**.
2. नियमाचे वर्णन, इनव्हॅरिएंट (कधीही न बदलणारी अट), आणि अकाउंटिंग परिणाम स्पष्ट नमूद केले जातील.
3. त्यानंतरच कोड आणि टेस्ट्समध्ये बदल केले जातील.

*कोणत्याही डेव्हलपर किंवा AI असिस्टंटला या नियमांचे उल्लंघन करण्याचा अधिकार नाही.*
