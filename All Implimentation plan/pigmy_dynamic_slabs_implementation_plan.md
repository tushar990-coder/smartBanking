# 📋 Pigmy Scheme Dynamic Interest & Penalty Slabs Implementation Plan
**FD-Style Configurable Slabs for Pigmy Schemes (पिग्मी डायनॅमिक स्लॅब अंमलबजावणी आराखडा)**

---

## 🎯 1. Architectural Summary & Goal

To provide the exact same enterprise flexibility found in the **Fixed Deposit (FD) module**, this plan introduces **Dynamic Multi-Tenure Slabs** for **Pigmy Schemes (`PigmySchemeInterestSlabs`)**.

Instead of static, hardcoded penalty and interest rates, bank administrators can dynamically configure:
- **Tenure Duration Range (कालावधी):** `FromMonths` to `ToMonths`
- **Interest Rate (व्याजदर %):** Paid to the customer on partial return or maturity
- **Penalty Rate (दंड दर %):** Deducted from principal if funds are withdrawn prematurely
- **Dynamic Rows:** Ability to add, modify, or delete slabs (`[+ नवीन स्लॅब जोडा]`) for any duration (6M, 12M, 24M, 36M, etc.)

### Standard Default 4 Slabs (Pre-filled):
1. **0 to 3 Months:** Interest `0.00%`, Penalty `2.00%` (२% दंड कपात)
2. **3 to 6 Months:** Interest `0.00%`, Penalty `1.00%` किंवा `0.00%` (१% दंड किंवा मुद्दल जशीच्या तशी)
3. **6 to 11 Months:** Interest `5.50%`, Penalty `0.00%` (५.५% अकाली व्याजदर)
4. **11 to 12 Months:** Interest `6.50%`, Penalty `0.00%` (६.५% पूर्ण नियमित व्याजदर)

---

## 🏗️ 2. Detailed Technical Implementation Steps

### Step 1: Database Migration Script
**File to create:** `patches/patch_add_pigmy_scheme_slabs.sql`
- Create table `[dbo].[PigmySchemeInterestSlabs]` with:
  - `SlabID` (INT, Identity, PK)
  - `PigmySchemeID` (INT, FK to `PigmySchemes` with `ON DELETE CASCADE`)
  - `FromMonths` (INT, Not Null)
  - `ToMonths` (INT, Not Null)
  - `InterestRate` (DECIMAL(5,2), Default `0.00`)
  - `PenaltyRate` (DECIMAL(5,2), Default `0.00`)
  - `SlabDescription` (NVARCHAR(100), Nullable)
  - `IsActive` (BIT, Default `1`)
  - `CreatedAt` (DATETIME, Default `GETUTCDATE()`)
- Create Non-Clustered Index: `IX_PigmySchemeInterestSlabs_Scheme (PigmySchemeID, FromMonths, ToMonths)`
- Seed the 4 standard default slabs for existing active Pigmy Schemes in the database so existing data remains 100% intact.

---

### Step 2: C# Entity Model Creation
**File to create:** `api/Bhisi.Api/Models/PigmySchemeInterestSlab.cs`
- Define entity `PigmySchemeInterestSlab` with data annotations and foreign key relationship to `PigmyScheme`.

**File to modify:** [PigmyScheme.cs](file:///d:/Development/Webapps/SmartBanking/smartBanking/api/Bhisi.Api/Models/PigmyScheme.cs)
- Add navigation property:
  ```csharp
  public virtual ICollection<PigmySchemeInterestSlab> Slabs { get; set; } = new List<PigmySchemeInterestSlab>();
  ```

**File to modify:** [AppDbContext.cs](file:///d:/Development/Webapps/SmartBanking/smartBanking/api/Bhisi.Api/Data/AppDbContext.cs)
- Add `DbSet`:
  ```csharp
  public DbSet<PigmySchemeInterestSlab> PigmySchemeInterestSlabs { get; set; }
  ```
- Configure Fluent API relationship in `OnModelCreating` with cascade delete.

---

### Step 3: Backend API Controller Enhancements
**File to modify:** [PigmySchemesController.cs](file:///d:/Development/Webapps/SmartBanking/smartBanking/api/Bhisi.Api/Controllers/PigmySchemesController.cs)
1. **GET `/api/PigmySchemes` & `GET /api/PigmySchemes/{id}`:**
   - Eager-load slabs using `.Include(s => s.Slabs.OrderBy(sl => sl.FromMonths))`
2. **POST `/api/PigmySchemes`:**
   - Accept `slabs` array in the request DTO.
   - If slabs are provided, persist each slab along with the scheme.
   - If slabs are not provided, auto-generate the 4 standard default slabs based on scheme duration and rates.
3. **PUT `/api/PigmySchemes/{id}`:**
   - Synchronize slabs: remove deleted slabs, update modified slabs, and insert new slabs.
4. **GET `/api/PigmySchemes/{id}/slabs`:**
   - Dedicated endpoint to fetch active slabs for calculation engines.

---

### Step 4: Frontend UI Dynamic Slabs Grid
**File to modify:** [PigmySchemeMaster.tsx](file:///d:/Development/Webapps/SmartBanking/smartBanking/client/src/components/PigmySchemeMaster.tsx)
1. **TypeScript Interface:**
   - Add `PigmySchemeInterestSlab` interface matching the backend model.
2. **Form State:**
   - Add `slabs` state array in `formData`.
   - On clicking "नवीन योजना" (Reset Form), auto-populate the 4 standard default slabs:
     - 0 to 3M: Interest 0%, Penalty 2.0%
     - 3 to 6M: Interest 0%, Penalty 1.0% (editable)
     - 6 to 11M: Interest 5.5%, Penalty 0%
     - 11 to 12M: Interest 6.5%, Penalty 0%
3. **Interactive Slabs Table Component:**
   - Add a styled UI card: **"📊 पिग्मी परतावा व व्याज स्लॅब रचना (Return & Penalty Slabs)"**.
   - Input controls for `FromMonths`, `ToMonths`, `InterestRate`, `PenaltyRate`, and `SlabDescription`.
   - `[+ नवीन स्लॅब जोडा]` button to append a new row dynamically.
   - Delete row icon button (`🗑️`) with minimum 1 row validation.
4. **Validation Rules:**
   - Ensure `ToMonths > FromMonths`.
   - Ensure continuity (no overlapping or negative month gaps).
   - Rate validation: `0% <= rate <= 100%`.
5. **Scheme List & Excel Export:**
   - Display a preview badge/modal of active slabs in the schemes table.
   - Include slab breakdown in Excel Export.

---

### Step 5: Calculation Engine Integration (Zero-Hardcoding)
**File to modify:** [PigmyClosureController.cs](file:///d:/Development/Webapps/SmartBanking/smartBanking/api/Bhisi.Api/Controllers/PigmyClosureController.cs) & Partial Return API
- Remove any hardcoded slab thresholds (`< 90 days = 2%`, etc.).
- Dynamically match the customer's elapsed months against `PigmySchemeInterestSlabs`:
  ```csharp
  var slab = await _context.PigmySchemeInterestSlabs
      .FirstOrDefaultAsync(s => s.PigmySchemeID == account.PigmySchemeID 
                             && elapsedMonths >= s.FromMonths 
                             && elapsedMonths < s.ToMonths 
                             && s.IsActive);
  ```
- If `slab.PenaltyRate > 0`: Net Payout = `Asked - (Asked * PenaltyRate / 100)`
- If `slab.InterestRate > 0`: Net Payout = `Asked + (Asked * InterestRate * Months / 1200)`
- Generate corresponding GL Vouchers (`Cr. Penalty Income GL` or `Dr. Interest Expense GL`).

---

## 🧪 3. Verification & Testing Checklist

1. **SQL Execution:** Execute `patch_add_pigmy_scheme_slabs.sql` on remote SQL Server and verify table creation.
2. **Backend API Verification:**
   - Create a scheme via POST with 4 slabs -> verify database rows.
   - Edit slabs via PUT -> verify persistence.
3. **Frontend UI Verification:**
   - Open `http://localhost:5173/` in browser.
   - Navigate to **पिग्मी योजना मास्टर (Pigmy Scheme Master)**.
   - Verify dynamic slab grid rendering, pre-filled default rows, adding a row, editing penalty in 3-6 months (e.g. 1.0%), and saving successfully.

---

## 🛡️ Safety & Non-Disruption Guarantee
- Existing schemes will automatically receive default slabs; no existing customer accounts will be broken.
- No other banking modules (Savings, Loans, Shares) are affected.
