# 📋 कर्ज वसुली पावती जतन त्रुटी विश्लेषण अहवाल
## Comprehensive Analysis Report: Loan Collection Receipt Save Error (`[object Object]`)

---

### 📌 १. पार्श्वभूमी व एररचे स्वरूप (Incident Overview)

* **स्क्रीन / मॉड्यूल:** कर्ज विभाग -> कर्ज वसुली नोंदी (`LoanCollectionMaster.tsx`)
* **URL:** `padvalwadi.hellomindspace.in/karjvibhag/vasuli`
* **संस्था:** श्री जोतिर्लिंग नागरी सहकारी पतसंस्था (पडवळवाडी)
* **खातेदार / कर्ज तपशील (स्क्रीनशॉटनुसार):**
  * **कर्ज योजना:** सोनेतारण कर्ज (Gold Loan)
  * **खाते क्र.:** `001- -0-012050000255` (🏷️ जुना क्र.: `२३५८`)
  * **कर्ज उचल रक्कम:** ₹ २,१५,०००.०० | **व्याजदर:** १३.००%
  * **व्याज आकारणी दिनांक:** ३१/०३/२०२६ ते ०१/०४/२०२६ (१ दिवस)
  * **जमा होणारे व्याज:** ₹ ७७.०० | **एकूण देय रक्कम:** ₹ ७७.००
* **एरर पॉपअप संदेश:**
  > **padvalwadi.hellomindspace.in says:**
  > `माहिती जतन करण्यास अडचण आली: [object Object]`

---

### 🔍 २. समस्येचे मूळ तांत्रिक कारणे (Root Cause Analysis)

#### अ) `[object Object]` का दिसत आहे? (Frontend Error Masking Bug)
* **फाइल:** `client/src/components/LoanCollectionMaster.tsx` (Lines 1539–1543)
* **कोड ओळ १५४०:**
  ```typescript
  } catch (err: any) {
      alert('माहिती जतन करण्यास अडचण आली: ' + (err.response?.data || err.message));
      console.error(err);
  }
  ```
* **समस्या:**
  बॅकएंड सर्व्हरवरून जेव्हा **HTTP 400 (Bad Request)** किंवा **HTTP 500 (Internal Server Error)** येतो, तेव्हा सर्व्हर त्रुटीचा संदेश स्ट्रिंगऐवजी **JSON ऑब्जेक्ट** (उदा. `{ message: "..." }` किंवा `{ title: "...", errors: { ... } }`) स्वरूपात पाठवतो.
  जावास्क्रिप्टमध्ये स्ट्रिंग आणि ऑब्जेक्ट एकत्र करताना (`'...' + object`) ऑब्जेक्टचे रूपांतर `[object Object]` मध्ये होते. त्यामुळे सर्व्हरने पाठवलेला खराखुरा मराठी/इंग्रजी संदेश झाकला जाऊन युझरला फक्त `[object Object]` दिसतो.

---

#### ब) सर्व्हरवर (Backend) कोणती त्रुटी घडत असावी? (Potential Server-Side Failures)

`api/Bhisi.Api/Controllers/LoanCollectionsController.cs` मधील `PostLoanCollection` पद्धतीचा तपास केला असता, खालीलपैकी एक कारण घडल्याचे स्पष्ट होते:

1. **कर्ज योजनेला लेजर मॅपिंग नसणे (Unmapped Loan / Interest Ledgers):**
   * **कोड ओळी ४८५–४९५:**
     ```csharp
     int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
     if (loanLedgerId == 0)
     {
         return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType ?? "अज्ञात"}' ला कर्ज मुद्दल खाते (Loan Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
     }

     int interestLedgerId = loanRate?.InterestLedgerID ?? 0;
     if (interestLedgerId == 0)
     {
         return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType ?? "अज्ञात"}' ला कर्ज व्याज खाते (Interest Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
     }
     ```
   * **विश्लेषण:** पडवळवाडी डेटाबेसमध्ये 'सोनेतारण कर्ज' (LoanRateID) च्या मास्टरमध्ये जर `LoanLedgerID` किंवा `InterestLedgerID` ० (शून्य) अथवा null असेल, तर सर्व्हर थेट वरील **JSON ऑब्जेक्ट (`{ message: "..." }`)** पाठवतो. हे ऑब्जेक्ट असल्याने फ्रंटएंडवर थेट `[object Object]` दिसते!

2. **व्हाउचर नंबर डुप्लिकेशन (Duplicate VoucherNo Exception):**
   * **कोड ओळ ५७६–५७७:**
     ```csharp
     int count = await _context.Vouchers.CountAsync(v => v.BranchID == collectingBranch && v.VoucherType == voucherType) + 1;
     string voucherNo = $"{branchCode}-{typeCode}-{fy}-{count:D5}";
     ```
   * **विश्लेषण:** जर पडवळवाडी शाखेत यापूर्वी एखादा व्हाउचर डिलीट झाला असेल किंवा आधीच त्या क्रमांकाचे व्हाउचर अस्तित्वात असेल, तर `CountAsync + 1` मुळे तयार होणारा नंबर आधीच टेबलमध्ये असू शकतो. `Vouchers` टेबलवर `VoucherNo` युनिक असल्याने SQL सर्वर `Violation of UNIQUE KEY constraint` ची ५०० एरर देतो, जी ProblemDetails ऑब्जेक्ट बनते.

3. **v2.5.87 मधील EF Core चेंज ट्रॅकर कॉन्फ्लिक्ट:**
   * **कोड ओळ ४५८ आणि ८०८:**
     ```csharp
     _context.LoanCollections.Add(collection);
     await _context.SaveChangesAsync(); // collection is inserted and tracked as Unchanged
     ...
     _context.Entry(collection).State = EntityState.Modified; // forcibly set to Modified
     await _context.SaveChangesAsync();
     ```
   * **विश्लेषण:** आधीच सेव्ह झालेल्या `collection` एंटिटीला पुन्हा `EntityState.Modified` करून सेव्ह करताना EF Core मध्ये नेव्हिगेशन प्रॉपर्टीज (`Fees` किंवा `Voucher`) मुळे `DbUpdateConcurrencyException` अथवा ट्रॅकिंग एरर उद्भवू शकते.

4. **खाते निवड (Radio Button Selection) डेटा विसंगती:**
   * स्क्रीनशॉटमध्ये टेबलमधील ३ ऱ्या खात्यासमोर (सोनेतारण कर्ज - जुना क्र. २३५८) **रेडिओ बटन ⚪ (रिकामे)** दिसत आहे आणि मंजूर रक्कम ₹ ९०,००० आहे, तर खालील तपशील टेबलमध्ये कर्ज उचल रक्कम ₹ २,१५,००० दिसत आहे. जर `formData.loanAccountID` योग्यरीत्या सेट झाला नसेल, तर `Loan account not found` किंवा मॉडेल व्हॅलिडेशन फेल होते.

---

### 💡 ३. उपाययोजना व शिफारसी (Proposed Recommendations)

1. **फ्रंटएंड एरर अनपॅकिंग सुधारणा (Fix [object Object] Display):**
   `LoanCollectionMaster.tsx` मध्ये एरर अलर्ट स्ट्रिंग करताना सर्व्हर ऑब्जेक्टमधील संदेश स्वच्छपणे दाखवणे:
   ```typescript
   const errorMsg = err.response?.data?.message 
       || err.response?.data?.title 
       || (typeof err.response?.data === 'string' ? err.response?.data : JSON.stringify(err.response?.data))
       || err.message;
   alert('माहिती जतन करण्यास अडचण आली: ' + errorMsg);
   ```
   यामुळे पडद्यामागील नेमकी त्रुटी काय आहे (उदा. लेजर जोडलेले नाही की व्हाऊचर नंबर डुप्लिकेट आहे) हे ऑपरेटरला एका सेकंदात स्पष्ट दिसेल.

2. **पडवळवाडी डेटाबेस कर्ज योजना लेजर्स तपासणी:**
   `SmartBanking_padvalwadi` मधील `LoanRates` टेबलमध्ये 'सोनेतारण कर्ज' (किंवा संबंधित योजनेचे) `LoanLedgerID` आणि `InterestLedgerID` योग्य लेजरशी जोडलेले आहेत का याची पडताळणी करणे.

3. **व्हाउचर नंबर जनरेशन सुरक्षित करणे:**
   `CountAsync + 1` ऐवजी चालू वर्षातील शेवटचा व्हाउचर क्रमांक (`OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync()`) काढून पुढील नंबर तयार करणे किंवा डुप्लिकेट असल्यास ऑटो-इन्क्रिमेंट करणे.

---
*अहवाल तयार केला: २४ ऑक्टोबर २०२६*
