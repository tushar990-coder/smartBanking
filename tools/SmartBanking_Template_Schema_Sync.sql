-- =========================================================================================
-- SmartBanking ERP - Pure Database Schema Synchronization Script
-- Target: SmartBanking_Template (or any new/existing Sanstha Database)
-- Purpose: Syncs database structure to Golden Baseline (Padavalwadi Standard)
-- Note: 100% PURE DDL (Schema Only) - NO TRANSACTIONAL DATA IS COPIED OR MODIFIED
-- =========================================================================================

SET NOCOUNT ON;
PRINT N'==================================================================';
PRINT N' Starting Schema Synchronization for: ' + DB_NAME();
PRINT N' Mode: Pure DDL (Structure Updates Only - Zero Data Copied)';
PRINT N'==================================================================';

-- -----------------------------------------------------------------------------------------
-- 1. Customers Table: Legacy Customer Support
-- -----------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Customers') AND name = N'LegacyCustomerNo')
BEGIN
    ALTER TABLE dbo.Customers ADD LegacyCustomerNo NVARCHAR(50) NULL;
    PRINT N'  [+] Added Customers.LegacyCustomerNo';
END
GO

-- -----------------------------------------------------------------------------------------
-- 2. SavingAccountMasters Table: Interest & Legacy Account Fields
-- -----------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SavingAccountMasters') AND name = N'LastInterestAmount')
BEGIN
    ALTER TABLE dbo.SavingAccountMasters ADD LastInterestAmount DECIMAL(18, 2) NULL;
    PRINT N'  [+] Added SavingAccountMasters.LastInterestAmount';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SavingAccountMasters') AND name = N'LastInterestPostingDate')
BEGIN
    ALTER TABLE dbo.SavingAccountMasters ADD LastInterestPostingDate DATETIME2 NULL;
    PRINT N'  [+] Added SavingAccountMasters.LastInterestPostingDate';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SavingAccountMasters') AND name = N'OldAccountNo')
BEGIN
    ALTER TABLE dbo.SavingAccountMasters ADD OldAccountNo NVARCHAR(50) NULL;
    PRINT N'  [+] Added SavingAccountMasters.OldAccountNo';
END
GO

-- -----------------------------------------------------------------------------------------
-- 3. SavingTransactions Table: Customer CIF Linkage
-- -----------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SavingTransactions') AND name = N'CustomerID')
BEGIN
    ALTER TABLE dbo.SavingTransactions ADD CustomerID INT NULL;
    PRINT N'  [+] Added SavingTransactions.CustomerID';
END
GO

-- -----------------------------------------------------------------------------------------
-- 4. SavingAccountJointHolders Table: Customer CIF Linkage
-- -----------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SavingAccountJointHolders') AND name = N'CustomerID')
BEGIN
    ALTER TABLE dbo.SavingAccountJointHolders ADD CustomerID INT NULL;
    PRINT N'  [+] Added SavingAccountJointHolders.CustomerID';
END
GO

-- -----------------------------------------------------------------------------------------
-- 5. Cash Management & Allocations
-- -----------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CashAllocations') AND name = N'AuthorizedBy')
BEGIN
    ALTER TABLE dbo.CashAllocations ADD AuthorizedBy INT NULL;
    PRINT N'  [+] Added CashAllocations.AuthorizedBy';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CashDenominations') AND name = N'PhysicalCashTotal')
BEGIN
    ALTER TABLE dbo.CashDenominations ADD PhysicalCashTotal DECIMAL(18, 2) NOT NULL DEFAULT (0.00);
    PRINT N'  [+] Added CashDenominations.PhysicalCashTotal';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CashDenominations') AND name = N'SystemCashBalance')
BEGIN
    ALTER TABLE dbo.CashDenominations ADD SystemCashBalance DECIMAL(18, 2) NOT NULL DEFAULT (0.00);
    PRINT N'  [+] Added CashDenominations.SystemCashBalance';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CashDenominations') AND name = N'Count1')
BEGIN
    ALTER TABLE dbo.CashDenominations ADD Count1 INT NOT NULL DEFAULT (0);
    PRINT N'  [+] Added CashDenominations.Count1';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CashDenominations') AND name = N'Count2')
BEGIN
    ALTER TABLE dbo.CashDenominations ADD Count2 INT NOT NULL DEFAULT (0);
    PRINT N'  [+] Added CashDenominations.Count2';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CashDenominations') AND name = N'EntryDate')
BEGIN
    ALTER TABLE dbo.CashDenominations ADD EntryDate DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME());
    PRINT N'  [+] Added CashDenominations.EntryDate';
END
GO

-- -----------------------------------------------------------------------------------------
-- 6. Non-Member CIF Support: Make MemberID Nullable across all Account Types
-- -----------------------------------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SavingAccountMasters' AND COLUMN_NAME = 'MemberID' AND IS_NULLABLE = 'NO'
)
BEGIN
    ALTER TABLE dbo.SavingAccountMasters ALTER COLUMN MemberID INT NULL;
    PRINT N'  [+] Altered SavingAccountMasters.MemberID -> NULLABLE (Supports Non-Member CIF)';
END

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'PigmyAccounts' AND COLUMN_NAME = 'MemberID' AND IS_NULLABLE = 'NO'
)
BEGIN
    ALTER TABLE dbo.PigmyAccounts ALTER COLUMN MemberID INT NULL;
    PRINT N'  [+] Altered PigmyAccounts.MemberID -> NULLABLE (Supports Non-Member CIF)';
END

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'FdAccounts' AND COLUMN_NAME = 'MemberID' AND IS_NULLABLE = 'NO'
)
BEGIN
    ALTER TABLE dbo.FdAccounts ALTER COLUMN MemberID INT NULL;
    PRINT N'  [+] Altered FdAccounts.MemberID -> NULLABLE (Supports Non-Member CIF)';
END

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'RdAccounts' AND COLUMN_NAME = 'MemberID' AND IS_NULLABLE = 'NO'
)
BEGIN
    ALTER TABLE dbo.RdAccounts ALTER COLUMN MemberID INT NULL;
    PRINT N'  [+] Altered RdAccounts.MemberID -> NULLABLE (Supports Non-Member CIF)';
END

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SavingAccountJointHolders' AND COLUMN_NAME = 'MemberID' AND IS_NULLABLE = 'NO'
)
BEGIN
    ALTER TABLE dbo.SavingAccountJointHolders ALTER COLUMN MemberID INT NULL;
    PRINT N'  [+] Altered SavingAccountJointHolders.MemberID -> NULLABLE (Supports Non-Member CIF)';
END
GO

-- -----------------------------------------------------------------------------------------
-- 7. System Version History Schema
-- -----------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'SystemVersionHistories')
BEGIN
    CREATE TABLE dbo.SystemVersionHistories (
        VersionHistoryID INT IDENTITY(1,1) PRIMARY KEY,
        Version NVARCHAR(100) NULL,
        VersionNumber NVARCHAR(50) NULL,
        PatchName NVARCHAR(150) NULL,
        ReleaseDate NVARCHAR(50) NULL,
        Changelog NVARCHAR(MAX) NULL,
        AppliedDate DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME()),
        InstalledOn DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME()),
        IsActive BIT NOT NULL DEFAULT (1)
    );
    PRINT N'  [+] Created Table dbo.SystemVersionHistories';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SystemVersionHistories') AND name = N'Version')
        ALTER TABLE dbo.SystemVersionHistories ADD Version NVARCHAR(100) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SystemVersionHistories') AND name = N'ReleaseDate')
        ALTER TABLE dbo.SystemVersionHistories ADD ReleaseDate NVARCHAR(50) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SystemVersionHistories') AND name = N'Changelog')
        ALTER TABLE dbo.SystemVersionHistories ADD Changelog NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SystemVersionHistories') AND name = N'InstalledOn')
        ALTER TABLE dbo.SystemVersionHistories ADD InstalledOn DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME());
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SystemVersionHistories') AND name = N'IsActive')
        ALTER TABLE dbo.SystemVersionHistories ADD IsActive BIT NOT NULL DEFAULT (1);
    PRINT N'  [+] Verified dbo.SystemVersionHistories columns';
END
GO

-- -----------------------------------------------------------------------------------------
-- 8. Performance Indexes for Search & Joint Holders
-- -----------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Customers_LegacyCustomerNo' AND object_id = OBJECT_ID(N'dbo.Customers'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Customers_LegacyCustomerNo ON dbo.Customers (LegacyCustomerNo) WHERE LegacyCustomerNo IS NOT NULL;
    PRINT N'  [+] Created Index IX_Customers_LegacyCustomerNo';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SavingAccountMasters_OldAccountNo' AND object_id = OBJECT_ID(N'dbo.SavingAccountMasters'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_SavingAccountMasters_OldAccountNo ON dbo.SavingAccountMasters (OldAccountNo) WHERE OldAccountNo IS NOT NULL;
    PRINT N'  [+] Created Index IX_SavingAccountMasters_OldAccountNo';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SavingAccountJointHolders_CustomerID' AND object_id = OBJECT_ID(N'dbo.SavingAccountJointHolders'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_SavingAccountJointHolders_CustomerID ON dbo.SavingAccountJointHolders (CustomerID) WHERE CustomerID IS NOT NULL;
    PRINT N'  [+] Created Index IX_SavingAccountJointHolders_CustomerID';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SavingTransactions_CustomerID' AND object_id = OBJECT_ID(N'dbo.SavingTransactions'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_SavingTransactions_CustomerID ON dbo.SavingTransactions (CustomerID) WHERE CustomerID IS NOT NULL;
    PRINT N'  [+] Created Index IX_SavingTransactions_CustomerID';
END
GO

PRINT N'==================================================================';
PRINT N' Schema Synchronization Completed Successfully! (100% OK)';
PRINT N'==================================================================';
