-- Multi-Branch Migration: Add BranchID & Multi-Branch Tracking to LoanCollections
-- This script ensures LoanCollections table supports collecting branch tracking,
-- fixes the critical cash mismatch bug, and enables accurate cashier drawer tallying.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

-- 1. Add BranchID column
IF COL_LENGTH('LoanCollections', 'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [BranchID] int NOT NULL CONSTRAINT [DF_LoanCollections_BranchID] DEFAULT 1;
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LoanCollections_Branches_BranchID')
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD CONSTRAINT [FK_LoanCollections_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [dbo].[Branches] ([BranchID]);
    END
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanCollections_BranchID' AND object_id = OBJECT_ID('LoanCollections'))
    BEGIN
        CREATE INDEX [IX_LoanCollections_BranchID] ON [dbo].[LoanCollections] ([BranchID]);
    END
END

-- 2. Add CollectingCashierID column
IF COL_LENGTH('LoanCollections', 'CollectingCashierID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [CollectingCashierID] int NULL;
END

-- 3. Add CreatedByUserID column
IF COL_LENGTH('LoanCollections', 'CreatedByUserID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [CreatedByUserID] int NULL;
END

-- 4. Add IsCrossBranch column
IF COL_LENGTH('LoanCollections', 'IsCrossBranch') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [IsCrossBranch] bit NOT NULL CONSTRAINT [DF_LoanCollections_IsCrossBranch] DEFAULT 0;
END

-- 5. Add HomeBranchID column
IF COL_LENGTH('LoanCollections', 'HomeBranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [HomeBranchID] int NULL;
END

-- 6. Backfill existing collections with their LoanAccount BranchID
IF COL_LENGTH('LoanCollections', 'BranchID') IS NOT NULL
BEGIN
    EXEC(N'UPDATE lc
    SET lc.BranchID = ISNULL(la.BranchID, 1),
        lc.HomeBranchID = ISNULL(la.BranchID, 1)
    FROM [dbo].[LoanCollections] lc
    INNER JOIN [dbo].[LoanAccounts] la ON lc.LoanAccountID = la.LoanAccountID
    WHERE lc.BranchID = 1 AND la.BranchID IS NOT NULL AND la.BranchID <> 1;');
END
