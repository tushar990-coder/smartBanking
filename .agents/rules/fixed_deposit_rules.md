# Fixed Deposit Module Invariant Rules

Whenever working on, modifying, debugging, or reviewing any part of the Fixed Deposit (FD) module (including frontend components `FdAccountOpening.tsx`, `FdOpeningBalanceMigration.tsx`, `FdWithdrawalMaturity.tsx`, `FdAccrualPosting.tsx`, `FdReports.tsx`, `FdReceiptPrintModal.tsx` and backend controllers/models `FdAccountsController.cs`, `FdAccount.cs`, `FdScheme.cs`, `FdTransaction.cs`, `FdInterestAccrual.cs`):

You MUST strictly comply with all rules defined in [FIXED_DEPOSIT_MODULE_SPECIFICATION_AND_RULES.md](file:///d:/Bhisi%20Software/FIXED_DEPOSIT_MODULE_SPECIFICATION_AND_RULES.md). Under NO circumstances are you allowed to violate these rules.

### Key Non-Negotiable Invariants:
1. **[RULE-FD-001] CIF / Customer-First Architecture**:
   - `FdAccounts` primary customer key is strictly `CustomerID`. `MemberID` does NOT exist in the database table and must NEVER be assumed as the primary foreign key.
   - Frontend forms MUST always resolve and send `customerID` (never `0`, null, or omitted).
   - `MemberID` is strictly an optional sub-ledger reference in accounting vouchers (`VoucherDetails`) if and only if the customer happens to have a linked member profile.
2. **[RULE-FD-002] Double-Entry Parity**:
   - Every financial voucher generated MUST have exact matching debits and credits (`Total Dr == Total Cr`).
   - Matured close: `Dr FD Liability` + `Dr Interest Payable` = `Cr Cash/Bank/SB Payout`.
   - Premature close: `Dr FD Liability` + `Dr Interest Payable` = `Cr Net Payout` + `Cr Premature Penalty Clawback Income`.
   - Renewal: `Dr Old FD Liability` + `Dr Interest Payable` = `Cr New FD Liability` + `Cr Cash/Bank/SB (if PrincipalOnly)`.
3. **[RULE-FD-003] SB Transfer Verification**:
   - When payment mode is `Transfer`, customer's SB account balance MUST be validated (`CurrentBalance >= totalRequired`).
   - Automatically debit the SB account and log a `SavingTransaction` (Withdrawal - Transfer).
4. **[RULE-FD-004] Premature Penalty Clawback**:
   - Recalculate interest for actual held days with penalty rate.
   - Any excess previously accrued interest must be clawed back from principal.
5. **[RULE-FD-006] Zero Deletion With Transactions**:
   - Do NOT allow deleting any FD account if financial transactions exist beyond the initial opening voucher.
6. **[RULE-FD-009] Migration Maturity Auto-Calculation with Override**:
   - In `FdOpeningBalanceMigration.tsx`, maturity amount MUST auto-calculate based on scheme, deposit amount, rate, opening date, and maturity date, but remain user-editable (manual override) to respect physical legacy receipts. Validate that `MaturityAmount >= DepositAmount`.
7. **Rule Update Protocol**:
   - If any new rule is established or updated, it MUST be added to [FIXED_DEPOSIT_MODULE_SPECIFICATION_AND_RULES.md](file:///d:/Bhisi%20Software/FIXED_DEPOSIT_MODULE_SPECIFICATION_AND_RULES.md) with an assigned `RULE-FD-XXX` identifier before making code modifications.
