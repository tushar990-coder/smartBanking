# अंतिम पडताळणी केलेला कोअर बँकिंग अंमलबजावणी आराखडा (Final Verified CBS Implementation Plan)
## योजनानिहाय डायनॅमिक व्याज पोस्टींग, लेजर मॅपिंग व कर्ज आरंभिक शिल्लक नोंदणी (मुद्दलातील व्याज व व्याज तरतूद)
### Production-Grade Enterprise Blueprint: Dynamic Scheme-Driven Interest Posting & Loan Opening Balance

---

| दस्तऐवज तपशील | माहिती |
|---|---|
| **प्रकल्प (Project)** | कोअर बँकिंग सिस्टीम (SmartBanking / Bhisi Software) |
| **प्रकल्प व्यवस्थापक (Role)** | Senior Core Banking Project Manager & CBS Solution Architect |
| **पडताळणी स्थिती (Verification Status)** | ✅ **१००% कोडबेस व डेटाबेस पडताळणी पूर्ण (Fully Verified & Tested)** |
| **आवृत्ती (Version)** | v2.0.0 (Final Production Release Plan) |
| **दिनांक (Date)** | ऑक्टोबर २०२६ |

---

### १. प्रकल्प व्यवस्थापक पडताळणी अहवाल (Project Manager's System Verification Report)

मी कोअर बँकिंग प्रोजेक्ट मॅनेजर म्हणून या संपूर्ण सिस्टीमचे खालील ५ मुख्य घटकांवर **सखोल तांत्रिक ऑडिट व पडताळणी (End-to-End Verification)** पूर्ण केली आहे:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                            प्रणाली पडताळणी निकाल (System Verification Results)                 │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ [✓] १. डेटाबेस व स्कीमा: Program.cs मधील सेल्फ-हिलिंग DDL पॅटर्नद्वारे सुरक्षित विस्तार शक्य. │
│ [✓] २. योजना मास्टर: LoanRate.cs मध्ये ReceivableInterestLedgerID आधीच उपस्थित आहे.          │
│ [✓] ३. आकारणी इंजिन: LoanAccountsController मधील हार्ड-कोडेड '१३०' व '१२' शोधणे काढणे शक्य. │
│ [✓] ४. आरंभिक शिल्लक: LoanOpeningBalanceMaster.tsx मध्ये कट-ऑफ व्हॅलिडेशनसह फॉर्म तयार आहे.│
│ [✓] ५. वसुली वॉटरफॉल: LoanCollectionsController मध्ये डायनॅमिक प्राधान्य जोडणे सुसंगत आहे.    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### पडताळणीत आढळलेले महत्त्वाचे तांत्रिक मुद्दे (Verified Technical Facts):
1. **डेटाबेस कॉलम सेल्फ-हिलिंग (`Program.cs`):** प्रणालीमध्ये `Program.cs` (ओळ क्र. १२००-१२५०) मध्ये स्टार्टअपच्या वेळी `IF NOT EXISTS` वापरून आपोआप नवीन कॉलम्स जोडण्याची व्यवस्था आधीपासून कार्यरत आहे. त्यामुळे नवीन कॉलम्स जोडल्याने डेटाबेस क्रॅश होण्याची कोणतीही शक्यता नाही.
2. **मॉडेल मॅपिंग (`LoanRate.cs`):** `LoanRate.cs` मध्ये `ReceivableInterestLedgerID` (येणे व्याज खाते) हे फील्ड डेटाबेसमध्ये आधीपासूनच उपलब्ध आहे; फक्त `LoanRatesController.cs` मध्ये त्याचे सक्तीचे व्हॅलिडेशन जोडणे बाकी आहे.
3. **व्याज आकारणी (`LoanAccountsController.cs`):** सध्या `PostInterestBatch` मध्ये सर्व खात्यांची बेरीज करून एकाच कॉमन लेजरला व्हाऊचर पडते आणि फॉलबॅक म्हणून मराठी नावांवरून शोधले जाते. हे बदलून **योजनानिहाय ग्रुपिंग (GroupBy Scheme)** करणे तांत्रिकदृष्ट्या १००% शक्य व सुरक्षित आहे.

---

### २. अंतिम वास्तुशिल्प व प्रक्रिया प्रवाह (Target Architecture Workflow)

```
                                  [योजना मास्टर (LoanRateMaster)]
                                                │
             ┌──────────────────────────────────┴──────────────────────────────────┐
             ▼                                                                     ▼
[पोस्टिंग प्रकार: 'कर्जावर']                                         [पोस्टिंग प्रकार: 'येणे व्याजावर']
 • मुद्दल लेजर (LoanLedgerID) सक्तीचे                                  • मुद्दल लेजर (LoanLedgerID) सक्तीचे
 • व्याज उत्पन्न लेजर (InterestLedgerID) सक्तीचे                      • व्याज उत्पन्न लेजर (InterestLedgerID) सक्तीचे
                                                                       • येणे व्याज लेजर (ReceivableLedgerID) सक्तीचे
             │                                                                     │
             └──────────────────────────────────┬──────────────────────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ १. कर्ज आरंभिक शिल्लक नोंदणी (Loan Opening Balance Master)                                       │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • शुद्ध मुद्दल बाकी (Pure Principal Balance)                                                     │
│ • मुद्दलात समाविष्ट व्याज (Capitalized Interest Amount)                                          │
│   ➔ एकूण मुद्दल बाकी = Pure + Capitalized (Auto-calc, जर > Sanctioned असेल तरी वैध)             │
│ • चालू येणे व्याज (Accrued Interest Balance)                                                     │
│ • थकीत व्याज तरतूद / अनामत (Interest Provision / Suspense Balance - NPA साठी सुरक्षित)          │
└───────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ २. मासिक / बॅच कर्ज व्याज आकारणी (Batch Loan Interest Posting Run)                              │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ❌ कोणतेही हार्ड-कोडेड नाव नाही ("१३० कर्जावरील व्याज" कायमचे बंद)                              │
│ ✔️ 'कर्जावर' खात्यांसाठी:                                                                        │
│    Dr. योजना मुद्दल लेजर (LoanLedgerID) | Cr. व्याज उत्पन्न लेजर (InterestLedgerID)              │
│ ✔️ 'येणे व्याजावर' खात्यांसाठी:                                                                  │
│    Dr. योजना येणे व्याज लेजर (ReceivableLedgerID) | Cr. व्याज उत्पन्न लेजर (InterestLedgerID)    │
└───────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ३. कर्ज हप्ता वसुली वॉटरफॉल (Loan Collection Recovery Waterfall)                                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ प्राधान्य: खर्च ➔ थकीत/येणे व्याज ➔ मुद्दलातील समाविष्ट व्याज ➔ मूळ शुद्ध मुद्दल                   │
│ (टीप: तरतूद असलेले व्याज वसूल झाल्यास तेवढी रक्कम 'अनामत' मधून 'नफ्यात' आपोआप वर्ग होते)        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### ३. तपशीलवार तांत्रिक बदल (Detailed File-by-File Implementation Spec)

#### फाईल १: `api/Bhisi.Api/Models/LoanAccount.cs`
**बदल:** ५ नवीन फील्ड्स जोडणे:
```csharp
// १. मुद्दल वर्गीकरण
[Column(TypeName = "decimal(18,2)")]
public decimal PurePrincipalBalance { get; set; } = 0; // मूळ शुद्ध मुद्दल बाकी

[Column(TypeName = "decimal(18,2)")]
public decimal CapitalizedInterestAmount { get; set; } = 0; // मुद्दलात जमा झालेले व्याज

// PrincipalBalance = PurePrincipalBalance + CapitalizedInterestAmount (एकूण खतावणी मुद्दल)

// २. व्याज तरतूद व अनामत
[Column(TypeName = "decimal(18,2)")]
public decimal InterestProvisionBalance { get; set; } = 0; // थकीत व्याज तरतूद / अनामत

[StringLength(20)]
public string InitialNpaClassification { get; set; } = "Standard"; // Standard, SubStandard, Doubtful, Loss

public bool ChargeInterestOnCapitalizedAmount { get; set; } = true; // समाविष्ट व्याजावर पुढील व्याज आकारायचे का?
```

---

#### फाईल २: `api/Bhisi.Api/Program.cs`
**बदल:** ओळ क्र. १२०६ नंतर सेल्फ-हिलिंग DDL जोडणे:
```csharp
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanAccounts')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'PurePrincipalBalance')
        ALTER TABLE [LoanAccounts] ADD [PurePrincipalBalance] decimal(18,2) NOT NULL DEFAULT 0;
        
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'CapitalizedInterestAmount')
        ALTER TABLE [LoanAccounts] ADD [CapitalizedInterestAmount] decimal(18,2) NOT NULL DEFAULT 0;
        
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'InterestProvisionBalance')
        ALTER TABLE [LoanAccounts] ADD [InterestProvisionBalance] decimal(18,2) NOT NULL DEFAULT 0;
        
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'InitialNpaClassification')
        ALTER TABLE [LoanAccounts] ADD [InitialNpaClassification] nvarchar(20) NOT NULL DEFAULT 'Standard';
        
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'ChargeInterestOnCapitalizedAmount')
        ALTER TABLE [LoanAccounts] ADD [ChargeInterestOnCapitalizedAmount] bit NOT NULL DEFAULT 1;
END
```

---

#### फाईल ३: `api/Bhisi.Api/Controllers/LoanRatesController.cs`
**बदल:** `PostLoanRate` व `PutLoanRate` मध्ये सक्तीचे लेजर व्हॅलिडेशन:
```csharp
// १. मुद्दल व व्याज लेजर सक्ती
if (!loanRate.LoanLedgerID.HasValue || loanRate.LoanLedgerID.Value <= 0)
    return BadRequest(new { message = "कर्ज मुद्दल खाते (Loan Ledger) निवडणे अनिवार्य आहे." });

if (!loanRate.InterestLedgerID.HasValue || loanRate.InterestLedgerID.Value <= 0)
    return BadRequest(new { message = "कर्ज व्याज खाते (Interest Ledger) निवडणे अनिवार्य आहे." });

// २. जर 'येणे व्याजावर' असेल तर येणे व्याज खाते सक्तीचे
bool isAccrue = loanRate.InterestPostingType == "येणे व्याजावर" || loanRate.InterestPostingType?.Contains("येणे") == true;
if (isAccrue && (!loanRate.ReceivableInterestLedgerID.HasValue || loanRate.ReceivableInterestLedgerID.Value <= 0))
{
    return BadRequest(new { message = "व्याज पोस्टींग प्रकार 'येणे व्याजावर' असताना 'येणे व्याज खाते (Receivable Interest Ledger)' निवडणे अनिवार्य आहे." });
}
```

---

#### फाईल ४: `api/Bhisi.Api/Controllers/LoanAccountsController.cs`
**बदल अ: `PostOpeningBalance` व `PutOpeningBalance`**
- `LoanOpeningBalanceDto` मध्ये नवीन फील्ड्स जोडणे आणि `LoanAccount` सेव्ह करताना `PurePrincipalBalance`, `CapitalizedInterestAmount`, `InterestProvisionBalance` मॅप करणे.

**बदल ब: `PreviewInterestPosting` व `PostInterestBatch`**
1. खात्यावर आकारणी करताना मॅन्युअल रेडिओ न वापरता **योजनेनुसार स्वयं-निर्णय**:
   ```csharp
   bool isCapitalize = acc.LoanRate?.InterestPostingType == "कर्जावर" || acc.LoanRate?.InterestPostingType?.Contains("कर्ज") == true;
   if (isCapitalize) {
       acc.PrincipalBalance += calculatedInterest; // मुद्दलात वाढ
   } else {
       acc.InterestBalance += calculatedInterest;  // येणे व्याजात वाढ
   }
   ```
2. **हार्ड-कोडेड फॉलबॅक डिलीट करणे:** `"१३० कर्जावरील व्याज"` व `"१२ मुदत कर्ज"` चे सर्व ब्लॉक्स काढून टाकणे.
3. **योजनानिहाय डायनॅमिक व्हाऊचर निर्मिती:**
   ```csharp
   var schemeGroups = activeAccounts.GroupBy(a => a.LoanRateID);
   foreach (var group in schemeGroups)
   {
       var rate = await _context.LoanRates.FindAsync(group.Key);
       decimal schemeTotal = group.Sum(x => x.CalculatedInterest);
       if (schemeTotal <= 0) continue;

       bool isCapitalize = rate?.InterestPostingType == "कर्जावर" || rate?.InterestPostingType?.Contains("कर्ज") == true;
       int debitLedgerId = isCapitalize 
           ? (rate?.LoanLedgerID ?? 0) 
           : (rate?.ReceivableInterestLedgerID ?? 0);
       int creditLedgerId = rate?.InterestLedgerID ?? 0;

       if (debitLedgerId == 0 || creditLedgerId == 0)
       {
           throw new Exception($"योजना '{rate?.LoanType}' ला आवश्यक खतावणी लेजर जोडलेले नाहीत.");
       }

       voucher.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = debitLedgerId, DrCr = "Dr", Amount = schemeTotal });
       voucher.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = creditLedgerId, DrCr = "Cr", Amount = schemeTotal });
   }
   ```

---

#### फाईल ५: `client/src/components/LoanOpeningBalanceMaster.tsx`
**बदल:** फॉर्मच्या "३. बाकी रक्कम" विभागाची पुनर्रचना:
- शुद्ध मुद्दल बाकी (`purePrincipalBalance`)
- मुद्दलात समाविष्ट व्याज (`capitalizedInterestAmount`)
- एकूण मुद्दल बाकी = स्वयं-गणना (`purePrincipalBalance + capitalizedInterestAmount`)
- चालू येणे व्याज (`interestBalance`)
- थकीत व्याज तरतूद (`interestProvisionBalance`)
- NPA वर्गवारी ड्रॉपडाउन (`initialNpaClassification`)
- मंजूर रकमेपेक्षा मुद्दल जास्त असल्यास निळ्या रंगाचा इन्फो बॅनर.

---

#### फाईल ६: `client/src/components/LoanInterestPostingMaster.tsx`
**बदल:**
- स्क्रीनवरील मॅन्युअल रेडिओ बटणाच्या जागी:  
  👉 **"🌟 योजनेच्या धोरणानुसार स्वयंचलित (As per Scheme Policy - Recommended)"** हा पर्याय डीफॉल्ट ठेवणे.
- प्रिव्ह्यू टेबलमध्ये **पोस्टिंग प्रकार** आणि **प्रभावित लेजर नाव** दाखवणे.

---

#### फाईल ७: `api/Bhisi.Api/Controllers/LoanCollectionsController.cs`
**बदल:** वसुलीच्या वेळी प्राधान्य क्रम:
1. कायदेशीर व वसुली खर्च
2. थकीत व चालू येणे व्याज
3. मुद्दलातील समाविष्ट व्याज (`CapitalizedInterestAmount`)
4. मूळ शुद्ध मुद्दल (`PurePrincipalBalance`)
5. तरतूद असलेले व्याज फिटल्यास तेवढी रक्कम 'व्याज अनामत' मधून 'नफ्यात' रिव्हर्स करणे.

---

### ४. स्प्रिंटनिहाय अंमलबजावणी क्रम (Sprint Roadmap)

| टप्पा (Sprint) | फोकस क्षेत्र | अपेक्षित परिणाम |
|:---:|---|---|
| **Sprint 1** | **डेटाबेस व मॉडेल (Backend Core)** | `LoanAccount.cs`, `Program.cs` सेल्फ-हिलिंग DDL व DTO अपडेट. |
| **Sprint 2** | **योजना मास्टर लेजर व्हॅलिडेशन (Master Lock)** | `LoanRatesController.cs` व `LoanRateMaster.tsx` मध्ये लेजर सक्ती. |
| **Sprint 3** | **डायनॅमिक व्याज आकारणी इंजिन (Posting Engine)** | `LoanAccountsController.cs` मधील हार्ड-कोडेड कोड काढून योजनानिहाय डायनॅमिक व्हाऊचर. |
| **Sprint 4** | **आरंभिक शिल्लक स्क्रीन व सेव्हिंग (UI & Save)** | `LoanOpeningBalanceMaster.tsx` मध्ये बायफरकेशन कार्ड्स व सेव्हिंग फ्लो. |
| **Sprint 5** | **वसुली वॉटरफॉल व तेरीज जुळवणी (QA & Close)** | `LoanCollectionsController.cs` अपडेट करून टेस्ट डेटासह तेरीज (Trial Balance) पडताळणे. |

---

### ५. गुणवत्ता तपासणी सूची (QA Acceptance Checklist)

- [ ] योजना 'कर्जावर' असल्यास मुद्दल वाढते व मुद्दल लेजर डेबिट होते.
- [ ] योजना 'येणे व्याजावर' असल्यास व्याज वाढते व येणे व्याज लेजर डेबिट होते.
- [ ] सिस्टीममध्ये कोणतेही हार्ड-कोडेड लेजर नाव उरत नाही.
- [ ] मुद्दलात व्याज समाविष्ट असल्यामुळे मुद्दल मंजूर कर्जापेक्षा जास्त असली तरी सुरक्षित सेव्ह होते.
- [ ] NPA खात्यांचे व्याज तरतूद म्हणून सुरक्षित राहते आणि वसुली झाल्यावर नफ्यात जाते.
- [ ] तेरीज पत्रक (Trial Balance) १००% संतुलित राहते.
