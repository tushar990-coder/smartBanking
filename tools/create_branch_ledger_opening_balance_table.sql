-- ====================================================================================
-- Script: create_branch_ledger_opening_balance_table.sql
-- Purpose: Create BranchLedgerOpeningBalances table, add DefaultIbtLedgerID to Branches,
--          and safely auto-migrate existing Ledgers.OpeningBalance into Head Office.
-- ====================================================================================

-- 1. Ensure DefaultIbtLedgerID & DefaultCashLedgerID columns exist on Branches table
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Branches' AND COLUMN_NAME = 'DefaultIbtLedgerID'
)
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [DefaultIbtLedgerID] INT NULL;
    PRINT 'Added DefaultIbtLedgerID column to Branches table.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Branches' AND COLUMN_NAME = 'DefaultCashLedgerID'
)
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [DefaultCashLedgerID] INT NULL;
    PRINT 'Added DefaultCashLedgerID column to Branches table.';
END
GO

-- 2. Create BranchLedgerOpeningBalances table if not exists
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'BranchLedgerOpeningBalances'
)
BEGIN
    CREATE TABLE [dbo].[BranchLedgerOpeningBalances] (
        [BranchLedgerOpeningBalanceID] INT IDENTITY(1,1) NOT NULL,
        [LedgerID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [OpeningBalance] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        [OpeningBalanceType] NVARCHAR(2) NOT NULL DEFAULT 'Dr', -- 'Dr' or 'Cr'
        [Remarks] NVARCHAR(250) NULL,
        [CreatedBy] INT NOT NULL DEFAULT 1,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_BranchLedgerOpeningBalances] PRIMARY KEY CLUSTERED ([BranchLedgerOpeningBalanceID] ASC),
        CONSTRAINT [FK_BranchLedgerOpeningBalances_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [dbo].[Ledgers] ([LedgerID]),
        CONSTRAINT [FK_BranchLedgerOpeningBalances_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [dbo].[Branches] ([BranchID]),
        CONSTRAINT [FK_BranchLedgerOpeningBalances_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [dbo].[FinancialYears] ([FinancialYearID])
    );
    PRINT 'Created BranchLedgerOpeningBalances table.';
END
ELSE
BEGIN
    IF COL_LENGTH('BranchLedgerOpeningBalances', 'CreatedOn') IS NULL
        ALTER TABLE [dbo].[BranchLedgerOpeningBalances] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
    IF COL_LENGTH('BranchLedgerOpeningBalances', 'CreatedBy') IS NULL
        ALTER TABLE [dbo].[BranchLedgerOpeningBalances] ADD [CreatedBy] INT NOT NULL DEFAULT 1;
    IF COL_LENGTH('BranchLedgerOpeningBalances', 'UpdatedOn') IS NULL
        ALTER TABLE [dbo].[BranchLedgerOpeningBalances] ADD [UpdatedOn] DATETIME2 NULL;
    IF COL_LENGTH('BranchLedgerOpeningBalances', 'UpdatedBy') IS NULL
        ALTER TABLE [dbo].[BranchLedgerOpeningBalances] ADD [UpdatedBy] INT NULL;
    PRINT 'Verified BranchLedgerOpeningBalances columns.';
END
GO

-- 3. Create Unique Index on (LedgerID, BranchID, FinancialYearID)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UQ_BranchLedgerOpeningBalances_Ledger_Branch_FY' 
      AND object_id = OBJECT_ID('dbo.BranchLedgerOpeningBalances')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_BranchLedgerOpeningBalances_Ledger_Branch_FY]
    ON [dbo].[BranchLedgerOpeningBalances] ([LedgerID], [BranchID], [FinancialYearID]);
    PRINT 'Created unique index UQ_BranchLedgerOpeningBalances_Ledger_Branch_FY.';
END
GO

-- 4. Auto-Migrate Existing Ledgers.OpeningBalance (> 0) into Head Office for Active Financial Year
DECLARE @hoBranchID INT = NULL;
SELECT TOP 1 @hoBranchID = BranchID 
FROM [dbo].[Branches] 
WHERE LOWER(ISNULL(BranchType, '')) = 'headoffice' OR BranchID = 1
ORDER BY CASE WHEN LOWER(ISNULL(BranchType, '')) = 'headoffice' THEN 0 ELSE 1 END, BranchID ASC;

DECLARE @activeFyID INT = NULL;
SELECT TOP 1 @activeFyID = FinancialYearID 
FROM [dbo].[FinancialYears] 
WHERE IsActive = 1
ORDER BY FinancialYearID DESC;

IF @activeFyID IS NULL
BEGIN
    SELECT TOP 1 @activeFyID = FinancialYearID FROM [dbo].[FinancialYears] ORDER BY FinancialYearID DESC;
END

IF @hoBranchID IS NOT NULL AND @activeFyID IS NOT NULL
BEGIN
    INSERT INTO [dbo].[BranchLedgerOpeningBalances] 
        ([LedgerID], [BranchID], [FinancialYearID], [OpeningBalance], [OpeningBalanceType], [Remarks], [CreatedBy], [CreatedOn])
    SELECT 
        l.LedgerID,
        @hoBranchID,
        @activeFyID,
        l.OpeningBalance,
        ISNULL(NULLIF(l.OpeningBalanceType, ''), 'Dr'),
        N'Auto-migrated from legacy ledger opening balance to Head Office',
        1,
        SYSUTCDATETIME()
    FROM [dbo].[Ledgers] l
    WHERE l.OpeningBalance > 0
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[BranchLedgerOpeningBalances] b 
          WHERE b.LedgerID = l.LedgerID 
            AND b.BranchID = @hoBranchID 
            AND b.FinancialYearID = @activeFyID
      );

    PRINT 'Auto-migrated ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' opening balance entries to Head Office (Branch ' + CAST(@hoBranchID AS VARCHAR(10)) + ').';
END
ELSE
BEGIN
    PRINT 'Warning: Could not determine HO Branch or Active Financial Year for migration.';
END
GO
