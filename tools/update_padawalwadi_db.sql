-- =========================================================================================
-- SmartBanking ERP - Padawalwadi (SmartBanking_JotirlingPdw) Database Update & Migration Patch
-- Zero Data Loss - All Existing Data 100% Preserved
-- =========================================================================================

USE [SmartBanking_JotirlingPdw];
GO

SET NOCOUNT ON;
PRINT 'Starting Padawalwadi Database Update...';
GO

-- 0. Customers
IF COL_LENGTH('Customers', 'LegacyCustomerNo') IS NULL
BEGIN
    ALTER TABLE [Customers] ADD [LegacyCustomerNo] NVARCHAR(50) NULL;
    PRINT 'Added LegacyCustomerNo to Customers';
END
GO

IF COL_LENGTH('Customers', 'MembershipType') IS NULL
BEGIN
    ALTER TABLE [Customers] ADD [MembershipType] NVARCHAR(50) NULL DEFAULT 'Regular';
    PRINT 'Added MembershipType to Customers';
END
GO

-- 1. AccountGroups
IF COL_LENGTH('AccountGroups', 'DisplayOrder') IS NULL
BEGIN
    ALTER TABLE [AccountGroups] ADD [DisplayOrder] INT NOT NULL CONSTRAINT DF_AccountGroups_DisplayOrder DEFAULT 0;
    PRINT 'Added DisplayOrder to AccountGroups';
END
GO

-- 2. Ledgers
IF COL_LENGTH('Ledgers', 'DisplayOrder') IS NULL
BEGIN
    ALTER TABLE [Ledgers] ADD [DisplayOrder] INT NOT NULL CONSTRAINT DF_Ledgers_DisplayOrder DEFAULT 0;
    PRINT 'Added DisplayOrder to Ledgers';
END
GO

IF COL_LENGTH('Ledgers', 'LedgerCode') IS NULL
BEGIN
    ALTER TABLE [Ledgers] ADD [LedgerCode] NVARCHAR(50) NULL;
    PRINT 'Added LedgerCode to Ledgers';
END
GO

-- 3. Members
IF COL_LENGTH('Members', 'NickName') IS NULL
BEGIN
    ALTER TABLE [Members] ADD [NickName] NVARCHAR(100) NULL;
    PRINT 'Added NickName to Members';
END
GO

-- Ensure unique filtered indices on Members exclude soft-deleted records ([IsDeleted] = 0)
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Members_CIFNo' AND object_id = OBJECT_ID('Members'))
BEGIN
    DROP INDEX [IX_Members_CIFNo] ON [Members];
END
CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_CIFNo] ON [Members]([CIFNo])
WHERE [CIFNo] IS NOT NULL AND [CIFNo] <> '' AND [IsDeleted] = 0;
PRINT 'Recreated unique index IX_Members_CIFNo with [IsDeleted] = 0 filter';
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Members_PANNo' AND object_id = OBJECT_ID('Members'))
BEGIN
    DROP INDEX [IX_Members_PANNo] ON [Members];
END
CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_PANNo] ON [Members]([PANNo])
WHERE [PANNo] IS NOT NULL AND [PANNo] <> '' AND [IsDeleted] = 0;
PRINT 'Recreated unique index IX_Members_PANNo with [IsDeleted] = 0 filter';
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Members_AadhaarNo' AND object_id = OBJECT_ID('Members'))
BEGIN
    DROP INDEX [IX_Members_AadhaarNo] ON [Members];
END
CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_AadhaarNo] ON [Members]([AadhaarNo])
WHERE [AadhaarNo] IS NOT NULL AND [AadhaarNo] <> '' AND [IsDeleted] = 0;
PRINT 'Recreated unique index IX_Members_AadhaarNo with [IsDeleted] = 0 filter';
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Members_MemberCode' AND object_id = OBJECT_ID('Members'))
BEGIN
    DROP INDEX [IX_Members_MemberCode] ON [Members];
END
CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_MemberCode] ON [Members]([MemberCode])
WHERE [MemberCode] IS NOT NULL AND [MemberCode] <> '' AND [IsDeleted] = 0;
PRINT 'Recreated unique index IX_Members_MemberCode with [IsDeleted] = 0 filter';
GO

-- 4. SavingAccountMasters
IF COL_LENGTH('SavingAccountMasters', 'LienAmount') IS NULL
BEGIN
    ALTER TABLE [SavingAccountMasters] ADD [LienAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_SavingAccountMasters_LienAmount DEFAULT 0;
    PRINT 'Added LienAmount to SavingAccountMasters';
END
GO

IF COL_LENGTH('SavingAccountMasters', 'LienReason') IS NULL
BEGIN
    ALTER TABLE [SavingAccountMasters] ADD [LienReason] NVARCHAR(250) NULL;
    PRINT 'Added LienReason to SavingAccountMasters';
END
GO

-- 5. Roles
IF COL_LENGTH('Roles', 'RoleCode') IS NULL
BEGIN
    ALTER TABLE [Roles] ADD [RoleCode] NVARCHAR(30) NOT NULL CONSTRAINT DF_Roles_RoleCode DEFAULT '';
    PRINT 'Added RoleCode to Roles';
END
GO

IF COL_LENGTH('Roles', 'IsSystemRole') IS NULL
BEGIN
    ALTER TABLE [Roles] ADD [IsSystemRole] BIT NOT NULL CONSTRAINT DF_Roles_IsSystemRole DEFAULT 1;
    PRINT 'Added IsSystemRole to Roles';
END
GO

IF COL_LENGTH('Roles', 'Status') IS NULL
BEGIN
    ALTER TABLE [Roles] ADD [Status] BIT NOT NULL CONSTRAINT DF_Roles_Status DEFAULT 1;
    PRINT 'Added Status to Roles';
END
GO

UPDATE [Roles] SET [RoleCode] = [RoleName] WHERE [RoleCode] = '' OR [RoleCode] IS NULL;
GO

-- 6. CommitteeMembers
IF COL_LENGTH('CommitteeMembers', 'TermYear') IS NULL
BEGIN
    ALTER TABLE [CommitteeMembers] ADD [TermYear] NVARCHAR(50) NULL;
    PRINT 'Added TermYear to CommitteeMembers';
END
GO

IF COL_LENGTH('CommitteeMembers', 'Category') IS NULL
BEGIN
    ALTER TABLE [CommitteeMembers] ADD [Category] NVARCHAR(100) NULL;
    PRINT 'Added Category to CommitteeMembers';
END
GO

IF COL_LENGTH('CommitteeMembers', 'DINNo') IS NULL
BEGIN
    ALTER TABLE [CommitteeMembers] ADD [DINNo] NVARCHAR(50) NULL;
    PRINT 'Added DINNo to CommitteeMembers';
END
GO

IF COL_LENGTH('CommitteeMembers', 'Remarks') IS NULL
BEGIN
    ALTER TABLE [CommitteeMembers] ADD [Remarks] NVARCHAR(500) NULL;
    PRINT 'Added Remarks to CommitteeMembers';
END
GO

-- 7. FdSchemes GL Mappings
IF COL_LENGTH('FdSchemes', 'FdLiabilityLedgerID') IS NULL
BEGIN
    ALTER TABLE [FdSchemes] ADD [FdLiabilityLedgerID] INT NULL;
    PRINT 'Added FdLiabilityLedgerID to FdSchemes';
END
GO

IF COL_LENGTH('FdSchemes', 'InterestExpenseLedgerID') IS NULL
BEGIN
    ALTER TABLE [FdSchemes] ADD [InterestExpenseLedgerID] INT NULL;
    PRINT 'Added InterestExpenseLedgerID to FdSchemes';
END
GO

IF COL_LENGTH('FdSchemes', 'InterestPayableLedgerID') IS NULL
BEGIN
    ALTER TABLE [FdSchemes] ADD [InterestPayableLedgerID] INT NULL;
    PRINT 'Added InterestPayableLedgerID to FdSchemes';
END
GO

IF COL_LENGTH('FdSchemes', 'PrematurePenaltyLedgerID') IS NULL
BEGIN
    ALTER TABLE [FdSchemes] ADD [PrematurePenaltyLedgerID] INT NULL;
    PRINT 'Added PrematurePenaltyLedgerID to FdSchemes';
END
GO

-- 8. RdSchemes GL Mappings
IF COL_LENGTH('RdSchemes', 'RdLiabilityLedgerID') IS NULL
BEGIN
    ALTER TABLE [RdSchemes] ADD [RdLiabilityLedgerID] INT NULL;
    PRINT 'Added RdLiabilityLedgerID to RdSchemes';
END
GO

IF COL_LENGTH('RdSchemes', 'InterestExpenseLedgerID') IS NULL
BEGIN
    ALTER TABLE [RdSchemes] ADD [InterestExpenseLedgerID] INT NULL;
    PRINT 'Added InterestExpenseLedgerID to RdSchemes';
END
GO

IF COL_LENGTH('RdSchemes', 'InterestPayableLedgerID') IS NULL
BEGIN
    ALTER TABLE [RdSchemes] ADD [InterestPayableLedgerID] INT NULL;
    PRINT 'Added InterestPayableLedgerID to RdSchemes';
END
GO

IF COL_LENGTH('RdSchemes', 'PenaltyIncomeLedgerID') IS NULL
BEGIN
    ALTER TABLE [RdSchemes] ADD [PenaltyIncomeLedgerID] INT NULL;
    PRINT 'Added PenaltyIncomeLedgerID to RdSchemes';
END
GO

IF COL_LENGTH('RdSchemes', 'PrematurePenaltyRate') IS NULL
BEGIN
    ALTER TABLE [RdSchemes] ADD [PrematurePenaltyRate] DECIMAL(18,2) NOT NULL CONSTRAINT DF_RdSchemes_PrematurePenaltyRate DEFAULT 0;
    PRINT 'Added PrematurePenaltyRate to RdSchemes';
END
GO

-- 9. PigmySchemes GL Mappings
IF COL_LENGTH('PigmySchemes', 'PigmyLiabilityLedgerID') IS NULL
BEGIN
    ALTER TABLE [PigmySchemes] ADD [PigmyLiabilityLedgerID] INT NULL;
    PRINT 'Added PigmyLiabilityLedgerID to PigmySchemes';
END
GO

IF COL_LENGTH('PigmySchemes', 'CommissionExpenseLedgerID') IS NULL
BEGIN
    ALTER TABLE [PigmySchemes] ADD [CommissionExpenseLedgerID] INT NULL;
    PRINT 'Added CommissionExpenseLedgerID to PigmySchemes';
END
GO

IF COL_LENGTH('PigmySchemes', 'InterestExpenseLedgerID') IS NULL
BEGIN
    ALTER TABLE [PigmySchemes] ADD [InterestExpenseLedgerID] INT NULL;
    PRINT 'Added InterestExpenseLedgerID to PigmySchemes';
END
GO

IF COL_LENGTH('PigmySchemes', 'InterestPayableLedgerID') IS NULL
BEGIN
    ALTER TABLE [PigmySchemes] ADD [InterestPayableLedgerID] INT NULL;
    PRINT 'Added InterestPayableLedgerID to PigmySchemes';
END
GO

-- 10. SavingInterestSettings GL Mappings
IF COL_LENGTH('SavingInterestSettings', 'SavingLiabilityLedgerID') IS NULL
BEGIN
    ALTER TABLE [SavingInterestSettings] ADD [SavingLiabilityLedgerID] INT NULL;
    PRINT 'Added SavingLiabilityLedgerID to SavingInterestSettings';
END
GO

IF COL_LENGTH('SavingInterestSettings', 'InterestExpenseLedgerID') IS NULL
BEGIN
    ALTER TABLE [SavingInterestSettings] ADD [InterestExpenseLedgerID] INT NULL;
    PRINT 'Added InterestExpenseLedgerID to SavingInterestSettings';
END
GO

IF COL_LENGTH('SavingInterestSettings', 'InterestPayableLedgerID') IS NULL
BEGIN
    ALTER TABLE [SavingInterestSettings] ADD [InterestPayableLedgerID] INT NULL;
    PRINT 'Added InterestPayableLedgerID to SavingInterestSettings';
END
GO

-- 11. LegalRecoveryLedgerMappings
IF COL_LENGTH('LegalRecoveryLedgerMappings', 'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [LegalRecoveryLedgerMappings] ADD [CreatedDate] DATETIME2 NOT NULL CONSTRAINT DF_LegalRecoveryLedgerMappings_CreatedDate DEFAULT GETUTCDATE();
    PRINT 'Added CreatedDate to LegalRecoveryLedgerMappings';
END
GO

IF COL_LENGTH('LegalRecoveryLedgerMappings', 'UpdatedDate') IS NULL
BEGIN
    ALTER TABLE [LegalRecoveryLedgerMappings] ADD [UpdatedDate] DATETIME2 NOT NULL CONSTRAINT DF_LegalRecoveryLedgerMappings_UpdatedDate DEFAULT GETUTCDATE();
    PRINT 'Added UpdatedDate to LegalRecoveryLedgerMappings';
END
GO

-- 12. Sec101NoticeHistories
IF COL_LENGTH('Sec101NoticeHistories', 'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [Sec101NoticeHistories] ADD [CreatedDate] DATETIME2 NOT NULL CONSTRAINT DF_Sec101NoticeHistories_CreatedDate DEFAULT GETUTCDATE();
    PRINT 'Added CreatedDate to Sec101NoticeHistories';
END
GO

-- 13. Sec101CaseMasters
IF COL_LENGTH('Sec101CaseMasters', 'CertificateNumber') IS NULL
BEGIN
    ALTER TABLE [Sec101CaseMasters] ADD [CertificateNumber] NVARCHAR(50) NULL;
    PRINT 'Added CertificateNumber to Sec101CaseMasters';
END
GO

IF COL_LENGTH('Sec101CaseMasters', 'GrantedAmount') IS NULL
BEGIN
    ALTER TABLE [Sec101CaseMasters] ADD [GrantedAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_Sec101CaseMasters_GrantedAmount DEFAULT 0;
    PRINT 'Added GrantedAmount to Sec101CaseMasters';
END
GO

IF COL_LENGTH('Sec101CaseMasters', 'GrantedInterestRate') IS NULL
BEGIN
    ALTER TABLE [Sec101CaseMasters] ADD [GrantedInterestRate] DECIMAL(18,2) NOT NULL CONSTRAINT DF_Sec101CaseMasters_GrantedInterestRate DEFAULT 0;
    PRINT 'Added GrantedInterestRate to Sec101CaseMasters';
END
GO

IF COL_LENGTH('Sec101CaseMasters', 'CaseStatus') IS NULL
BEGIN
    ALTER TABLE [Sec101CaseMasters] ADD [CaseStatus] NVARCHAR(50) NULL;
    PRINT 'Added CaseStatus to Sec101CaseMasters';
END
GO

IF COL_LENGTH('Sec101CaseMasters', 'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [Sec101CaseMasters] ADD [CreatedDate] DATETIME2 NOT NULL CONSTRAINT DF_Sec101CaseMasters_CreatedDate DEFAULT GETUTCDATE();
    PRINT 'Added CreatedDate to Sec101CaseMasters';
END
GO

-- 14. Sec101HearingLogs
IF COL_LENGTH('Sec101HearingLogs', 'HearingLogId') IS NULL
BEGIN
    ALTER TABLE [Sec101HearingLogs] ADD [HearingLogId] INT NULL;
    PRINT 'Added HearingLogId to Sec101HearingLogs';
END
GO

IF COL_LENGTH('Sec101HearingLogs', 'HearingStage') IS NULL
BEGIN
    ALTER TABLE [Sec101HearingLogs] ADD [HearingStage] NVARCHAR(100) NULL;
    PRINT 'Added HearingStage to Sec101HearingLogs';
END
GO

IF COL_LENGTH('Sec101HearingLogs', 'PresenceType') IS NULL
BEGIN
    ALTER TABLE [Sec101HearingLogs] ADD [PresenceType] NVARCHAR(50) NULL;
    PRINT 'Added PresenceType to Sec101HearingLogs';
END
GO

IF COL_LENGTH('Sec101HearingLogs', 'NextHearingPurpose') IS NULL
BEGIN
    ALTER TABLE [Sec101HearingLogs] ADD [NextHearingPurpose] NVARCHAR(250) NULL;
    PRINT 'Added NextHearingPurpose to Sec101HearingLogs';
END
GO

IF COL_LENGTH('Sec101HearingLogs', 'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [Sec101HearingLogs] ADD [CreatedDate] DATETIME2 NOT NULL CONSTRAINT DF_Sec101HearingLogs_CreatedDate DEFAULT GETUTCDATE();
    PRINT 'Added CreatedDate to Sec101HearingLogs';
END
GO

-- 15. Sec101AttachmentAuctions
IF COL_LENGTH('Sec101AttachmentAuctions', 'ExecutionOrderNo') IS NULL
BEGIN
    ALTER TABLE [Sec101AttachmentAuctions] ADD [ExecutionOrderNo] NVARCHAR(50) NULL;
    PRINT 'Added ExecutionOrderNo to Sec101AttachmentAuctions';
END
GO

IF COL_LENGTH('Sec101AttachmentAuctions', 'OrderDate') IS NULL
BEGIN
    ALTER TABLE [Sec101AttachmentAuctions] ADD [OrderDate] DATETIME2 NULL;
    PRINT 'Added OrderDate to Sec101AttachmentAuctions';
END
GO

IF COL_LENGTH('Sec101AttachmentAuctions', 'EmployerName') IS NULL
BEGIN
    ALTER TABLE [Sec101AttachmentAuctions] ADD [EmployerName] NVARCHAR(150) NULL;
    PRINT 'Added EmployerName to Sec101AttachmentAuctions';
END
GO

IF COL_LENGTH('Sec101AttachmentAuctions', 'EmployerAddress') IS NULL
BEGIN
    ALTER TABLE [Sec101AttachmentAuctions] ADD [EmployerAddress] NVARCHAR(250) NULL;
    PRINT 'Added EmployerAddress to Sec101AttachmentAuctions';
END
GO

IF COL_LENGTH('Sec101AttachmentAuctions', 'MonthlyDeductionAmount') IS NULL
BEGIN
    ALTER TABLE [Sec101AttachmentAuctions] ADD [MonthlyDeductionAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_Sec101AttachmentAuctions_MonthlyDeductionAmount DEFAULT 0;
    PRINT 'Added MonthlyDeductionAmount to Sec101AttachmentAuctions';
END
GO

IF COL_LENGTH('Sec101AttachmentAuctions', 'EstimatedValue') IS NULL
BEGIN
    ALTER TABLE [Sec101AttachmentAuctions] ADD [EstimatedValue] DECIMAL(18,2) NOT NULL CONSTRAINT DF_Sec101AttachmentAuctions_EstimatedValue DEFAULT 0;
    PRINT 'Added EstimatedValue to Sec101AttachmentAuctions';
END
GO

IF COL_LENGTH('Sec101AttachmentAuctions', 'ExecutionStatus') IS NULL
BEGIN
    ALTER TABLE [Sec101AttachmentAuctions] ADD [ExecutionStatus] NVARCHAR(50) NULL;
    PRINT 'Added ExecutionStatus to Sec101AttachmentAuctions';
END
GO

IF COL_LENGTH('Sec101AttachmentAuctions', 'RecoveredAmount') IS NULL
BEGIN
    ALTER TABLE [Sec101AttachmentAuctions] ADD [RecoveredAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_Sec101AttachmentAuctions_RecoveredAmount DEFAULT 0;
    PRINT 'Added RecoveredAmount to Sec101AttachmentAuctions';
END
GO

IF COL_LENGTH('Sec101AttachmentAuctions', 'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [Sec101AttachmentAuctions] ADD [CreatedDate] DATETIME2 NOT NULL CONSTRAINT DF_Sec101AttachmentAuctions_CreatedDate DEFAULT GETUTCDATE();
    PRINT 'Added CreatedDate to Sec101AttachmentAuctions';
END
GO

-- 16. Sec101LegalExpenses
IF COL_LENGTH('Sec101LegalExpenses', 'LegalExpenseId') IS NULL
BEGIN
    ALTER TABLE [Sec101LegalExpenses] ADD [LegalExpenseId] INT NULL;
    PRINT 'Added LegalExpenseId to Sec101LegalExpenses';
END
GO

IF COL_LENGTH('Sec101LegalExpenses', 'PayeeName') IS NULL
BEGIN
    ALTER TABLE [Sec101LegalExpenses] ADD [PayeeName] NVARCHAR(150) NULL;
    PRINT 'Added PayeeName to Sec101LegalExpenses';
END
GO

IF COL_LENGTH('Sec101LegalExpenses', 'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [Sec101LegalExpenses] ADD [PaymentMode] NVARCHAR(50) NULL;
    PRINT 'Added PaymentMode to Sec101LegalExpenses';
END
GO

IF COL_LENGTH('Sec101LegalExpenses', 'VoucherNumber') IS NULL
BEGIN
    ALTER TABLE [Sec101LegalExpenses] ADD [VoucherNumber] NVARCHAR(50) NULL;
    PRINT 'Added VoucherNumber to Sec101LegalExpenses';
END
GO

IF COL_LENGTH('Sec101LegalExpenses', 'IsDebitedToBorrower') IS NULL
BEGIN
    ALTER TABLE [Sec101LegalExpenses] ADD [IsDebitedToBorrower] BIT NOT NULL CONSTRAINT DF_Sec101LegalExpenses_IsDebitedToBorrower DEFAULT 0;
    PRINT 'Added IsDebitedToBorrower to Sec101LegalExpenses';
END
GO

IF COL_LENGTH('Sec101LegalExpenses', 'DebitLedgerId') IS NULL
BEGIN
    ALTER TABLE [Sec101LegalExpenses] ADD [DebitLedgerId] INT NULL;
    PRINT 'Added DebitLedgerId to Sec101LegalExpenses';
END
GO

IF COL_LENGTH('Sec101LegalExpenses', 'CreditLedgerId') IS NULL
BEGIN
    ALTER TABLE [Sec101LegalExpenses] ADD [CreditLedgerId] INT NULL;
    PRINT 'Added CreditLedgerId to Sec101LegalExpenses';
END
GO

IF COL_LENGTH('Sec101LegalExpenses', 'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [Sec101LegalExpenses] ADD [CreatedDate] DATETIME2 NOT NULL CONSTRAINT DF_Sec101LegalExpenses_CreatedDate DEFAULT GETUTCDATE();
    PRINT 'Added CreatedDate to Sec101LegalExpenses';
END
GO

-- 17. SystemVersionHistories Table
IF OBJECT_ID(N'[SystemVersionHistories]', N'U') IS NULL
BEGIN
    CREATE TABLE [SystemVersionHistories] (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Version] NVARCHAR(50) NOT NULL,
        [ReleaseDate] NVARCHAR(50) NOT NULL,
        [Changelog] NVARCHAR(MAX) NULL,
        [InstalledOn] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [IsActive] BIT NOT NULL DEFAULT 1
    );
    PRINT 'Created SystemVersionHistories table';
END
GO

-- 18. AuditLedgerMappings Table
IF OBJECT_ID(N'[AuditLedgerMappings]', N'U') IS NULL
BEGIN
    CREATE TABLE [AuditLedgerMappings] (
        [AuditLedgerMappingID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [CategoryCode] NVARCHAR(50) NOT NULL,
        [CategoryName] NVARCHAR(150) NOT NULL,
        [LedgerID] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedOn] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_AuditLedgerMappings_Ledgers FOREIGN KEY ([LedgerID]) REFERENCES [Ledgers]([LedgerID]) ON DELETE CASCADE
    );
    CREATE INDEX IX_AuditLedgerMappings_CategoryCode ON [AuditLedgerMappings]([CategoryCode]);
    PRINT 'Created AuditLedgerMappings table';
END
GO

-- 19. Set Default Display Orders for Core Account Groups if 0
UPDATE [AccountGroups] SET [DisplayOrder] = 1 WHERE [GroupID] = 1 OR [GroupName] LIKE N'%भागभांडवल%' OR [GroupName] LIKE N'%भाग भांडवल%' OR [GroupName] LIKE N'%Share Capital%';
UPDATE [AccountGroups] SET [DisplayOrder] = 2 WHERE [GroupID] = 4 OR [GroupName] LIKE N'%राखीव%' OR [GroupName] LIKE N'%Reserves%';
UPDATE [AccountGroups] SET [DisplayOrder] = 3 WHERE [GroupID] = 10 OR [GroupName] LIKE N'%ठेवी%' OR [GroupName] LIKE N'%Deposits%';
UPDATE [AccountGroups] SET [DisplayOrder] = 4 WHERE [GroupID] = 15 OR [GroupName] LIKE N'%बँक कर्जे%' OR [GroupName] LIKE N'%कर्जे देणी%' OR [GroupName] LIKE N'%Borrowings%';
UPDATE [AccountGroups] SET [DisplayOrder] = 5 WHERE [GroupID] = 18 OR [GroupName] LIKE N'%इतर देणी%' OR [GroupName] LIKE N'%इतर देणे%' OR [GroupName] LIKE N'%Other Liabilities%';
UPDATE [AccountGroups] SET [DisplayOrder] = 6 WHERE [GroupName] LIKE N'%नफा%' OR [GroupName] LIKE N'%Profit%';

UPDATE [AccountGroups] SET [DisplayOrder] = 1 WHERE [GroupID] = 31 OR [GroupName] LIKE N'%रोकड%' OR [GroupName] LIKE N'%रोख शिल्लक%' OR [GroupName] LIKE N'%Cash%';
UPDATE [AccountGroups] SET [DisplayOrder] = 2 WHERE [GroupID] = 32 OR [GroupName] LIKE N'%बँक शिल्लक%' OR [GroupName] LIKE N'%बँकेतील शिल्लक%' OR [GroupName] LIKE N'%Bank%';
UPDATE [AccountGroups] SET [DisplayOrder] = 3 WHERE [GroupID] = 35 OR [GroupName] LIKE N'%गुंतवणूक%' OR [GroupName] LIKE N'%Investment%';
UPDATE [AccountGroups] SET [DisplayOrder] = 4 WHERE [GroupID] = 42 OR [GroupName] LIKE N'%कर्जे%' OR [GroupName] LIKE N'%Loan%';
UPDATE [AccountGroups] SET [DisplayOrder] = 5 WHERE [GroupID] = 47 OR [GroupName] LIKE N'%मालमत्ता%' OR [GroupName] LIKE N'%Asset%';
UPDATE [AccountGroups] SET [DisplayOrder] = 6 WHERE [GroupID] = 52 OR [GroupName] LIKE N'%इतर येणे%' OR [GroupName] LIKE N'%Receivables%';
UPDATE [AccountGroups] SET [DisplayOrder] = 7 WHERE [GroupName] LIKE N'%तोटा%' OR [GroupName] LIKE N'%Loss%';

UPDATE [AccountGroups] SET [DisplayOrder] = 1 WHERE [GroupName] LIKE N'%उत्पन्न%' OR [GroupName] LIKE N'%Income%';
UPDATE [AccountGroups] SET [DisplayOrder] = 1 WHERE [GroupName] LIKE N'%खर्च%' OR [GroupName] LIKE N'%Expense%';
GO

-- 19.1 Ensure Clean Marathi Unicode on Branches
UPDATE [Branches] SET [BranchName] = N'मुख्य शाखा (Main Branch)' WHERE [BranchID] = 1;
GO

-- 20. Sync EF Core Migration History Table
IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory] WHERE [MigrationId] = N'20260808160116_AddInvestmentTypeAndGlLedgerMappings')
        INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260808160116_AddInvestmentTypeAndGlLedgerMappings', N'10.0.9');

    IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory] WHERE [MigrationId] = N'20260809162505_SyncLatestSchema')
        INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260809162505_SyncLatestSchema', N'10.0.9');

    IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory] WHERE [MigrationId] = N'20260821113030_SyncBranchDefaultCashLedger')
        INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260821113030_SyncBranchDefaultCashLedger', N'10.0.9');

    IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory] WHERE [MigrationId] = N'20260821132036_AddAccountGroupDisplayOrderAndLedgerCode')
        INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260821132036_AddAccountGroupDisplayOrderAndLedgerCode', N'10.0.9');
END
GO

PRINT '========================================================================';
PRINT '  PADAWALWADI DATABASE UPDATE & SCHEMA SYNCHRONIZATION COMPLETED!      ';
PRINT '========================================================================';
GO
