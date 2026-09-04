USE [SmartBanking_JotirlingPdw];
GO
SET NOCOUNT ON;

PRINT '========================================================================';
PRINT '  COMPREHENSIVE DATABASE AUDIT REPORT - SmartBanking_JotirlingPdw      ';
PRINT '========================================================================';

PRINT '';
PRINT '--- 1. CRITICAL TABLES EXISTENCE & COLUMN COUNTS ---';
SELECT 
    t.name AS [Table Name], 
    COUNT(c.column_id) AS [Total Columns],
    'EXISTS (OK)' AS [Status]
FROM sys.tables t
JOIN sys.columns c ON t.object_id = c.object_id
WHERE t.name IN (
    'SystemVersionHistories', 'AuditLedgerMappings', 'CommitteeMembers', 
    'EmployerMasters', 'SansthaDetails', 'AccountGroups', 'Ledgers', 
    'Members', 'Loans', 'FdAccounts', 'RdAccounts', 'PigmyAccounts', 
    'SavingAccountMasters', 'Vouchers', 'BranchDayEndStatuses', '__EFMigrationsHistory'
)
GROUP BY t.name
ORDER BY t.name;

PRINT '';
PRINT '--- 2. CRITICAL FEATURE COLUMNS VERIFICATION ---';
SELECT 
    t.name AS [Table], 
    c.name AS [Column], 
    ty.name AS [Type],
    CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END AS [Nullable]
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE 
    (t.name = 'AccountGroups' AND c.name IN ('DisplayOrder', 'GroupCode', 'GroupNameEnglish')) OR
    (t.name = 'Ledgers' AND c.name IN ('DisplayOrder', 'LedgerCode', 'InterestRate')) OR
    (t.name = 'SavingAccountMasters' AND c.name IN ('LienAmount', 'LienReason', 'IsLienActive')) OR
    (t.name = 'FdSchemes' AND c.name IN ('FdLiabilityLedgerID', 'InterestExpenseLedgerID', 'InterestPayableLedgerID', 'PrematurePenaltyLedgerID')) OR
    (t.name = 'RdSchemes' AND c.name IN ('RdLiabilityLedgerID', 'InterestExpenseLedgerID', 'InterestPayableLedgerID', 'PrematurePenaltyLedgerID', 'LatePenaltyLedgerID')) OR
    (t.name = 'PigmySchemes' AND c.name IN ('PigmyLiabilityLedgerID', 'InterestExpenseLedgerID', 'CommissionExpenseLedgerID')) OR
    (t.name = 'InvestmentSchemes' AND c.name IN ('InvestmentAssetLedgerID', 'InterestIncomeLedgerID', 'InterestReceivableLedgerID')) OR
    (t.name = 'Loans' AND c.name IN ('IsSec101NoticeIssued', 'Sec101NoticeDate', 'Sec101NoticeRefNo', 'Sec101RecoveryExpense')) OR
    (t.name = 'Vouchers' AND c.name IN ('RejectionReason', 'ScrollNo')) OR
    (t.name = 'Members' AND c.name IN ('NickName', 'AadhaarDocPath', 'PanDocPath'))
ORDER BY t.name, c.name;

PRINT '';
PRINT '--- 3. BALANCE SHEET ACCOUNT GROUPS WITH DISPLAY ORDER ---';
SELECT 
    GroupID, 
    GroupName, 
    DisplayOrder, 
    NatureOfGroup
FROM AccountGroups
WHERE DisplayOrder > 0
ORDER BY NatureOfGroup, DisplayOrder;

PRINT '';
PRINT '--- 4. EF CORE MIGRATIONS SYNC STATUS ---';
SELECT MigrationId, ProductVersion FROM __EFMigrationsHistory ORDER BY MigrationId;

PRINT '';
PRINT '--- 5. MASTER DATA INTEGRITY (EXISTING RECORDS CHECK) ---';
SELECT 'SansthaDetails' AS [Table], COUNT(*) AS [Record Count] FROM SansthaDetails
UNION ALL
SELECT 'Branches', COUNT(*) FROM Branches
UNION ALL
SELECT 'Users', COUNT(*) FROM Users
UNION ALL
SELECT 'Roles', COUNT(*) FROM Roles
UNION ALL
SELECT 'FinancialYears', COUNT(*) FROM FinancialYears
UNION ALL
SELECT 'AccountGroups', COUNT(*) FROM AccountGroups;
GO
