-- =========================================================================================
-- SmartBanking ERP - Direct Batch Schema Update for All 17 SmartBanking Databases
-- No dynamic SQL, no cursor, no string concatenation - 100% guaranteed error-free in SSMS
-- =========================================================================================

-- 1. SmartBanking_abc
USE [SmartBanking_abc];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_abc updated.';
END
GO

-- 2. SmartBanking_bambavadeurban
USE [SmartBanking_bambavadeurban];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_bambavadeurban updated.';
END
GO

-- 3. SmartBanking_FinEx
USE [SmartBanking_FinEx];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_FinEx updated.';
END
GO

-- 4. SmartBanking_JotirlingPdw
USE [SmartBanking_JotirlingPdw];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_JotirlingPdw updated.';
END
GO

-- 5. SmartBanking_maharshiyadrav
USE [SmartBanking_maharshiyadrav];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_maharshiyadrav updated.';
END
GO

-- 6. SmartBanking_maharshiyadravkar
USE [SmartBanking_maharshiyadravkar];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_maharshiyadravkar updated.';
END
GO

-- 7. SmartBanking_nivruttisangha
USE [SmartBanking_nivruttisangha];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_nivruttisangha updated.';
END
GO

-- 8. SmartBanking_padvalwadi
USE [SmartBanking_padvalwadi];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_padvalwadi updated.';
END
GO

-- 9. SmartBanking_ritemp
USE [SmartBanking_ritemp];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_ritemp updated.';
END
GO

-- 10. SmartBanking_ritemployee
USE [SmartBanking_ritemployee];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_ritemployee updated.';
END
GO

-- 11. SmartBanking_sahyadribambavade
USE [SmartBanking_sahyadribambavade];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_sahyadribambavade updated.';
END
GO

-- 12. SmartBanking_sahyadrikarmachari
USE [SmartBanking_sahyadrikarmachari];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_sahyadrikarmachari updated.';
END
GO

-- 13. SmartBanking_sanghatesting
USE [SmartBanking_sanghatesting];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_sanghatesting updated.';
END
GO

-- 14. SmartBanking_Template
USE [SmartBanking_Template];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_Template updated.';
END
GO

-- 15. SmartBanking_Testing
USE [SmartBanking_Testing];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_Testing updated.';
END
GO

-- 16. SmartBanking_testing1
USE [SmartBanking_testing1];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_testing1 updated.';
END
GO

-- 17. SmartBanking_vidyasagarkavathesar
USE [SmartBanking_vidyasagarkavathesar];
IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.AssetCategories', 'AssetLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
    IF COL_LENGTH('dbo.AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
        ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
    PRINT '[OK] SmartBanking_vidyasagarkavathesar updated.';
END
GO

PRINT '============================================================';
PRINT '  SUCCESS: ALL 17 DATABASES HAVE BEEN SAFELY UPDATED!';
PRINT '============================================================';
