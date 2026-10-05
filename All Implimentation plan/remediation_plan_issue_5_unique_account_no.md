# 🛡️ वरिष्ठ सिस्टीम लेखापरीक्षक (Senior System Auditor) सुधारात्मक कृती योजना
## दोष क्र. ५ [उच्च / HIGH]: LoanAccountNo ची डेटाबेस युनिकनेस (Unique Index) व कॉनकरन्सी त्रुटी — खाते क्रमांक डुप्लिकेशन प्रतिबंध व डेटाबेस अखंडता

---

### 📌 १. समस्या विश्लेषण व ऑडिट निरीक्षण (Root Cause & Audit Analysis)

#### अ. सद्यस्थितीतील त्रुटी:
1. **मॅन्युअल इनपुटवर शून्य डुप्लिकेट तपासणी (Zero Validation on User-Supplied Account Number):**
   - `LoanOpeningBalanceMaster.tsx` मधून ऑपरेटरने एखादा खाते क्रमांक हाताने बदलला किंवा प्रविष्ट केला, तर `LoanAccountsController.cs` मधील `ResolveValidLoanAccountNo` पद्धत तो क्रमांक आधीपासून डेटाबेसमध्ये अस्तित्वात आहे की नाही हे **कधीही तपासत नाही**.
   - ती केवळ स्ट्रिंगमधील कोट्स व ब्रेसेस काढून जसाच्या तसा तोच खाते क्रमांक परत करते:
     ```csharp
     // LoanAccountsController.cs Line 1220
     private async Task<string> ResolveValidLoanAccountNo(int branchId, int loanRateId, string? inputAccountNo)
     {
         string clean = (inputAccountNo ?? "").Trim();
         // ... काही JSON क्लीनिंग ...
         if (string.IsNullOrWhiteSpace(clean))
         {
             // केवळ क्रमांक रिकामा असेल तरच ऑटो-जनरेट होतो!
         }
         return clean; // ❌ जर युझरने अस्तित्वात असलेला क्रमांक दिला, तर तो थेट परत केला जातो!
     }
     ```

2. **डेटाबेस स्तरावर युनिक इंडेक्सचा पूर्ण अभाव (No Database UNIQUE Constraint):**
   - `LoanAccounts` टेबलवर केवळ `PK_LoanAccounts` आणि `IX_LoanAccounts_CustomerID` अस्तित्वात आहेत.
   - `(BranchID, LoanAccountNo)` अथवा `LoanAccountNo` वर कोणताही युनिक इंडेक्स (`UNIQUE CONSTRAINT / UNIQUE INDEX`) नाही.
   - `AppDbContext.cs` मधील `OnModelCreating` मध्ये देखील `LoanAccount` साठी युनिक इंडेक्स कन्फिगर केलेला नाही.

3. **कॉनकरन्सी शर्यत (Concurrency Race Condition):**
   - जर दोन वेगवेगळ्या शाखा ऑपरेटर किंवा काऊंटरने एकाच वेळी (उदा. सकाळी १०:०० वाजता) नवीन कर्ज खाते उघडण्याचा प्रयत्न केला, तर दोघांनाही एकच ऑटो-जनरेट केलेला नंबर मिळू शकतो.
   - डेटाबेस युनिक कन्स्ट्रेंट नसल्यामुळे SQL Server दोन्ही खाती विनाअडथळा सेव्ह करतो!

```
[ऑपरेटर १: शाखा १] ──► खाते क्र: "001-201-0000042" ──┐
                                                        ├──► [SQL Server Database]
[ऑपरेटर २: शाखा १] ──► खाते क्र: "001-201-0000042" ──┘    दोन्ही खाती सेव्ह झाली! ❌
                                                          (Unique Constraint नाही)
                                                                   │
                                                                   ▼
                                          [वसुली / पासबुक / नोटीस गोंधळ]
                                          ग्राहक 'अ' चा हप्ता ग्राहक 'ब' च्या खात्यावर!
```

---

#### ब. बँकिंग व कायदेशीर जोखीम (Banking & Legal Risks):
* **चुकीच्या खात्यावर वसुली जमा (Misattribution of Loan Recovery):** एकाच क्रमांकावर दोन वेगवेगळे कर्जदार असल्यास, जेव्हा कॅशियर किंवा एजंट वसुली नोंदवतो तेव्हा रक्कम दुसऱ्याच ग्राहकाच्या खात्यावर जमा होऊन गंभीर आर्थिक अपहार व कायदेशीर वाद निर्माण होऊ शकतात.
* **दोषपूर्ण कायदेशीर नोटीस (Defective Legal & Recovery Notices):** थकबाकी वसुली, कलम १३८ चेक बाऊन्स, किंवा जप्ती नोटीस पाठवताना एकाच्या नावावरील नोटीस दुसऱ्या कर्जदाराच्या पत्त्यावर निघेल. कोर्टात ही केस तांत्रिक त्रुटीमुळे बाद ठरेल.
* **लेजर व तेरीज पत्रक विसंगती (Ledger Integrity Violation):** सब-लेजर (Sub-Ledger) मधील खात्यांची संख्या आणि प्रत्यक्ष लेजर शिल्लक यांचा मेळ बसणार नाही.

---

### 🎯 २. प्रस्तावित दुहेरी सुरक्षा आर्किटेक्चर (Defense-in-Depth Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        इनकमिंग विनंती (POST / PUT)                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     स्तर १: ॲप्लिकेशन पूर्व-तपासणी                      │
│            (Application-Level Pre-Validation Guard)                   │
├────────────────────────────────────────────────────────────────────────┤
│ _context.LoanAccounts.AnyAsync(l => l.BranchID == branchId             │
│    && l.LoanAccountNo == clean && l.LoanAccountID != currentId)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            │ आधीच अस्तित्वात असल्यास                      │ युनिक असल्यास
            ▼                                               ▼
┌───────────────────────────────┐           ┌────────────────────────────────┐
│ HTTP 409 Conflict             │           │ डेटाबेस व्यवहार (DB Insert)    │
│ "कर्ज खाते क्र. '...' आधीपासून  │           └───────────────┬────────────────┘
│ या शाखेत अस्तित्वात आहे..."   │                           │
└───────────────────────────────┘                           ▼
                                            ┌────────────────────────────────┐
                                            │     स्तर २: डेटाबेस युनिक इंडेक्स     │
                                            │ (IX_LoanAccounts_Branch_AccountNo)  │
                                            └───────────────┬────────────────┘
                                                            │
                                    ┌───────────────────────┴────────────────┐
                                    │ कॉनकरन्सी शर्यत आल्यास (Error 2601)    │ यशस्वी
                                    ▼                                        ▼
                        ┌───────────────────────┐               ┌────────────────────┐
                        │ DbUpdateException     │               │ HTTP 200 / 201 OK  │
                        │ कॅच करून 409 Conflict  │               │ Audit Log सेव्ह    │
                        │ + Audit Trail Log     │               └────────────────────┘
                        └───────────────────────┘
```

---

### 📋 ३. तांत्रिक सुधारात्मक घटक (Components to Remediate)

#### घटक १: डेटाबेस स्तरावर युनिक इंडेक्स निर्मिती (Database Unique Index)
- **इंडेक्स नाव:** `IX_LoanAccounts_Branch_AccountNo`
- **कॉलम्स:** `(BranchID, LoanAccountNo)`
- **फिल्टर अट (Filtered Index):** `WHERE [LoanAccountNo] IS NOT NULL AND [LoanAccountNo] <> ''`
- *टीप:* फिल्टर अट लावल्यामुळे जुन्या डेटाबेसमधील तात्पुरत्या रिक्त किंवा नल नोंदींमुळे इंडेक्स ब्लॉक होणार नाही.

#### घटक २: Entity Framework Core मॉडेल मॅपिंग (`AppDbContext.cs`)
- `modelBuilder.Entity<LoanAccount>` मध्ये फ्लूएंट एपीआय (Fluent API) द्वारे हा युनिक इंडेक्स नोंदवला जाईल, ज्यामुळे भविष्यातील मायग्रेशन्समध्ये हा नियम कायमस्वरूपी टिकून राहील.

#### घटक ३: `LoanAccountsController.cs` मध्ये व्हॅलिडेशन व गार्ड क्लॉजेस
1. **`CheckLoanAccountNoExistsAsync(int branchId, string accountNo, int? excludeId = null)`** ही खात्रीशीर पद्धत जोडणे.
2. **`ValidateOpeningBalanceDtoAsync`** मध्ये या पद्धतीचा वापर करून सेव्ह करण्यापूर्वीच खाते क्रमांक डुप्लिकेशन रोखणे.
3. **`ResolveValidLoanAccountNo`** मध्ये सुधारणा करून मॅन्युअल क्रमांक आधीपासून असल्यास स्पष्ट एरर/सूचना देणे.
4. **`PostLoanAccount` (नियमित कर्ज निर्मिती)** मध्ये देखील हाच युनिकनेस चेक लावणे.
5. **`PostOpeningBalance` व `PutOpeningBalance`** मध्ये `DbUpdateException` (SQL 2601/2627) हाताळणी करून सिस्टीम क्रॅश ऐवजी सुरक्षित ४०९ एरर व फॉरेन्सिक ऑडिट लॉग नोंदवणे.

#### घटक ४: ॲप्लिकेशन स्टार्टअप स्वयंचलित पॅच (`Program.cs`)
- कोअर बँकिंगच्या सर्व विद्यमान व नवीन संस्था डेटाबेसेसमध्ये सर्व्हर सुरू होताच हा इंडेक्स स्वयंचलितपणे निर्माण होईल याची खात्री करणे.

---

### 🛠️ ४. तपशीलवार अंमलबजावणी योजना (Step-by-Step Implementation Plan)

#### पाऊल १: `AppDbContext.cs` मध्ये युनिक इंडेक्स नोंदवणे
```csharp
modelBuilder.Entity<LoanAccount>(entity =>
{
    entity.HasIndex(l => new { l.BranchID, l.LoanAccountNo })
          .IsUnique()
          .HasDatabaseName("IX_LoanAccounts_Branch_AccountNo")
          .HasFilter("[LoanAccountNo] IS NOT NULL AND [LoanAccountNo] <> ''");

    entity.HasOne(l => l.Branch)
    // ... उर्वरित विद्यमान कॉन्फिगरेशन ...
```

#### पाऊल २: `Program.cs` स्टार्टअपमध्ये युनिक इंडेक्स निर्मिती स्क्रिप्ट समाविष्ट करणे
```sql
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanAccounts_Branch_AccountNo' AND object_id = OBJECT_ID('LoanAccounts'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_LoanAccounts_Branch_AccountNo]
    ON [dbo].[LoanAccounts] ([BranchID], [LoanAccountNo])
    WHERE [LoanAccountNo] IS NOT NULL AND [LoanAccountNo] <> '';
END
```

#### पाऊल ३: `LoanAccountsController.cs` मध्ये खात्रीशीर डुप्लिकेट तपासणी सहाय्यक पद्धत
```csharp
private async Task<bool> IsLoanAccountNoDuplicateAsync(int branchId, string? accountNo, int? excludeLoanAccountId = null)
{
    if (string.IsNullOrWhiteSpace(accountNo)) return false;
    string clean = accountNo.Trim();

    var query = _context.LoanAccounts.AsNoTracking().Where(l => l.BranchID == branchId && l.LoanAccountNo == clean);
    if (excludeLoanAccountId.HasValue && excludeLoanAccountId.Value > 0)
    {
        query = query.Where(l => l.LoanAccountID != excludeLoanAccountId.Value);
    }

    return await query.AnyAsync();
}
```

#### पाऊल ४: `ValidateOpeningBalanceDtoAsync` मध्ये तपासणी समाविष्ट करणे
- जर `LoanOpeningBalanceID == 0` असेल तर `IsLoanAccountNoDuplicateAsync(dto.BranchID, dto.LoanAccountNo)` तपासणे.
- जर `LoanOpeningBalanceID > 0` असेल तर `IsLoanAccountNoDuplicateAsync(dto.BranchID, dto.LoanAccountNo, dto.LoanOpeningBalanceID)` तपासणे.
- डुप्लिकेट आढळल्यास: `"कर्ज खाते क्रमांक '{dto.LoanAccountNo}' आधीपासून शाखा क्र. {dto.BranchID} मध्ये अस्तित्वात आहे. कृपया वेगळा खाते क्रमांक प्रविष्ट करा."`

#### पाऊल ५: कॉनकरन्सी शर्यत झेलण्यासाठी `DbUpdateException` ट्रॅप लावणे
```csharp
catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sqlEx && (sqlEx.Number == 2601 || sqlEx.Number == 2627))
{
    await transaction.RollbackAsync();
    var (vUserId, vUsername, vIp) = GetAuditContext();
    _context.AuditLogs.Add(new AuditLog
    {
        UserID = vUserId,
        Username = vUsername,
        Action = "LOAN_ACCOUNT_DUPLICATE_COLLISION",
        EntityName = "LoanAccount",
        Status = "Conflict",
        Timestamp = DateTime.Now,
        IPAddress = vIp,
        Details = $"Concurrency collision: LoanAccountNo '{resolvedAccountNo}' already exists in Branch {dto.BranchID}."
    });
    await _context.SaveChangesAsync();
    return Conflict(new { message = $"कर्ज खाते क्रमांक '{resolvedAccountNo}' आधीपासून अस्तित्वात आहे. कृपया नवीन खाते क्रमांक जनरेट करा." });
}
```

#### पाऊल ६: क्लायंट-साइड एरर हँडलिंग (`LoanOpeningBalanceMaster.tsx`)
- एरर मेसेज रिस्पॉन्स योग्यरीत्या पार्स करून ऑपरेटरला स्पष्ट अलर्ट दाखवणे.

---

### 🧪 ५. चाचणी व पडताळणी आराखडा (Verification Matrix)

| चाचणी प्रसंग (Scenario) | इनपुट पेलोड / कृती | अपेक्षित निकाल (Expected Result) |
|---|---|---|
| **१. अस्तित्वात असलेला नंबर टाकून नवीन नोंद** | विद्यमान `LoanAccountNo: "001-201-0000001"` | HTTP 409 Conflict: `"कर्ज खाते क्रमांक आधीपासून अस्तित्वात आहे..."` |
| **२. संपादन करताना तोच नंबर कायम ठेवणे** | स्वतःचे खाते एडिट करताना तोच नंबर ठेवणे | HTTP 200 OK (यशस्वी अद्यतन) |
| **३. संपादन करताना दुसऱ्याचे खाते क्र. देणे** | खाते क्र. 'A' एडिट करताना 'B' चा नंबर देणे | HTTP 409 Conflict: `"कर्ज खाते क्रमांक आधीपासून अस्तित्वात आहे..."` |
| **४. ऑटो-जनरेटेड नंबर वापरणे** | खाते क्रमांक रिकामा ठेवणे | प्रणाली पुढील उपलब्ध बिनचूक युनिक नंबर देईल. |
| **५. कॉनकरन्सी शर्यत (दोन विनंत्या एकाच वेळी)** | दोन थ्रेड्सवरून एकाच नंबरने सेव्ह कॉल | एक विनंती यशस्वी, दुसरी HTTP 409 (सिस्टीम क्रॅश नाही, डेटा सुरक्षित). |

---

### 📋 ६. वरिष्ठ लेखापरीक्षक निष्कर्ष (Auditor's Sign-Off)
सदर योजना लागू केल्याने कोअर बँकिंगच्या कर्ज मॉड्यूलमध्ये **एकाच क्रमांकावर दोन खाती निर्माण होण्याची कोणतीही शक्यता उरणार नाही**, आणि सिस्टीमचे लेजर व कायदेशीर कामकाज पूर्णपणे सुरक्षित होईल.
