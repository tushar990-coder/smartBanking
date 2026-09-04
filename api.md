# Smart Banking Core - Pigmy Android App API Specification (`Api.md`)

This document is the **official reference guide for Android Application Developers** integrating with the Smart Banking Pigmy Mobile REST API. It includes complete request headers, cURL testing commands, request body schemas, and HTTP response previews for all endpoints.

---

## 🔑 Base URL & Authentication Headers

- **Base URL**: `http://<server-ip>:<port>/api/PigmyApp` (e.g. `http://192.168.1.100:5000/api/PigmyApp`)
- **Common HTTP Headers**:

```http
Content-Type: application/json
X-Agent-Id: 5
```

> **Note for Android Developers (Retrofit / Volley)**:
> Always pass `@Header("X-Agent-Id") int agentId` in your Retrofit interface calls.

---

## 📑 Complete API Quick Reference

| # | Feature Name | HTTP Method | Endpoint URI | Headers Required |
|---|---|---|---|---|
| 1 | Agent Mobile Login | `POST` | `/api/PigmyApp/Login` | `Content-Type: application/json` |
| 2 | Dashboard Summary | `GET` | `/api/PigmyApp/Dashboard` | `X-Agent-Id: <id>` |
| 3 | Assigned Customers List | `GET` | `/api/PigmyApp/Accounts` | `X-Agent-Id: <id>` |
| 4 | Create Customer & Account | `POST` | `/api/PigmyApp/CreateCustomer` | `Content-Type: application/json`, `X-Agent-Id: <id>` |
| 5 | Check Collection & Lock Status | `GET` | `/api/PigmyApp/CollectionStatus` | `X-Agent-Id: <id>` |
| 6 | Sync Bulk Collection Entries | `POST` | `/api/PigmyApp/BulkCollection` | `Content-Type: application/json`, `X-Agent-Id: <id>` |
| 7 | Customer Passbook Statement | `GET` | `/api/PigmyApp/Passbook` | `X-Agent-Id: <id>` |
| 8 | Collection Report | `GET` | `/api/PigmyApp/CollectionReport` | `X-Agent-Id: <id>` |
| 9 | Commission Earnings Report | `GET` | `/api/PigmyApp/CommissionReport` | `X-Agent-Id: <id>` |

---

## 🛠️ Detailed Endpoint Documentation & Previews

---

### 1. Agent Mobile Login

Authenticates the agent using their mobile number and returns their Agent ID and access token.

#### 📌 Request Headers & Body:
```http
POST /api/PigmyApp/Login HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "mobileNo": "9876543210"
}
```

#### 💻 cURL Testing Command:
```bash
curl -X POST "http://localhost:5000/api/PigmyApp/Login" \
  -H "Content-Type: application/json" \
  -d '{"mobileNo": "9876543210"}'
```

#### 📥 Response Preview (HTTP 200 OK):
```json
{
  "agentId": 5,
  "agentName": "Ramrao Patil",
  "mobileNo": "9876543210",
  "token": "temp-token-agent-5"
}
```

#### ⚠️ Error Response (HTTP 401 Unauthorized):
```json
"Invalid Mobile Number or Inactive Agent."
```

---

### 2. Mobile App Dashboard Summary

Fetches today's collection total, receipt count, opening cash holding, and closing cash holding for the agent.

#### 📌 Request Headers:
```http
GET /api/PigmyApp/Dashboard HTTP/1.1
Host: localhost:5000
X-Agent-Id: 5
```

#### 💻 cURL Testing Command:
```bash
curl -X GET "http://localhost:5000/api/PigmyApp/Dashboard" \
  -H "X-Agent-Id: 5"
```

#### 📥 Response Preview (HTTP 200 OK):
```json
{
  "date": "2026-08-09",
  "openingBalance": 12500.00,
  "todaysCollection": 3500.00,
  "totalReceipts": 14,
  "closingBalance": 16000.00
}
```

---

### 3. Customer List (Assigned Accounts)

Fetches list of active Pigmy customers assigned exclusively to the logged-in agent.

#### 📌 Request Headers:
```http
GET /api/PigmyApp/Accounts HTTP/1.1
Host: localhost:5000
X-Agent-Id: 5
```

#### 💻 cURL Testing Command:
```bash
curl -X GET "http://localhost:5000/api/PigmyApp/Accounts" \
  -H "X-Agent-Id: 5"
```

#### 📥 Response Preview (HTTP 200 OK):
```json
[
  {
    "pigmyAccountID": 102,
    "accountNo": "PGM-1-20260401-0102",
    "memberName": "Suresh Deshmukh",
    "mobileNo": "9422012345",
    "currentBalance": 4500.00
  },
  {
    "pigmyAccountID": 103,
    "accountNo": "PGM-1-20260401-0103",
    "memberName": "Anil Kulkarni",
    "mobileNo": "9822334455",
    "currentBalance": 8200.00
  }
]
```

---

### 4. Create Customer & Open Pigmy Account

Creates a new member profile and auto-opens an active Pigmy Account assigned to the logged-in agent.

#### 📌 Request Headers & Body:
```http
POST /api/PigmyApp/CreateCustomer HTTP/1.1
Host: localhost:5000
Content-Type: application/json
X-Agent-Id: 5
```

```json
{
  "firstName": "Vikas",
  "middleName": "Sharad",
  "lastName": "Shinde",
  "mobileNo": "9922884411",
  "aadhaarNo": "123456789012",
  "address": "At Post Karad, Dist Satara",
  "gender": "Male",
  "branchID": 1
}
```

#### 💻 cURL Testing Command:
```bash
curl -X POST "http://localhost:5000/api/PigmyApp/CreateCustomer" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: 5" \
  -d '{
    "firstName": "Vikas",
    "middleName": "Sharad",
    "lastName": "Shinde",
    "mobileNo": "9922884411",
    "aadhaarNo": "123456789012",
    "address": "At Post Karad, Dist Satara",
    "gender": "Male",
    "branchID": 1
  }'
```

#### 📥 Response Preview (HTTP 200 OK):
```json
{
  "success": true,
  "message": "नवीन पिग्मी ग्राहक व खाते यशस्वीरीत्या उघडले गेले!",
  "memberId": 54,
  "pigmyAccountId": 128,
  "accountNo": "PGM-1-20260809-0054",
  "memberName": "Vikas Shinde",
  "mobileNo": "9922884411",
  "status": "Active"
}
```

---

### 5. Check 2-Day Remittance & Collection Lock Status

Checks if the agent has un-submitted cash collections for the previous 2 days. 
- If cash is pending: returns `collect_Pigmi = 0`, `is_pending = 1`, and `status = "LOCKED"`.
- If clean: returns `collect_Pigmi = 1`, `is_pending = 0`, and `status = "ALLOWED"`.

#### 📌 Request Headers:
```http
GET /api/PigmyApp/CollectionStatus HTTP/1.1
Host: localhost:5000
X-Agent-Id: 5
```

#### 💻 cURL Testing Command:
```bash
curl -X GET "http://localhost:5000/api/PigmyApp/CollectionStatus" \
  -H "X-Agent-Id: 5"
```

#### 📥 Response Preview 1: ALLOWED Status (HTTP 200 OK)
```json
{
  "agentId": 5,
  "collect_Pigmi": 1,
  "is_pending": 0,
  "status": "ALLOWED",
  "message": "कमिशन व पिग्मी कलेक्शनसाठी एजंट अधिकृत आहे.",
  "previousDaysCollectionDetails": [
    {
      "date": "2026-08-07",
      "totalCollected": 2000.00,
      "totalRemitted": 2000.00,
      "pendingCash": 0.00,
      "isSubmitted": true
    },
    {
      "date": "2026-08-08",
      "totalCollected": 1500.00,
      "totalRemitted": 1500.00,
      "pendingCash": 0.00,
      "isSubmitted": true
    }
  ]
}
```

#### 📥 Response Preview 2: LOCKED Status (HTTP 200 OK)
```json
{
  "agentId": 5,
  "collect_Pigmi": 0,
  "is_pending": 1,
  "status": "LOCKED",
  "message": "मागील २ दिवसांचे पिग्मी कलेक्शन शाखेत जमा केलेले नाही. कृपया आधी शाखेत कॅश जमा करा.",
  "previousDaysCollectionDetails": [
    {
      "date": "2026-08-07",
      "totalCollected": 3000.00,
      "totalRemitted": 0.00,
      "pendingCash": 3000.00,
      "isSubmitted": false
    }
  ]
}
```

---

### 6. Sync Bulk Collection Entries (Online / Offline Sync)

Submits customer daily collections in bulk. If `collect_Pigmi` is `0`, server rejects collection with HTTP 403 Forbidden.

#### 📌 Request Headers & Body:
```http
POST /api/PigmyApp/BulkCollection HTTP/1.1
Host: localhost:5000
Content-Type: application/json
X-Agent-Id: 5
```

```json
{
  "items": [
    {
      "pigmyAccountId": 102,
      "collectionAmount": 200.00,
      "collectionDate": "2026-08-09",
      "receiptNo": "REC-OFF-102-001"
    },
    {
      "pigmyAccountId": 103,
      "collectionAmount": 500.00,
      "collectionDate": "2026-08-09",
      "receiptNo": "REC-OFF-103-002"
    }
  ]
}
```

#### 💻 cURL Testing Command:
```bash
curl -X POST "http://localhost:5000/api/PigmyApp/BulkCollection" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: 5" \
  -d '{
    "items": [
      {
        "pigmyAccountId": 102,
        "collectionAmount": 200.00,
        "collectionDate": "2026-08-09",
        "receiptNo": "REC-OFF-102-001"
      },
      {
        "pigmyAccountId": 103,
        "collectionAmount": 500.00,
        "collectionDate": "2026-08-09",
        "receiptNo": "REC-OFF-103-002"
      }
    ]
  }'
```

#### 📥 Response Preview (HTTP 200 OK):
```json
{
  "success": true,
  "collect_Pigmi": 1,
  "message": "एकूण 2 खात्यांमध्ये ₹700.00 ची नोंद यशस्वीरीत्या सेव्ह झाली!",
  "savedCount": 2,
  "totalAmount": 700.00,
  "receipts": [
    {
      "pigmyAccountId": 102,
      "accountNo": "PGM-1-20260401-0102",
      "receiptNo": "REC-OFF-102-001",
      "amount": 200.00,
      "newBalance": 4700.00
    },
    {
      "pigmyAccountId": 103,
      "accountNo": "PGM-1-20260401-0103",
      "receiptNo": "REC-OFF-103-002",
      "amount": 500.00,
      "newBalance": 8700.00
    }
  ]
}
```

#### ⚠️ Error Response when Locked (HTTP 403 Forbidden):
```json
{
  "collect_Pigmi": 0,
  "is_pending": 1,
  "message": "मागील २ दिवसांची रोख रक्कम शाखेत जमा नसल्यामुळे जमा स्वीकारणे बंद केले आहे. कृपया शाखेत कॅश जमा करा."
}
```

---

### 7. Customer Pigmy Passbook Statement

Retrieves a customer's collection ledger passbook for a given date range with running balance.

#### 📌 Request Headers & Query Parameters:
```http
GET /api/PigmyApp/Passbook?pigmyAccountId=102&fromDate=2026-04-01&toDate=2026-08-09 HTTP/1.1
Host: localhost:5000
X-Agent-Id: 5
```

| Query Parameter | Type | Required | Description | Example |
|---|---|---|---|---|
| `pigmyAccountId` | `Integer` | Yes | Target customer Pigmy Account ID | `102` |
| `fromDate` | `String` | No | Start date (YYYY-MM-DD) | `2026-04-01` |
| `toDate` | `String` | No | End date (YYYY-MM-DD) | `2026-08-09` |

#### 💻 cURL Testing Command:
```bash
curl -X GET "http://localhost:5000/api/PigmyApp/Passbook?pigmyAccountId=102&fromDate=2026-04-01&toDate=2026-08-09" \
  -H "X-Agent-Id: 5"
```

#### 📥 Response Preview (HTTP 200 OK):
```json
{
  "pigmyAccountId": 102,
  "accountNo": "PGM-1-20260401-0102",
  "memberName": "Suresh Deshmukh",
  "agentName": "Ramrao Patil",
  "openingDate": "2026-04-01",
  "fromDate": "2026-04-01",
  "toDate": "2026-08-09",
  "openingBalance": 0.00,
  "totalCredit": 4700.00,
  "closingBalance": 4700.00,
  "currentTotalBalance": 4700.00,
  "transactions": [
    {
      "collectionId": 45,
      "date": "2026-04-01",
      "receiptNo": "REC-MANUAL-001",
      "creditAmount": 500.00,
      "runningBalance": 500.00,
      "source": "MANUAL"
    },
    {
      "collectionId": 98,
      "date": "2026-08-09",
      "receiptNo": "REC-OFF-102-001",
      "creditAmount": 200.00,
      "runningBalance": 4700.00,
      "source": "APP"
    }
  ]
}
```

---

### 8. Collection Report (Date Range & Agent)

Retrieves total collections, receipt counts, and daily list for an agent across a date range.

#### 📌 Request Headers & Query Parameters:
```http
GET /api/PigmyApp/CollectionReport?fromDate=2026-08-01&toDate=2026-08-09 HTTP/1.1
Host: localhost:5000
X-Agent-Id: 5
```

#### 💻 cURL Testing Command:
```bash
curl -X GET "http://localhost:5000/api/PigmyApp/CollectionReport?fromDate=2026-08-01&toDate=2026-08-09" \
  -H "X-Agent-Id: 5"
```

#### 📥 Response Preview (HTTP 200 OK):
```json
{
  "agentId": 5,
  "fromDate": "2026-08-01",
  "toDate": "2026-08-09",
  "totalCollectedAmount": 14500.00,
  "totalReceiptsCount": 38,
  "uniqueAccountsCount": 18,
  "collections": [
    {
      "collectionId": 98,
      "receiptNo": "REC-OFF-102-001",
      "date": "2026-08-09",
      "pigmyAccountId": 102,
      "accountNo": "PGM-1-20260401-0102",
      "memberName": "Suresh Deshmukh",
      "amount": 200.00,
      "source": "APP"
    }
  ]
}
```

---

### 9. Agent Commission Earnings Report

Retrieves total collected amount, applicable commission rate, calculated commission, and voucher payout status.

#### 📌 Request Headers & Query Parameters:
```http
GET /api/PigmyApp/CommissionReport?fromDate=2026-08-01&toDate=2026-08-09 HTTP/1.1
Host: localhost:5000
X-Agent-Id: 5
```

#### 💻 cURL Testing Command:
```bash
curl -X GET "http://localhost:5000/api/PigmyApp/CommissionReport?fromDate=2026-08-01&toDate=2026-08-09" \
  -H "X-Agent-Id: 5"
```

#### 📥 Response Preview (HTTP 200 OK):
```json
{
  "agentId": 5,
  "fromDate": "2026-08-01",
  "toDate": "2026-08-09",
  "totalCollectedAmount": 14500.00,
  "commissionRate": 2.50,
  "rateType": "PERCENTAGE",
  "calculatedCommission": 362.50,
  "paidCommission": 0.00,
  "pendingCommission": 362.50,
  "paidVouchersCount": 0
}
```