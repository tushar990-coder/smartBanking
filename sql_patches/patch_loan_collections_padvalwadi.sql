-- ============================================================================
-- SmartBanking CBS - Database Patch: LoanCollections Schema Resilience
-- Target Databases: SmartBanking_padvalwadi & All Branch Databases
-- Purpose: Ensures all columns in LoanCollections and table LoanCollectionFees exist
-- ============================================================================

USE [SmartBanking_padvalwadi];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

PRINT '>>> Applying LoanCollections and LoanCollectionFees Schema Self-Healing...';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanCollections')
BEGIN
    IF COL_LENGTH('LoanCollections', 'ReceivableInterestCollected') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [ReceivableInterestCollected] decimal(18,2) NOT NULL DEFAULT 0.00;
        PRINT 'Added column ReceivableInterestCollected to LoanCollections';
    END

    IF COL_LENGTH('LoanCollections', 'InterestWaived') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [InterestWaived] decimal(18,2) NOT NULL DEFAULT 0.00;
        PRINT 'Added column InterestWaived to LoanCollections';
    END

    IF COL_LENGTH('LoanCollections', 'PenaltyWaived') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [PenaltyWaived] decimal(18,2) NOT NULL DEFAULT 0.00;
        PRINT 'Added column PenaltyWaived to LoanCollections';
    END

    IF COL_LENGTH('LoanCollections', 'IsOTS') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [IsOTS] bit NOT NULL DEFAULT 0;
        PRINT 'Added column IsOTS to LoanCollections';
    END

    IF COL_LENGTH('LoanCollections', 'ResolutionNo') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [ResolutionNo] nvarchar(100) NULL;
        PRINT 'Added column ResolutionNo to LoanCollections';
    END

    IF COL_LENGTH('LoanCollections', 'ApprovedByUserID') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [ApprovedByUserID] int NULL;
        PRINT 'Added column ApprovedByUserID to LoanCollections';
    END

    IF COL_LENGTH('LoanCollections', 'HomeBranchVoucherID') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [HomeBranchVoucherID] int NULL;
        PRINT 'Added column HomeBranchVoucherID to LoanCollections';
    END

    IF COL_LENGTH('LoanCollections', 'AgentID') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [AgentID] int NULL;
        PRINT 'Added column AgentID to LoanCollections';
    END

    IF COL_LENGTH('LoanCollections', 'CollectionSource') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [CollectionSource] nvarchar(20) NOT NULL DEFAULT 'COUNTER';
        PRINT 'Added column CollectionSource to LoanCollections';
    END

    IF COL_LENGTH('LoanCollections', 'TransactionId') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [TransactionId] nvarchar(100) NULL;
        PRINT 'Added column TransactionId to LoanCollections';
    END

    IF COL_LENGTH('LoanCollections', 'SyncReferenceId') IS NULL
    BEGIN
        ALTER TABLE [dbo].[LoanCollections] ADD [SyncReferenceId] nvarchar(100) NULL;
        PRINT 'Added column SyncReferenceId to LoanCollections';
    END
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanCollectionFees')
BEGIN
    CREATE TABLE [dbo].[LoanCollectionFees] (
        [LoanCollectionFeeID] int NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [LoanCollectionID] int NOT NULL,
        [LedgerID] int NOT NULL,
        [Amount] decimal(18,2) NOT NULL DEFAULT 0.00
    );
    PRINT 'Created table LoanCollectionFees';
END
GO

PRINT '>>> LoanCollections patch executed successfully!';
GO
