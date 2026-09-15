# Pigmy Agent Android Application — Senior Architecture & Implementation Plan

This architecture plan is designed for developing the **Native Android (Kotlin / Jetpack Compose / MVVM)** or **Flutter** Pigmy Agent Mobile Application on your development machine, perfectly integrating with the existing SmartBanking .NET 10 CBS Backend.

---

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions for Android Application:**
> 1. **Tech Stack Recommendation:** **Kotlin + Jetpack Compose + MVVM + Room Database + Retrofit2 + WorkManager** (Standard for Indian Banking/POS apps). If your team specializes in Flutter, the same offline-first data model applies.
> 2. **Offline-First Security & Idempotency:** The app must generate unique UUIDs (`transactionId = $"MOB-{agentId}-{timestamp}-{UUID}"`) on the device for every collection. This prevents double-deductions during network drops and sync retries.
> 3. **Hardware Integration:** Standard 58mm (2-inch) or 80mm (3-inch) Bluetooth Thermal POS Printers (Epson ESC/POS protocol) for instant customer paper receipts.
> 4. **Multi-Sanstha Domain Routing:** An initial "Server Setup" screen allowing the app to connect to any branch/society URL (e.g., `https://api.testing.hellomindspace.in` or local IP).

---

## 1. System Architecture & Tech Stack

```
+-----------------------------------------------------------------------------------+
|                            Android Agent Mobile App                               |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                     UI Layer (Jetpack Compose / Material 3)                 |  |
|  |   - Server Setup Screen      - Agent Login & PIN Screen   - Agent Dashboard |  |
|  |   - Quick Deposit Screen     - Bluetooth Printer Manager  - Offline Sync    |  |
|  |   - Customer Onboard Form    - Passbook / Mini-Statement  - Day Summary     |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |                                          |
|  +-----------------------------------------------------------------------------+  |
|  |               ViewModel & State Management (Kotlin StateFlow)               |  |
|  |   - AgentAuthViewModel       - CollectionViewModel        - SyncViewModel   |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                  Repository Layer (Single Source of Truth)                  |  |
|  +-------------------------------------+---------------------------------------+  |
|                     |                                       |                     |
|  +-------------------------------------+   +-----------------------------------+  |
|  |      Local Storage (Offline-First)  |   |     Remote Network (Retrofit2)    |  |
|  |   - Room DB (Accounts, Customers)   |   |   - Auth & Session Token Intercept|  |
|  |   - Offline Collections Queue Table |   |   - Real-time & Bulk-Sync APIs    |  |
|  |   - EncryptedSharedPreferences (PIN)|   |   - KYC Multipart Upload          |  |
|  +-------------------------------------+   +-----------------------------------+  |
|                     |                                       |                     |
|  +-----------------------------------------------------------------------------+  |
|  |             Background Sync Worker (Android WorkManager)                    |  |
|  |   - Periodic Network Check -> Push Offline Transactions -> Pull Balances    |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|               SmartBanking CBS Backend API (Already Live on Port 5242)             |
|   - POST /api/Auth/login                - GET /api/accounts                       |
|   - POST /api/collections               - POST /api/collections/bulk-sync         |
|   - GET /api/agent/lock-status          - GET /api/dashboard/summary              |
|   - POST /api/AgentCustomerRequests     - GET /api/AgentCustomerRequests/dropdowns|
|   - POST /api/Members/upload            - GET /api/reports/passbook/{accountId}   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Core Modules & Screen Breakdown

### Module 1: Server Configuration & Authentication
1. **Server Setup Screen:**
   - Input Server Base URL (supports HTTPS domain or IP with port).
   - Test Connection ping (`GET /api/PigmySchemes`).
2. **Agent Login Screen:**
   - Inputs: Username & Password.
   - Branch selection (dropdown populated from server).
   - Calls `POST /api/Auth/login`.
   - On success, saves JWT token in `EncryptedSharedPreferences`.
3. **App Lock & Biometric PIN:**
   - 4-digit quick unlock PIN setup.
   - Fingerprint / Biometric authentication support via Android `BiometricPrompt`.

---

### Module 2: Agent Dashboard & Lock Guard
1. **Live KPI Metric Cards:**
   - Today's Collection: ₹ Amount & Count.
   - Cash in Hand (रोख शिल्लक) vs Max Cash Limit badge.
   - Unsynced Offline Records badge (`X pending`).
2. **Lockout Enforcement (Agent Lock Service):**
   - Evaluates `GET /api/agent/lock-status`.
   - If `isLocked == true` (Pending cash > Max limit or unremitted collections > Max Lock Days):
     - Displays prominent red alert: *"कॅश मर्यादा ओलांडली आहे. कृपया शाखेत रोख भरणा करा."*
     - Disables collection button until remittance is posted.
3. **Quick Action Grid:**
   - 💵 **हप्ता संकलन (New Deposit)**
   - 🔍 **खातेदार शोध (Search Account)**
   - 📝 **नवीन ग्राहक नोंदणी (Customer Onboarding)**
   - 📜 **दैनिक पासबुक / रिपोर्ट (Passbook / Daybook)**
   - 🔄 **सिंक करा (Sync Now)**
   - 🖨️ **प्रिंटर कनेक्ट (Printer Settings)**

---

### Module 3: Daily Pigmy Collection (Online + Offline)
1. **Account Search & Select:**
   - Instant search by Account No (`HO1-PG-00001`), Customer Name, Mobile Number.
   - Barcode / QR Code Scanner (camera integration) to scan customer passbook QR.
2. **Deposit Entry Form:**
   - Account summary: Customer Name, Current Balance (चालू शिल्लक), Daily target.
   - Quick Amount Pills: `+₹100`, `+₹200`, `+₹500`, `+₹1,000`.
   - Custom Amount input with minimum validation.
   - Mode: `CASH` (default) or `UPI`.
3. **Receipt & Printing:**
   - Generates client UUID `transactionId = "TXN_MOB_" + System.currentTimeMillis()`.
   - If Online: calls `POST /api/collections`.
   - If Offline: saves to Room DB `OfflineCollectionEntity` with `isSynced = false`, updates local account balance immediately.
   - Auto-triggers ESC/POS Bluetooth Thermal Print.
   - Voice confirmation chime: (उदा. *"पावती क्रमांक... मध्ये ₹... जमा झाले"*).

---

### Module 4: Offline-First Room Database Architecture
```kotlin
@Entity(tableName = "pigmy_accounts")
data class PigmyAccountEntity(
    @PrimaryKey val accountId: Int,
    val accountNo: String,
    val customerName: String,
    val mobileNo: String?,
    val address: String?,
    val currentBalance: Double,
    val interestRate: Double,
    val openingDate: String,
    val maturityDate: String,
    val status: String
)

@Entity(tableName = "offline_collections")
data class OfflineCollectionEntity(
    @PrimaryKey val transactionId: String, // UUID
    val accountId: Int,
    val accountNo: String,
    val customerName: String,
    val amount: Double,
    val paymentMode: String, // CASH / UPI
    val timestamp: String,
    val isSynced: Boolean = false,
    val serverReceiptNo: String? = null,
    val syncErrorMessage: String? = null
)
```

---

### Module 5: Automated Sync Engine (WorkManager)
1. **Background Sync Worker (`PigmySyncWorker`):**
   - Scheduled with `Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()`.
   - Gathers all unsynced records (`SELECT * FROM offline_collections WHERE isSynced = 0`).
   - Dispatches payload to `POST /api/collections/bulk-sync`.
   - Updates local rows with `serverReceiptNo` and marks `isSynced = true`.
   - Refreshes updated account balances via `GET /api/accounts`.
2. **Conflict Resolution:**
   - Server enforces idempotency via `transactionId`. Re-sending an already processed transaction returns HTTP 200 with the existing receipt number without duplicate ledger posting.

---

### Module 6: Bluetooth Thermal Printer Integration (ESC/POS)
1. **Bluetooth Discovery & Pairing:**
   - Scans paired Bluetooth devices (`BluetoothAdapter.getBondedDevices()`).
   - Connects via RFCOMM socket (`UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")`).
2. **Bilingual Thermal Receipt Layout (58mm Paper):**
```text
================================
   श्री बांबवडे नागरी सहकारी पतसंस्था
     शाखा: मुख्य शाखा (बांबवडे)
================================
पावती क्र   : REC-20260915-0042
दिनांक      : 15/09/2026 13:30:15
एजंट नाव    : राजेश कांबळे (AGT-001)
--------------------------------
खाते क्र     : HO1-PG-00001
खातेदार नाव : ओंकार गडसिंग
मोबाईल      : 98********
--------------------------------
जमा रक्कम   : ₹ 200.00
अक्षरी      : दोनशे रुपये फक्त
चालू शिल्लक : ₹ 1,400.00
पेमेंट पद्धत: रोख (CASH)
--------------------------------
  ।। ठेव सुरक्षित, भविष्य उज्वल ।।
  संगणकीकृत पावती - स्वाक्षरीची
         गरज नाही.
================================
```

---

### Module 7: Field Customer Onboarding (Stage-1 KYC)
1. **Customer Registration Form:**
   - Personal information (First, Middle, Last names).
   - Auto-transliteration from Marathi to English.
   - Contact details (Mobile, Address, Taluka, District).
   - Nominee details (Name, Age, Relation).
   - Pigmy Scheme & Daily target amount.
2. **Camera & KYC Document Capture:**
   - Live photo of customer (front camera / back camera).
   - Photo of Aadhaar Card and PAN Card.
   - In-app Finger Signature canvas.
   - Multipart upload to `POST /api/Members/upload`.
3. **Submission:**
   - Posts data to `POST /api/AgentCustomerRequests`.
   - Enters branch queue for clerk/manager approval.

---

## 3. Recommended Android Project Structure (Kotlin)

```
app/src/main/java/com/smartbanking/pigmy/
├── data/
│   ├── api/
│   │   ├── AuthInterceptor.kt
│   │   ├── PigmyApiService.kt
│   │   └── NetworkResult.kt
│   ├── local/
│   │   ├── AppDatabase.kt
│   │   ├── dao/
│   │   │   ├── AccountDao.kt
│   │   │   └── CollectionDao.kt
│   │   └── entity/
│   │       ├── PigmyAccountEntity.kt
│   │       └── OfflineCollectionEntity.kt
│   └── repository/
│       ├── AuthRepository.kt
│       ├── CollectionRepository.kt
│       └── SyncRepository.kt
├── di/
│   └── AppModule.kt (Hilt or Koin)
├── printer/
│   ├── BluetoothPrinterManager.kt
│   ├── EscPosHelper.kt
│   └── ReceiptBuilder.kt
├── ui/
│   ├── auth/
│   │   ├── LoginScreen.kt
│   │   └── PinLockScreen.kt
│   ├── dashboard/
│   │   ├── DashboardScreen.kt
│   │   └── DashboardViewModel.kt
│   ├── collection/
│   │   ├── QuickDepositScreen.kt
│   │   ├── AccountSearchDialog.kt
│   │   └── ReceiptPreviewDialog.kt
│   ├── onboarding/
│   │   ├── CustomerOnboardScreen.kt
│   │   └── SignaturePadView.kt
│   ├── sync/
│   │   └── SyncStatusScreen.kt
│   └── theme/
│       ├── Color.kt
│       └── Theme.kt
├── util/
│   ├── CurrencyFormatter.kt
│   ├── DateUtil.kt
│   └── SoundHelper.kt
└── worker/
    └── PigmySyncWorker.kt
```

---

## 4. Verification & Testing Plan

### Automated & Unit Tests:
- Room DB migration & query unit tests (CRUD for accounts and collections).
- Idempotency test: Re-submitting the same `transactionId` must not fail.
- ESC/POS byte-array generation tests.

### Device Testing (Physical Android Device):
1. **Network Disconnection Test:** Make 5 collections in Airplane Mode; verify they persist locally and print receipts.
2. **Auto-Reconnection Sync Test:** Turn on Wi-Fi/4G; verify WorkManager triggers and syncs records with server within 10 seconds.
3. **Bluetooth Printer Test:** Verify pairing, text alignment, Marathi font rendering (via bitmap printing or ESC/POS Unicode), and paper cut.
4. **Lock Limit Test:** Simulate collection exceeding ₹20,000 pending cash; verify UI restricts further collections.
