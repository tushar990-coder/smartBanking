================================================================================
 SmartBanking ERP - Template Database Deployment Instructions (SQL Server 2022)
================================================================================

Why MDF/BAK failed (Error 948):
Your local machine created the database on SQL Server 2025 (Database Version 998).
SQL Server 2022 (Database Version 957) on your server rejects attaching or restoring 
MDF/BAK files from a higher version ("A downgrade path is not supported").

This package provides the pure T-SQL deployment script that creates the database,
all 50+ CBS tables, indexes, triggers, and all master records on SQL Server 2022
(or any SQL Server version) with ZERO errors.

--------------------------------------------------------------------------------
OPTION 1: Execute via SSMS (SQL Server Management Studio) - RECOMMENDED
--------------------------------------------------------------------------------
1. On your server, open SQL Server Management Studio (SSMS).
2. Connect to your SQL Server (e.g., MINDSPACE-CONST or localhost).
3. Click File -> Open -> File... (or press Ctrl + O).
4. Select: SmartBanking_Template_Server2022.sql
5. Click "Execute" (or press F5).
6. Done! The database 'SmartBanking_Template' is created with all master data.

--------------------------------------------------------------------------------
OPTION 2: 1-Click Batch File Deployment
--------------------------------------------------------------------------------
1. Right-click "1_CLICK_DEPLOY.bat" and choose "Run as administrator".
2. Enter your server name (e.g. MINDSPACE-CONST or just press Enter for localhost).
3. Done!

--------------------------------------------------------------------------------
What is preserved in this master database:
--------------------------------------------------------------------------------
- 91 Account Group Ledgers
- 410 Master General & Subsidiary Ledgers
- Master Sanstha Profile & Branch 1
- Admin User (admin / Shri@2026) & Roles
- All CBS Schemes (Share, FD, RD, Pigmy, Saving, Loan, NPA)
- Zero Customers, Members, Accounts, Vouchers
- All Sequences & Identity Counters cleanly initialized at 1
================================================================================
