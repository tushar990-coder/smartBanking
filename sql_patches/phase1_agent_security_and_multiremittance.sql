-- ============================================================================
-- Phase 1: Agent App Security, Concurrency, and Multi-Product Remittance Patch
-- Safe & Idempotent for Live SmartBanking SQL Server Databases
-- ============================================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

-- 1. PigmyAgents lockout & active session tracking columns
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PigmyAgents')
BEGIN
    IF COL_LENGTH('PigmyAgents', 'FailedLoginAttempts') IS NULL
        ALTER TABLE [dbo].[PigmyAgents] ADD [FailedLoginAttempts] INT NOT NULL DEFAULT 0;
    IF COL_LENGTH('PigmyAgents', 'IsLocked') IS NULL
        ALTER TABLE [dbo].[PigmyAgents] ADD [IsLocked] BIT NOT NULL DEFAULT 0;
    IF COL_LENGTH('PigmyAgents', 'ActiveSessionToken') IS NULL
        ALTER TABLE [dbo].[PigmyAgents] ADD [ActiveSessionToken] NVARCHAR(2000) NULL;
END

-- 2. Remittance link columns on LoanCollections, SavingTransactions, RdTransactions
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LoanCollections')
BEGIN
    IF COL_LENGTH('LoanCollections', 'RemittanceDepositId') IS NULL
        ALTER TABLE [dbo].[LoanCollections] ADD [RemittanceDepositId] INT NULL;
END

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SavingTransactions')
BEGIN
    IF COL_LENGTH('SavingTransactions', 'VoucherID') IS NULL
        ALTER TABLE [dbo].[SavingTransactions] ADD [VoucherID] INT NULL;
    IF COL_LENGTH('SavingTransactions', 'RemittanceDepositId') IS NULL
        ALTER TABLE [dbo].[SavingTransactions] ADD [RemittanceDepositId] INT NULL;
END

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RdTransactions')
BEGIN
    IF COL_LENGTH('RdTransactions', 'RemittanceDepositId') IS NULL
        ALTER TABLE [dbo].[RdTransactions] ADD [RemittanceDepositId] INT NULL;

    -- Allow NULL VoucherID for unremitted mobile RD collections (voucher created at branch remittance)
    IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.RdTransactions')
          AND name = 'VoucherID'
          AND is_nullable = 0
    )
    BEGIN
        ALTER TABLE [dbo].[RdTransactions] ALTER COLUMN [VoucherID] INT NULL;
    END
END

-- 3. Optimistic Concurrency (RowVersion) on Account Master tables
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PigmyAccounts') AND COL_LENGTH('PigmyAccounts', 'RowVersion') IS NULL
    ALTER TABLE [dbo].[PigmyAccounts] ADD [RowVersion] ROWVERSION NOT NULL;

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LoanAccounts') AND COL_LENGTH('LoanAccounts', 'RowVersion') IS NULL
    ALTER TABLE [dbo].[LoanAccounts] ADD [RowVersion] ROWVERSION NOT NULL;

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SavingAccountMasters') AND COL_LENGTH('SavingAccountMasters', 'RowVersion') IS NULL
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [RowVersion] ROWVERSION NOT NULL;

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RdAccounts') AND COL_LENGTH('RdAccounts', 'RowVersion') IS NULL
    ALTER TABLE [dbo].[RdAccounts] ADD [RowVersion] ROWVERSION NOT NULL;

-- 4. Filtered Unique Indexes for Mobile Idempotency
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LoanCollections')
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_LoanCollections_SyncReferenceId' AND object_id = OBJECT_ID('dbo.LoanCollections'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_LoanCollections_SyncReferenceId]
    ON [dbo].[LoanCollections] ([SyncReferenceId])
    WHERE [SyncReferenceId] IS NOT NULL;
END

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SavingTransactions')
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_SavingTransactions_SyncReferenceId' AND object_id = OBJECT_ID('dbo.SavingTransactions'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_SavingTransactions_SyncReferenceId]
    ON [dbo].[SavingTransactions] ([SyncReferenceId])
    WHERE [SyncReferenceId] IS NOT NULL;
END

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RdTransactions')
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_RdTransactions_SyncReferenceId' AND object_id = OBJECT_ID('dbo.RdTransactions'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_RdTransactions_SyncReferenceId]
    ON [dbo].[RdTransactions] ([SyncReferenceId])
    WHERE [SyncReferenceId] IS NOT NULL;
END
GO
