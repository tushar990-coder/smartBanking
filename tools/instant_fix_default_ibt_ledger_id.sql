-- =========================================================================================
-- Emergency Fix Script: instant_fix_default_ibt_ledger_id.sql
-- Description: Instantly ensures DefaultIbtLedgerID, DefaultCashLedgerID, and
--              BranchLedgerOpeningBalances table exist across all branches.
-- Safe, Idempotent, and Non-Destructive (Zero Data Loss).
-- =========================================================================================

-- 1. Ensure DefaultIbtLedgerID & DefaultCashLedgerID on Branches
IF COL_LENGTH('Branches', 'DefaultIbtLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [DefaultIbtLedgerID] INT NULL;
    PRINT '-> [SUCCESS] Added DefaultIbtLedgerID column to Branches.';
END
ELSE
BEGIN
    PRINT '-> [OK] DefaultIbtLedgerID column already exists on Branches.';
END
GO

IF COL_LENGTH('Branches', 'DefaultCashLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [DefaultCashLedgerID] INT NULL;
    PRINT '-> [SUCCESS] Added DefaultCashLedgerID column to Branches.';
END
ELSE
BEGIN
    PRINT '-> [OK] DefaultCashLedgerID column already exists on Branches.';
END
GO

-- 2. Ensure BranchLedgerOpeningBalances Table Exists
IF OBJECT_ID(N'[dbo].[BranchLedgerOpeningBalances]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[BranchLedgerOpeningBalances] (
        [BranchLedgerOpeningBalanceID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [LedgerID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [OpeningBalance] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        [OpeningBalanceType] NVARCHAR(2) NOT NULL DEFAULT 'Dr',
        [Remarks] NVARCHAR(250) NULL,
        [CreatedBy] INT NOT NULL DEFAULT 1,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [FK_BranchLedgerOpeningBalances_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [dbo].[Ledgers] ([LedgerID]),
        CONSTRAINT [FK_BranchLedgerOpeningBalances_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [dbo].[Branches] ([BranchID]),
        CONSTRAINT [FK_BranchLedgerOpeningBalances_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [dbo].[FinancialYears] ([FinancialYearID])
    );
    PRINT '-> [SUCCESS] Created BranchLedgerOpeningBalances table.';
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
    PRINT '-> [OK] BranchLedgerOpeningBalances table and columns verified.';
END
GO

-- 3. Ensure Composite Unique Index
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UQ_BranchLedgerOpeningBalances_Ledger_Branch_FY' 
      AND object_id = OBJECT_ID('dbo.BranchLedgerOpeningBalances')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_BranchLedgerOpeningBalances_Ledger_Branch_FY]
    ON [dbo].[BranchLedgerOpeningBalances] ([LedgerID], [BranchID], [FinancialYearID]);
    PRINT '-> [SUCCESS] Created unique index UQ_BranchLedgerOpeningBalances_Ledger_Branch_FY.';
END
ELSE
BEGIN
    PRINT '-> [OK] Unique index UQ_BranchLedgerOpeningBalances_Ledger_Branch_FY already exists.';
END
GO
