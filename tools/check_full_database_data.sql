USE [SmartBanking_JotirlingPdw];
GO
SET NOCOUNT ON;

PRINT '===================================================================================';
PRINT '         DATABASE DATA INVENTORY REPORT - SmartBanking_JotirlingPdw               ';
PRINT '===================================================================================';

PRINT '';
PRINT '--- 1. SUMMARY OF TABLES WITH DATA (डेटा असलेली सर्व टेबल्स) ---';
SELECT 
    t.name AS [Table Name],
    p.rows AS [Total Records]
FROM sys.tables t
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
WHERE t.is_ms_shipped = 0 AND p.rows > 0
ORDER BY p.rows DESC, t.name;

PRINT '';
PRINT '--- 2. SANSTHA DETAILS (संस्था तपशील) ---';
SELECT SansthaID, SansthaName, RegistrationNo, Address FROM SansthaDetails;

PRINT '';
PRINT '--- 3. BRANCH DETAILS (शाखा तपशील) ---';
SELECT BranchID, BranchName, BranchCode, Address FROM Branches;

PRINT '';
PRINT '--- 4. FINANCIAL YEARS (आर्थिक वर्ष) ---';
SELECT FinancialYearID, YearCode, StartDate, EndDate, IsActive, IsClosed FROM FinancialYears;

PRINT '';
PRINT '--- 5. USERS & ROLES (वापरकर्ते आणि अधिकार) ---';
SELECT u.UserID, u.Username, u.IsActive, r.RoleName
FROM Users u
LEFT JOIN Roles r ON u.RoleID = r.RoleID;

PRINT '';
PRINT '--- 6. ACCOUNT GROUPS SUMMARY (खाते गट सारांश) ---';
SELECT 
    NatureOfGroup,
    COUNT(*) AS [Total Groups],
    COUNT(CASE WHEN DisplayOrder > 0 THEN 1 END) AS [Groups with DisplayOrder]
FROM AccountGroups
GROUP BY NatureOfGroup;

PRINT '';
PRINT '--- 7. LEDGERS SUMMARY (खतावणी लेजर्स) ---';
SELECT 
    COUNT(*) AS [Total Ledgers],
    COUNT(CASE WHEN IsActive = 1 THEN 1 END) AS [Active Ledgers]
FROM Ledgers;

PRINT '';
PRINT '--- 8. MEMBERS (सभासद माहिती) ---';
SELECT COUNT(*) AS [Total Members] FROM Members;

PRINT '';
PRINT '--- 9. DEPOSITS & LOANS SUMMARY (ठेवी आणि कर्जे) ---';
SELECT 
    (SELECT COUNT(*) FROM SavingAccountMasters) AS [Saving Accounts],
    (SELECT COUNT(*) FROM FdAccounts) AS [FD Accounts],
    (SELECT COUNT(*) FROM RdAccounts) AS [RD Accounts],
    (SELECT COUNT(*) FROM PigmyAccounts) AS [Pigmy Accounts],
    (SELECT COUNT(*) FROM Loans) AS [Loan Accounts],
    (SELECT COUNT(*) FROM Vouchers) AS [Total Vouchers / Transactions];
GO
