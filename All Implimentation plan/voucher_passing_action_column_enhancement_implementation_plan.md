# 🏛️ कोअर बँकिंग सर्वंकष अंमलबजावणी आराखडा (Comprehensive Implementation Plan)
## व्हाउचर पासिंग, मंजुरी व व्यवस्थापन: कृती (Action) ५-पर्यायी कार्यप्रणाली (Voucher, Pass, Unpass, Delete, ViewForm)
### Document ID: `PLAN-CBS-VOUCHER-ACTION-SUITE-v2.5.50`
### Target Component: `client/src/components/VoucherPosting.tsx` & `api/Bhisi.Api/Controllers/VoucherPostingController.cs`

---

### 📌 १. कार्यकारी सारांश व उद्दिष्ट (Executive Summary & Objective)

कोअर बँकिंग प्रणालीमध्ये (CBS) **"व्हाउचर पासिंग, मंजुरी व व्यवस्थापन" (`VoucherPosting.tsx`)** ही नियंत्रक, चेकर व शाखा व्यवस्थापक (Checker / Manager Dual Control) पातळीवरील मध्यवर्ती स्क्रीन आहे.

सध्या या स्क्रीनवरील मास्टर टेबलच्या **"कृती (Action)"** स्तंभात केवळ २ मर्यादित पर्याय उपलब्ध आहेत:
* **प्रलंबित टॅब (Pending Tab):** केवळ `[फॉर्म व्ह्यू (Form View)]` आणि `[रद्द / हटवा (Delete)]`. पास करण्यासाठी वर जाऊन चेकबॉक्स निवडून बल्क पास करावे लागते.
* **मंजूर टॅब (Approved Tab):** केवळ `[फॉर्म व्ह्यू (Form View)]` आणि `[अन-पास (Unpass)]`. व्हाउचर पावती पाहण्यासाठी किंवा प्रिंट करण्यासाठी स्वतंत्र मेनूवर जावे लागते.

वापरकर्त्याच्या अचूक गरजेनुसार, प्रत्येक व्हाउचरच्या **"कृती (Action)"** स्तंभात खालील **५ स्वतंत्र व स्पष्ट पर्याय (5 Mandatory CBS Action Options)** थेट उपलब्ध करणे आवश्यक आहे:

```
+---------------------------------------------------------------------------------------------------------------------------------+
|                                 🏛️ व्हाउचर पासिंग: कृती (Action) ५-पर्यायी आर्किटेक्चरल मॅट्रिक्स                               |
+---------------------------------------------------------------------------------------------------------------------------------+
| १. 📄 व्हाउचर (Voucher)   : अधिकृत बँक व्हाउचर पावती (Voucher Receipt Slip) थेट पॉपअप मोडलमध्ये पाहणे व १-क्लिक प्रिंट करणे.     |
| २. ✅ पास (Pass)         : वैयक्तिक व्हाउचर एका क्लिकवर थेट मंजूर करणे व दैनिक शाखानिहाय स्क्रॉल क्र. (#ScrollNo) वाटप करणे.     |
| ३. ↩️ अन-पास (Unpass)    : मंजूर झालेले व्हाउचर कारणासह पुन्हा 'प्रलंबित' स्थितीत नेणे (खातावणी दुरुस्तीसाठी स्क्रॉल क्र. रीसेट).   |
| ४. 🗑️ हटवा (Delete)      : चुकीची प्रलंबित व्हाउचर नोंद सुरक्षितपणे संबंधित खात्यांच्या कॅस्केड क्लिनअप व ऑडिट लॉगसह डिलीट करणे.    |
| ५. 👁️ फॉर्म व्ह्यू (ViewForm): ज्या मूळ खात्यातून/फॉर्ममधून नोंद झाली (उदा. कर्ज, बचत, ठेव, पिग्मी, शेअर्स, लॉकर) तो मूळ फॉर्म उघडणे. |
+---------------------------------------------------------------------------------------------------------------------------------+
```

---

### 🔍 २. सोर्स कोड ऑडिट व लाइन नंबर विश्लेषण (Source Code Audit & Line Mapping)

सध्याच्या `client/src/components/VoucherPosting.tsx` (एकूण १८१९ ओळी) च्या तपासणीतील मुख्य नोंदी:

| घटक / कार्य (Component / Function) | विद्यमान फाइल व ओळ क्र. (Source Line) | सद्यस्थिती (Current Behavior) | आवश्यक बदल / सुधारणा (Required Fix) |
|---|---|---|---|
| **Lucide Icons Imports** | `VoucherPosting.tsx: Line 1-23` | `Printer`, `Eye` आयकॉन नाहीत. | `Printer`, `Eye` आयात करणे. |
| **VoucherPrint Import** | `VoucherPosting.tsx: Line 24` | `VoucherPrint` आयात केलेले नाही. | `import VoucherPrint from './VoucherPrint';` जोडणे. |
| **Print Modal State** | `VoucherPosting.tsx: Line 85-87` | प्रिंट स्टेट उपलब्ध नाही. | `const [printingVoucherId, setPrintingVoucherId] = useState<number \| null>(null);` जोडणे. |
| **Single Pass Engine** | `VoucherPosting.tsx: Line 229-265` | फक्त `handlePostSelected` (Bulk Post) आहे. | स्वतंत्र `handleSinglePass(voucher: Voucher)` फंक्शन तयार करणे. |
| **Form View Dispatcher** | `VoucherPosting.tsx: Line 292-551` | `handleOpenFormView(v)` १८+ मॉड्यूल्ससाठी कार्यरत आहे. | कायम ठेवणे व 'फॉर्म व्ह्यू' बटणाशी थेट जोडणे. |
| **Direct Single Delete** | `VoucherPosting.tsx: Line 554-588` | `handleDirectSingleDelete(voucher)` कार्यरत आहे. | मंजूर व्हाउचर्ससाठी अन-पास करण्याची सुरक्षा सूचना (`Safety Guard`) जोडणे. |
| **Single Unpass Modal** | `VoucherPosting.tsx: Line 628-661` | `openSingleUnpassModal(voucher)` कार्यरत आहे. | 'अन-पास' बटणाशी थेट जोडणे; प्रलंबित असताना माहिती देणे. |
| **Table Header `<th>`** | `VoucherPosting.tsx: Line 1239` | `<th className="... w-24">कृती (Action)</th>` | ५ बटणे व्यवस्थित बसण्यासाठी रुंदी `w-64` किंवा `min-w-[270px]` करणे. |
| **Table Action Cell `<td>`** | `VoucherPosting.tsx: Line 1361-1394` | फक्त २ बटणे (Form View + Delete/Unpass) आहेत. | ५-पर्यायी सुबक आयकॉन-बटण बार रेंडर करणे. |
| **Expanded Breakdown Row** | `VoucherPosting.tsx: Line 1428-1471` | मर्यादित बटणे आहेत. | विस्तृत खाती तपशील हेडरमध्येही हे ५ पर्याय ठळकपणे देणे. |
| **Print Modal Renderer** | `VoucherPosting.tsx: Line 1813` | प्रिंट मोडल रेंडरर नाही. | फाईलच्या तळाशी `printingVoucherId` साठी हाय-क्वालिटी मोडल रेंडर करणे. |

---

### ⚙️ ३. ५ कृती पर्यायांचे सविस्तर तांत्रिक डिझाइन (Detailed Technical Specification of 5 Actions)

```
                                  ┌────────────────────────────────────────────────┐
                                  │      वापरकर्ता 'कृती (Action)' क्लिक करतो      │
                                  └───────────────────────┬────────────────────────┘
                                                          │
          ┌───────────────────────┬───────────────────────┼───────────────────────┬───────────────────────┐
          ▼                       ▼                       ▼                       ▼                       ▼
    【१. व्हाउचर】             【२. पास】             【३. अन-पास】            【४. हटवा】           【५. फॉर्म व्ह्यू】
  (Action: voucher)        (Action: Pass)         (Action: unpass)        (Action: delete)       (Action: viewform)
          │                       │                       │                       │                       │
          ▼                       ▼                       ▼                       ▼                       ▼
   setPrintingVoucherId    handleSinglePass()    openSingleUnpassModal() handleActionDelete()  handleOpenFormView()
          │                       │                       │                       │                       │
   VoucherPrint.tsx         POST /api/              POST /api/              DELETE /api/          CBS Dispatcher
   अधिकृत बँक पावती        VoucherPosting/Post     VoucherPosting/Unpass   VoucherPosting/{id}   /?tab={module}
   - संस्था नाव व लोगो     - Maker!=Checker चेक    - EOD लॉक तपासणी        - पुष्टीकरण विचारणे    - &voucherId={id}
   - Dr / Cr खाती तपशील    - Dr == Cr समानता चेक   - ScrollNo = null       - कॅस्केड खाती क्लिनअप - &passingMode=true
   - अंकी व अक्षरी रक्कम   - दैनिक ScrollNo वाटप   - Status = 'Pending'    - AuditLogs जतन        - Read-Only Mode
   - Maker/Checker स्वाक्षरी- Status = 'Approved'  - AuditLogs जतन         - यादी रिफ्रेश         - चेकर अंबर बॅनर
```

---

#### ३.१. पर्याय १: 📄 व्हाउचर (Action: `voucher`) - स्लिप प्रिव्ह्यू व प्रिंट
* **उद्दिष्ट:** व्हाउचरची अधिकृत सीबीएस बँक पावती पाहणे, लेजर नावे/जमा तपासणे व प्रिंट काढणे.
* **कॉल पद्धती:** 
  ```tsx
  setPrintingVoucherId(v.voucherID);
  ```
* **घटक इंटिग्रेशन:** `client/src/components/VoucherPrint.tsx`
* **पॉपअप मोडल संरचना:**
  ```tsx
  {printingVoucherId && (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-md max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-300">
        <VoucherPrint 
          voucherId={printingVoucherId} 
          onBack={() => setPrintingVoucherId(null)} 
        />
      </div>
    </div>
  )}
  ```
* **सुरक्षा व दृश्यमानता:** प्रलंबित (Pending) व मंजूर (Approved) दोन्ही प्रकारच्या व्हाउचर्ससाठी हे बटण १००% उपलब्ध असेल. मंजूर व्हाउचरवर अधिकृत स्क्रॉल क्रमांक (`Scroll No.`) छापून येईल.

---

#### ३.२. पर्याय २: ✅ पास (Action: `Pass`) - थेट १-क्लिक मंजुरी
* **उद्दिष्ट:** बल्क चेकबॉक्स न निवडता केवळ चालू रो मधील व्हाउचर एका क्लिकवर अधिकृतरीत्या पास करणे.
* **कॉल पद्धती:** `handleSinglePass(voucher: Voucher)`
* **अंमलबजावणी कोड लॉजिक:**
  ```typescript
  const handleSinglePass = async (voucher: Voucher) => {
    if (!voucher) return;
    if (voucher.status === 'Approved') {
      alert(`व्हाउचर क्र. ${voucher.voucherNo} आधीच मंजूर आहे (स्क्रॉल क्र. #${voucher.scrollNo}).`);
      return;
    }

    const confirmMsg = `व्हाउचर क्र. ${voucher.voucherNo} (${voucher.voucherType} - ₹${voucher.totalAmount.toLocaleString('en-IN')}) मंजूर व पास करायचे आहे का?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/VoucherPosting/Post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: [voucher.voucherID],
          approvedBy: user?.userID || 1,
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        const scrollInfo = resData.vouchers?.[0]?.scrollNo 
          ? ` (वाटप केलेला स्क्रॉल क्र. #${resData.vouchers[0].scrollNo})` 
          : '';
        setMessage(`व्हाउचर क्र. ${voucher.voucherNo}${scrollInfo} यशस्वीरीत्या पास व पोस्ट झाले.`);
        await refreshAll();
      } else {
        const errText = await res.text();
        setError(`मंजुरी त्रुटी: ${errText}`);
      }
    } catch (err) {
      setError('पासिंग करताना नेटवर्क त्रुटी आली. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setActionLoading(false);
    }
  };
  ```
* **बॅकएंड नियम (`VoucherPostingController.cs`):**
  1. **Maker-Checker Segregation:** ज्या वापरकर्त्याने व्हाउचर तयार केले (`CreatedBy`), तोच वापरकर्ता (अ‍ॅडमिन वगळता) ते मंजूर करू शकत नाही.
  2. **Double-Entry Balance:** $\sum \text{Dr} == \sum \text{Cr}$ असणे बंधनकारक (तफावत असल्यास रोखले जाईल).
  3. **Scroll Number Allocation:** त्या शाखेचा व त्या तारखेचा चालू कमाल स्क्रॉल नंबर शोधून `ScrollNo = maxScroll + 1` स्वयंचलित दिला जातो.
  4. **Status Update:** `Status = 'Approved'`, `ApprovedBy = userId`, `ApprovedOn = DateTime.Now`.
* **बटण स्टेट:** 
  - `activeTab === 'PENDING'` असताना: **ठळक हिरवे बटण** `[✅ पास]`.
  - `activeTab === 'APPROVED'` असताना: **डिसेबल्ड बॅज** `[✓ मंजूर #${v.scrollNo}]`.

---

#### ३.३. पर्याय ३: ↩️ अन-पास (Action: `unpass`) - मंजुरी मागे घेणे
* **उद्दिष्ट:** मंजूर झालेल्या व्हाउचरमध्ये काही चूक आढळल्यास ते पुन्हा प्रलंबित स्थितीत पाठवणे, जेणेकरून मूळ फॉर्ममध्ये जाऊन दुरुस्ती करता येईल.
* **कॉल पद्धती:** `openSingleUnpassModal(voucher: Voucher)`
* **मोडल कार्यप्रवाह:**
  - अन-पास मोडल उघडते (`unpassModalOpen = true`).
  - कारण नोंद: `माहिती सुधारण्यासाठी मंजुरी रद्द केली (Reverted to Pending for correction)` (किंवा वापरकर्त्याने टाईप केलेले कारण).
  - कॉल: `POST /api/VoucherPosting/Unpass`
    ```json
    {
      "voucherIds": [targetVoucherToUnpass.voucherID],
      "reason": unpassReason,
      "unpassedBy": user?.userID || 1,
      "username": user?.username || "Admin",
      "userRole": user?.roleName || "Admin"
    }
    ```
* **बॅकएंड सीबीएस नियम (`VoucherPostingController.cs`):**
  1. **EOD Day-Closed Guard:** व्हाउचरच्या तारखेची दिवसअखेर (Day-End) पूर्ण झालेली असल्यास, केवळ मुख्य कार्यालयीन व्यवस्थापकाला (HO Manager / Admin) विशेष परवानगीनेच अन-पास करता येईल.
  2. **Scroll Revert:** `ScrollNo = null`, `Status = 'Pending'`, `ApprovedBy = null`, `ApprovedOn = null`.
  3. **Audit Trail:** पूर्वीचा स्क्रॉल क्र., रक्कम, तारीख, अन-पास करण्याचे कारण व वेळ `AuditLogs` मध्ये कायमस्वरूपी नोंदवली जाते.
* **बटण स्टेट:**
  - `activeTab === 'APPROVED'` असताना: **ठळक अंबर बटण** `[↩️ अन-पास]`.
  - `activeTab === 'PENDING'` असताना: **डिसेबल्ड/ग्रे** (कारण ते आधीच प्रलंबित आहे).

---

#### ३.४. पर्याय ४: 🗑️ हटवा (Action: `delete`) - सुरक्षित कायमस्वरूपी डिलीट
* **उद्दिष्ट:** चुकीची किंवा रद्द केलेली व्हाउचर नोंद व त्याच्याशी संबंधित खात्यांची नोंद डेटाबेसमधून सुरक्षित हटवणे.
* **कॉल पद्धती:** `handleActionDelete(voucher: Voucher)`
* **अंमलबजावणी कोड लॉजिक (सुरक्षा तपासणीसह):**
  ```typescript
  const handleActionDelete = async (voucher: Voucher) => {
    if (!voucher) return;

    // CBS Guard: मंजूर व्हाउचर थेट डिलीट करण्यास बंदी
    if (voucher.status === 'Approved' || activeTab === 'APPROVED') {
      alert(
        `सुरक्षा चेतावणी: व्हाउचर क्र. ${voucher.voucherNo} आधीच मंजूर (Approved) झालेले आहे.\n\n` +
        `कोअर बँकिंग नियमांनुसार मंजूर व्हाउचर थेट डिलीट करता येत नाही.\n` +
        `कृपया प्रथम 'अन-पास (Unpass)' बटण दाबून व्हाउचर प्रलंबित करा, त्यानंतरच डिलीट करा.`
      );
      return;
    }

    // प्रलंबित व्हाउचरसाठी थेट डिलीट
    handleDirectSingleDelete(voucher);
  };
  ```
* **बॅकएंड कॅस्केडिंग क्लिनअप (`ProcessSingleVoucherDeletionAsync`):**
  - पिग्मी वसुली असेल तर `PigmyCollections` मधील व्हाउचर मॅपिंग रीसेट/डिलीट.
  - बचत ठेव/उपसा असेल तर `SavingTransactions` सुरक्षित रीसेट.
  - कर्ज वसुली/वाटप असेल तर संबंधित सब-रेकॉर्ड्स क्लिनअप.
  - संपूर्ण व्यवहार `AuditLogs` मध्ये जतन.

---

#### ३.५. पर्याय ५: 👁️ फॉर्म व्ह्यू (Action: `viewform`) - मूळ फॉर्ममध्ये चेकर तपासणी
* **उद्दिष्ट:** ज्या मूळ फॉर्ममधून नोंद झाली आहे, त्याच फॉर्ममध्ये संपूर्ण व्यवहार (खाते क्रमांक, नियम, व्याज, जामीनदार, सभासद प्रोफाइल) हुबेहूब तपासणे.
* **कॉल पद्धती:** `handleOpenFormView(voucher: Voucher)`
* **डिस्पॅचर मॅपिंग टेबल (18+ Modules Supported):**
  ```typescript
  // Voucher No. Prefix आणि Narration वरून स्वयंचलित अचूक फॉर्म निवड:
  1. Loan Collection       -> /?tab=loan-collection&voucherId={id}&passingMode=true
  2. Loan Disbursement     -> /karjvibhag/karjmagni?subTab=2&voucherId={id}&passingMode=true
  3. Saving Account Close  -> /?tab=saving-closing&voucherId={id}&passingMode=true
  4. Saving Deposit/Withdr -> /?tab=saving-transaction&voucherId={id}&passingMode=true
  5. FD Withdrawal/Maturity-> /?tab=fd-withdrawal&voucherId={id}&passingMode=true
  6. FD Account Opening    -> /?tab=fd-account&voucherId={id}&passingMode=true
  7. RD Account Opening    -> /?tab=rd-account&voucherId={id}&passingMode=true
  8. RD Withdrawal         -> /?tab=rd-withdrawal&voucherId={id}&passingMode=true
  9. RD Collection         -> /?tab=rd-collection&voucherId={id}&passingMode=true
  10. Pigmy Daybook        -> /?tab=pigmy-daybook&voucherId={id}&passingMode=true
  11. Pigmy Closure        -> /?tab=pigmy-closure&voucherId={id}&passingMode=true
  12. Pigmy Collection     -> /?tab=pigmy-collection&voucherId={id}&passingMode=true
  13. Share Transfer       -> /?tab=share-transfer&voucherId={id}&passingMode=true
  14. Share Withdrawal     -> /?tab=share-withdrawal&voucherId={id}&passingMode=true
  15. Share Capital        -> /?tab=share-master&voucherId={id}&passingMode=true
  16. Member Closure       -> /?tab=member-closure&voucherId={id}&passingMode=true
  17. Locker Allotment/Rent-> /?tab=locker-...&voucherId={id}&passingMode=true
  18. Asset Purchase       -> /?tab=asset-purchase&voucherId={id}&passingMode=true
  19. General Vouchers     -> /?tab=voucher&voucherId={id}&passingMode=true
  ```
* **चेकर सुरक्षा:** मूळ फॉर्म पूर्णपणे `<fieldset disabled>` मध्ये असतो, ज्यामुळे चेकरकडून चुकूनही डेटा बदलला जात नाही.

---

### 🎨 ४. युझर इंटरफेस (UI/UX) मांडणी व घटक डिझाइन (Visual Layouts)

टेबलच्या `कृती (Action)` सेलमध्ये ५ बटणे अत्यंत सुबक, आकर्षक व आधुनिक डिझाइनमध्ये बसवण्यासाठी खालील **२ परस्परपूरक लेआउट्स** लागू केले जातील:

#### ४.१. टेबल रो मधील स्मार्ट कॉम्पॅक्ट अ‍ॅक्शन बार (Primary Table Cell Action Group)
टेबल हेडरची रुंदी `<th className="... w-72 text-center">कृती (Action)</th>` केली जाईल.

```
+-----------------------------------------------------------------------------------------------+
|                                      कृती (Action) सेल                                        |
+-----------------------------------------------------------------------------------------------+
|  [👁️ फॉर्म]    [📄 व्हाउचर]    [✅ पास]        [↩️ अन-पास]     [🗑️ हटवा]                       |
| (Emerald-50)   (Sky-50)      (Emerald-600)   (Amber-500)     (Rose-50)                        |
|   मूळ फॉर्म      पावती प्रिंट    थेट मंजूर करा    मंजुरी रद्द करा  रद्द व हटवा                      |
+-----------------------------------------------------------------------------------------------+
```

##### प्रत्यक्ष JSX कोड स्निपेट:
```tsx
<td className="px-2 py-1.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
  <div className="inline-flex items-center justify-center gap-1">
    {/* १. फॉर्म व्ह्यू (View Form) */}
    <button
      type="button"
      onClick={() => handleOpenFormView(v)}
      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-sm font-bold text-[10px] transition-all cursor-pointer flex items-center gap-0.5 shadow-2xs"
      title="मूळ फॉर्ममध्ये एन्ट्री पाहा (View Original Form)"
    >
      <Eye className="w-3 h-3 text-emerald-700" />
      <span>फॉर्म</span>
    </button>

    {/* २. व्हाउचर पावती (Voucher Print Slip) */}
    <button
      type="button"
      onClick={() => setPrintingVoucherId(v.voucherID)}
      className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-0.5 rounded-sm font-bold text-[10px] transition-all cursor-pointer flex items-center gap-0.5 shadow-2xs"
      title="अधिकृत व्हाउचर पावती पाहा व प्रिंट करा (View & Print Voucher Slip)"
    >
      <Printer className="w-3 h-3 text-sky-700" />
      <span>व्हाउचर</span>
    </button>

    {/* ३. पास करा (Pass - Active in Pending) */}
    {activeTab === 'PENDING' ? (
      <button
        type="button"
        onClick={() => handleSinglePass(v)}
        disabled={actionLoading}
        className="bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 px-2 py-0.5 rounded-sm font-bold text-[10px] transition-all cursor-pointer flex items-center gap-0.5 shadow-xs disabled:opacity-50"
        title="हे व्हाउचर थेट मंजूर व पास करा (Direct Approve & Pass)"
      >
        <CheckCircle2 className="w-3 h-3 text-white" />
        <span>पास</span>
      </button>
    ) : (
      <span 
        className="px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-400 border border-gray-200 text-[9.5px] font-bold cursor-not-allowed"
        title={`व्हाउचर आधीच मंजूर आहे (स्क्रॉल क्र. #${v.scrollNo || 'उपलब्ध'})`}
      >
        ✓ पास
      </span>
    )}

    {/* ४. अन-पास करा (Unpass - Active in Approved) */}
    {activeTab === 'APPROVED' ? (
      <button
        type="button"
        onClick={() => openSingleUnpassModal(v)}
        disabled={actionLoading}
        className="bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 px-1.5 py-0.5 rounded-sm font-bold text-[10px] transition-all cursor-pointer flex items-center gap-0.5 shadow-xs disabled:opacity-50"
        title="मंजूर व्हाउचर अन-पास करून प्रलंबित स्थितीत पाठवा (Revert to Pending)"
      >
        <RotateCcw className="w-3 h-3 text-white" />
        <span>अन-पास</span>
      </button>
    ) : (
      <span 
        className="px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-400 border border-gray-200 text-[9.5px] font-bold cursor-not-allowed"
        title="व्हाउचर आधीच प्रलंबित आहे"
      >
        ↩️ अन-पास
      </span>
    )}

    {/* ५. हटवा / डिलीट (Delete) */}
    <button
      type="button"
      onClick={() => handleActionDelete(v)}
      disabled={actionLoading}
      className={`px-1.5 py-0.5 rounded-sm font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5 border ${
        activeTab === 'PENDING'
          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
          : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-rose-50 hover:text-rose-600'
      }`}
      title={activeTab === 'PENDING' ? "व्हाउचर कायमस्वरूपी रद्द व डिलीट करा" : "मंजूर व्हाउचर डिलीट करण्यासाठी प्रथम अन-पास करा"}
    >
      <Trash2 className="w-3 h-3 text-rose-600" />
      <span>हटवा</span>
    </button>
  </div>
</td>
```

---

#### ४.२. खाती तपशील (Expanded Breakdown Row) मधील अ‍ॅक्शन बार सुधारणा
जेव्हा वापरकर्ता कोणत्याही व्हाउचर रो वर क्लिक करतो, तेव्हा उघडणाऱ्या तपशील विभागात (`Line 1428`) खालील ५ मोठी बटणे दिसतील:

```tsx
<div className="flex flex-wrap items-center gap-2">
  {/* १. मूळ फॉर्म व्ह्यू */}
  <button onClick={() => handleOpenFormView(v)} className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded text-[10.5px] font-bold flex items-center gap-1 shadow-xs cursor-pointer">
    <Eye className="w-3.5 h-3.5" /> <span>मूळ फॉर्ममध्ये उघडा (View Form)</span>
  </button>

  {/* २. पावती प्रिंट */}
  <button onClick={() => setPrintingVoucherId(v.voucherID)} className="bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1 rounded text-[10.5px] font-bold flex items-center gap-1 shadow-xs cursor-pointer">
    <Printer className="w-3.5 h-3.5" /> <span>व्हाउचर पावती (Print Slip)</span>
  </button>

  {/* ३. पास (प्रलंबित असताना) */}
  {activeTab === 'PENDING' && (
    <button onClick={() => handleSinglePass(v)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[10.5px] font-bold flex items-center gap-1 shadow-xs cursor-pointer">
      <CheckCircle2 className="w-3.5 h-3.5" /> <span>व्हाउचर पास करा (Approve)</span>
    </button>
  )}

  {/* ४. अन-पास (मंजूर असताना) */}
  {activeTab === 'APPROVED' && (
    <button onClick={() => openSingleUnpassModal(v)} className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded text-[10.5px] font-bold flex items-center gap-1 shadow-xs cursor-pointer">
      <RotateCcw className="w-3.5 h-3.5" /> <span>मंजुरी मागे घ्या (Unpass)</span>
    </button>
  )}

  {/* ५. डिलीट */}
  {activeTab === 'PENDING' && (
    <button onClick={() => handleDirectSingleDelete(v)} className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded text-[10.5px] font-bold flex items-center gap-1 shadow-xs cursor-pointer">
      <Trash2 className="w-3.5 h-3.5" /> <span>व्हाउचर रद्द व हटवा (Delete)</span>
    </button>
  )}
</div>
```

---

### 📋 ५. अंमलबजावणी कृती टप्पे (Step-by-Step Execution Matrix)

```
+--------+---------------------------------------+----------------------------------+----------------------------------------+
| टप्पा  | कार्य (Task)                          | फाईल (File Target)               | अंमलबजावणी तपशील (Technical Actions)    |
+--------+---------------------------------------+----------------------------------+----------------------------------------+
| टप्पा १| Imports व States सेटअप                 | `client/src/.../VoucherPosting`  | Printer, Eye आयात करणे;                |
|        |                                       | (Line 1-30, 85-90)               | `printingVoucherId` स्टेट जोडणे.       |
+--------+---------------------------------------+----------------------------------+----------------------------------------+
| टप्पा २| Single Pass & Action Delete फंक्शन्स  | `client/src/.../VoucherPosting`  | `handleSinglePass(v)` व                 |
|        |                                       | (Line 265-275, 580-590)          | `handleActionDelete(v)` जोडणे.         |
+--------+---------------------------------------+----------------------------------+----------------------------------------+
| टप्पा ३| Master Table Header & Body सुधारणा    | `client/src/.../VoucherPosting`  | Header रुंदी w-72 करणे;                 |
|        |                                       | (Line 1239, 1361-1394)           | <td> मध्ये ५-पर्यायी अ‍ॅक्शन बार रेंडर करणे|
+--------+---------------------------------------+----------------------------------+----------------------------------------+
| टप्पा ४| Expanded Breakdown Row अ‍ॅक्शन अपडेट   | `client/src/.../VoucherPosting`  | खाती तपशील हेडरमध्ये ५ मोठी बटणे        |
|        |                                       | (Line 1428-1460)                 | जोडणे.                                 |
+--------+---------------------------------------+----------------------------------+----------------------------------------+
| टप्पा ५| VoucherPrint Modal Overlay जोडणे     | `client/src/.../VoucherPosting`  | फाईलच्या शेवटी `VoucherPrint` मोडल     |
|        |                                       | (Line 1813)                      | पॉपअप रेंडर करणे.                      |
+--------+---------------------------------------+----------------------------------+----------------------------------------+
| टप्पा ६| पडताळणी, बिल्ड व टेस्ट केसेस तपासणी  | `client/` (npm run build)        | सर्व ५ पर्यायांची प्रत्यक्ष चाचणी घेणे. |
+--------+---------------------------------------+----------------------------------+----------------------------------------+
```

---

### 🧪 ६. सर्वंकष चाचणी व पडताळणी योजना (Comprehensive Test Suite & Verification Matrix)

खालील **६ ठोस टेस्ट केसेस** द्वारे नवीन पर्यायांची पडताळणी केली जाईल:

```
+------------+-------------------------------+-----------------------------------+-------------------------------------------+
| टेस्ट केस  | कृती (User Action)            | अपेक्षित API कॉल (Expected API)     | अपेक्षित दृश्यमान परिणाम (Expected UI)     |
+------------+-------------------------------+-----------------------------------+-------------------------------------------+
| TC-01      | 'व्हाउचर' बटण दाबा            | GET /api/SansthaDetails           | स्क्रीनवर अधिकृत व्हाउचर पावती मोडल      |
| (Voucher)  | (Pending किंवा Approved मध्ये)| GET /api/Vouchers/{id}            | उघडेल, नावे/जमा खाती व प्रिंट बटण दिसेल.  |
+------------+-------------------------------+-----------------------------------+-------------------------------------------+
| TC-02      | 'पास' बटण दाबा                | POST /api/VoucherPosting/Post     | व्हाउचर तात्काळ प्रलंबितमधून मंजूर मध्ये जाईल,|
| (Pass)     | (Pending व्हाउचरवर)          | {"voucherIds": [id]}              | स्क्रॉल क्र. (#ScrollNo) वाटप मेसेज दिसेल.|
+------------+-------------------------------+-----------------------------------+-------------------------------------------+
| TC-03      | 'अन-पास' बटण दाबा             | POST /api/VoucherPosting/Unpass   | कारण नोंद मोडल उघडेल, पुष्टीकरणानंतर       |
| (Unpass)   | (Approved व्हाउचरवर)         | {"voucherIds": [id], "reason":..} | व्हाउचर पुन्हा प्रलंबित टॅबमध्ये येईल.     |
+------------+-------------------------------+-----------------------------------+-------------------------------------------+
| TC-04      | 'हटवा' बटण दाबा               | DELETE /api/VoucherPosting/{id}   | अलर्ट पुष्टी विचारून व्हाउचर कायमस्वरूपी  |
| (Delete-P) | (Pending व्हाउचरवर)          |                                   | डिलीट होईल व यादी रीफ्रेश होईल.           |
+------------+-------------------------------+-----------------------------------+-------------------------------------------+
| TC-05      | 'हटवा' बटण दाबा               | कोणताही API कॉल नाही              | "मंजूर व्हाउचर डिलीट करण्यासाठी प्रथम    |
| (Delete-A) | (Approved व्हाउचरवर)         | (Safety Intercept)                | अन-पास करा" अशी सीबीएस चेतावणी दिसेल.     |
+------------+-------------------------------+-----------------------------------+-------------------------------------------+
| TC-06      | 'फॉर्म' बटण दाबा              | Dispatcher Routing                | संबंधित व्यवहाराचा मूळ फॉर्म Read-Only     |
| (ViewForm) | (कोणत्याही व्हाउचरवर)        | ?tab={module}&passingMode=true    | तपासणी मोडमध्ये अंबर चेकर बॅनरसह उघडेल.   |
+------------+-------------------------------+-----------------------------------+-------------------------------------------+
```

---

> [!NOTE]
> **सुरक्षितता व अखंडता नोंद (Integrity Notice):**  
> हा आराखडा केवळ नियोजन (Planning) उद्देशाने तयार करण्यात आला आहे. वापरकर्त्याच्या पूर्व-परवानगीशिवाय कोणताही कोड संपादित केला गेलेला नाही. आपण मंजुरी दिल्यानंतर वरील टप्प्यांची थेट कोडिंग अंमलबजावणी केली जाईल.
