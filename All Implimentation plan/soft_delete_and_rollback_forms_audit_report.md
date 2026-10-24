# स्मार्टबँकिंग सीबीएस (SmartBanking CBS)
## सॉफ्ट डिलीट, डीअॅक्टिव्हेशन व वित्तीय रोलबॅक पर्यायांचा सर्वंकष अहवाल (Audit & Architecture Report)

**दिनांक:** २५ ऑक्टोबर २०२६  
**प्रणाली:** SmartBanking Multi-Sanstha Core Banking System (v2.5.91)  
**अहवाल प्रकार:** सिस्टीम-व्यापी डेटा डिलीशन, सॉफ्ट डिलीट व रोलबॅक यंत्रणा ऑडिट अहवाल  

---

### १. कार्यकारी सारांश (Executive Summary)

सहकारी बँकिंग व पतसंस्था नियमावली (Maharashtra Co-operative Societies Act व RBI Audit Guidelines) नुसार, बँकिंग सॉफ्टवेअरमधील प्रत्येक डेटा नोंद वैधानिक ऑडिटच्या कक्षेत येते. त्यामुळे स्मार्टबँकिंग सीबीएस प्रणालीमध्ये साध्या 'Hard Delete' ऐवजी सुरक्षिततेचे **४ मुख्य स्तर (Tiers)** तयार करण्यात आले आहेत:

1. **शुद्ध सॉफ्ट डिलीट (Pure Soft Delete - `IsDeleted = 1 / true`):**  
   डेटाबेस टेबलातून रेकॉर्ड प्रत्यक्ष नष्ट न होता फक्त फ्लॅग `IsDeleted = 1` होतो. युनिक इंडेक्स आणि सर्च क्वेरीज् मध्ये `[IsDeleted] = 0` फिल्टर लावून ॲक्टिव्ह स्क्रीनवरून ती नोंद अदृश्य होते, परंतु फॉरेन्सिक ऑडिटसाठी कायम सुरक्षित राहते.
2. **स्थिती निष्क्रियीकरण (Soft Deactivation - `IsActive = false` किंवा `Status = 'Inactive'`):**  
   मास्टर्स (योजना, लेजर्स, ऑपरेटर, शाखा) ज्यांच्यावर आधीच खाती किंवा व्यवहार झालेले आहेत, त्यांना डिलीट करण्याऐवजी निष्क्रिय केले जाते. यामुळे चालू खात्यांवर परिणाम होत नाही आणि नवीन नोंदींमध्ये ती योजना/लेजर निवडता येत नाही.
3. **वित्तीय रोलबॅक व व्हाउचर्स रिव्हर्सल (Financial Reversal & Voucher Rollback):**  
   व्यवहार पावती (उदा. मुदत ठेव, कर्ज वसुली, कर्ज वितरण, सेव्हिंग व्यवहार) डिलीट केल्यास खाते शिल्लक पूर्ववत होते, जोडलेले जनरल लेजर व्हाउचर्स (JV/Receipt/Payment) आपोआप उलटवले (Reverse) जातात आणि ऑडिट लॉग नोंदवले जातात.
4. **कडक पूर्व-अटींसह डिलीट (Conditional Delete with Pre-dependency Checks):**  
   जर सभासद किंवा खातेदारावर एकही सक्रिय खाते, कर्ज, जामीनकी किंवा शेअर्स शिल्लक नसतील, तरच स्वच्छतेसाठी डिलीटची मुभा मिळते.

---

### २. फॉर्म व मॉड्यूलनिहाय सविस्तर वर्गीकरण

---

#### वर्ग १: शुद्ध सॉफ्ट डिलीट व सॉफ्ट डीअॅक्टिव्हेशन (Soft Delete / Soft Deactivation)

| अ.क्र. | मॉड्यूल | फॉर्म / स्क्रीन नाव | Frontend Component | Backend Controller | डिलीट / बंद प्रकार | सविस्तर कार्यपद्धती व परिणाम |
|:---:|:---|:---|:---|:---|:---|:---|
| **१** | ग्राहक व्यवस्थापन | **खातेदार नोंदणी (Customer Master)** | [CustomerMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/CustomerMaster.tsx) | [CustomersController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/CustomersController.cs) | `IsDeleted` फ्लॅग व पूर्व-अट डिलीट | डेटाबेस टेबलमध्ये `[IsDeleted]` कॉलम व युनिक इंडेक्स फिल्टर आहे. ९ अवलंबित्वे (बचत, कर्ज, FD, RD, पिग्मी, शेअर्स, लॉकर, ओपनिंग बॅलन्स) तपासली जातात; व्यवहार असल्यास डिलीट रोखले जाते. |
| **२** | सभासद व्यवस्थापन | **सभासद नोंदणी (Member Master)** | [MemberMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/MemberMaster.tsx) | [MembersController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/MembersController.cs) | `IsDeleted` फ्लॅग व पूर्व-अट डिलीट | `[Members].[IsDeleted]` सपोर्टेड. ११ मॉड्यूल्स (कर्ज, जामीनदार, बचत, मुदत ठेव, शेअर्स, संचालक मंडळ, १०१ वसुली केस) तपासले जातात. |
| **३** | सभासद व्यवस्थापन | **संयुक्त सभासद (Joint Member Master)** | [JointMembersController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/JointMembersController.cs) | [JointMembersController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/JointMembersController.cs) | `IsDeleted` सॉफ्ट डिलीट | मूळ सभासदाशी जोडलेले सह-सभासद डिलीट करताना सॉफ्ट फ्लॅग वापरला जातो. |
| **४** | हिशोब व खतावणी | **लेजर खाते मास्टर (Ledger Master)** | [LedgerMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/LedgerMaster.tsx) | [LedgersController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/LedgersController.cs) | `IsActive = false` (सॉफ्ट निष्क्रिय) | लेजरवर एकही व्हाउचर असल्यास **Hard Delete पूर्णपणे ब्लॉक** केले जाते व युझरला 'Inactive (निष्क्रिय)' करण्याचा सल्ला दिला जातो. |
| **५** | मुदत ठेव योजना | **FD योजना मास्टर (FD Scheme Master)** | [FdSchemeMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/FdSchemeMaster.tsx) | [FdSchemesController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/FdSchemesController.cs) | `IsActive = false` (सॉफ्ट बंद) | चालू FD खाती असल्यास योजना डिलीट होत नाही. योजनेचा `IsActive` टॉगल करून नवीन ठेवींसाठी बंद करता येते. |
| **६** | आवर्ती ठेव योजना | **RD योजना मास्टर (RD Scheme Master)** | [RdAccountOpening.tsx](file:///d:/Bhisi%20Software/client/src/components/RdAccountOpening.tsx) | [RdSchemesController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/RdSchemesController.cs) | `IsActive = false` (सॉफ्ट बंद) | सक्रिय आरडी खाती असणाऱ्या योजनांना सुरक्षा लॉक असते; केवळ नवीन खात्यांसाठी इन-ॲक्टिव्ह करता येते. |
| **७** | पिग्मी ठेव योजना | **पिग्मी योजना मास्टर (Pigmy Scheme Master)** | [PigmySchemeMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/PigmySchemeMaster.tsx) | [PigmySchemesController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/PigmySchemesController.cs) | `IsActive = false` व स्लॅब डीअॅक्टिव्हेशन | खाती जोडलेली असल्यास डिपेंडन्सी पॉपअप दाखवून 'Inactive' करण्याचा सुरक्षित पर्याय मिळतो. |
| **८** | कर्ज व्याजदर योजना | **कर्ज योजना मास्टर (Loan Rate Master)** | [LoanRateMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/LoanRateMaster.tsx) | [LoanRatesController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/LoanRatesController.cs) | `IsActive = false` (सॉफ्ट बंद) | वितरित कर्जे चालू असेपर्यंत योजना डिलीट करता येत नाही; केवळ सॉफ्ट निष्क्रिय केली जाते. |
| **९** | भाग भांडवल योजना | **शेअर्स योजना मास्टर (Share Scheme Master)** | [ShareSchemeMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/ShareSchemeMaster.tsx) | [ShareSchemesController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/ShareSchemesController.cs) | `IsActive = false` (सॉफ्ट बंद) | शेअर्स वाटप झालेल्या योजना कायमस्वरूपी लॉक असतात. |
| **१०** | प्रतिनिधी व्यवस्थापन | **पिग्मी एजंट मास्टर (Pigmy Agent Master)** | [PigmyAgentMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/PigmyAgentMaster.tsx) | [PigmyAgentsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/PigmyAgentsController.cs) | `Status = 'Inactive'` (सॉफ्ट निष्क्रिय) | एजंटकडे शिल्लक कॅश, कलेक्शन्स किंवा खाती असल्यास थेट डिलीट होत नाही. खाती दुसऱ्या एजंटकडे हस्तांतरित करून स्टेटस 'Inactive' केला जातो. |
| **११** | युझर व सुरक्षा | **ऑपरेटर व युझर्स (Users Management)** | `UsersMaster` | [UsersController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/UsersController.cs) | `IsActive = false, IsLocked = true` | **Delete Endpoint अस्तित्वात नाही!** बँकिंग ऑडिट नियमानुसार युझर कायमस्वरूपी केवळ Deactivate किंवा Account Lock केला जातो. |
| **१२** | संस्था रचना | **शाखा मास्टर (Branch Master)** | [BranchMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/BranchMaster.tsx) | [BranchesController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/BranchesController.cs) | `IsActive = false` | व्यवहार असणारी शाखा डिलीट होत नाही; सॉफ्ट बंद केली जाते. |

---

#### वर्ग २: वित्तीय उलट नोंद, व्हाऊचर रिव्हर्सल व रोलबॅक (Financial Reversal & Rollback Deletion)

| अ.क्र. | मॉड्यूल | फॉर्म / स्क्रीन नाव | Frontend Component | Backend Controller | रोलबॅक व रिव्हर्सल कार्यपद्धती (Financial Impact) |
|:---:|:---|:---|:---|:---|:---|
| **१३** | मुदत ठेव | **मुदत ठेव पावती (FD Account Opening)** | [FdAccountOpening.tsx](file:///d:/Bhisi%20Software/client/src/components/FdAccountOpening.tsx) | [FdAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/FdAccountsController.cs) | **पूर्ण वित्तीय रोलबॅक:**<br>• FD खाते डिलीट केल्यास संबंधित JV/Receipt व्हाउचर आपोआप रिव्हर्स/डिलीट होतात.<br>• जर ठेव बचत खात्यातून ट्रान्सफरने भरली असेल तर बचत खात्यात रक्कम त्वरित परत जमा (Refund) होते.<br>• कर्जास तारण (Lien/Pledged) असल्यास डिलीट ब्लॉक होते.<br>• **विशेष नोंद:** डिलीट केलेल्या नोंदी **'मुदत ठेव थेट रद्द नोंदी व रोलबॅक अहवाल (FD Deleted Entries Report)'** मध्ये कायम दिसतात! |
| **१४** | कर्ज वसुली | **कर्ज वसुली पावती (Loan Collection Entry)** | [LoanCollectionMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/LoanCollectionMaster.tsx) | [LoanCollectionsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/LoanCollectionsController.cs) | **कर्ज व रोख शिल्लक रोलबॅक:**<br>• वसुली पावती डिलीट केल्यास मुद्दल शिल्लक (`PrincipalBalance`), दंडात्मक व्याज व येणे व्याज कर्ज खात्यात पुन्हा पूर्ववत वाढवले जाते.<br>• कर्ज बंद झाले असल्यास पुन्हा 'Active' होते.<br>• शेवटच्या हप्त्याची तारीख (`LastInstallmentPaidDate`) मागील पावतीवर रिस्टोअर होते.<br>• रोख व्हाउचर व आंतरशाखा (IBT) व्हाउचर आपोआप उलटवले जातात. |
| **१५** | कर्ज वितरण | **कर्ज वाटप (Loan Disbursement Master)** | [LoanDistributionListModal.tsx](file:///d:/Bhisi%20Software/client/src/components/LoanDistributionListModal.tsx) | [LoanDisbursementsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/LoanDisbursementsController.cs) | **वाटप कपात व खाते रोलबॅक:**<br>• वाटप रद्द केल्यास कर्जातून कापलेले शेअर्स, बचत ठेव किंवा इतर कपाती उलटवून संबंधित खात्यांतून वजा होतात.<br>• वाटप व्हाउचर रद्द होऊन कर्ज खाते पुन्हा 'मंजूर (Approved)' स्थितीवर जाते. |
| **१६** | कर्ज खाते | **कर्ज खाते व ओपनिंग शिल्लक (Loan Account Master)** | [LoanOpeningBalanceMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/LoanOpeningBalanceMaster.tsx) | [LoanAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/LoanAccountsController.cs) | **तारण व GL रोलबॅक:**<br>• कर्ज खाते डिलीट केल्यास तारण ठेव पावतीवरील 'Lien' आपोआप मोकळा होतो.<br>• कर्ज योजनेच्या GL ओपनिंग बॅलन्सचे रि-सिंक होते.<br>• फॉरेन्सिक ऑडिट लॉग (`LOAN_ACCOUNT_DELETED`) मध्ये ऑपरेटर, आयपी आणि खात्याची सर्व माहिती कायमस्वरूपी नोंदवली जाते. |
| **१७** | कर्ज अर्ज | **कर्ज मागणी अर्ज (Loan Application)** | [LoanApplicationMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/LoanApplicationMaster.tsx) | [LoanApplicationsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/LoanApplicationsController.cs) | **कॅस्केड सुरक्षा तपासणी:**<br>• जर अर्जावर आधीच हप्ता वसुली (EMI) झाली असेल, तर डिलीट १००% प्रतिबंधित असते.<br>• वसुली नसल्यास जोडलेले वाटप, शेअर्स कपात आणि व्हाउचर्स सुरक्षितपणे रोलबॅक होतात. |
| **१८** | बचत व्यवहार | **बचत ठेव / काढणे व्यवहार (Saving Transaction Entry)** | [SavingTransactionEntry.tsx](file:///d:/Bhisi%20Software/client/src/components/SavingTransactionEntry.tsx) | [SavingTransactionsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/SavingTransactionsController.cs) | **शिल्लक व ट्रान्सफर रिव्हर्सल:**<br>• व्यवहार डिलीट केल्यास खात्याची शिल्लक उलटवली जाते.<br>• जर हा ट्रान्सफर व्यवहार असेल तर दुसऱ्या खात्यातील जमा/नावे नोंदही एकाच ट्रान्झॅक्शनमध्ये उलटवली जाते.<br>• **दिवस अखेर (EOD) लॉक:** संबंधित दिवसाची दिवस अखेर झाली असल्यास डिलीट पूर्णपणे बंद असते. |
| **१९** | बचत खाते | **बचत खाते नोंदणी (Saving Account Master)** | [SavingAccountMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/SavingAccountMaster.tsx) | [SavingAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/SavingAccountsController.cs) | **व्यवहार तपासणी:**<br>• खात्यावर ओपनिंग बॅलन्सव्यतिरिक्त कोणताही व्यवहार झाला असल्यास खाते डिलीट करता येत नाही.<br>• केवळ नवीन उघडलेले किंवा ओपनिंग शिल्लक असलेले खाते GL बॅलन्स रिव्हर्स करून हटवता येते. |
| **२०** | आवर्ती ठेव | **आरडी खाते नोंदणी (RD Account Opening)** | [RdAccountOpening.tsx](file:///d:/Bhisi%20Software/client/src/components/RdAccountOpening.tsx) | [RdAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/RdAccountsController.cs) | **हप्ता व शेड्युल रोलबॅक:**<br>• नंतरचे हप्ते भरले असल्यास डिलीट प्रतिबंधित.<br>• केवळ नवीन खाते असल्यास हप्ता वेळापत्रक (Schedules), व्याज तरतूद आणि पावती व्हाउचर्स रोलबॅक होतात; खाते नंबर अनुक्रम (Sequence) पूर्ववत होतो. |
| **२१** | पिग्मी खाते | **पिग्मी खाते नोंदणी (Pigmy Account Opening)** | [PigmyAccountOpening.tsx](file:///d:/Bhisi%20Software/client/src/components/PigmyAccountOpening.tsx) | [PigmyAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/PigmyAccountsController.cs) | **कलेक्शन व व्याज कॅस्केड रोलबॅक:**<br>• खाते डिलीट करताना संबंधित पिग्मी कलेक्शन्स, व्याज नोंदी व ओपनिंग व्हाउचर्स स्वच्छ केले जातात. |
| **२२** | पिग्मी डे-बुक | **एजंट कॅश भरणा पावती (Agent Day Book Deposit)** | [AgentDayBookMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/AgentDayBookMaster.tsx) | [AgentDayBookController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/AgentDayBookController.cs) | **कॅश व डिनॉमिनेशन रोलबॅक:**<br>• भरणा पावती डिलीट केल्यास संबंधित कॅश व्हाउचर व नोटांचा तपशील (Denominations) रोलबॅक होतो.<br>• व्हाउचर पास (Approved) झाले असल्यास डिलीट रोखले जाते. |
| **२३** | शेअर्स शिल्लक | **शेअर्स ओपनिंग व प्रमाणपत्र (Share Opening Balance & Certificate)** | [ShareOpeningBalance.tsx](file:///d:/Bhisi%20Software/client/src/components/ShareOpeningBalance.tsx) | [ShareAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/ShareAccountsController.cs) | **प्रमाणपत्र शिल्लक रोलबॅक:**<br>• विशिष्ट शेअर्स दाखला डिलीट केल्यास तेवढ्या शेअर्सची संख्या व रक्कम मुख्य शेअर खात्यातून व सभासद ओपनिंग शिल्लकीतून अचूक वजा होते. |
| **२४** | जर्नल व्हाउचर्स | **व्हाउचर नोंदणी व मंजुरी (Voucher Entry & Posting)** | [VoucherMaster.tsx](file:///d:/Bhisi%20Software/client/src/components/VoucherMaster.tsx) व [VoucherPosting.tsx](file:///d:/Bhisi%20Software/client/src/components/VoucherPosting.tsx) | [VouchersController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/VouchersController.cs) | **कठोर ऑडिट नियंत्रण व 'DELETED' स्टेटस:**<br>• **किमान १० अक्षरांचे कारण** लिहिणे सक्तीचे.<br>• मंजूर (Approved) व्हाउचर डिलीट करण्याचा अधिकार **फक्त HO Manager** कडे.<br>• संबंधित बचत व्यवहार 'DELETED' कारणासह रिव्हर्स होतात.<br>• FD व्याज पोस्टिंगची शेवटची तारीख रोलबॅक होते. |
| **२५** | गुंतवणूक खाती | **बँक गुंतवणूक खाती (Investment Account Master)** | [InvestmentAccountOpening.tsx](file:///d:/Bhisi%20Software/client/src/components/InvestmentAccountOpening.tsx) | [InvestmentAccountsController.cs](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/InvestmentAccountsController.cs) | **मुदतपूर्ती लॉक व सिक्वेन्स रोलबॅक:**<br>• मुदतपूर्ती (Maturity Claim) झाली असल्यास डिलीट रोखले जाते.<br>• डिलीट केल्यास गुंतवणूक व्हाउचर व नंबर सिक्वेन्स पूर्ववत होतात. |

---

#### वर्ग ३: कायदेशीर व ऑडिट सुरक्षिततेसाठी डिलीट पर्याय नसलेले फॉर्म्स (No Delete Option - Immutable)

बँकिंग नियमांनुसार खालील फॉर्म्सवर कोणताही Delete किंवा Rollback पर्याय दिलेला नाही:

1. **दिवस अखेर (EOD / Day End Operations):**  
   एकदा संस्थेचा दिवस बंद (Day Closed) झाला की त्या तारखेचा कोणताही कॅश व्यवहार, व्हाउचर किंवा पावती डिलीट करता येत नाही.
2. **आर्थिक वर्ष समाप्ती (Year End Operations):**  
   ऑडिट पूर्ण होऊन नफा-तोटा भांडवलीकरण (P&L Capitalization) व नवीन वर्षाचे ओपनिंग बॅलन्स निर्माण झाल्यानंतर मागील वर्षातील नोंदी डिलीट करता येत नाहीत.
3. **खाते बंद नोंद (Account Closure Transactions):**  
   बचत, पिग्मी किंवा आरडी खाते बंद केल्यावर ते डिलीट होत नाही; त्याची स्थिती `Status = 'Closed'` होते आणि अंतिम व्याज व परतावा व्हाउचर कायमस्वरूपी नोंदवले जाते.
4. **लॉकर सरेंडर (Locker Surrender):**  
   लॉकर सोडल्यावर खाते डिलीट होत नाही; `Allotment.Status = 'Surrendered'` आणि लॉकर क्रमांक 'Available' होतो.
5. **सिस्टीम ऑडिट लॉग (Audit Logs):**  
   युझर्सने लॉगिन, लॉगआउट, पावती तयार करणे, बदल किंवा डिलीट केल्याच्या सर्व नोंदी अपरिवर्तनीय (Read-Only) असतात.

---

### ३. 'सॉफ्ट डिलीट' संदर्भातील विद्यमान अहवाल (Special Reports)

सिस्टीममध्ये डिलीट झालेल्या नोंदी तपासण्यासाठी आधीच स्वतंत्र अहवाल उपलब्ध आहे:
* **अहवाल नाव:** मुदत ठेव थेट रद्द नोंदी व रोलबॅक अहवाल (Fixed Deposit Deleted Entries & Rollback Audit)
* **मेन्यू मार्ग:** `अहवाल डॅशबोर्ड (Report Dashboard) -> ७. मुदत ठेव थेट रद्द नोंदी व रोलबॅक अहवाल`
* **वैशिष्ट्ये:** कोणत्या युझरने (`DeletedBy`), कोणत्या तारखेला (`DeletedDate`), कोणते खाते क्र., रक्कम व कारणासह रद्द केले याचा सविस्तर ऑडिट ट्रेल एक्सेल व पीडीएफ एक्सपोर्टसह उपलब्ध आहे.

---

### ४. निष्कर्ष व शिफारशी (Key Takeaways & Recommendations)

1. **आर्थिक सुरक्षितता:**  
   स्मार्टबँकिंग सीबीएसमध्ये 'कलेक्शन', 'डिपॉझिट', 'लोन वितरण' किंवा 'व्हाउचर' डिलीट केल्यास **सिस्टीममधील लेजर आणि शिल्लक कधीही विस्कळीत होत नाही**; कारण प्रत्येक डिलीशनच्या पाठीमागे संपूर्ण वित्तीय रोलबॅक (Voucher Reversal & Account Balance Restoration) कार्यान्वित आहे.
2. **सॉफ्ट डिलीटचा विस्तार:**  
   `Customers` आणि `Members` टेबलांप्रमाणेच जर व्यवस्थापनास **सर्व खाती (Accounts) व व्हाउचर्स** टेबल्समध्ये प्रत्यक्ष डिलीट न करता `IsDeleted = 1` करायचे असल्यास, सध्याच्या रोलबॅक इंजिनसोबत फक्त एका आर्किटेक्चरल पॅचद्वारे 'Universal Soft Delete' लागू करता येऊ शकते.
