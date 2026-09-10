================================================================================
SmartBanking_Template - Master Template Database for Server Deployment
================================================================================
Generated Date: 2026-09-09
Architecture: 100% Pure Customer-First (CIF-First) Architecture (v2.4.5)

1. FILES INCLUDED IN THIS ARCHIVE:
--------------------------------------------------------------------------------
* SmartBanking_Template.mdf  (Primary Database Data File)
* SmartBanking_Template_log.ldf  (Transaction Log File)
* SmartBanking_Template.bak  (Full SQL Server Database Backup File)
* README_SmartBanking_Template.txt  (This documentation)

2. WHAT IS PRESERVED IN THIS DATABASE:
--------------------------------------------------------------------------------
- Master Schemes:
  * Share Schemes (ShareSchemes)
  * Fixed Deposit Schemes (FdSchemes)
  * Recurring Deposit Schemes (RdSchemes)
  * Pigmy / Daily Deposit Schemes (PigmySchemes)
  * Saving Interest Schemes (SavingInterestSettings)
  * Loan Interest Schemes (LoanRates)
  * Cash Management Settings (CashManagementSettings)
  * Security Types (SecurityTypes)
  * NPA Configuration & Provision Slabs (NpaConfigs, NpaProvisionSlabs)
- Master Group Ledgers:
  * 91 Core Banking Group Ledgers (AccountGroups)
- Master Ledgers (Chart of Accounts):
  * 410 Master General & Subsidiary Ledgers (Ledgers)
- Institution Details (Sanstha Mahiti):
  * Organization Profile & Settings (SansthaDetails)
- Branch Master:
  * Main Branch (BranchID = 1) (Branches)
- Login Users & Security Roles:
  * Administrator User (Users)
  * Role Definitions (Roles)
- Financial Year:
  * Active Financial Year (FinancialYears)
- Bank Masters:
  * Standard Bank List (BankMasters)
- Cashier Counters:
  * Main Vault & Counter Master records with zero balance (Cashiers)

3. WHAT IS EMPTIED / ZERO RECORDS:
--------------------------------------------------------------------------------
- Zero Customers (Customers)
- Zero Members (Members)
- Zero Share Accounts & Certificates (ShareAccounts, ShareCertificates)
- Zero Saving Accounts & Transactions (SavingAccountMasters, SavingTransactions)
- Zero Fixed Deposit Accounts (FdAccounts, FdTransactions)
- Zero Recurring Deposit Accounts (RdAccounts, RdTransactions)
- Zero Pigmy Accounts & Collections (PigmyAccounts, PigmyTransactions)
- Zero Loans & Disbursements (LoanAccounts, LoanApplications)
- Zero Vouchers & Ledger Details (Vouchers, VoucherDetails)
- Zero Audit Logs & Login Logs (AuditLogs, UserLoginAudits)

4. 100% STRICT RULES IMPLEMENTED:
--------------------------------------------------------------------------------
- CIF-First Architecture:
  * FdAccounts, RdAccounts, and PigmyAccounts strictly reference CustomerID.
  * Zero MemberID fallback.
  * Membership is strictly linked to Customers via CustomerID.
- Identity Seeds:
  * Every cleared table has its IDENTITY seed reset so that the VERY FIRST
    record inserted will start with ID = 1.
- CIF Sequences:
  * CifSequences.CurrentValue is reset to 0, ensuring the first generated
    CIF is CIF000001.

5. HOW TO ATTACH OR RESTORE ON SERVER / VPS:
--------------------------------------------------------------------------------
OPTION A: Using MDF and LDF Files (Attach Database)
Copy SmartBanking_Template.mdf and SmartBanking_Template_log.ldf to your server's
DATA folder, then execute in SSMS:

CREATE DATABASE [SmartBanking_Template]
ON (FILENAME = 'C:\YourServerDataPath\SmartBanking_Template.mdf'),
   (FILENAME = 'C:\YourServerDataPath\SmartBanking_Template_log.ldf')
FOR ATTACH;

--------------------------------------------------------------------------------
OPTION B: Using .BAK File (Restore Database)
Execute in SSMS on the server:

RESTORE DATABASE [SmartBanking_Template]
FROM DISK = 'C:\Path\To\SmartBanking_Template.bak'
WITH REPLACE;

6. DEFAULT LOGIN CREDENTIALS:
--------------------------------------------------------------------------------
Username: admin
Password: (Master secure institutional password: Shri@2026)
================================================================================
