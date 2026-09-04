# 📖 Smart Banking - Pigmy Module Complete API Documentation

या दस्तऐवजामध्ये (Documentation) पिग्मी मॉड्युलशी संबंधित सर्व **API Calls, HTTP Methods, Routes, Query Parameters, Headers आणि Request Body (JSON Schemas)** सविस्तर दिले आहेत.

---

## 📑 अनुक्रमणिका (Table of Contents)
1. [१. पिग्मी योजना (Pigmy Schemes API)](#१-पिग्मी-योजना-pigmy-schemes-api)
2. [२. पिग्मी एजंट्स (Pigmy Agents API)](#२-पिग्मी-एजंट्स-pigmy-agents-api)
3. [३. पिग्मी खाती व स्थलांतर (Pigmy Accounts & Migration API)](#३-पिग्मी-खाती-व-स्थलांतर-pigmy-accounts--migration-api)
4. [४. दैनिक पिग्मी जमा / संकलन (Pigmy Collections API)](#४-दैनिक-पिग्मी-जमा--संकलन-pigmy-collections-api)
5. [५. पिग्मी व्याज गणना व पोस्टिंग (Pigmy Interest API)](#५-पिग्मी-व्याज-गणना-व-पोस्टिंग-pigmy-interest-api)
6. [६. पिग्मी खाते बंद करणे (Pigmy Account Closure API)](#६-पिग्मी-खाते-बंद-करणे-pigmy-account-closure-api)
7. [७. एजंट कमिशन मॉड्युल (Agent Commission API)](#७-एजंट-कमिशन-मॉड्युल-agent-commission-api)
8. [८. एजंट डे-बुक व रोख भरणा (Agent Day Book & Cash Remittance API)](#८-एजंट-डे-बुक-व-रोख-भरणा-agent-day-book--cash-remittance-api)
9. [९. पिग्मी मोबाईल / अँड्रॉइड ॲप (Pigmy Mobile & Android App API)](#९-पिग्मी-मोबाईल--अँड्रॉइड-ॲप-pigmy-mobile--android-app-api)

---

## १. पिग्मी योजना (Pigmy Schemes API)
**Base Route**: `/api/PigmySchemes`

### `GET /api/PigmySchemes`
- **वर्णन**: सर्व पिग्मी योजनांची यादी (GL लेजर मॅपिंगसह).
- **Request Body**: काही नाही (None)

### `GET /api/PigmySchemes/{id}`
- **वर्णन**: विशिष्ट योजनेची सविस्तर माहिती.
- **Request Body**: None

### `GET /api/PigmySchemes/NextCode`
- **वर्णन**: पुढील आपोआप तयार होणारा योजना कोड (उदा. `{"nextCode": "PGS002"}`).
- **Request Body**: None

### `POST /api/PigmySchemes` *(नवीन योजना तयार करा)*
- **वर्णन**: नवीन पिग्मी ठेव योजना जतन करा.
- **Request Body (JSON)**:
```json
{
  "schemeCode": "PGS001",
  "schemeName": "दैनिक नियमित ठेव योजना (Daily Pigmy 4%)",
  "interestRate": 4.0,
  "durationMonths": 12,
  "status": "Active",
  "pigmyLiabilityLedgerID": 105,
  "interestExpenseLedgerID": 204,
  "interestPayableLedgerID": 106,
  "commissionExpenseLedgerID": 205
}
```

### `PUT /api/PigmySchemes/{id}` *(योजना अद्ययावत करा)*
- **वर्णन**: विद्यमान योजना संपादित करा.
- **Request Body (JSON)**:
```json
{
  "pigmySchemeID": 1,
  "schemeCode": "PGS001",
  "schemeName": "दैनिक नियमित ठेव योजना (Daily Pigmy 4%)",
  "interestRate": 4.5,
  "durationMonths": 12,
  "status": "Active",
  "pigmyLiabilityLedgerID": 105,
  "interestExpenseLedgerID": 204,
  "interestPayableLedgerID": 106,
  "commissionExpenseLedgerID": 205
}
```

### `DELETE /api/PigmySchemes/{id}?force=true|false`
- **वर्णन**: योजना डिलीट करणे. (जर खाती जोडलेली असतील तर `force=true` वापरावे).

---

## २. पिग्मी एजंट्स (Pigmy Agents API)
**Base Route**: `/api/PigmyAgents`

### `GET /api/PigmyAgents`
- **वर्णन**: सर्व पिग्मी एजंट्सची यादी.
- **Request Body**: None

### `GET /api/PigmyAgents/next-id`
- **वर्णन**: पुढील एजंट आयडी व कोड मिळवा (उदा. `{"nextId": 3, "agentCode": "AGT-003"}`).

### `POST /api/PigmyAgents` *(नवीन एजंट तयार करा)*
- **वर्णन**: नवीन पिग्मी एजंट नोंदणी.
- **Request Body (JSON)**:
```json
{
  "agentName": "आनंद विनायक पाटील",
  "mobileNo": "9876543210",
  "joiningDate": "2025-04-01",
  "status": "Active",
  "branchID": 1
}
```

### `PUT /api/PigmyAgents/{id}` *(एजंट माहिती अपडेट करा)*
- **Request Body (JSON)**:
```json
{
  "pigmyAgentID": 1,
  "agentName": "आनंद विनायक पाटील",
  "mobileNo": "9876543210",
  "joiningDate": "2025-04-01",
  "status": "Active",
  "branchID": 1
}
```

### `DELETE /api/PigmyAgents/{id}?force=true|false`
- **वर्णन**: एजंट डिलीट करणे (किंवा `force=true` ने संदर्भ दुसऱ्या एजंटकडे हस्तांतरित करणे).

---

## ३. पिग्मी खाती व स्थलांतर (Pigmy Accounts & Migration API)
**Base Route**: `/api/PigmyAccounts`

### `GET /api/PigmyAccounts`
- **वर्णन**: सर्व पिग्मी खात्यांची यादी (सभासद, योजना, एजंट, शिल्लक रकमेसह).
- **Query Filters**:
  - `agentId`: एजंटनुसार फिल्टर करा (उदा. `/api/PigmyAccounts?agentId=2`)
  - `branchId`: शाखेनुसार फिल्टर करा (उदा. `/api/PigmyAccounts?branchId=1`)
  - `status`: स्थितीनुसार फिल्टर करा (उदा. `/api/PigmyAccounts?agentId=2&status=Active`)

### `GET /api/PigmyAccounts/Agent/{agentId}` ⭐ *(एजंटनुसार सर्व ग्राहक व खाती मिळवणे)*
- **वर्णन**: विशिष्ट एजंटशी जोडलेली सर्व पिग्मी खाती व ग्राहकांची (सभासद) माहिती मिळवणे.
- **Query Parameter**: `status` (Default: `"Active"`)
- **उदाहरण**: `GET /api/PigmyAccounts/Agent/2?status=Active`
- **Response (JSON Array)**:
```json
[
  {
    "pigmyAccountID": 5,
    "accountNo": "010100005",
    "memberID": 101,
    "memberName": "सचिन रमेश तेंडुलकर",
    "memberCode": "MEM-00101",
    "mobileNo": "9876543210",
    "address": "शिवाजी नगर, सांगली",
    "schemeName": "दैनिक नियमित ठेव योजना (Daily Pigmy 4%)",
    "interestRate": 4.0,
    "currentBalance": 15000.00,
    "totalDepositedAmount": 15000.00,
    "openingDate": "2025-04-01",
    "maturityDate": "2026-03-31",
    "status": "Active"
  },
  {
    "pigmyAccountID": 6,
    "accountNo": "010100006",
    "memberID": 102,
    "memberName": "राहुल शरद द्रविड",
    "memberCode": "MEM-00102",
    "mobileNo": "9822334455",
    "address": "गणेश नगर, सांगली",
    "schemeName": "दैनिक नियमित ठेव योजना (Daily Pigmy 4%)",
    "interestRate": 4.0,
    "currentBalance": 22500.00,
    "totalDepositedAmount": 22500.00,
    "openingDate": "2025-04-01",
    "maturityDate": "2026-03-31",
    "status": "Active"
  }
]
```

### `GET /api/PigmyAccounts/Member/{memberId}`
- **वर्णन**: संबंधित सभासदाची सर्व पिग्मी खाती.

### `GET /api/PigmyAccounts/{id}`
- **वर्णन**: विशिष्ट पिग्मी खात्याची माहिती.

### `GET /api/PigmyAccounts/NextAccountNo?branchId=1&pigmySchemeId=1`
- **वर्णन**: पुढील उपलब्ध खाते क्रमांक (उदा. `{"nextAccountNo": "010100005"}`).

---

### `POST /api/PigmyAccounts` *(नवीन पिग्मी खाते उघडा)*
- **वर्णन**: नवीन पिग्मी खाते तयार करणे, आरंभिक ठेव ट्रान्झॅक्शन आणि स्वयंचलित लेजर व्हाउचर तयार करणे.
- **Request Body (JSON)**:
```json
{
  "memberID": 101,
  "branchID": 1,
  "pigmySchemeID": 1,
  "pigmyAgentID": 2,
  "openingDate": "2026-04-01",
  "openingBalance": 1000.00,
  "accountNo": "010100005"
}
```
*(टीप: `accountNo` न दिल्यास सिस्टीम पुढील सिक्वेन्स आपोआप घेते).*

---

### `POST /api/PigmyAccounts/Migrate` *(आरंभिक शिल्लक स्थलांतर - Opening Balance Migration)*
- **वर्णन**: मागील सॉफ्टवेअर/वर्षातील जुनी शिल्लक स्थलांतरित करणे.
- **Request Body (JSON)**:
```json
{
  "memberID": 101,
  "branchID": 1,
  "pigmySchemeID": 1,
  "pigmyAgentID": 2,
  "openingBalance": 25000.00,
  "financialYear": "2025-2026",
  "asOfDate": "2025-03-31",
  "openingDate": "2025-03-31"
}
```

---

### `PUT /api/PigmyAccounts/{id}` *(खाते माहिती अपडेट करा)*
- **Request Body (JSON)**:
```json
{
  "pigmyAgentID": 2,
  "pigmySchemeID": 1,
  "totalDepositedAmount": 26500.00,
  "status": "Active",
  "maturityDate": "2027-03-31"
}
```

### `DELETE /api/PigmyAccounts/{id}?force=true|false`
- **वर्णन**: पिग्मी खाते व त्याचे सर्व व्यवहार डिलीट करणे.

### `POST /api/PigmyAccounts/ClearAllPigmyData`
- **वर्णन**: चाचणीसाठी किंवा रिसेट करण्यासाठी पिग्मी डेटा पूर्णपणे साफ करणे.

---

## ४. दैनिक पिग्मी जमा / संकलन (Pigmy Collections API)
**Base Route**: `/api/PigmyCollections`

### `GET /api/PigmyCollections`
- **Query Filters**: `fromDate`, `toDate`, `agentId`, `branchId`, `pigmyAccountId`
- **उदा.**: `/api/PigmyCollections?fromDate=2026-04-01&toDate=2026-04-30&agentId=2`

---

### `POST /api/PigmyCollections/Manual` *(सिंगल मॅन्युअल जमा नोंद)*
- **वर्णन**: शाखेतून एका खात्यावर रोख रक्कम जमा करणे.
- **Request Body (JSON)**:
```json
{
  "pigmyAccountId": 5,
  "agentId": 2,
  "collectionDate": "2026-04-15",
  "collectionAmount": 500.00
}
```

---

### `POST /api/PigmyCollections/BulkManual` *(बल्क / ग्रिड मॅन्युअल जमा नोंद)*
- **वर्णन**: एकाच एजंटच्या अनेक खात्यांची एकत्रित जमा नोंद करणे.
- **Request Body (JSON)**:
```json
{
  "agentId": 2,
  "collectionDate": "2026-04-15",
  "items": [
    {
      "pigmyAccountId": 5,
      "collectionAmount": 500.00
    },
    {
      "pigmyAccountId": 6,
      "collectionAmount": 1000.00
    },
    {
      "pigmyAccountId": 7,
      "collectionAmount": 250.00
    }
  ]
}
```

---

### `POST /api/PigmyCollections/AppSync` *(मोबाईल ॲपवरून कलेक्शन सिंक)*
- **वर्णन**: मोबाईल ॲपवरून गोळा केलेल्या पावत्या बॅचमध्ये सिंक करणे.
- **Request Body (JSON Array)**:
```json
[
  {
    "pigmyAccountId": 5,
    "agentId": 2,
    "collectionDate": "2026-04-15T11:30:00",
    "collectionAmount": 500.00,
    "syncReferenceId": "SYNC-UUID-98741-A"
  },
  {
    "pigmyAccountId": 6,
    "agentId": 2,
    "collectionDate": "2026-04-15T11:45:00",
    "collectionAmount": 1000.00,
    "syncReferenceId": "SYNC-UUID-98741-B"
  }
]
```

---

## ५. पिग्मी व्याज गणना व पोस्टिंग (Pigmy Interest API)
**Base Route**: `/api/PigmyInterest`

### `GET /api/PigmyInterest/CalculatePreview`
- **Query Parameters**: `startDate=YYYY-MM-DD`, `endDate=YYYY-MM-DD`
- **उदा.**: `/api/PigmyInterest/CalculatePreview?startDate=2025-04-01&endDate=2026-03-31`
- **वर्णन**: दरमहा १० तारखेच्या किमान शिल्लक नियमानुसार व्याजाची पूर्वपडताळणी (Preview) पाहणे.

---

### `POST /api/PigmyInterest/PostInterest` *(व्याज खात्यांवर जमा करणे)*
- **वर्णन**: सर्व खात्यांवर व्याज जमा करून लेजर जर्नल व्हाउचर तयार करणे.
- **Request Body (JSON)**:
```json
{
  "startDate": "2025-04-01",
  "endDate": "2026-03-31",
  "branchId": 1
}
```

---

## ६. पिग्मी खाते बंद करणे (Pigmy Account Closure API)
**Base Route**: `/api/PigmyClosure`

### `GET /api/PigmyClosure/Preview/{accountNo}`
- **उदा.**: `/api/PigmyClosure/Preview/010100005`
- **वर्णन**: खाते मुदतपूर्व (Premature) आहे की मुदतीनंतर, व देय रक्कम (Net Payable) तपासणे.

---

### `POST /api/PigmyClosure/Close` *(खाते बंद करून रक्कम देणे)*
- **वर्णन**: खाते 'Closed' करून शिल्लक शून्य करणे व पेमेंट व्हाउचर जनरेट करणे.
- **Request Body (JSON)**:
```json
{
  "accountNo": "010100005",
  "branchId": 1,
  "narration": "पिग्मी खाते मुदत समाप्तीनंतर बंद करून रोख परतावा दिला."
}
```

---

## ७. एजंट कमिशन मॉड्युल (Agent Commission API)
**Base Route**: `/api/AgentCommission`

### `GET /api/AgentCommission/Settings`
- **वर्णन**: कमिशन दर व टक्केवारी सेटिंग्ज पाहणे.

### `POST /api/AgentCommission/Settings` *(कमिशन सेटिंग तयार करा)*
- **Request Body (JSON)**:
```json
{
  "agentId": 2,
  "calculationFrequency": "MONTHLY",
  "commissionType": "PERCENTAGE",
  "commissionRate": 3.0,
  "isActive": true
}
```

### `GET /api/AgentCommission/Pending?branchId=1&agentId=2`
- **वर्णन**: जमा झालेले पण अजून न दिलेले प्रलंबित (Pending) कमिशन.

### `GET /api/AgentCommission/History?branchId=1&agentId=2&fromDate=2026-01-01&toDate=2026-03-31`
- **वर्णन**: दिलेले कमिशन व व्हाउचर तपशील इतिहास.

---

### `POST /api/AgentCommission/Calculate` *(कमिशन गणना करा)*
- **Request Body (JSON)**:
```json
{
  "agentId": 2,
  "frequency": "MONTHLY",
  "fromDate": "2026-03-01",
  "toDate": "2026-03-31",
  "date": "2026-03-31"
}
```

---

### `POST /api/AgentCommission/Pay` *(कमिशन अदा करा)*
- **वर्णन**: कमिशन रोख, बँक किंवा एजंटच्या सेव्हिंग खात्यावर वर्ग (Transfer) करणे व पेमेंट व्हाउचर तयार करणे.
- **Request Body (JSON)**:
```json
{
  "commissionId": 12,
  "branchId": 1,
  "paymentMode": "CASH",
  "cashLedgerId": 1,
  "expenseLedgerId": 205,
  "agentSavingAccountId": null
}
```
*(जर `paymentMode` हे `"AGENT_SB"` असेल तर `agentSavingAccountId` द्यावे).*

---

## ८. एजंट डे-बुक व रोख भरणा (Agent Day Book & Cash Remittance API)
**Base Route**: `/api/AgentDayBook`

### `GET /api/AgentDayBook/Summary/{agentId}/{date}`
- **उदा.**: `/api/AgentDayBook/Summary/2/2026-04-15`
- **वर्णन**: एजंटचे डे-बुक सारांश (आरंभीची शिल्लक + आजची वसुली - शाखेत जमा रक्कम = उर्वरित शिल्लक).

---

### `POST /api/AgentDayBook/DepositCash` *(एजंटने शाखेत कॅश जमा करणे)*
- **वर्णन**: एजंटने गोळा केलेली कॅश शाखेच्या कॅशियरकडे जमा करणे व पावती व्हाउचर तयार करणे.
- **Request Body (JSON)**:
```json
{
  "agentId": 2,
  "branchId": 1,
  "depositDate": "2026-04-15",
  "amount": 15000.00,
  "paymentMode": "CASH",
  "narration": "दैनिक पिग्मी वसुली रोख भरणा"
}
```

---

## ९. पिग्मी मोबाईल / अँड्रॉइड ॲप (Pigmy Mobile & Android App API)
**Headers required**: `X-Agent-Id: <AgentID>` किंवा `Authorization: Bearer <Token>`

### `POST /api/PigmyApp/Login` *(एजंट मोबाईल लॉगिन)*
- **Request Body (JSON)**:
```json
{
  "mobileNo": "9876543210"
}
```

---

### `GET /api/PigmyApp/CollectionStatus` किंवा `GET /api/agent/lock-status`
- **वर्णन**: मागील २ दिवसांचे कॅश रेमिटन्स लॉक तपासणे.

---

### `GET /api/PigmyApp/Accounts` किंवा `GET /api/accounts`
- **वर्णन**: एजंटशी जोडलेली सर्व सक्रिय पिग्मी खाती मोबाईलवर डाऊनलोड करणे.

---

### `POST /api/PigmyApp/CreateCustomer` किंवा `POST /api/accounts` *(मोबाईलवरून नवीन खाते उघडा)*
- **वर्णन**: एजंटने थेट फील्डवरून नवीन ग्राहक व पिग्मी खाते उघडणे.
- **Request Body (JSON)**:
```json
{
  "firstName": "प्रशांत",
  "middleName": "दिलीप",
  "lastName": "जाधव",
  "mobileNo": "9822334455",
  "aadhaarNo": "123456789012",
  "address": "शिवाजी चौक, सांगली",
  "gender": "Male",
  "branchID": 1,
  "agentId": 2
}
```

---

### `POST /api/PigmyApp/BulkCollection` *(मोबाईलवरून बॅच कलेक्शन पाठवणे)*
- **Request Body (JSON)**:
```json
{
  "agentId": 2,
  "items": [
    {
      "pigmyAccountId": 5,
      "collectionAmount": 500.00,
      "collectionDate": "2026-04-15T10:00:00",
      "receiptNo": "REC-APP-01-20260415-001"
    },
    {
      "pigmyAccountId": 6,
      "collectionAmount": 200.00,
      "collectionDate": "2026-04-15T10:05:00",
      "receiptNo": "REC-APP-01-20260415-002"
    }
  ]
}
```

---

### `POST /api/collections` *(सिंगल रिअल-टाइम वसुली नोंद)*
- **Request Body (JSON)**:
```json
{
  "accountId": 5,
  "amount": 500.00,
  "timestamp": "2026-04-15T10:00:00",
  "transactionId": "TXN-UUID-5566-7788",
  "offlineSync": false,
  "agentId": 2,
  "paymentMode": "CASH"
}
```

---

### `POST /api/collections/bulk-sync` *(ऑफलाइन बॅच सिंक)*
- **Request Body (JSON)**:
```json
{
  "agentId": 2,
  "collections": [
    {
      "accountId": 5,
      "amount": 500.00,
      "timestamp": "2026-04-15T10:00:00",
      "transactionId": "OFFLINE-TXN-001",
      "offlineSync": true
    },
    {
      "accountId": 6,
      "amount": 1000.00,
      "timestamp": "2026-04-15T10:15:00",
      "transactionId": "OFFLINE-TXN-002",
      "offlineSync": true
    }
  ]
}
```

---

### `GET /api/PigmyApp/Passbook?pigmyAccountId=5&fromDate=2026-01-01&toDate=2026-04-15`
- **वर्णन**: खात्याचे पासबुक, सर्व जमा/नावे व्यवहार व चालू शिल्लक.

---

### `GET /api/PigmyApp/CollectionReport?fromDate=2026-04-01&toDate=2026-04-15`
- **वर्णन**: एजंटच्या दैनिक वसुलीचा अहवाल.

---

### `GET /api/PigmyApp/CommissionReport?fromDate=2026-01-01&toDate=2026-03-31`
- **वर्णन**: एजंटचे मिळालेले एकूण कमिशन अहवाल.
