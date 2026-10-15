-- =========================================================================================
-- SmartBanking Core CBS - Vouchers & LoanCollections IBT Schema Fix for Trial Balance
-- Safe, Idempotent, Zero Data Loss Script
-- Adds IsIbtVoucher, RelatedVoucherID, TargetBranchID to Vouchers
-- Adds HomeBranchVoucherID to LoanCollections
-- Adds DefaultIbtLedgerID to Branches
-- =========================================================================================

SET NOCOUNT ON;
PRINT '========================================================================';
PRINT '  Starting Vouchers & LoanCollections IBT Schema Alignment...           ';
PRINT '  Database Context: ' + DB_NAME();
PRINT '========================================================================';

-- 1. Vouchers Table: IsIbtVoucher
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[Vouchers]') AND name = 'IsIbtVoucher')
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [IsIbtVoucher] BIT NOT NULL CONSTRAINT [DF_Vouchers_IsIbtVoucher] DEFAULT 0;
    PRINT 'Added [IsIbtVoucher] to Vouchers';
END
ELSE
BEGIN
    PRINT '[IsIbtVoucher] already exists on Vouchers';
END

-- 2. Vouchers Table: RelatedVoucherID
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[Vouchers]') AND name = 'RelatedVoucherID')
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [RelatedVoucherID] INT NULL;
    PRINT 'Added [RelatedVoucherID] to Vouchers';
END
ELSE
BEGIN
    PRINT '[RelatedVoucherID] already exists on Vouchers';
END

-- 3. Vouchers Table: TargetBranchID
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[Vouchers]') AND name = 'TargetBranchID')
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [TargetBranchID] INT NULL;
    PRINT 'Added [TargetBranchID] to Vouchers';
END
ELSE
BEGIN
    PRINT '[TargetBranchID] already exists on Vouchers';
END

-- 4. LoanCollections Table: HomeBranchVoucherID
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanCollections]') AND name = 'HomeBranchVoucherID')
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [HomeBranchVoucherID] INT NULL;
    PRINT 'Added [HomeBranchVoucherID] to LoanCollections';
END
ELSE
BEGIN
    PRINT '[HomeBranchVoucherID] already exists on LoanCollections';
END

-- 5. Branches Table: DefaultIbtLedgerID
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[Branches]') AND name = 'DefaultIbtLedgerID')
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [DefaultIbtLedgerID] INT NULL;
    PRINT 'Added [DefaultIbtLedgerID] to Branches';
END
ELSE
BEGIN
    PRINT '[DefaultIbtLedgerID] already exists on Branches';
END

-- 6. Branches Table: DefaultCashLedgerID
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[Branches]') AND name = 'DefaultCashLedgerID')
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [DefaultCashLedgerID] INT NULL;
    PRINT 'Added [DefaultCashLedgerID] to Branches';
END

-- 7. High-Performance Indexes for Trial Balance & IBT Queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vouchers_IsIbtVoucher' AND object_id = OBJECT_ID('Vouchers'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Vouchers_IsIbtVoucher] 
    ON [dbo].[Vouchers] ([IsIbtVoucher], [BranchID]) 
    INCLUDE ([VoucherDate], [Status]);
    PRINT 'Created Index IX_Vouchers_IsIbtVoucher';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vouchers_RelatedVoucherID' AND object_id = OBJECT_ID('Vouchers'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Vouchers_RelatedVoucherID] 
    ON [dbo].[Vouchers] ([RelatedVoucherID]);
    PRINT 'Created Index IX_Vouchers_RelatedVoucherID';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LoanCollections_HomeBranchVoucherID' AND object_id = OBJECT_ID('LoanCollections'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanCollections_HomeBranchVoucherID] 
    ON [dbo].[LoanCollections] ([HomeBranchVoucherID]);
    PRINT 'Created Index IX_LoanCollections_HomeBranchVoucherID';
END

PRINT '========================================================================';
PRINT '  Vouchers & LoanCollections IBT Schema Alignment Completed Successfully.';
PRINT '========================================================================';
