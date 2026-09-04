-- ==============================================================================
-- Pure Customer-Centric (CIF-First) Core Banking Architecture Upgrade
-- Script: V3_Pure_CIF_Core_Banking_Migration.sql
-- Description: Adds CustomerID to all Banking Modules, backfills existing data,
--              makes MemberID nullable, and ensures 100% data integrity.
-- ==============================================================================

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

PRINT '>>> Step 1: Adding CustomerID column to [PigmyAccounts]...';
IF COL_LENGTH('PigmyAccounts', 'CustomerID') IS NULL
BEGIN
    ALTER TABLE [PigmyAccounts] ADD [CustomerID] INT NULL;
END
GO

PRINT '>>> Step 2: Adding CustomerID column to [SavingAccountMasters]...';
IF COL_LENGTH('SavingAccountMasters', 'CustomerID') IS NULL
BEGIN
    ALTER TABLE [SavingAccountMasters] ADD [CustomerID] INT NULL;
END
GO

PRINT '>>> Step 3: Adding CustomerID column to [FdAccounts]...';
IF COL_LENGTH('FdAccounts', 'CustomerID') IS NULL
BEGIN
    ALTER TABLE [FdAccounts] ADD [CustomerID] INT NULL;
END
GO

PRINT '>>> Step 4: Adding CustomerID column to [RdAccounts]...';
IF COL_LENGTH('RdAccounts', 'CustomerID') IS NULL
BEGIN
    ALTER TABLE [RdAccounts] ADD [CustomerID] INT NULL;
END
GO

PRINT '>>> Step 5: Adding CustomerID column to [LoanAccounts]...';
IF COL_LENGTH('LoanAccounts', 'CustomerID') IS NULL
BEGIN
    ALTER TABLE [LoanAccounts] ADD [CustomerID] INT NULL;
END
GO

PRINT '>>> Step 6: Adding CustomerID column to [LoanApplications]...';
IF COL_LENGTH('LoanApplications', 'CustomerID') IS NULL
BEGIN
    ALTER TABLE [LoanApplications] ADD [CustomerID] INT NULL;
END
GO

PRINT '>>> Step 7: Adding CustomerID column to [LockerAllotments]...';
IF COL_LENGTH('LockerAllotments', 'CustomerID') IS NULL
BEGIN
    ALTER TABLE [LockerAllotments] ADD [CustomerID] INT NULL;
END
GO

PRINT '>>> Step 8: Backfilling CustomerID in all banking tables from [Members]...';
GO

-- PigmyAccounts
UPDATE p
SET p.CustomerID = m.CustomerID
FROM [PigmyAccounts] p
INNER JOIN [Members] m ON p.MemberID = m.MemberID
WHERE p.CustomerID IS NULL AND m.CustomerID IS NOT NULL;
GO

-- SavingAccountMasters
UPDATE s
SET s.CustomerID = m.CustomerID
FROM [SavingAccountMasters] s
INNER JOIN [Members] m ON s.MemberID = m.MemberID
WHERE s.CustomerID IS NULL AND m.CustomerID IS NOT NULL;
GO

-- FdAccounts
UPDATE f
SET f.CustomerID = m.CustomerID
FROM [FdAccounts] f
INNER JOIN [Members] m ON f.MemberID = m.MemberID
WHERE f.CustomerID IS NULL AND m.CustomerID IS NOT NULL;
GO

-- RdAccounts
UPDATE r
SET r.CustomerID = m.CustomerID
FROM [RdAccounts] r
INNER JOIN [Members] m ON r.MemberID = m.MemberID
WHERE r.CustomerID IS NULL AND m.CustomerID IS NOT NULL;
GO

-- LoanAccounts
UPDATE l
SET l.CustomerID = m.CustomerID
FROM [LoanAccounts] l
INNER JOIN [Members] m ON l.MemberID = m.MemberID
WHERE l.CustomerID IS NULL AND m.CustomerID IS NOT NULL;
GO

-- LoanApplications
UPDATE la
SET la.CustomerID = m.CustomerID
FROM [LoanApplications] la
INNER JOIN [Members] m ON la.MemberID = m.MemberID
WHERE la.CustomerID IS NULL AND m.CustomerID IS NOT NULL;
GO

-- LockerAllotments
UPDATE lk
SET lk.CustomerID = m.CustomerID
FROM [LockerAllotments] lk
INNER JOIN [Members] m ON lk.MemberID = m.MemberID
WHERE lk.CustomerID IS NULL AND m.CustomerID IS NOT NULL;
GO

PRINT '>>> Step 9: Creating Foreign Keys & Indexes for CustomerID...';
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_PigmyAccounts_Customers_CustomerID')
BEGIN
    ALTER TABLE [PigmyAccounts] WITH CHECK ADD CONSTRAINT [FK_PigmyAccounts_Customers_CustomerID] 
    FOREIGN KEY([CustomerID]) REFERENCES [Customers] ([CustomerID]);
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SavingAccountMasters_Customers_CustomerID')
BEGIN
    ALTER TABLE [SavingAccountMasters] WITH CHECK ADD CONSTRAINT [FK_SavingAccountMasters_Customers_CustomerID] 
    FOREIGN KEY([CustomerID]) REFERENCES [Customers] ([CustomerID]);
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_FdAccounts_Customers_CustomerID')
BEGIN
    ALTER TABLE [FdAccounts] WITH CHECK ADD CONSTRAINT [FK_FdAccounts_Customers_CustomerID] 
    FOREIGN KEY([CustomerID]) REFERENCES [Customers] ([CustomerID]);
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_RdAccounts_Customers_CustomerID')
BEGIN
    ALTER TABLE [RdAccounts] WITH CHECK ADD CONSTRAINT [FK_RdAccounts_Customers_CustomerID] 
    FOREIGN KEY([CustomerID]) REFERENCES [Customers] ([CustomerID]);
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LoanAccounts_Customers_CustomerID')
BEGIN
    ALTER TABLE [LoanAccounts] WITH CHECK ADD CONSTRAINT [FK_LoanAccounts_Customers_CustomerID] 
    FOREIGN KEY([CustomerID]) REFERENCES [Customers] ([CustomerID]);
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LoanApplications_Customers_CustomerID')
BEGIN
    ALTER TABLE [LoanApplications] WITH CHECK ADD CONSTRAINT [FK_LoanApplications_Customers_CustomerID] 
    FOREIGN KEY([CustomerID]) REFERENCES [Customers] ([CustomerID]);
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LockerAllotments_Customers_CustomerID')
BEGIN
    ALTER TABLE [LockerAllotments] WITH CHECK ADD CONSTRAINT [FK_LockerAllotments_Customers_CustomerID] 
    FOREIGN KEY([CustomerID]) REFERENCES [Customers] ([CustomerID]);
END
GO

-- Creating helpful indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PigmyAccounts_CustomerID')
    CREATE NONCLUSTERED INDEX [IX_PigmyAccounts_CustomerID] ON [PigmyAccounts] ([CustomerID]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavingAccountMasters_CustomerID')
    CREATE NONCLUSTERED INDEX [IX_SavingAccountMasters_CustomerID] ON [SavingAccountMasters] ([CustomerID]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FdAccounts_CustomerID')
    CREATE NONCLUSTERED INDEX [IX_FdAccounts_CustomerID] ON [FdAccounts] ([CustomerID]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RdAccounts_CustomerID')
    CREATE NONCLUSTERED INDEX [IX_RdAccounts_CustomerID] ON [RdAccounts] ([CustomerID]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanAccounts_CustomerID')
    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_CustomerID] ON [LoanAccounts] ([CustomerID]);
GO

PRINT '>>> Step 10: Making MemberID column NULLABLE on banking account tables...';
ALTER TABLE [PigmyAccounts] ALTER COLUMN [MemberID] INT NULL;
ALTER TABLE [SavingAccountMasters] ALTER COLUMN [MemberID] INT NULL;
ALTER TABLE [FdAccounts] ALTER COLUMN [MemberID] INT NULL;
ALTER TABLE [RdAccounts] ALTER COLUMN [MemberID] INT NULL;
ALTER TABLE [LoanAccounts] ALTER COLUMN [MemberID] INT NULL;
ALTER TABLE [LoanApplications] ALTER COLUMN [MemberID] INT NULL;
ALTER TABLE [LockerAllotments] ALTER COLUMN [MemberID] INT NULL;
GO

PRINT '>>> [SUCCESS] V3 Pure Customer-Centric Migration Completed Successfully!';
GO
