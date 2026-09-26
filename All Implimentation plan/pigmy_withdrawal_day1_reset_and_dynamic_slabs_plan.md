# 🏛️ संपूर्ण अंमलबजावणी आराखडा: पिग्मी डायनॅमिक स्लॅब्स, अंशतः विड्रॉल 'Day 1' रीसेट नियम व मुदतपूर्ती व्यवस्थापन
### (Enterprise Implementation Plan: Pigmy Dynamic Slabs, Partial Withdrawal 'Day 1' Reset Rule & Fixed Expiry Architecture)

**दस्तऐवज आवृत्ती:** २.० (मल्टी-स्कीम, सायकल रीसेट व लीप वर्ष समाविष्ट)  
**तारीख:** २६ सप्टेंबर २०२६  
**प्रकल्प:** स्मार्ट बँकिंग को-ऑपरेटिव्ह कोअर बँकिंग सिस्टीम (SmartBanking CBS)  
**मॉड्युल:** पिग्मी ठेव व्यवस्थापन (Pigmy Daily Deposit System)

---

## १. पार्श्वभूमी व उद्दिष्ट (Executive Summary & Scope)

आज सकाळपासून झालेल्या सखोल तांत्रिक चर्चेनुसार, पिग्मी (दैनिक ठेव) योजनेमध्ये दोन मोठे टप्पे निश्चित करण्यात आले आहेत:

1. **टप्पा १ (आधीच पूर्ण व सत्यापित):** 
   - कोणत्याही पिग्मी योजनेसाठी **डायनॅमिक स्लॅब्स (Dynamic Slabs)** तयार करणे.
   - प्रत्येक योजनेचे स्लॅब्स एकमेकांपासून स्वतंत्र (Isolated) असणे.
   - स्लॅबनुसार **महिने निवडणे (Month Selector)**, शून्य ओव्हरराईट बग (`01` इनपुट) दुरुस्त करणे.
   - फॉर्म सुटसुटीत ठेवण्यासाठी वरचे अनावश्यक बटणे व सिम्युलेशन बॉक्स काढून खाली एकच **`+ नवीन स्लॅब जोडा (Add Next Slab)`** बटण ठेवणे.

2. **टप्पा २ (नवीन चर्चा व अंमलबजावणी योजना - No Code Changes Yet):**
   - पिग्मी खात्यातून ग्राहकाने मधेच कोणतीही रक्कम काढल्यास (Partial Withdrawal):
     - काढलेली रक्कम तत्कालीन कालावधीनुसार सेटल करणे.
     - **उर्वरित शिल्लक रकमेसाठी कालावधीचा घड्याळ पुन्हा Day 1 (दिवस १) वर रीसेट करणे.**
     - जोपर्यंत खाते मॅच्युरिटी गाठत नाही, तोपर्यंत ही प्रक्रिया अखंड चालू ठेवणे (`Repeat until maturity hit`).
   - **पर्याय 'ब' (Fixed Expiry Date):** मूळ मॅच्युरिटी तारीख न बदलता, शेवटच्या रीसेटपासून मूळ मुदतीपर्यंत जेवढे महिने भरतील, तेवढ्याच महिन्यांचा स्लॅब अंतिम दिवशी लावणे.
   - **लीप वर्ष (Leap Year - ३६६ दिवस) मधील १२ महिन्यांचा अचूक नियम.**

---

## २. 'Day 1 रीसेट' आणि 'मॅच्युरिटी गाठेपर्यंत पुनरावृत्ती' नियम (Business Logic)

### २.१ मूळ बँकिंग नियम
पिग्मी ही **"दैनिक अल्पबचत"** असल्याने ग्राहकाने पूर्ण मुदतीपर्यंत पैसे अखंड जमा ठेवावेत अशी अपेक्षा असते. जर ग्राहकाने मधेच पैसे काढले, तर अखंडतेचा नियम (Tenure Continuity) भंग पावतो.

### २.२ टाइमलाइन उदाहरण (Cycle Timeline)
समजा योजना **१२ महिने मुदतीची** आहे आणि ग्राहक दरमहा ₹२,००० जमा करत आहे:
* **योजना स्लॅब:** 
  - ० ते ३ महिने: २% दंड कपात
  - ३ ते ६ महिने: ०% (मुद्दल परत)
  - ६ ते ११ महिने: ५.५% अकाली व्याज
  - ११ ते १२ महिने: ६.५% पूर्ण मुदत व्याज

```
[१ जानेवारी २०२६] --------------------> [१ मे २०२६] --------------------> [१ सप्टेंबर २०२६] --------------------> [३१ डिसेंबर २०२६]
खाते उघडले (Day 1)                      पहिली विड्रॉल                            दुसरी विड्रॉल                             Fixed Maturity Date
जमा: ₹०                                 जमा: ₹८,०००                             जमा: ₹१३,०००                              (मूळ मुदत पूर्ण)
सायकल १ सुरू                             ₹३,००० काढले                             ₹४,००० काढले                              शिल्लक रकमेचा हिशोब
                                        उर्वरित: ₹५,०००                          उर्वरित: ₹९,०००
                                        ⏰ Day 1 रीसेट!                           ⏰ Day 1 रीसेट!
                                        सायकल २ सुरू (१ मे)                      सायकल ३ सुरू (१ सप्टें)
```

### २.३ पर्याय 'ब' नुसार अंतिम मॅच्युरिटीचे गणित:
1. **१ सप्टेंबर ते ३१ डिसेंबर २०२६** या दरम्यान कालावधी = **४ महिने**.
2. जरी मूळ खाते १ जानेवारीला उघडले होते आणि ३१ डिसेंबरला १२ महिने झाले, तरी **शेवटची सायकल १ सप्टेंबरला सुरू झाल्याने केवळ ४ महिनेच** भरले!
3. त्यामुळे ३१ डिसेंबरला उर्वरित शिल्लक रकमेवर **३ ते ६ महिन्यांचा स्लॅब (०% व्याज)** लागू होईल. (ग्राहकाला १२ महिन्यांचा ६.५% स्लॅब मिळणार नाही).
4. **फायदा:** यामुळे ग्राहक मधेच पैसे काढण्यापासून परावृत्त होतो आणि बँकेच्या ठेवी सुरक्षित राहतात.

---

## ३. लीप वर्ष (Leap Year) मधील १२ महिन्यांचे गणित

बँकिंग कायद्यानुसार (Negotiable Instruments Act & RBI Standards):

### ३.१ कॅलेंडर महिने नियम (Calendar Month Rule)
* **१२ महिने म्हणजे ३६५ किंवा ३६६ दिवसांची बेरीज नव्हे, तर १२ कॅलेंडर महिने असतात.**
* जर खाते **१ जानेवारी २०२८ (लीप वर्ष)** रोजी उघडले, तर त्याची मुदत **३१ डिसेंबर २०२८** रोजी पूर्ण होते. फेब्रुवारीमध्ये २९ दिवस आले तरी ते १ जानेवारी ते ३१ डिसेंबर या कालावधीत **अचूक १२ कॅलेंडर महिने** मोजले जातात.
* जर खाते **२९ फेब्रुवारी २०२८ (Leap Day)** रोजी उघडले, तर पुढील वर्षी २९ फेब्रुवारी नसल्याने `.AddMonths(12)` द्वारे मुदत **२८ फेब्रुवारी २०२९** ठरते.

### ३.२ दैनिक व्याज आकारणी (Interest Divisor: 365 vs 366)
पिग्मी योजना मास्टरमधील `व्याजाचे दिवस = 365`:
$$\text{दैनिक व्याज} = \frac{\text{रोजची शिल्लक} \times \text{व्याजदर} \times \text{दिवस}}{३६५ \times १००}$$
* **Actual/365 पद्धत:** लीप वर्षात फेब्रुवारीत २९ दिवस आल्यामुळे ग्राहक ३६६ दिवस पैसे जमा ठेवतो आणि त्याला २९ फेब्रुवारीच्या त्या १ अतिरिक्त दिवसाचेही दैनिक व्याज जमा रकमेवर **मिळते**.

---

## ४. डेटाबेस रचना (Database Architecture)

सध्याच्या डेटाबेसला कोणताही धक्का न लावता खालील २ साधे बदल प्रस्तावित आहेत:

### ४.१ `[dbo].[PigmyAccounts]` टेबलमध्ये नवीन फील्ड्स:
```sql
ALTER TABLE [dbo].[PigmyAccounts]
ADD [EffectiveStartDate] DATETIME NULL,           -- चालू सायकलची सुरुवातीची तारीख (डिफॉल्ट = OpeningDate)
    [CurrentCycleNumber] INT NOT NULL DEFAULT 1,  -- चालू सायकल क्रमांक (उदा. १, २, ३...)
    [LastWithdrawalDate] DATETIME NULL,           -- शेवटची विड्रॉल तारीख
    [TotalWithdrawnAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00; -- आतापर्यंत काढलेली एकूण रक्कम
```

### ४.२ `[dbo].[PigmyWithdrawals]` (अंशतः पैसे काढल्याचा इतिहास):
```sql
CREATE TABLE [dbo].[PigmyWithdrawals] (
    [WithdrawalID] INT IDENTITY(1,1) PRIMARY KEY,
    [PigmyAccountID] INT NOT NULL FOREIGN KEY REFERENCES [dbo].[PigmyAccounts]([PigmyAccountID]),
    [WithdrawalDate] DATETIME NOT NULL,
    [CycleNumber] INT NOT NULL,                   -- कितव्या सायकलीत काढले
    [CycleStartSnapshot] DATETIME NOT NULL,       -- ती सायकल कधी सुरू झाली होती
    [ElapsedDays] INT NOT NULL,                   -- किती दिवस झाले होते
    [ElapsedMonths] DECIMAL(5,2) NOT NULL,        -- किती महिने झाले होते
    [RequestedAmount] DECIMAL(18,2) NOT NULL,     -- मागितलेली रक्कम
    [AppliedSlabID] INT NULL FOREIGN KEY REFERENCES [dbo].[PigmySchemeInterestSlabs]([SlabID]),
    [PenaltyRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    [PenaltyAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    [InterestAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    [NetPaidAmount] DECIMAL(18,2) NOT NULL,       -- ग्राहकाला रोख दिलेली निव्वळ रक्कम
    [RemainingBalance] DECIMAL(18,2) NOT NULL,    -- खात्यात मागे उरलेली शिल्लक रक्कम
    [VoucherNo] NVARCHAR(50) NULL,
    [CreatedBy] INT NOT NULL,
    [CreatedDate] DATETIME NOT NULL DEFAULT GETDATE()
);
```

---

## ५. कोअर बँकिंग खातावणी नोंदी (GL Ledger Accounting Entries)

जेव्हा ग्राहक अंशतः विड्रॉल करतो (उदा. ₹५,००० काढले, २% दंड = ₹१००, निव्वळ दिले = ₹४,९००):

| खाते (Ledger) | खाते प्रकार | नावे (Debit) | जमा (Credit) | शेरा (Narration) |
| :--- | :--- | :--- | :--- | :--- |
| **पिग्मी ठेव देयता खाते (Pigmy Liability Ledger)** | Liability | **₹५,०००.००** | - | पिग्मी ठेवीतून मुद्दल कपात |
| **रोख शिल्लक खाते (Cash Ledger)** | Asset | - | **₹४,९००.००** | ग्राहकास प्रत्यक्ष अदा केलेली रोख |
| **पिग्मी दंड आकारणी उत्पन्न (Sundry / Penalty Income)** | Income | - | **₹१००.००** | २% मुदतपूर्व विड्रॉल दंड उत्पन्न |

👉 **उर्वरित शिल्लक:** पिग्मी ठेव देयता खात्यात मागे राहिलेली शिल्लक रक्कम जशीच्या तशी राहते आणि तिच्यासाठी सायकल तारीख `EffectiveStartDate = WithdrawalDate` बनते.

---

## ६. बॅकएंड एपीआय अल्गोरिदम (Backend C# Implementation Logic)

### ६.१ विड्रॉल विनंती आल्यावर (On Partial Withdrawal Request):
```csharp
// १. चालू सायकलीचे महिने मोजणे:
DateTime cycleStart = account.EffectiveStartDate ?? account.OpeningDate;
int elapsedDays = (DateTime.Today - cycleStart).Days;
decimal elapsedMonths = (decimal)elapsedDays / 30.416m; // किंवा अचूक कॅलेंडर महिने

// २. चालू सायकलीचा स्लॅब शोधणे (From PigmySchemeInterestSlabs):
var activeSlab = scheme.Slabs
    .Where(s => elapsedMonths >= s.FromMonths && elapsedMonths < s.ToMonths)
    .FirstOrDefault();

// ३. काढलेल्या रकमेवर दंड किंवा व्याज आकारणी:
decimal penaltyAmt = (request.Amount * activeSlab.PenaltyRate) / 100m;
decimal interestAmt = (request.Amount * activeSlab.InterestRate) / 100m;
decimal netPayable = request.Amount - penaltyAmt + interestAmt;

// ४. खात्याचे बॅलन्स अपडेट व Day 1 रीसेट:
account.TotalDepositedAmount -= request.Amount;
account.TotalWithdrawnAmount += request.Amount;
account.LastWithdrawalDate = DateTime.Today;

// 🌟 THE DAY 1 RESET:
account.EffectiveStartDate = DateTime.Today; 
account.CurrentCycleNumber += 1; // सायकल पुढे गेली

// ५. व्हाउचर तयार करणे व सेव्ह करणे
```

### ६.२ अंतिम मॅच्युरिटीच्या दिवशी (On Fixed Expiry Date):
```csharp
// मूळ MaturityDate वर खाते आले:
DateTime lastCycleStart = account.EffectiveStartDate ?? account.OpeningDate;
int daysInFinalCycle = (account.MaturityDate - lastCycleStart).Days;
decimal monthsInFinalCycle = (decimal)daysInFinalCycle / 30.416m;

// शेवटच्या सायकलीचा स्लॅब शोधणे:
var finalSlab = scheme.Slabs
    .Where(s => monthsInFinalCycle >= s.FromMonths && monthsInFinalCycle < s.ToMonths)
    .FirstOrDefault();

// अंतिम उर्वरित शिल्लक रकमेवर finalSlab चे व्याज देऊन खाते पूर्ण बंद करणे.
```

---

## ७. युझर इंटरफेस (UI) डिझाईन आराखडा

1. **पिग्मी विड्रॉल स्क्रीन (Pigmy Partial Withdrawal Screen):**
   - खाते क्रमांक टाकल्यावर चालू जमा शिल्लक, सध्याची सायकल (Cycle #1), आणि सध्याचा चालू स्लॅब दिसेल.
   - रक्कम टाकल्यावर लगेच **काढायची रक्कम**, **कपात होणारा दंड**, आणि **उर्वरित शिल्लक रकमेसाठी 'नवीन Day 1' कधीपासून सुरू होईल** याचा स्पष्ट इशारा (Alert Box) दिसेल.
2. **पासबुक प्रिंटिंग (Passbook Print):**
   - एन्ट्रीमध्ये स्पष्ट शेरा असेल:
     `विड्रॉल ₹३,००० (सायकल १ पूर्ण) | उर्वरित शिल्लक ₹५,००० (नवीन सायकल २ सुरू: ०१/०५/२०२६)`

---

## ८. अंमलबजावणी चेकलिस्ट (Execution Checklist)

- [x] **टप्पा १:** पिग्मी योजना मास्टरमध्ये डायनॅमिक स्लॅब्स व महिने निवड (पूर्ण व कार्यरत).
- [x] **टप्पा १:** इनपुट शून्य बग निवारण व स्क्रीनवरील अनावश्यक बटणांची स्वच्छता (पूर्ण व कार्यरत).
- [ ] **टप्पा २:** `PigmyAccounts` टेबलमध्ये `EffectiveStartDate`, `CurrentCycleNumber` कॉलम जोडणे (SQL स्थलांतर).
- [ ] **टप्पा २:** `PigmyWithdrawals` टेबल तयार करणे व ट्रँझॅक्शन ट्रॅकिंग.
- [ ] **टप्पा २:** `PigmyAccountsController` व `PigmyClosureController` मध्ये Day 1 रीसेट व पर्याय 'ब' नुसार स्लॅब मॅपिंग जोडणे.
- [ ] **टप्पा २:** पिग्मी विड्रॉल मॉडेलमध्ये थेट व्हाउचर ऑटो-पोस्टिंग जोडणे.

---
*टीप: हा दस्तऐवज केवळ आराखडा (Plan) म्हणून सादर केला आहे. तुमच्या पुढील मंजुरीनंतरच कोडिंग व डेटाबेसचे पुढील काम सुरू केले जाईल.*
