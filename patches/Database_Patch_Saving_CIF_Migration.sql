-- ==============================================================================
-- DATABASE SCHEMA PATCH: Saving Accounts CIF-First Migration & Multi-Table Schema
-- Date: 2026-09-05
-- Description:
--   1. Ensures SavingTransactions has CustomerID column
--   2. Ensures SavingAccountJointHolders has CustomerID column and MemberID is nullable
--   3. Ensures Deposit Account tables (SavingAccountMasters, FdAccounts, RdAccounts, PigmyAccounts)
--      have MemberID as nullable to support Non-Member Customer accounts.
-- ==============================================================================

USE [SmartBanking_Bambawade_Inspect]; -- Change database name as applicable
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT 'Applying Database Schema Patch...';
GO

-- 1. SavingTransactions: CustomerID column
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SavingTransactions')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingTransactions') AND name = 'CustomerID')
    BEGIN
        ALTER TABLE [SavingTransactions] ADD [CustomerID] INT NOT NULL DEFAULT 1;
        PRINT '✅ Added CustomerID to SavingTransactions';
    END
END
GO

-- 2. SavingAccountJointHolders: CustomerID column & Nullable MemberID
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SavingAccountJointHolders')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingAccountJointHolders') AND name = 'CustomerID')
    BEGIN
        ALTER TABLE [SavingAccountJointHolders] ADD [CustomerID] INT NULL;
        PRINT '✅ Added CustomerID to SavingAccountJointHolders';
    END

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingAccountJointHolders') AND name = 'MemberID' AND is_nullable = 0)
    BEGIN
        ALTER TABLE [SavingAccountJointHolders] ALTER COLUMN [MemberID] INT NULL;
        PRINT '✅ Altered MemberID to INT NULL on SavingAccountJointHolders';
    END
END
GO

-- 3. SavingAccountMasters: Nullable MemberID
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SavingAccountMasters')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingAccountMasters') AND name = 'MemberID' AND is_nullable = 0)
    BEGIN
        ALTER TABLE [SavingAccountMasters] ALTER COLUMN [MemberID] INT NULL;
        PRINT '✅ Altered MemberID to INT NULL on SavingAccountMasters';
    END
END
GO

-- 4. FdAccounts: Nullable MemberID
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FdAccounts')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FdAccounts') AND name = 'MemberID' AND is_nullable = 0)
    BEGIN
        ALTER TABLE [FdAccounts] ALTER COLUMN [MemberID] INT NULL;
        PRINT '✅ Altered MemberID to INT NULL on FdAccounts';
    END
END
GO

-- 5. RdAccounts: Nullable MemberID
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RdAccounts')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('RdAccounts') AND name = 'MemberID' AND is_nullable = 0)
    BEGIN
        ALTER TABLE [RdAccounts] ALTER COLUMN [MemberID] INT NULL;
        PRINT '✅ Altered MemberID to INT NULL on RdAccounts';
    END
END
GO

-- 6. PigmyAccounts: Nullable MemberID
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PigmyAccounts')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PigmyAccounts') AND name = 'MemberID' AND is_nullable = 0)
    BEGIN
        ALTER TABLE [PigmyAccounts] ALTER COLUMN [MemberID] INT NULL;
        PRINT '✅ Altered MemberID to INT NULL on PigmyAccounts';
    END
END
GO

PRINT '🎉 Database Schema Patch Applied Successfully!';
GO
