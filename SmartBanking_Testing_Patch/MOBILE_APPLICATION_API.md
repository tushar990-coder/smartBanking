# 📱 Smart Banking — Mobile Application & Pigmy API Documentation

This document contains complete REST API specifications for developing the **Mobile Application (Agent App & Customer App)** for the Smart Banking platform.

---

## 🌐 1. General Configuration

- **Base URL:** `http://<your-server-ip>:5242`
- **Default Headers:**
  - `Content-Type: application/json; charset=utf-8`
  - `Authorization: Bearer <JWT_TOKEN>` *(Required for all secure endpoints)*
  - `X-Agent-Id: <AGENT_ID>` *(Optional fallback header for Agent specific requests)*

---

## 🔑 2. Authentication API (एजंट / युझर लॉगिन)

### `POST /api/Auth/login`
Authenticates the mobile user/agent and returns a JWT access token.

#### Request Headers:
```http
Content-Type: application/json
```

#### Request Body:
```json
{
  "username": "agent01",
  "password": "password123"
}
```

#### Response (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": 10,
  "agentId": 1,
  "username": "agent01",
  "fullName": "गणेश पाटील",
  "role": "Agent",
  "branchId": 1
}
```

---

## 📋 3. Pigmy Schemes API (पिग्मी योजना यादी)

### `GET /api/PigmySchemes`
Fetches all available Pigmy schemes with interest rates, duration, and status.

#### Request Headers:
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Response (200 OK):
```json
[
  {
    "pigmySchemeID": 1,
    "schemeCode": "PGS001",
    "schemeName": "दैनंदिन पिग्मी बचत योजना (Daily Pigmy 4%)",
    "interestRate": 4.00,
    "durationMonths": 12,
    "status": "Active"
  },
  {
    "pigmySchemeID": 2,
    "schemeCode": "PGS002",
    "schemeName": "विशेष पिग्मी योजना (Special Pigmy 5%)",
    "interestRate": 5.00,
    "durationMonths": 24,
    "status": "Active"
  }
]
```

### `GET /api/PigmySchemes/{id}`
Fetches details of a single Pigmy scheme.

---

## 📥 4. Agent Customer Onboarding (नवीन ग्राहक व पिग्मी खाते नोंदणी विनंती)

### `POST /api/AgentCustomerRequests`
Allows an agent to submit a new customer onboarding request directly from the mobile app. The request is held in staging until approved by the society branch.

#### Request Headers:
```http
Content-Type: application/json; charset=utf-8
Authorization: Bearer <JWT_TOKEN>
```

#### Request Body:
```json
{
  "branchID": 1,
  "pigmyAgentID": 1,
  "agentName": "गणेश पाटील (Agent-01)",
  "firstName": "विकास",
  "middleName": "तानाजी",
  "lastName": "शिंदे",
  "firstNameEng": "Vikas",
  "middleNameEng": "Tanaji",
  "lastNameEng": "Shinde",
  "gender": "Male",
  "birthDate": "1992-05-15",
  "occupation": "शेती / व्यवसाय",
  "casteCategory": "Open",
  "mobileNo": "9876543210",
  "email": "vikas.shinde@example.com",
  "aadhaarNo": "123456789012",
  "panNo": "ABCPS1234F",
  "address": "मु. पो. कासारवाडी, ता. हवेली",
  "village": "कासारवाडी",
  "taluka": "हवेली",
  "district": "पुणे",
  "pincode": "411034",
  "nomineeName": "सुनिता विकास शिंदे",
  "nomineeNameEng": "Sunita Vikas Shinde",
  "nomineeRelation": "पत्नी (Wife)",
  "nomineeAddress": "कासारवाडी, पुणे",
  "nomineeBirthDate": "1995-08-10",
  "nomineeAge": 31,
  "photoPath": "/uploads/members/photo_123.jpg",
  "signaturePath": "/uploads/members/sign_123.jpg",
  "aadhaarDocPath": "/uploads/members/aadhaar_123.jpg",
  "panDocPath": "/uploads/members/pan_123.jpg",
  "openPigmyAccount": true,
  "pigmySchemeID": 1,
  "dailyDepositAmount": 200.00,
  "initialDepositAmount": 500.00,
  "remarks": "दुकानदार - दररोज ₹२०० बचत"
}
```

#### Response (200 OK):
```json
{
  "requestID": 4,
  "status": "Pending",
  "requestDate": "2026-08-30T16:56:52",
  "message": "ग्राहक नोंदणी विनंती यशस्वीरीत्या पाठवली. शाखेकडून मंजुरी मिळाल्यावर खाते सुरू होईल."
}
```

### `GET /api/AgentCustomerRequests/pending`
Returns pending onboarding requests submitted for the branch.

---

## 📷 5. KYC & Document Upload API (फोटो व कागदपत्रे अपलोड)

### `POST /api/Members/upload`
Uploads customer photo, signature, Aadhaar, or PAN images/PDFs.

#### Request Headers:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

#### Form Data Parameters:
- `file`: The binary image/PDF file.

#### Response (200 OK):
```json
{
  "url": "/uploads/members/photo_1788088891490.jpg",
  "fileName": "photo_1788088891490.jpg"
}
```

---

## 👥 6. Pigmy Accounts API (एजंटची सक्रिय ग्राहक खाती)

### `GET /api/accounts`
Returns all active Pigmy customer accounts assigned to the logged-in agent.

#### Request Headers:
```http
Authorization: Bearer <JWT_TOKEN>
X-Agent-Id: 1
```

#### Query Parameters (Optional):
- `agentId`: `1`

#### Response (200 OK):
```json
[
  {
    "accountId": 15,
    "pigmyAccountId": 15,
    "accountNo": "100-PG-00015",
    "memberId": 42,
    "memberName": "विकास तानाजी शिंदे",
    "mobileNo": "9876543210",
    "address": "कासारवाडी, हवेली",
    "currentBalance": 12400.00,
    "totalDepositedAmount": 12400.00,
    "interestRate": 4.00,
    "openingDate": "2026-08-01",
    "maturityDate": "2027-08-01",
    "status": "Active"
  }
]
```

---

## 💰 7. Daily Pigmy Collection & Sync API (दैनिक हप्ता संकलन)

### `POST /api/collections` (Real-Time Single Deposit)
Used by agent mobile app to record an online daily deposit collection.

#### Request Headers:
```http
Content-Type: application/json; charset=utf-8
Authorization: Bearer <JWT_TOKEN>
```

#### Request Body:
```json
{
  "agentId": 1,
  "accountId": 15,
  "accountNo": "100-PG-00015",
  "amount": 200.00,
  "paymentMode": "CASH",
  "transactionId": "TXN_MOB_1788019283",
  "latitude": 18.5204,
  "longitude": 73.8567,
  "remarks": "Daily Deposit"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "isDuplicate": false,
  "receiptNo": "REC-20260830-0042",
  "transactionId": "TXN_MOB_1788019283",
  "accountId": 15,
  "accountNo": "100-PG-00015",
  "memberName": "विकास तानाजी शिंदे",
  "amount": 200.00,
  "currentBalance": 12600.00,
  "paymentMode": "CASH",
  "timestamp": "2026-08-30 17:15:00",
  "message": "हप्ता यशस्वीरित्या जमा झाला."
}
```

---

### `POST /api/collections/bulk-sync` (Offline Batch Sync)
Synchronizes multiple offline collections made by the agent while disconnected from the internet.

#### Request Headers:
```http
Content-Type: application/json; charset=utf-8
Authorization: Bearer <JWT_TOKEN>
```

#### Request Body:
```json
{
  "collections": [
    {
      "agentId": 1,
      "accountId": 15,
      "accountNo": "100-PG-00015",
      "amount": 200.00,
      "transactionId": "OFFLINE_TXN_001",
      "paymentMode": "CASH",
      "timestamp": "2026-08-30T10:30:00"
    },
    {
      "agentId": 1,
      "accountId": 18,
      "accountNo": "100-PG-00018",
      "amount": 500.00,
      "transactionId": "OFFLINE_TXN_002",
      "paymentMode": "CASH",
      "timestamp": "2026-08-30T10:35:00"
    }
  ]
}
```

#### Response (200 OK):
```json
{
  "syncedCount": 2,
  "failedCount": 0,
  "totalAmount": 700.00,
  "results": [
    {
      "transactionId": "OFFLINE_TXN_001",
      "success": true,
      "receiptNo": "REC-20260830-0043",
      "currentBalance": 12600.00
    },
    {
      "transactionId": "OFFLINE_TXN_002",
      "success": true,
      "receiptNo": "REC-20260830-0044",
      "currentBalance": 8500.00
    }
  ]
}
```

---

## 🔒 8. Agent Cash Limit & Lock Status (कॅश मर्यादा व लॉक स्थिती)

### `GET /api/agent/lock-status`
Checks if the agent's cash-in-hand has exceeded the maximum allowed cash limit.

#### Request Headers:
```http
Authorization: Bearer <JWT_TOKEN>
X-Agent-Id: 1
```

#### Response (200 OK):
```json
{
  "agentId": "1",
  "status": "ALLOWED",
  "pendingCash": 3600.00,
  "maxCashLimit": 50000.00,
  "message": "Collection allowed.",
  "isLocked": false
}
```

---

## 📊 9. Dashboard & Statement APIs (डॅशबोर्ड व पासबुक)

### `GET /api/dashboard/summary?agentId=1`
Returns daily collection statistics for the agent.

#### Response (200 OK):
```json
{
  "date": "2026-08-30",
  "agentId": 1,
  "openingBalance": 0.00,
  "todaysCollection": 8600.00,
  "todaysRemittance": 5000.00,
  "totalReceipts": 24,
  "closingBalance": 3600.00,
  "pendingCashInHand": 3600.00,
  "lockStatus": "ALLOWED",
  "isLocked": false
}
```

---

### `GET /api/reports/passbook/{accountId}`
Fetches account transaction history (Passbook / Mini Statement).

#### Query Parameters:
- `fromDate`: `2026-08-01`
- `toDate`: `2026-08-30`

#### Response (200 OK):
```json
{
  "accountId": 15,
  "accountNo": "100-PG-00015",
  "memberName": "विकास तानाजी शिंदे",
  "agentName": "गणेश पाटील",
  "openingBalance": 12000.00,
  "closingBalance": 12600.00,
  "statement": [
    {
      "transactionId": 101,
      "date": "2026-08-28",
      "transactionType": "Deposit",
      "narration": "Daily Pigmy Deposit",
      "drAmount": 0.00,
      "crAmount": 200.00,
      "runningBalance": 12200.00
    },
    {
      "transactionId": 102,
      "date": "2026-08-29",
      "transactionType": "Deposit",
      "narration": "Daily Pigmy Deposit",
      "drAmount": 0.00,
      "crAmount": 200.00,
      "runningBalance": 12400.00
    },
    {
      "transactionId": 103,
      "date": "2026-08-30",
      "transactionType": "Deposit",
      "narration": "Daily Pigmy Deposit",
      "drAmount": 0.00,
      "crAmount": 200.00,
      "runningBalance": 12600.00
    }
  ]
}
```

---

## 📑 10. Master & Dropdown Options API (ड्रॉपडाऊन पर्याय व मास्टर यादी)

### `GET /api/AgentCustomerRequests/dropdowns`
Fetches all master dropdown lists in a single API call for building the Mobile App Customer Registration Form (Genders, Caste Categories, Occupations, Nominee Relations, Pigmy Schemes, and Branches).

#### Request Headers:
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Response (200 OK):
```json
{
  "genders": [
    { "code": "Male", "nameMr": "पुरुष (Male)", "nameEn": "Male" },
    { "code": "Female", "nameMr": "महिला (Female)", "nameEn": "Female" },
    { "code": "Other", "nameMr": "इतर (Other)", "nameEn": "Other" }
  ],
  "casteCategories": [
    { "code": "Open", "nameMr": "खुला (Open)", "nameEn": "Open" },
    { "code": "OBC", "nameMr": "ओबीसी (OBC)", "nameEn": "OBC" },
    { "code": "SC", "nameMr": "एस.सी. (SC)", "nameEn": "SC" },
    { "code": "ST", "nameMr": "एस.टी. (ST)", "nameEn": "ST" },
    { "code": "VJNT", "nameMr": "व्ही.जे.एन.टी. (VJNT)", "nameEn": "VJNT" },
    { "code": "NT", "nameMr": "एन.टी. (NT)", "nameEn": "NT" },
    { "code": "SBC", "nameMr": "एस.बी.सी. (SBC)", "nameEn": "SBC" },
    { "code": "EWS", "nameMr": "ई.डब्ल्यू.एस. (EWS)", "nameEn": "EWS" },
    { "code": "Other", "nameMr": "इतर (Other)", "nameEn": "Other" }
  ],
  "occupations": [
    { "code": "Agriculture", "nameMr": "शेती (Agriculture)", "nameEn": "Agriculture" },
    { "code": "Business", "nameMr": "व्यवसाय / व्यापारी (Business)", "nameEn": "Business" },
    { "code": "Private Service", "nameMr": "खाजगी नोकरी (Private Service)", "nameEn": "Private Service" },
    { "code": "Govt Service", "nameMr": "सरकारी नोकरी (Govt Service)", "nameEn": "Govt Service" },
    { "code": "Labor", "nameMr": "मजुरी (Labor / Daily Wage)", nameEn": "Labor" },
    { "code": "Housewife", "nameMr": "गृहिणी (Housewife)", nameEn": "Housewife" },
    { "code": "Other", "nameMr": "इतर (Other)", nameEn": "Other" }
  ],
  "nomineeRelations": [
    { "code": "Wife", "nameMr": "पत्नी (Wife)", "nameEn": "Wife" },
    { "code": "Husband", "nameMr": "पती (Husband)", nameEn": "Husband" },
    { "code": "Son", "nameMr": "मुलगा (Son)", nameEn": "Son" },
    { "code": "Daughter", "nameMr": "मुलगी (Daughter)", nameEn": "Daughter" },
    { "code": "Mother", "nameMr": "आई (Mother)", nameEn": "Mother" },
    { "code": "Father", "nameMr": "वडील (Father)", nameEn": "Father" },
    { "code": "Brother", "nameMr": "भाऊ (Brother)", nameEn": "Brother" },
    { "code": "Sister", "nameMr": "बहीण (Sister)", nameEn": "Sister" },
    { "code": "Other", "nameMr": "इतर (Other)", nameEn": "Other" }
  ],
  "pigmySchemes": [
    {
      "pigmySchemeID": 1,
      "schemeCode": "PGS001",
      "schemeName": "दैनंदिन पिग्मी बचत योजना (Daily Pigmy 4%)",
      "interestRate": 4.00,
      "durationMonths": 12
    }
  ],
  "branches": [
    {
      "branchID": 1,
      "branchCode": "BR001",
      "branchName": "मुख्य शाखा (Main Branch)"
    }
  ]
}
```

