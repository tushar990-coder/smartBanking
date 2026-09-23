/*
====================================================================================================
 SMARTBANKING CORE BANKING SYSTEM (CBS)
 MODULE: LOAN / LOAN APPLICATIONS (कर्ज मागणी अर्ज)
 SCRIPT: Phase 1 - 100% Pure CIF Decoupling & Direct Drop of Legacy Member Columns
 VERSION: v2.5.4
 DATE: 2026-09-23
====================================================================================================
 PURPOSE:
   Permanently remove all legacy Member foreign keys, indexes, and columns:
   - [MemberID]
   - [CoMemberID]
   - [CoMember2ID]
   from [dbo].[LoanApplications], establishing 100% Pure CIF (CustomerID) for:
   - Primary Borrower: [CustomerID] -> [Customers]([CustomerID])
   - Co-Borrower 1: [CoCustomerID] -> [Customers]([CustomerID])
   - Co-Borrower 2: [CoCustomer2ID] -> [Customers]([CustomerID])
   - Director Recommendation: [RecommendedByDirectorID] -> [Customers]([CustomerID])
   - Guarantors 1 & 2: [Guarantor1CustomerID], [Guarantor2CustomerID] -> [Customers]([CustomerID])
====================================================================================================
*/

SET NOCOUNT ON;
PRINT '================================================================================';
PRINT '  STARTING PHASE 1: LOAN APPLICATIONS PURE CIF DECOUPLING & DIRECT DROP         ';
PRINT '================================================================================';

IF OBJECT_ID(N'[dbo].[LoanApplications]', N'U') IS NOT NULL
BEGIN
    PRINT '  -> Found table [dbo].[LoanApplications]. Processing constraints and columns...';

    -- 1. Drop Foreign Keys referencing Members from LoanApplications
    DECLARE @sql NVARCHAR(MAX) = N'';

    SELECT @sql += N'ALTER TABLE [' + OBJECT_SCHEMA_NAME(parent_object_id) + N'].[' + OBJECT_NAME(parent_object_id) + N'] DROP CONSTRAINT [' + name + N']; '
    FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('dbo.LoanApplications') 
      AND object_id IN (
          SELECT constraint_object_id FROM sys.foreign_key_columns 
          WHERE parent_object_id = OBJECT_ID('dbo.LoanApplications') 
            AND COL_NAME(parent_object_id, parent_column_id) IN ('MemberID', 'CoMemberID', 'CoMember2ID', 'RecommendedByDirectorID')
      );

    IF @sql <> N'' 
    BEGIN
        PRINT '  -> Dropping Foreign Keys: ' + @sql;
        EXEC sp_executesql @sql;
    END

    -- 2. Drop Indexes on legacy columns
    SET @sql = N'';
    SELECT @sql += N'DROP INDEX [' + i.name + N'] ON [' + OBJECT_SCHEMA_NAME(i.object_id) + N'].[' + OBJECT_NAME(i.object_id) + N']; '
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('dbo.LoanApplications') 
      AND c.name IN ('MemberID', 'CoMemberID', 'CoMember2ID')
      AND i.is_primary_key = 0;

    IF @sql <> N'' 
    BEGIN
        PRINT '  -> Dropping Indexes: ' + @sql;
        EXEC sp_executesql @sql;
    END

    -- 3. Drop Default Constraints on legacy columns if any
    SET @sql = N'';
    SELECT @sql += N'ALTER TABLE [' + OBJECT_SCHEMA_NAME(parent_object_id) + N'].[' + OBJECT_NAME(parent_object_id) + N'] DROP CONSTRAINT [' + name + N']; '
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.LoanApplications') 
      AND parent_column_id IN (
          SELECT column_id FROM sys.columns 
          WHERE object_id = OBJECT_ID('dbo.LoanApplications') 
            AND name IN ('MemberID', 'CoMemberID', 'CoMember2ID')
      );

    IF @sql <> N'' 
    BEGIN
        PRINT '  -> Dropping Default Constraints: ' + @sql;
        EXEC sp_executesql @sql;
    END

    -- 4. Drop Legacy Columns
    IF COL_LENGTH(N'[dbo].[LoanApplications]', N'MemberID') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[LoanApplications] DROP COLUMN [MemberID];
        PRINT '  + Dropped column [MemberID] from [dbo].[LoanApplications]';
    END

    IF COL_LENGTH(N'[dbo].[LoanApplications]', N'CoMemberID') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[LoanApplications] DROP COLUMN [CoMemberID];
        PRINT '  + Dropped column [CoMemberID] from [dbo].[LoanApplications]';
    END

    IF COL_LENGTH(N'[dbo].[LoanApplications]', N'CoMember2ID') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[LoanApplications] DROP COLUMN [CoMember2ID];
        PRINT '  + Dropped column [CoMember2ID] from [dbo].[LoanApplications]';
    END

    -- 5. Ensure CIF Columns Exist
    IF COL_LENGTH(N'[dbo].[LoanApplications]', N'CustomerID') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanApplications] ADD [CustomerID] INT NULL;
        PRINT '  + Added column [CustomerID] to [dbo].[LoanApplications]';
    END

    IF COL_LENGTH(N'[dbo].[LoanApplications]', N'CoCustomerID') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanApplications] ADD [CoCustomerID] INT NULL;
        PRINT '  + Added column [CoCustomerID] to [dbo].[LoanApplications]';
    END

    IF COL_LENGTH(N'[dbo].[LoanApplications]', N'CoCustomer2ID') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanApplications] ADD [CoCustomer2ID] INT NULL;
        PRINT '  + Added column [CoCustomer2ID] to [dbo].[LoanApplications]';
    END

    IF COL_LENGTH(N'[dbo].[LoanApplications]', N'Guarantor1CustomerID') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanApplications] ADD [Guarantor1CustomerID] INT NULL;
        PRINT '  + Added column [Guarantor1CustomerID] to [dbo].[LoanApplications]';
    END

    IF COL_LENGTH(N'[dbo].[LoanApplications]', N'Guarantor2CustomerID') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanApplications] ADD [Guarantor2CustomerID] INT NULL;
        PRINT '  + Added column [Guarantor2CustomerID] to [dbo].[LoanApplications]';
    END

    IF COL_LENGTH(N'[dbo].[LoanApplications]', N'RecommendedByDirectorID') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanApplications] ADD [RecommendedByDirectorID] INT NULL;
        PRINT '  + Added column [RecommendedByDirectorID] to [dbo].[LoanApplications]';
    END

    PRINT '  -> [dbo].[LoanApplications] pure CIF schema migration completed.';
END
ELSE
BEGIN
    PRINT '  -> Table [dbo].[LoanApplications] not found.';
END
GO

PRINT '================================================================================';
PRINT '  [SUCCESS] PHASE 1 LOAN APPLICATIONS PURE CIF MIGRATION READY!                 ';
PRINT '================================================================================';
