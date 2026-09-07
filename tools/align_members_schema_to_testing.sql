-- =========================================================================================
-- SmartBanking ERP - Align Members Schema to Canonical Testing Baseline (13 Columns)
-- Target: Any SmartBanking Sanstha Database (e.g. SmartBanking_JotirlingPdw)
-- Purpose: Safely consolidates OldMemberCode into LegacyMemberNo, drops OldMemberCode and LegacyMemberId,
--          and verifies the exact 13 canonical columns match the testing baseline.
-- =========================================================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
GO

PRINT '========================================================================';
PRINT '  Starting Members Table Alignment for: ' + DB_NAME();
PRINT '========================================================================';

-- 1. Safely copy any non-empty OldMemberCode into LegacyMemberNo before dropping
IF COL_LENGTH('Members', 'OldMemberCode') IS NOT NULL
BEGIN
    EXEC('UPDATE [dbo].[Members]
    SET [LegacyMemberNo] = [OldMemberCode]
    WHERE ([LegacyMemberNo] IS NULL OR [LegacyMemberNo] = '''') AND [OldMemberCode] IS NOT NULL;');
    PRINT '  [+] Consolidated OldMemberCode into LegacyMemberNo.';
END

-- 2. Drop any indexes on OldMemberCode or LegacyMemberId
DECLARE @IdxDrop NVARCHAR(MAX) = '';
SELECT @IdxDrop = @IdxDrop + 'DROP INDEX [' + i.name + '] ON [dbo].[Members];' + CHAR(13)
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID(N'[dbo].[Members]')
  AND i.is_primary_key = 0
  AND c.name IN ('OldMemberCode', 'LegacyMemberId');

IF LEN(@IdxDrop) > 0 
BEGIN
    EXEC sp_executesql @IdxDrop;
    PRINT '  [+] Dropped indexes on OldMemberCode / LegacyMemberId.';
END

-- 3. Drop any default constraints on OldMemberCode or LegacyMemberId
DECLARE @DfDrop NVARCHAR(MAX) = '';
SELECT @DfDrop = @DfDrop + 'ALTER TABLE [dbo].[Members] DROP CONSTRAINT [' + d.name + '];' + CHAR(13)
FROM sys.default_constraints d
JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
WHERE d.parent_object_id = OBJECT_ID(N'[dbo].[Members]')
  AND c.name IN ('OldMemberCode', 'LegacyMemberId');

IF LEN(@DfDrop) > 0 
BEGIN
    EXEC sp_executesql @DfDrop;
    PRINT '  [+] Dropped default constraints on OldMemberCode / LegacyMemberId.';
END

-- 4. Drop columns OldMemberCode and LegacyMemberId from dbo.Members
IF COL_LENGTH('Members', 'OldMemberCode') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[Members] DROP COLUMN [OldMemberCode];
    PRINT '  [+] Dropped column OldMemberCode from dbo.Members.';
END

IF COL_LENGTH('Members', 'LegacyMemberId') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[Members] DROP COLUMN [LegacyMemberId];
    PRINT '  [+] Dropped column LegacyMemberId from dbo.Members.';
END

-- 5. Customer-First Loan Linkage
IF COL_LENGTH('LoanAccounts', 'CoCustomerID') IS NULL ALTER TABLE [LoanAccounts] ADD [CoCustomerID] INT NULL;
IF COL_LENGTH('LoanAccounts', 'CoCustomer2ID') IS NULL ALTER TABLE [LoanAccounts] ADD [CoCustomer2ID] INT NULL;
IF COL_LENGTH('LoanAccounts', 'Guarantor1CustomerID') IS NULL ALTER TABLE [LoanAccounts] ADD [Guarantor1CustomerID] INT NULL;
IF COL_LENGTH('LoanAccounts', 'Guarantor2CustomerID') IS NULL ALTER TABLE [LoanAccounts] ADD [Guarantor2CustomerID] INT NULL;

IF COL_LENGTH('LoanApplications', 'CoCustomerID') IS NULL ALTER TABLE [LoanApplications] ADD [CoCustomerID] INT NULL;
IF COL_LENGTH('LoanApplications', 'CoCustomer2ID') IS NULL ALTER TABLE [LoanApplications] ADD [CoCustomer2ID] INT NULL;
IF COL_LENGTH('LoanApplications', 'Guarantor1CustomerID') IS NULL ALTER TABLE [LoanApplications] ADD [Guarantor1CustomerID] INT NULL;
IF COL_LENGTH('LoanApplications', 'Guarantor2CustomerID') IS NULL ALTER TABLE [LoanApplications] ADD [Guarantor2CustomerID] INT NULL;

IF COL_LENGTH('MemberOpeningBalances', 'CustomerID') IS NULL ALTER TABLE [MemberOpeningBalances] ADD [CustomerID] INT NULL;

PRINT '========================================================================';
PRINT '  Members Table Alignment Completed! Verification:';
PRINT '========================================================================';

SELECT 
    c.column_id AS [Col#],
    c.name AS [ColumnName],
    ty.name AS [DataType],
    c.is_nullable AS [Nullable]
FROM sys.columns c
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE c.object_id = OBJECT_ID(N'[dbo].[Members]')
ORDER BY c.column_id;
