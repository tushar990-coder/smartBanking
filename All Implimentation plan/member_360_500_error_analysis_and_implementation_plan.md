# खातेदार ३६०° (Member360) त्रुटी विश्लेषण व निराकरण कृती आराखडा
## Root Cause Analysis & Detailed Implementation Plan for HTTP 500 Error

---

### १. त्रुटीचे मूळ कारण (Root Cause Analysis)

वापरकर्त्याने स्क्रीनशॉटमध्ये दाखवलेली त्रुटी:
> **खातेदार ३६०° सारांश लोड करता आला नाही (Request failed with status code 500)**
> URL: `http://localhost:5173/member-360?memberId=1`
> खातेदार: `CIF-000001 राजेश निवृत्ती कांबळे`

बॅकएंड API वर थेट JWT ऑथोरायझेशन टोकनसह टेस्ट कॉल (`GET /api/Reports/Customer360/1`) केल्यानंतर बॅकएंडकडून मिळालेला मूळ एक्सेप्शन संदेश:

```
StatusCode        : InternalServerError (500)
Server Message    : ३६०° प्रोफाइल लोडिंग करताना त्रुटी आली: Invalid column name 'BranchID'.
```

#### तांत्रिक विश्लेषण (Technical Deep-Dive):
1. **कंट्रोलर व क्वेरी अंमलबजावणी (Controller Query Execution):**
   - [`ReportsController.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Controllers/ReportsController.cs#L3456) मधील `GetMember360` ॲक्शन खातेदाराचे ताजे व्यवहार आणण्यासाठी `SavingTransactions` टेबलवर LINQ क्वेरी करते:
     ```csharp
     var lastSavingTx = await _context.SavingTransactions
         .Where(st => savingAccIds.Contains(st.SavingAccountID))
         .OrderByDescending(st => st.TransactionDate)
         .FirstOrDefaultAsync();

     var savingTxs = await _context.SavingTransactions
         .Include(st => st.SavingAccount)
         .Where(st => savingAccIds.Contains(st.SavingAccountID))
         .OrderByDescending(st => st.TransactionDate)
         .Take(20)
         .ToListAsync();
     ```
2. **मॉडेल वि. डेटाबेस विसंगती (Model vs Database Schema Mismatch):**
   - कोर बँकिंग सिस्टीम (CBS) मल्टि-ब्राँच आर्किटेक्चर लागू करताना C# मॉडेल [`SavingTransaction.cs`](file:///d:/Bhisi%20Software/api/Bhisi.Api/Models/SavingTransaction.cs#L33) मध्ये `BranchID` प्रॉपर्टी समाविष्ट करण्यात आली होती:
     ```csharp
     [Required]
     public int BranchID { get; set; } = 1;

     [ForeignKey("BranchID")]
     public virtual Branch? Branch { get; set; }
     ```
   - परंतु, स्थानिक डेटाबेस `SmartBanking_Template` मधील प्रत्यक्ष `SavingTransactions` टेबलमध्ये `BranchID` हा कॉलम अस्तित्वात नाही!
3. **परिणाम (Impact):**
   - जेव्हा Entity Framework Core ही क्वेरी SQL Server वर एक्झिक्युट करते, तेव्हा SQL जनरेशनमध्ये `[s].[BranchID]` कॉल केला जातो.
   - SQL Server ताबडतोब `SqlException: Invalid column name 'BranchID'` फेकतो, ज्यामुळे संपूर्ण ३६०° डॅशबोर्ड ५०० Internal Server Error देऊन थांबतो.
   - याचप्रमाणे `LoanApplications` टेबलमध्येही मॉडेलनुसार `BranchID` कॉलम शिल्लक आहे.

---

### २. प्रस्तावित निराकरण कृती आराखडा (Implementation Plan)

#### टप्पा १: SQL डेटाबेस स्कीमा अपडेट (Database Schema Patch)
`SmartBanking_Template` डेटाबेसवर खालील SQL पॅच रन करणे:
1. `SavingTransactions` टेबलमध्ये `BranchID INT NOT NULL DEFAULT 1` जोडणे.
2. विद्यमान व्यवहारांचे `BranchID` त्यांच्या संबंधित `SavingAccountMasters.BranchID` वरून अचूकपणे बॅकफिल (Backfill) करणे.
3. `LoanApplications` टेबलमध्ये `BranchID INT NOT NULL DEFAULT 1` जोडणे व ग्राहकांच्या होम ब्रँचवरून बॅकफिल करणे.
4. रिपोर्टिंगच्या परफॉर्मन्ससाठी आवश्यक इंडेक्स जोडणे.

```sql
-- 1. SavingTransactions BranchID
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingTransactions') AND name = 'BranchID')
BEGIN
    ALTER TABLE [SavingTransactions] ADD [BranchID] INT NOT NULL CONSTRAINT DF_SavingTransactions_BranchID DEFAULT 1;
    
    UPDATE st
    SET st.BranchID = ISNULL(sa.BranchID, 1)
    FROM SavingTransactions st
    JOIN SavingAccountMasters sa ON st.SavingAccountID = sa.SavingAccountID;
    
    PRINT 'Added BranchID to SavingTransactions and backfilled from SavingAccountMasters';
END

-- 2. LoanApplications BranchID
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LoanApplications') AND name = 'BranchID')
BEGIN
    ALTER TABLE [LoanApplications] ADD [BranchID] INT NOT NULL CONSTRAINT DF_LoanApplications_BranchID DEFAULT 1;
    
    UPDATE la
    SET la.BranchID = ISNULL(c.BranchID, 1)
    FROM LoanApplications la
    JOIN Customers c ON la.CustomerID = c.CustomerID;
    
    PRINT 'Added BranchID to LoanApplications and backfilled from Customers';
END
```

#### टप्पा २: मास्टर VPS मायग्रेशन स्क्रिप्टमध्ये नोंद (Master VPS Schema Sync)
भविष्यातील क्लायंट डिप्लॉयमेंट्स किंवा VPS अपडेट्समध्ये ही त्रुटी येऊ नये म्हणून [`tools/master_vps_update_schema.sql`](file:///d:/Bhisi%20Software/tools/master_vps_update_schema.sql) मध्ये कलम ५० (Saving CIF-First Schema) अंतर्गत हाच बदल नोंदवणे.

#### टप्पा ३: बॅकएंड API चाचणी (Backend API Verification)
1. स्थानिक Kestrel सर्व्हरवर थेट `GET /api/Reports/Customer360/1` कॉल करून २०० OK रिस्पॉन्स तपासणे.
2. DTO मधील सर्व बचत, कर्ज, FD, RD, पिग्मी आणि ताजे व्यवहार (RecentTransactions) अचूक लोड होत असल्याची खात्री करणे.

#### टप्पा ४: फ्रंटएंड डॅशबोर्ड पडताळणी (Frontend Dashboard Verification)
1. `http://localhost:5173/member-360?memberId=1` ब्राउझरमध्ये रिफ्रेश करणे.
2. खातेदार प्रोफाइल कार्ड, पोर्टफोलिओ शिल्लक (बचत ठेवी, कर्जे, शेअर्स) आणि अलीकडील २० व्यवहारांची यादी लाल एररशिवाय सुरळीत दिसत असल्याची खात्री करणे.
