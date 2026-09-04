USE [SmartBanking_JotirlingPdw];
GO
SET NOCOUNT ON;

PRINT '=== 1. SANSTHA DETAILS ===';
SELECT SansthaID, SansthaName, RegistrationNo, Address, Taluka, District FROM SansthaDetails;

PRINT '=== 2. BRANCHES ===';
SELECT BranchID, BranchName, BranchCode, Address FROM Branches;

PRINT '=== 3. ROLES ===';
SELECT RoleID, RoleName, RoleCode, Description FROM Roles;

PRINT '=== 4. ACCOUNT GROUPS (First 15) ===';
SELECT TOP 15 GroupID, GroupName, NatureOfGroup, DisplayOrder FROM AccountGroups ORDER BY GroupID;

PRINT '=== 5. LEDGERS (First 15) ===';
SELECT TOP 15 LedgerID, LedgerName, LedgerCode FROM Ledgers ORDER BY LedgerID;

PRINT '=== 6. MEMBERS (First 15) ===';
SELECT TOP 15 MemberID, MemberCode, FirstName, MiddleName, LastName, Address FROM Members ORDER BY MemberID;

PRINT '=== 7. SAVING ACCOUNTS ===';
SELECT TOP 10 SavingAccountID, AccountNo, Balance FROM SavingAccounts;

PRINT '=== 8. LOAN ACCOUNTS ===';
SELECT TOP 10 LoanID, LoanNo, SanctionAmount FROM Loans;
GO
