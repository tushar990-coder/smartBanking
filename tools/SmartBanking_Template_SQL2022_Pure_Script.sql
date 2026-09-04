-- =========================================================================================
-- SmartBanking Core ERP - 100% Pure SQL Server 2022 Template Database Deployment Script
-- Generated Date: 2026-09-03 14.49.34
-- Zero Mismatch Guarantee: Runs cleanly on SQL Server 2022, 2019, 2016 and Azure SQL
-- Preserved Masters: AccountGroups (à¤–à¤¾à¤¤à¥‡ à¤—à¤Ÿ), Ledgers (à¤–à¤¾à¤¤à¥‡ à¤®à¤¾à¤¹à¤¿à¤¤à¥€), Users, Roles, Branches
-- Cleared: All transactional data, customer records, account balances & opening balances
-- =========================================================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

DECLARE @dbName NVARCHAR(128) = DB_NAME();
PRINT '========================================================================';
PRINT '  Deploying SmartBanking ERP Template Database to: ' + @dbName;
PRINT '========================================================================';
GO

-- -----------------------------------------------------------------------------------------
-- Table: [__SystemVersionHistory]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[__SystemVersionHistory]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[__SystemVersionHistory] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [VersionNumber] nvarchar(50) NOT NULL,
        [AppliedOn] datetime2 NOT NULL DEFAULT (getutcdate()),
        [PatchName] nvarchar(200) NOT NULL DEFAULT (''),
        [Status] nvarchar(20) NOT NULL DEFAULT ('SUCCESS'),
        [Remarks] nvarchar(MAX) NULL,
        [AppliedBy] nvarchar(100) NULL,
        CONSTRAINT [PK____System__3214EC0716EE5E27] PRIMARY KEY CLUSTERED ([Id])
    );
    PRINT 'Created table [__SystemVersionHistory]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AccountGroups]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AccountGroups]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AccountGroups] (
        [GroupID] int IDENTITY(1,1) NOT NULL,
        [GroupName] nvarchar(100) NOT NULL,
        [ParentGroupID] int NULL,
        [NatureOfGroup] nvarchar(50) NOT NULL,
        [IsActive] bit NOT NULL,
        [LegacyGroupId] int NULL,
        [GroupNameEnglish] nvarchar(100) NULL,
        [DisplayOrder] int NOT NULL DEFAULT ((0)),
        [GroupCode] nvarchar(50) NULL,
        CONSTRAINT [PK_AccountGroups] PRIMARY KEY CLUSTERED ([GroupID])
    );
    PRINT 'Created table [AccountGroups]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AgentCustomerRequests]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AgentCustomerRequests]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AgentCustomerRequests] (
        [RequestID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [PigmyAgentID] int NULL,
        [AgentName] nvarchar(100) NULL,
        [FirstName] nvarchar(50) NOT NULL,
        [MiddleName] nvarchar(50) NULL,
        [LastName] nvarchar(50) NOT NULL,
        [FirstNameEng] nvarchar(50) NULL,
        [MiddleNameEng] nvarchar(50) NULL,
        [LastNameEng] nvarchar(50) NULL,
        [Gender] nvarchar(10) NULL DEFAULT ('Male'),
        [BirthDate] datetime2 NULL,
        [Occupation] nvarchar(100) NULL,
        [CasteCategory] nvarchar(50) NULL,
        [MobileNo] nvarchar(15) NULL,
        [Email] nvarchar(100) NULL,
        [AadhaarNo] nvarchar(12) NULL,
        [PANNo] nvarchar(10) NULL,
        [Address] nvarchar(500) NULL,
        [AddressEng] nvarchar(500) NULL,
        [Village] nvarchar(100) NULL,
        [Taluka] nvarchar(100) NULL,
        [District] nvarchar(100) NULL,
        [Pincode] nvarchar(10) NULL,
        [NomineeName] nvarchar(150) NULL,
        [NomineeNameEng] nvarchar(150) NULL,
        [NomineeRelation] nvarchar(50) NULL,
        [NomineeAddress] nvarchar(500) NULL,
        [NomineeBirthDate] datetime2 NULL,
        [NomineeAge] int NULL,
        [PhotoPath] nvarchar(MAX) NULL,
        [SignaturePath] nvarchar(MAX) NULL,
        [AadhaarDocPath] nvarchar(MAX) NULL,
        [PanDocPath] nvarchar(MAX) NULL,
        [OpenPigmyAccount] bit NOT NULL DEFAULT ((1)),
        [PigmySchemeID] int NULL,
        [DailyDepositAmount] decimal(18, 2) NOT NULL DEFAULT ((100)),
        [InitialDepositAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [Remarks] nvarchar(500) NULL,
        [Status] nvarchar(20) NOT NULL DEFAULT ('Pending'),
        [RequestDate] datetime2 NOT NULL DEFAULT (getdate()),
        [ApprovalDate] datetime2 NULL,
        [ApprovedByUserID] int NULL,
        [CreatedMemberID] int NULL,
        [CreatedPigmyAccountID] int NULL,
        [RejectionReason] nvarchar(500) NULL,
        CONSTRAINT [PK__AgentCus__33A8519A226010D3] PRIMARY KEY CLUSTERED ([RequestID])
    );
    PRINT 'Created table [AgentCustomerRequests]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AssetAllocations]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AssetAllocations]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AssetAllocations] (
        [AllocationID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [AssetID] int NOT NULL,
        [AllocatedBranchID] int NOT NULL,
        [AllocationDate] datetime2 NOT NULL,
        [Department] nvarchar(100) NOT NULL,
        [CustodianName] nvarchar(150) NOT NULL,
        [Remarks] nvarchar(500) NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_AssetAllocations] PRIMARY KEY CLUSTERED ([AllocationID])
    );
    PRINT 'Created table [AssetAllocations]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AssetCategories]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AssetCategories]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AssetCategories] (
        [CategoryID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [CategoryCode] nvarchar(20) NOT NULL,
        [CategoryName] nvarchar(100) NOT NULL,
        [UsefulLifeMonths] int NOT NULL,
        [DepreciationRate] decimal(5, 2) NOT NULL,
        [DepreciationMethod] nvarchar(10) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_AssetCategories] PRIMARY KEY CLUSTERED ([CategoryID])
    );
    PRINT 'Created table [AssetCategories]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AssetDepreciations]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AssetDepreciations]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AssetDepreciations] (
        [DepreciationID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [AssetID] int NOT NULL,
        [CalculationDate] datetime2 NOT NULL,
        [Method] nvarchar(10) NOT NULL,
        [Rate] decimal(5, 2) NOT NULL,
        [DepreciationAmount] decimal(18, 2) NOT NULL,
        [BookValueBefore] decimal(18, 2) NOT NULL,
        [BookValueAfter] decimal(18, 2) NOT NULL,
        [VoucherID] int NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_AssetDepreciations] PRIMARY KEY CLUSTERED ([DepreciationID])
    );
    PRINT 'Created table [AssetDepreciations]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AssetDisposals]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AssetDisposals]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AssetDisposals] (
        [DisposalID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [AssetID] int NOT NULL,
        [DisposalDate] datetime2 NOT NULL,
        [DisposalType] nvarchar(30) NOT NULL,
        [BookValueAtDisposal] decimal(18, 2) NOT NULL,
        [SaleAmount] decimal(18, 2) NOT NULL,
        [ProfitOrLoss] decimal(18, 2) NOT NULL,
        [BuyerName] nvarchar(150) NULL,
        [VoucherID] int NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_AssetDisposals] PRIMARY KEY CLUSTERED ([DisposalID])
    );
    PRINT 'Created table [AssetDisposals]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AssetMaintenances]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AssetMaintenances]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AssetMaintenances] (
        [MaintenanceID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [AssetID] int NOT NULL,
        [MaintenanceDate] datetime2 NOT NULL,
        [MaintenanceType] nvarchar(30) NOT NULL,
        [ServiceProvider] nvarchar(150) NOT NULL,
        [Cost] decimal(18, 2) NOT NULL,
        [Remarks] nvarchar(500) NULL,
        [NextServiceDate] datetime2 NULL,
        [VoucherID] int NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_AssetMaintenances] PRIMARY KEY CLUSTERED ([MaintenanceID])
    );
    PRINT 'Created table [AssetMaintenances]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AssetPurchases]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AssetPurchases]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AssetPurchases] (
        [PurchaseID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [SupplierName] nvarchar(150) NOT NULL,
        [InvoiceNo] nvarchar(50) NOT NULL,
        [InvoiceDate] datetime2 NOT NULL,
        [TaxableAmount] decimal(18, 2) NOT NULL,
        [GstAmount] decimal(18, 2) NOT NULL,
        [TotalAmount] decimal(18, 2) NOT NULL,
        [PaymentMode] nvarchar(30) NOT NULL,
        [BankLedgerID] int NULL,
        [VoucherID] int NULL,
        [AssetIdsJson] nvarchar(MAX) NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_AssetPurchases] PRIMARY KEY CLUSTERED ([PurchaseID])
    );
    PRINT 'Created table [AssetPurchases]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Assets]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Assets]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Assets] (
        [AssetID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [CategoryID] int NOT NULL,
        [AssetCode] nvarchar(30) NOT NULL,
        [AssetName] nvarchar(150) NOT NULL,
        [PurchaseDate] datetime2 NOT NULL,
        [OriginalCost] decimal(18, 2) NOT NULL,
        [AccumulatedDepreciation] decimal(18, 2) NOT NULL,
        [CurrentBookValue] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [Location] nvarchar(100) NULL,
        [Custodian] nvarchar(100) NULL,
        [IsOpeningBalance] bit NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_Assets] PRIMARY KEY CLUSTERED ([AssetID])
    );
    PRINT 'Created table [Assets]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AssetTransfers]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AssetTransfers]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AssetTransfers] (
        [TransferID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [AssetID] int NOT NULL,
        [FromBranchID] int NOT NULL,
        [ToBranchID] int NOT NULL,
        [TransferDate] datetime2 NOT NULL,
        [FromCustodian] nvarchar(150) NOT NULL,
        [ToCustodian] nvarchar(150) NOT NULL,
        [Remarks] nvarchar(500) NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_AssetTransfers] PRIMARY KEY CLUSTERED ([TransferID])
    );
    PRINT 'Created table [AssetTransfers]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AssetVerifications]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AssetVerifications]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AssetVerifications] (
        [VerificationID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [AssetID] int NOT NULL,
        [VerificationDate] datetime2 NOT NULL,
        [AuditorName] nvarchar(100) NOT NULL,
        [PhysicalStatus] nvarchar(30) NOT NULL,
        [Remarks] nvarchar(500) NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_AssetVerifications] PRIMARY KEY CLUSTERED ([VerificationID])
    );
    PRINT 'Created table [AssetVerifications]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AuditLedgerMappings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AuditLedgerMappings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AuditLedgerMappings] (
        [AuditLedgerMappingID] int IDENTITY(1,1) NOT NULL,
        [CategoryCode] nvarchar(50) NOT NULL,
        [CategoryName] nvarchar(150) NOT NULL,
        [LedgerID] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL DEFAULT (getutcdate()),
        [UpdatedOn] datetime2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK__AuditLed__ED4F654C7BB05806] PRIMARY KEY CLUSTERED ([AuditLedgerMappingID])
    );
    PRINT 'Created table [AuditLedgerMappings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [AuditLogs]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[AuditLogs]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AuditLogs] (
        [AuditLogID] bigint IDENTITY(1,1) NOT NULL,
        [UserID] int NULL,
        [Username] nvarchar(100) NOT NULL,
        [Action] nvarchar(100) NOT NULL,
        [EntityName] nvarchar(100) NOT NULL,
        [EntityID] nvarchar(50) NULL,
        [Timestamp] datetime2 NOT NULL DEFAULT (getdate()),
        [IPAddress] nvarchar(50) NULL,
        [Details] nvarchar(MAX) NULL,
        [Status] nvarchar(20) NOT NULL DEFAULT ('SUCCESS'),
        CONSTRAINT [PK__AuditLog__EB5F6CDD4183B671] PRIMARY KEY CLUSTERED ([AuditLogID])
    );
    PRINT 'Created table [AuditLogs]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [BankMasters]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[BankMasters]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[BankMasters] (
        [BankID] int IDENTITY(1,1) NOT NULL,
        [BankName] nvarchar(100) NOT NULL,
        CONSTRAINT [PK_BankMasters] PRIMARY KEY CLUSTERED ([BankID])
    );
    PRINT 'Created table [BankMasters]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [BorrowerLinkedAccounts]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[BorrowerLinkedAccounts]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[BorrowerLinkedAccounts] (
        [BorrowerLinkedAccountID] int IDENTITY(1,1) NOT NULL,
        [ParentMemberID] int NOT NULL,
        [LinkedMemberID] int NOT NULL,
        [LinkType] nvarchar(50) NOT NULL,
        [Remarks] nvarchar(250) NULL,
        CONSTRAINT [PK_BorrowerLinkedAccounts] PRIMARY KEY CLUSTERED ([BorrowerLinkedAccountID])
    );
    PRINT 'Created table [BorrowerLinkedAccounts]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [BranchDayEndStatuses]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[BranchDayEndStatuses]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[BranchDayEndStatuses] (
        [StatusID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL,
        [BusinessDate] datetime2 NOT NULL,
        [IsDayClosed] bit NOT NULL,
        CONSTRAINT [PK_BranchDayEndStatuses] PRIMARY KEY CLUSTERED ([StatusID])
    );
    PRINT 'Created table [BranchDayEndStatuses]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Branches]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Branches]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Branches] (
        [BranchID] int IDENTITY(1,1) NOT NULL,
        [BranchCode] nvarchar(10) NOT NULL,
        [BranchName] nvarchar(100) NOT NULL,
        [Address] nvarchar(200) NULL,
        [IFSCCode] nvarchar(20) NULL,
        [IsActive] bit NOT NULL,
        [BranchType] nvarchar(20) NOT NULL DEFAULT ('Branch'),
        [MobileNo] nvarchar(15) NULL,
        [Email] nvarchar(100) NULL,
        [DefaultCashLedgerID] int NULL,
        CONSTRAINT [PK_Branches] PRIMARY KEY CLUSTERED ([BranchID])
    );
    PRINT 'Created table [Branches]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [BranchMasters]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[BranchMasters]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[BranchMasters] (
        [BranchID] int IDENTITY(1,1) NOT NULL,
        [BranchCode] nvarchar(20) NOT NULL,
        [BranchName] nvarchar(100) NOT NULL,
        [Address] nvarchar(255) NULL,
        [City] nvarchar(50) NULL,
        [District] nvarchar(50) NULL,
        [State] nvarchar(50) NULL,
        [Pincode] nvarchar(10) NULL,
        [MobileNo] nvarchar(15) NULL,
        [Email] nvarchar(100) NULL,
        [Status] bit NOT NULL,
        [CreatedBy] int NULL,
        [CreatedDate] datetime2 NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        [BranchType] nvarchar(20) NOT NULL DEFAULT ('Branch'),
        CONSTRAINT [PK_BranchMasters] PRIMARY KEY CLUSTERED ([BranchID])
    );
    PRINT 'Created table [BranchMasters]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [CashAllocations]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[CashAllocations]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[CashAllocations] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [BranchId] int NULL,
        [FromCashierId] int NULL,
        [ToCashierId] int NOT NULL,
        [Amount] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [AllocationDate] datetime2 NOT NULL DEFAULT (getdate()),
        [AllocationType] nvarchar(50) NOT NULL DEFAULT ('HEAD_TO_TELLER'),
        [Status] nvarchar(20) NOT NULL DEFAULT ('ACCEPTED'),
        [Remarks] nvarchar(250) NULL,
        [IsReturn] bit NOT NULL DEFAULT ((0)),
        [CreatedBy] nvarchar(100) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK__CashAllo__3214EC0752793849] PRIMARY KEY CLUSTERED ([Id])
    );
    PRINT 'Created table [CashAllocations]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [CashDenominations]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[CashDenominations]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[CashDenominations] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [BranchId] int NULL,
        [CashierId] int NOT NULL,
        [DenominationDate] datetime2 NOT NULL DEFAULT (getdate()),
        [EntryType] nvarchar(50) NOT NULL DEFAULT ('CLOSING'),
        [Count2000] int NOT NULL DEFAULT ((0)),
        [Count500] int NOT NULL DEFAULT ((0)),
        [Count200] int NOT NULL DEFAULT ((0)),
        [Count100] int NOT NULL DEFAULT ((0)),
        [Count50] int NOT NULL DEFAULT ((0)),
        [Count20] int NOT NULL DEFAULT ((0)),
        [Count10] int NOT NULL DEFAULT ((0)),
        [Count5] int NOT NULL DEFAULT ((0)),
        [CountCoins] int NOT NULL DEFAULT ((0)),
        [TotalAmount] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [ExpectedAmount] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [DifferenceAmount] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [DifferenceType] nvarchar(20) NOT NULL DEFAULT ('MATCHED'),
        [Remarks] nvarchar(250) NULL,
        [VerifiedBy] nvarchar(100) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK__CashDeno__3214EC075C02A283] PRIMARY KEY CLUSTERED ([Id])
    );
    PRINT 'Created table [CashDenominations]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [CashierBalances]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[CashierBalances]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[CashierBalances] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [BranchId] int NULL,
        [CashierId] int NOT NULL,
        [BalanceDate] datetime2 NOT NULL DEFAULT (getdate()),
        [OpeningBalance] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [ReceivedFromHead] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [TotalReceipts] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [TotalPayments] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [ReturnedToHead] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [ClosingBalance] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [PhysicalCashTally] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [CashDifference] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [Status] nvarchar(20) NOT NULL DEFAULT ('OPEN'),
        [LastUpdated] datetime2 NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK__CashierB__3214EC076F1576F7] PRIMARY KEY CLUSTERED ([Id])
    );
    PRINT 'Created table [CashierBalances]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Cashiers]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Cashiers]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Cashiers] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [BranchId] int NULL,
        [CashierName] nvarchar(100) NOT NULL,
        [CounterNumber] nvarchar(50) NOT NULL DEFAULT (N'à¤•à¥…à¤¶ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤° à¥§'),
        [UserId] int NULL,
        [IsActive] bit NOT NULL DEFAULT ((1)),
        [IsHeadCashier] bit NOT NULL DEFAULT ((0)),
        [MaxCashLimit] decimal(18, 2) NOT NULL DEFAULT ((500000.00)),
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        [CashLedgerId] int NULL,
        CONSTRAINT [PK__Cashiers__3214EC0749E3F248] PRIMARY KEY CLUSTERED ([Id])
    );
    PRINT 'Created table [Cashiers]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [CashManagementSettings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[CashManagementSettings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[CashManagementSettings] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [BranchId] int NULL,
        [MainVaultLedgerId] int NULL,
        [CashShortageLedgerId] int NULL,
        [CashExcessLedgerId] int NULL,
        [AutoGenerateVouchers] bit NOT NULL DEFAULT ((0)),
        [EnableDenominationMandatory] bit NOT NULL DEFAULT ((1)),
        [MaxBranchVaultLimit] decimal(18, 2) NOT NULL DEFAULT ((5000000.00)),
        [DefaultCounterLimit] decimal(18, 2) NOT NULL DEFAULT ((500000.00)),
        [Remarks] nvarchar(250) NULL,
        [LastUpdated] datetime2 NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK__CashMana__3214EC077D63964E] PRIMARY KEY CLUSTERED ([Id])
    );
    PRINT 'Created table [CashManagementSettings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [CollateralComplianceLogs]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[CollateralComplianceLogs]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[CollateralComplianceLogs] (
        [CollateralComplianceLogID] int IDENTITY(1,1) NOT NULL,
        [LoanAccountID] int NOT NULL,
        [CollateralType] nvarchar(50) NOT NULL,
        [ValuationDate] datetime2 NOT NULL,
        [ValuationValue] decimal(18, 2) NOT NULL,
        [ValuersCount] int NOT NULL,
        [LastInspectionDate] datetime2 NOT NULL,
        [InsuranceExpiryDate] datetime2 NOT NULL,
        [LastStockStatementDate] datetime2 NULL,
        [IsAuditorVerified] bit NOT NULL,
        [IsMarginMaintained] bit NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [CollateralDescription] nvarchar(MAX) NULL,
        [CollateralValue] decimal(18, 2) NULL,
        [InspectorName] nvarchar(100) NULL,
        [MarginPercent] decimal(5, 2) NULL,
        [Remarks] nvarchar(500) NULL,
        CONSTRAINT [PK_CollateralComplianceLogs] PRIMARY KEY CLUSTERED ([CollateralComplianceLogID])
    );
    PRINT 'Created table [CollateralComplianceLogs]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [CommitteeMembers]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[CommitteeMembers]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[CommitteeMembers] (
        [CommitteeMemberID] int IDENTITY(1,1) NOT NULL,
        [MemberID] int NOT NULL,
        [Designation] nvarchar(100) NOT NULL,
        [JoiningDate] datetime2 NOT NULL,
        [EndDate] datetime2 NULL,
        [ResolutionNo] nvarchar(100) NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [CreatedBy] nvarchar(100) NOT NULL,
        [UpdatedOn] datetime2 NOT NULL,
        [UpdatedBy] nvarchar(100) NOT NULL,
        [TermYear] nvarchar(50) NULL,
        [Category] nvarchar(100) NULL,
        [DINNo] nvarchar(50) NULL,
        [Remarks] nvarchar(500) NULL,
        CONSTRAINT [PK_CommitteeMembers] PRIMARY KEY CLUSTERED ([CommitteeMemberID])
    );
    PRINT 'Created table [CommitteeMembers]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [CustomerOpeningBalances]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[CustomerOpeningBalances]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[CustomerOpeningBalances] (
        [CustomerOpeningBalanceID] int IDENTITY(1,1) NOT NULL,
        [CustomerID] int NOT NULL,
        [LedgerID] int NOT NULL,
        [Amount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [BalanceType] nvarchar(2) NOT NULL DEFAULT ('Dr'),
        [CreatedBy] int NOT NULL DEFAULT ((1)),
        [CreatedOn] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_CustomerOpeningBalances] PRIMARY KEY CLUSTERED ([CustomerOpeningBalanceID])
    );
    PRINT 'Created table [CustomerOpeningBalances]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Customers]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Customers]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Customers] (
        [CustomerID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [CIFNo] nvarchar(20) NOT NULL,
        [FirstName] nvarchar(50) NOT NULL,
        [MiddleName] nvarchar(50) NULL,
        [LastName] nvarchar(50) NOT NULL,
        [NickName] nvarchar(100) NULL,
        [FirstNameEng] nvarchar(50) NULL,
        [MiddleNameEng] nvarchar(50) NULL,
        [LastNameEng] nvarchar(50) NULL,
        [Address] nvarchar(500) NULL,
        [AddressEng] nvarchar(500) NULL,
        [Village] nvarchar(100) NULL,
        [Taluka] nvarchar(100) NULL,
        [District] nvarchar(100) NULL,
        [MobileNo] nvarchar(15) NULL,
        [AadhaarNo] nvarchar(12) NULL,
        [PANNo] nvarchar(10) NULL,
        [RegistrationDate] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
        [NomineeName] nvarchar(150) NULL,
        [NomineeNameEng] nvarchar(150) NULL,
        [NomineeRelation] nvarchar(50) NULL,
        [NomineeAddress] nvarchar(500) NULL,
        [NomineeBirthDate] datetime2 NULL,
        [NomineeIsMinor] bit NOT NULL DEFAULT ((0)),
        [NomineeGuardianName] nvarchar(150) NULL,
        [PhotoPath] nvarchar(MAX) NULL,
        [SignaturePath] nvarchar(MAX) NULL,
        [AadhaarDocPath] nvarchar(MAX) NULL,
        [PanDocPath] nvarchar(MAX) NULL,
        [Gender] nvarchar(10) NULL,
        [BirthDate] datetime2 NULL,
        [Occupation] nvarchar(100) NULL,
        [CasteCategory] nvarchar(50) NULL,
        [Caste] nvarchar(100) NULL,
        [Email] nvarchar(150) NULL,
        [IsMinor] bit NOT NULL DEFAULT ((0)),
        [GuardianName] nvarchar(150) NULL,
        [GuardianNameEng] nvarchar(150) NULL,
        [GuardianRelation] nvarchar(50) NULL,
        [GuardianAadhaarNo] nvarchar(12) NULL,
        [GuardianMobileNo] nvarchar(15) NULL,
        [GuardianAddress] nvarchar(500) NULL,
        [Status] nvarchar(20) NOT NULL DEFAULT ('Active'),
        [EmployerId] int NULL,
        [IsDeleted] bit NOT NULL DEFAULT ((0)),
        [CreatedBy] int NOT NULL DEFAULT ((1)),
        [CreatedOn] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_Customers] PRIMARY KEY CLUSTERED ([CustomerID])
    );
    PRINT 'Created table [Customers]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [DeceasedClaimSettlements]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[DeceasedClaimSettlements]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[DeceasedClaimSettlements] (
        [ClaimID] int IDENTITY(1,1) NOT NULL,
        [MemberID] int NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [DeathDate] datetime2 NOT NULL DEFAULT (CONVERT([date],getdate(),0)),
        [DeathCertificateNo] nvarchar(100) NULL,
        [NomineeName] nvarchar(150) NOT NULL,
        [NomineeRelation] nvarchar(50) NULL,
        [NomineeAadhaarNo] nvarchar(12) NULL,
        [NomineeMobileNo] nvarchar(15) NULL,
        [NomineeBankAccount] nvarchar(100) NULL,
        [TotalSavingsBalance] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [TotalFdBalance] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [TotalRdBalance] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [TotalPigmyBalance] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [TotalShareAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [TotalLoanLiability] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [NetPayableAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [ResolutionNo] nvarchar(100) NULL,
        [ResolutionDate] datetime2 NULL,
        [VoucherID] int NULL,
        [Status] nvarchar(20) NOT NULL DEFAULT ('Settled'),
        [SettlementDate] datetime2 NOT NULL DEFAULT (CONVERT([date],getdate(),0)),
        [Remarks] nvarchar(500) NULL,
        [CreatedBy] int NOT NULL DEFAULT ((1)),
        [CreatedOn] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
        CONSTRAINT [PK__Deceased__EF2E13BB05C3D225] PRIMARY KEY CLUSTERED ([ClaimID])
    );
    PRINT 'Created table [DeceasedClaimSettlements]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [DemandMemberDetails]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[DemandMemberDetails]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[DemandMemberDetails] (
        [DemandMemberDetailId] int IDENTITY(1,1) NOT NULL,
        [DemandNoticeId] int NOT NULL,
        [MemberId] int NOT NULL,
        [LoanInstallment] decimal(18, 2) NOT NULL,
        [SavingDeposit] decimal(18, 2) NOT NULL,
        [ShareDeposit] decimal(18, 2) NOT NULL,
        [PigmyDeposit] decimal(18, 2) NOT NULL,
        [RdDeposit] decimal(18, 2) NOT NULL,
        [TotalDeduction] decimal(18, 2) NOT NULL,
        [IsProcessed] bit NOT NULL,
        CONSTRAINT [PK_DemandMemberDetails] PRIMARY KEY CLUSTERED ([DemandMemberDetailId])
    );
    PRINT 'Created table [DemandMemberDetails]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [DemandNotices]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[DemandNotices]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[DemandNotices] (
        [DemandNoticeId] int IDENTITY(1,1) NOT NULL,
        [NoticeNumber] nvarchar(50) NOT NULL,
        [Month] int NOT NULL,
        [Year] int NOT NULL,
        [EmployerId] int NOT NULL,
        [BranchId] int NOT NULL,
        [TotalDemandAmount] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [CreatedBy] int NOT NULL,
        CONSTRAINT [PK_DemandNotices] PRIMARY KEY CLUSTERED ([DemandNoticeId])
    );
    PRINT 'Created table [DemandNotices]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [DemandRecoveries]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[DemandRecoveries]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[DemandRecoveries] (
        [DemandRecoveryId] int IDENTITY(1,1) NOT NULL,
        [DemandNoticeId] int NOT NULL,
        [RecoveryDate] datetime2 NOT NULL,
        [TotalReceivedAmount] decimal(18, 2) NOT NULL,
        [VoucherId] int NULL,
        [Remarks] nvarchar(250) NULL,
        [CreatedDate] datetime2 NOT NULL,
        [CreatedBy] int NOT NULL,
        CONSTRAINT [PK_DemandRecoveries] PRIMARY KEY CLUSTERED ([DemandRecoveryId])
    );
    PRINT 'Created table [DemandRecoveries]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [DepartmentMasters]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[DepartmentMasters]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[DepartmentMasters] (
        [DepartmentID] int IDENTITY(1,1) NOT NULL,
        [DepartmentCode] nvarchar(20) NOT NULL,
        [DepartmentName] nvarchar(100) NOT NULL,
        [Description] nvarchar(255) NULL,
        [Status] bit NOT NULL,
        [CreatedBy] int NULL,
        [CreatedDate] datetime2 NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        CONSTRAINT [PK_DepartmentMasters] PRIMARY KEY CLUSTERED ([DepartmentID])
    );
    PRINT 'Created table [DepartmentMasters]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [DividendDistributions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[DividendDistributions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[DividendDistributions] (
        [DividendId] int IDENTITY(1,1) NOT NULL,
        [ShareAccountId] int NOT NULL,
        [FinancialYear] nvarchar(20) NOT NULL,
        [DividendPercentage] decimal(5, 2) NOT NULL,
        [DividendAmount] decimal(18, 2) NOT NULL,
        [PayoutDate] datetime2 NOT NULL,
        [IsPaid] bit NOT NULL,
        [VoucherId] int NULL,
        CONSTRAINT [PK_DividendDistributions] PRIMARY KEY CLUSTERED ([DividendId])
    );
    PRINT 'Created table [DividendDistributions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [EmployeeBankDetails]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[EmployeeBankDetails]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[EmployeeBankDetails] (
        [EmployeeBankDetailID] int IDENTITY(1,1) NOT NULL,
        [CIFNo] nvarchar(20) NOT NULL,
        [EmployeeID] nvarchar(50) NOT NULL,
        [DepartmentID] int NOT NULL,
        [JoiningDate] datetime2 NOT NULL,
        [EmployeeStatus] nvarchar(20) NOT NULL,
        [MobileNumber] nvarchar(15) NULL,
        [BankName] nvarchar(100) NOT NULL,
        [IFSCCode] nvarchar(20) NOT NULL,
        [AccountNumber] nvarchar(50) NOT NULL,
        [AccountType] nvarchar(20) NOT NULL,
        [BranchID] int NOT NULL,
        [CreatedBy] int NULL,
        [CreatedDate] datetime2 NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        CONSTRAINT [PK_EmployeeBankDetails] PRIMARY KEY CLUSTERED ([EmployeeBankDetailID])
    );
    PRINT 'Created table [EmployeeBankDetails]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [EmployerMasters]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[EmployerMasters]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[EmployerMasters] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [ContactNo] nvarchar(50) NULL,
        [LegacyTypeId] int NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        [Address] nvarchar(500) NULL,
        CONSTRAINT [PK_EmployerMasters] PRIMARY KEY CLUSTERED ([Id])
    );
    PRINT 'Created table [EmployerMasters]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [EodBatchProcessLogs]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[EodBatchProcessLogs]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[EodBatchProcessLogs] (
        [LogID] bigint IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL,
        [BusinessDate] datetime2 NOT NULL,
        [StepNumber] int NOT NULL,
        [StepName] nvarchar(100) NOT NULL,
        [Status] nvarchar(20) NOT NULL DEFAULT ('SUCCESS'),
        [RecordsProcessed] int NOT NULL DEFAULT ((0)),
        [ErrorMessage] nvarchar(MAX) NULL,
        [StartTime] datetime2 NOT NULL DEFAULT (getdate()),
        [EndTime] datetime2 NULL,
        CONSTRAINT [PK__EodBatch__5E5499A846486B8E] PRIMARY KEY CLUSTERED ([LogID])
    );
    PRINT 'Created table [EodBatchProcessLogs]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [FdAccounts]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[FdAccounts]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[FdAccounts] (
        [FdAccountID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [MemberID] int NOT NULL,
        [FdSchemeID] int NOT NULL,
        [AccountNo] nvarchar(30) NOT NULL,
        [OpeningDate] datetime2 NOT NULL,
        [DepositAmount] decimal(18, 2) NOT NULL,
        [InterestRate] decimal(5, 2) NOT NULL,
        [MaturityDate] datetime2 NOT NULL,
        [MaturityAmount] decimal(18, 2) NOT NULL,
        [IsLegacyAccount] bit NOT NULL,
        [LegacyAccruedInt] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [NomineeName] nvarchar(100) NULL,
        [NomineeRelation] nvarchar(50) NULL,
        [Remarks] nvarchar(250) NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        [LegacyAccountId] int NULL,
        [LegacyAccountNumber] nvarchar(50) NULL,
        [PaymentMode] nvarchar(20) NOT NULL DEFAULT ('Cash'),
        [BankAccountLedgerID] int NULL,
        [ChequeNo] nvarchar(50) NULL,
        [ChequeDate] datetime2 NULL,
        [SavingAccountID] int NULL,
        [CustomerID] int NULL,
        CONSTRAINT [PK_FdAccounts] PRIMARY KEY CLUSTERED ([FdAccountID])
    );
    PRINT 'Created table [FdAccounts]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [FdAccountSequences]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[FdAccountSequences]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[FdAccountSequences] (
        [SequenceID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL,
        [ProductType] nvarchar(10) NOT NULL,
        [CurrentValue] int NOT NULL,
        CONSTRAINT [PK_FdAccountSequences] PRIMARY KEY CLUSTERED ([SequenceID])
    );
    PRINT 'Created table [FdAccountSequences]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [FdInterestAccruals]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[FdInterestAccruals]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[FdInterestAccruals] (
        [AccrualID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [FdAccountID] int NOT NULL,
        [VoucherID] int NOT NULL,
        [AccrualDate] datetime2 NOT NULL,
        [CalculatedDays] int NOT NULL,
        [InterestAmount] decimal(18, 2) NOT NULL,
        [IsPosted] bit NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_FdInterestAccruals] PRIMARY KEY CLUSTERED ([AccrualID])
    );
    PRINT 'Created table [FdInterestAccruals]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [FdSchemes]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[FdSchemes]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[FdSchemes] (
        [FdSchemeID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [SchemeCode] nvarchar(20) NOT NULL,
        [SchemeName] nvarchar(100) NOT NULL,
        [DurationMonths] int NOT NULL,
        [InterestRate] decimal(5, 2) NOT NULL,
        [SeniorCitizenInterestRate] decimal(5, 2) NOT NULL,
        [InterestType] nvarchar(20) NOT NULL,
        [InterestPostingMethod] nvarchar(20) NOT NULL,
        [InterestCompoundingFrequency] nvarchar(20) NOT NULL,
        [MinimumAmount] decimal(18, 2) NOT NULL,
        [MaximumAmount] decimal(18, 2) NOT NULL,
        [PrematureInterestRate] decimal(5, 2) NOT NULL,
        [EffectiveDate] datetime2 NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        [FdLiabilityLedgerID] int NULL,
        [InterestExpenseLedgerID] int NULL,
        [InterestPayableLedgerID] int NULL,
        [PrematurePenaltyLedgerID] int NULL,
        CONSTRAINT [PK_FdSchemes] PRIMARY KEY CLUSTERED ([FdSchemeID])
    );
    PRINT 'Created table [FdSchemes]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [FdTransactions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[FdTransactions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[FdTransactions] (
        [FdTransactionID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [FdAccountID] int NOT NULL,
        [VoucherID] int NOT NULL,
        [TransactionDate] datetime2 NOT NULL,
        [TransactionType] nvarchar(20) NOT NULL,
        [DebitCredit] nvarchar(2) NOT NULL,
        [Amount] decimal(18, 2) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_FdTransactions] PRIMARY KEY CLUSTERED ([FdTransactionID])
    );
    PRINT 'Created table [FdTransactions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [FinancialYears]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[FinancialYears]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[FinancialYears] (
        [FinancialYearID] int IDENTITY(1,1) NOT NULL,
        [YearCode] nvarchar(50) NOT NULL,
        [StartDate] datetime2 NOT NULL,
        [EndDate] datetime2 NOT NULL,
        [IsActive] bit NOT NULL,
        [IsClosed] bit NOT NULL,
        CONSTRAINT [PK_FinancialYears] PRIMARY KEY CLUSTERED ([FinancialYearID])
    );
    PRINT 'Created table [FinancialYears]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [GoldLoanDetails]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[GoldLoanDetails]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[GoldLoanDetails] (
        [GoldLoanDetailID] int IDENTITY(1,1) NOT NULL,
        [LoanAccountID] int NOT NULL,
        [OrnamentName] nvarchar(200) NOT NULL,
        [Quantity] int NOT NULL,
        [GrossWeight] decimal(18, 3) NOT NULL,
        [NetWeight] decimal(18, 3) NOT NULL,
        [Purity] decimal(18, 2) NOT NULL,
        [GoldRatePerGram] decimal(18, 2) NOT NULL,
        [EstimatedValue] decimal(18, 2) NOT NULL,
        [ImagePath] nvarchar(500) NULL,
        CONSTRAINT [PK_GoldLoanDetails] PRIMARY KEY CLUSTERED ([GoldLoanDetailID])
    );
    PRINT 'Created table [GoldLoanDetails]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [InvestmentAccounts]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[InvestmentAccounts]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[InvestmentAccounts] (
        [InvestmentAccountID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [InvestmentInstitutionID] int NOT NULL,
        [SchemeID] int NOT NULL,
        [InvestmentNo] nvarchar(30) NOT NULL,
        [InvestmentDate] datetime2 NOT NULL,
        [PrincipalAmount] decimal(18, 2) NOT NULL,
        [InterestRate] decimal(5, 2) NOT NULL,
        [MaturityDate] datetime2 NOT NULL,
        [ExpectedMaturityAmount] decimal(18, 2) NOT NULL,
        [AccruedInterestTillMigration] decimal(18, 2) NOT NULL,
        [BookValue] decimal(18, 2) NOT NULL,
        [IsLegacyAccount] bit NOT NULL,
        [NomineeName] nvarchar(100) NULL,
        [NomineeRelation] nvarchar(50) NULL,
        [Remarks] nvarchar(250) NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        [DepositReceiptNo] nvarchar(50) NULL,
        CONSTRAINT [PK_InvestmentAccounts] PRIMARY KEY CLUSTERED ([InvestmentAccountID])
    );
    PRINT 'Created table [InvestmentAccounts]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [InvestmentAccountSequences]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[InvestmentAccountSequences]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[InvestmentAccountSequences] (
        [SequenceID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL,
        [ProductType] nvarchar(10) NOT NULL,
        [CurrentValue] int NOT NULL,
        CONSTRAINT [PK_InvestmentAccountSequences] PRIMARY KEY CLUSTERED ([SequenceID])
    );
    PRINT 'Created table [InvestmentAccountSequences]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [InvestmentInstitutions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[InvestmentInstitutions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[InvestmentInstitutions] (
        [InstitutionID] int IDENTITY(1,1) NOT NULL,
        [InstitutionMasterID] int NOT NULL,
        [BranchID] int NOT NULL,
        [InstitutionName] nvarchar(150) NOT NULL,
        [InstitutionType] nvarchar(50) NOT NULL,
        [InstitutionBranchName] nvarchar(100) NOT NULL,
        [Address] nvarchar(250) NULL,
        [ContactPerson] nvarchar(100) NULL,
        [MobileNumber] nvarchar(15) NULL,
        [EmailID] nvarchar(100) NULL,
        [IsActive] bit NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        CONSTRAINT [PK_InvestmentInstitutions] PRIMARY KEY CLUSTERED ([InstitutionID])
    );
    PRINT 'Created table [InvestmentInstitutions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [InvestmentInterestAccruals]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[InvestmentInterestAccruals]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[InvestmentInterestAccruals] (
        [AccrualID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [InvestmentAccountID] int NOT NULL,
        [AccrualDate] datetime2 NOT NULL,
        [InterestAmount] decimal(18, 2) NOT NULL,
        [VoucherID] int NULL,
        [IsPosted] bit NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_InvestmentInterestAccruals] PRIMARY KEY CLUSTERED ([AccrualID])
    );
    PRINT 'Created table [InvestmentInterestAccruals]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [InvestmentInterestReceipts]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[InvestmentInterestReceipts]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[InvestmentInterestReceipts] (
        [ReceiptID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [InvestmentAccountID] int NOT NULL,
        [ReceiptDate] datetime2 NOT NULL,
        [ReceivedAmount] decimal(18, 2) NOT NULL,
        [VoucherID] int NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_InvestmentInterestReceipts] PRIMARY KEY CLUSTERED ([ReceiptID])
    );
    PRINT 'Created table [InvestmentInterestReceipts]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [InvestmentMaturities]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[InvestmentMaturities]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[InvestmentMaturities] (
        [MaturityID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [InvestmentAccountID] int NOT NULL,
        [MaturityDate] datetime2 NOT NULL,
        [PrincipalReceived] decimal(18, 2) NOT NULL,
        [InterestReceived] decimal(18, 2) NOT NULL,
        [TotalReceived] decimal(18, 2) NOT NULL,
        [VoucherID] int NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_InvestmentMaturities] PRIMARY KEY CLUSTERED ([MaturityID])
    );
    PRINT 'Created table [InvestmentMaturities]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [InvestmentPrematureWithdrawals]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[InvestmentPrematureWithdrawals]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[InvestmentPrematureWithdrawals] (
        [WithdrawalID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [InvestmentAccountID] int NOT NULL,
        [WithdrawalDate] datetime2 NOT NULL,
        [PrincipalPaid] decimal(18, 2) NOT NULL,
        [RevisedInterestRate] decimal(5, 2) NOT NULL,
        [InterestPaid] decimal(18, 2) NOT NULL,
        [PenaltyAmount] decimal(18, 2) NOT NULL,
        [NetPayout] decimal(18, 2) NOT NULL,
        [VoucherID] int NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_InvestmentPrematureWithdrawals] PRIMARY KEY CLUSTERED ([WithdrawalID])
    );
    PRINT 'Created table [InvestmentPrematureWithdrawals]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [InvestmentRenewals]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[InvestmentRenewals]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[InvestmentRenewals] (
        [RenewalID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [OldInvestmentAccountID] int NOT NULL,
        [NewInvestmentAccountID] int NOT NULL,
        [RenewalType] nvarchar(30) NOT NULL,
        [RenewalAmount] decimal(18, 2) NOT NULL,
        [RenewalDate] datetime2 NOT NULL,
        [VoucherID] int NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_InvestmentRenewals] PRIMARY KEY CLUSTERED ([RenewalID])
    );
    PRINT 'Created table [InvestmentRenewals]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [InvestmentSchemes]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[InvestmentSchemes]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[InvestmentSchemes] (
        [SchemeID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [InvestmentInstitutionID] int NOT NULL,
        [SchemeCode] nvarchar(20) NOT NULL,
        [SchemeName] nvarchar(100) NOT NULL,
        [InterestRate] decimal(5, 2) NOT NULL,
        [DurationMonths] int NOT NULL,
        [InterestCalculationMethod] nvarchar(50) NOT NULL,
        [PrematureWithdrawalRate] decimal(5, 2) NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        [InterestIncomeLedgerID] int NULL,
        [InterestReceivableLedgerID] int NULL,
        [InvestmentAssetLedgerID] int NULL,
        [InvestmentType] nvarchar(30) NOT NULL DEFAULT (N''),
        CONSTRAINT [PK_InvestmentSchemes] PRIMARY KEY CLUSTERED ([SchemeID])
    );
    PRINT 'Created table [InvestmentSchemes]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [InvestmentVoucherMappings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[InvestmentVoucherMappings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[InvestmentVoucherMappings] (
        [MappingID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [InvestmentType] nvarchar(50) NOT NULL,
        [InvestmentLedgerID] int NOT NULL,
        [InterestIncomeLedgerID] int NOT NULL,
        [InterestReceivableLedgerID] int NOT NULL,
        CONSTRAINT [PK_InvestmentVoucherMappings] PRIMARY KEY CLUSTERED ([MappingID])
    );
    PRINT 'Created table [InvestmentVoucherMappings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [JointMembers]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[JointMembers]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[JointMembers] (
        [JointMemberID] int IDENTITY(1,1) NOT NULL,
        [PrimaryMemberID] int NOT NULL,
        [JointMemberCode] nvarchar(30) NULL,
        [FirstName] nvarchar(50) NOT NULL,
        [MiddleName] nvarchar(50) NULL,
        [LastName] nvarchar(50) NOT NULL,
        [FirstNameEng] nvarchar(50) NULL,
        [MiddleNameEng] nvarchar(50) NULL,
        [LastNameEng] nvarchar(50) NULL,
        [RelationWithPrimary] nvarchar(50) NOT NULL DEFAULT ('Spouse'),
        [AadhaarNo] nvarchar(12) NULL,
        [PANNo] nvarchar(10) NULL,
        [MobileNo] nvarchar(15) NULL,
        [Address] nvarchar(500) NULL,
        [PhotoPath] nvarchar(MAX) NULL,
        [SignaturePath] nvarchar(MAX) NULL,
        [Status] nvarchar(20) NOT NULL DEFAULT ('Active'),
        [IsDeleted] bit NOT NULL DEFAULT ((0)),
        [CreatedBy] int NOT NULL DEFAULT ((1)),
        [CreatedOn] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK__JointMem__79956D2E7C3A67EB] PRIMARY KEY CLUSTERED ([JointMemberID])
    );
    PRINT 'Created table [JointMembers]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Ledgers]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Ledgers]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Ledgers] (
        [LedgerID] int IDENTITY(1,1) NOT NULL,
        [LedgerName] nvarchar(100) NOT NULL,
        [GroupID] int NOT NULL,
        [OpeningBalance] decimal(18, 2) NOT NULL,
        [OpeningBalanceType] nvarchar(2) NOT NULL,
        [ReportType] nvarchar(100) NULL,
        [AccountType] nvarchar(100) NULL,
        [ExcludeFromRule35Swanidhi] bit NOT NULL,
        [IsActive] bit NOT NULL,
        [LegacyLedgerId] int NULL,
        [LedgerNameEnglish] nvarchar(100) NULL,
        [DisplayOrder] int NOT NULL DEFAULT ((0)),
        [LedgerCode] nvarchar(50) NULL,
        CONSTRAINT [PK_Ledgers] PRIMARY KEY CLUSTERED ([LedgerID])
    );
    PRINT 'Created table [Ledgers]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LegalRecoveryLedgerMappings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LegalRecoveryLedgerMappings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LegalRecoveryLedgerMappings] (
        [MappingId] int IDENTITY(1,1) NOT NULL,
        [BranchId] int NOT NULL DEFAULT ((1)),
        [TransactionType] nvarchar(50) NOT NULL DEFAULT ('LEGAL_RECOVERY'),
        [DebitLedgerId] int NOT NULL DEFAULT ((0)),
        [CreditLedgerId] int NOT NULL DEFAULT ((0)),
        [IsActive] bit NOT NULL DEFAULT ((1)),
        [NoticeFeeLedgerId] int NULL,
        [CourtFeeLedgerId] int NULL,
        [AdvocateFeeLedgerId] int NULL,
        [AuctionExpenseLedgerId] int NULL,
        [MiscellaneousExpenseLedgerId] int NULL,
        [LegalCostRecoveryLedgerId] int NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        [UpdatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        [UpdatedAt] datetime2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK__LegalRec__8B57819D20ACD28B] PRIMARY KEY CLUSTERED ([MappingId])
    );
    PRINT 'Created table [LegalRecoveryLedgerMappings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LoanAccountNpaStatuses]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LoanAccountNpaStatuses]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LoanAccountNpaStatuses] (
        [LoanAccountNpaStatusID] int IDENTITY(1,1) NOT NULL,
        [LoanAccountID] int NOT NULL,
        [AsOfDate] datetime2 NOT NULL,
        [OverdueDate] datetime2 NULL,
        [OutOfOrderDate] datetime2 NULL,
        [Category] nvarchar(50) NOT NULL,
        [SecurityType] nvarchar(50) NOT NULL,
        [OutstandingBalance] decimal(18, 2) NOT NULL,
        [CompliantCollateralValue] decimal(18, 2) NOT NULL,
        [ProvisionRequired] decimal(18, 2) NOT NULL,
        [ProvisionHeld] decimal(18, 2) NOT NULL,
        [IsAutoClassified] bit NOT NULL,
        [LastClassificationRunId] int NOT NULL,
        [AuditorRemarks] nvarchar(500) NULL,
        CONSTRAINT [PK_LoanAccountNpaStatuses] PRIMARY KEY CLUSTERED ([LoanAccountNpaStatusID])
    );
    PRINT 'Created table [LoanAccountNpaStatuses]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LoanAccounts]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LoanAccounts]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LoanAccounts] (
        [LoanAccountID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL,
        [LoanApplicationID] int NULL,
        [MemberID] int NOT NULL,
        [CoMemberID] int NULL,
        [CoMember2ID] int NULL,
        [LoanRateID] int NOT NULL,
        [LoanAccountNo] nvarchar(50) NOT NULL,
        [PrincipalBalance] decimal(18, 2) NOT NULL,
        [InterestBalance] decimal(18, 2) NOT NULL,
        [OverdueInterestBalance] decimal(18, 2) NOT NULL,
        [OpeningDate] datetime2 NOT NULL,
        [LoanDisbursementDate] datetime2 NULL,
        [SanctionedAmount] decimal(18, 2) NOT NULL,
        [InterestRate] decimal(18, 2) NOT NULL,
        [DurationMonths] int NOT NULL,
        [InstallmentAmount] decimal(18, 2) NOT NULL,
        [FirstInstallmentDate] datetime2 NULL,
        [MaturityDate] datetime2 NULL,
        [InstallmentFrequency] nvarchar(50) NOT NULL,
        [LastInstallmentPaidDate] datetime2 NULL,
        [NoOfInstallments] int NOT NULL,
        [RecommendedByDirectorID] int NULL,
        [Guarantor1MemberID] int NULL,
        [Guarantor2MemberID] int NULL,
        [SecurityDetails] nvarchar(500) NULL,
        [SecurityValue] decimal(18, 2) NOT NULL,
        [IsOpeningBalance] bit NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [LegacyAccountId] int NULL,
        [LegacyAccountNumber] nvarchar(50) NULL,
        [CustomerID] int NULL,
        CONSTRAINT [PK_LoanAccounts] PRIMARY KEY CLUSTERED ([LoanAccountID])
    );
    PRINT 'Created table [LoanAccounts]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LoanApplications]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LoanApplications]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LoanApplications] (
        [LoanApplicationID] int IDENTITY(1,1) NOT NULL,
        [ApplicationNo] nvarchar(50) NOT NULL,
        [ApplicationDate] datetime2 NOT NULL,
        [MemberID] int NOT NULL,
        [CoMemberID] int NULL,
        [CoMember2ID] int NULL,
        [LoanRateID] int NOT NULL,
        [RequestedAmount] decimal(18, 2) NOT NULL,
        [InterestRate] decimal(18, 2) NOT NULL,
        [DurationMonths] int NOT NULL,
        [InstallmentFrequency] nvarchar(50) NOT NULL,
        [InstallmentAmount] decimal(18, 2) NOT NULL,
        [NoOfInstallments] int NOT NULL,
        [FirstInstallmentDate] datetime2 NULL,
        [MaturityDate] datetime2 NULL,
        [RecommendedByDirectorID] int NULL,
        [Purpose] nvarchar(200) NULL,
        [Guarantor1MemberID] int NULL,
        [Guarantor2MemberID] int NULL,
        [SecurityDetails] nvarchar(500) NULL,
        [SecurityValue] decimal(18, 2) NOT NULL,
        [LoanAccountNo] nvarchar(50) NULL,
        [CustomerID] int NULL,
        CONSTRAINT [PK_LoanApplications] PRIMARY KEY CLUSTERED ([LoanApplicationID])
    );
    PRINT 'Created table [LoanApplications]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LoanCollectionFees]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LoanCollectionFees]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LoanCollectionFees] (
        [LoanCollectionFeeID] int IDENTITY(1,1) NOT NULL,
        [LoanCollectionID] int NOT NULL,
        [LedgerID] int NOT NULL,
        [Amount] decimal(18, 2) NOT NULL,
        CONSTRAINT [PK_LoanCollectionFees] PRIMARY KEY CLUSTERED ([LoanCollectionFeeID])
    );
    PRINT 'Created table [LoanCollectionFees]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LoanCollections]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LoanCollections]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LoanCollections] (
        [LoanCollectionID] int IDENTITY(1,1) NOT NULL,
        [LoanAccountID] int NOT NULL,
        [CollectionDate] datetime2 NOT NULL,
        [ReceiptNo] nvarchar(50) NOT NULL,
        [TotalAmountReceived] decimal(18, 2) NOT NULL,
        [SurchargeCollected] decimal(18, 2) NOT NULL,
        [PenaltyInterestCollected] decimal(18, 2) NOT NULL,
        [InterestCollected] decimal(18, 2) NOT NULL,
        [PrincipalCollected] decimal(18, 2) NOT NULL,
        [PaymentMode] nvarchar(50) NOT NULL,
        [BankName] nvarchar(100) NULL,
        [ChequeNo] nvarchar(50) NULL,
        [BankAccountLedgerID] int NULL,
        [TransferFromSavingAccountNo] nvarchar(50) NULL,
        [VoucherID] int NULL,
        [Remarks] nvarchar(200) NULL,
        [InterestWaived] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [PenaltyWaived] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [IsOTS] bit NOT NULL DEFAULT ((0)),
        [ResolutionNo] nvarchar(100) NULL,
        [ApprovedByUserID] int NULL,
        CONSTRAINT [PK_LoanCollections] PRIMARY KEY CLUSTERED ([LoanCollectionID])
    );
    PRINT 'Created table [LoanCollections]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LoanDisbursementDeductions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LoanDisbursementDeductions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LoanDisbursementDeductions] (
        [LoanDisbursementDeductionID] int IDENTITY(1,1) NOT NULL,
        [LoanDisbursementID] int NOT NULL,
        [LedgerID] int NOT NULL,
        [Amount] decimal(18, 2) NOT NULL,
        CONSTRAINT [PK_LoanDisbursementDeductions] PRIMARY KEY CLUSTERED ([LoanDisbursementDeductionID])
    );
    PRINT 'Created table [LoanDisbursementDeductions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LoanDisbursements]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LoanDisbursements]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LoanDisbursements] (
        [LoanDisbursementID] int IDENTITY(1,1) NOT NULL,
        [LoanAccountID] int NOT NULL,
        [DisbursementDate] datetime2 NOT NULL,
        [SanctionedAmount] decimal(18, 2) NOT NULL,
        [DisbursementAmount] decimal(18, 2) NOT NULL,
        [ProcessingFee] decimal(18, 2) NOT NULL,
        [ShareDeduction] decimal(18, 2) NOT NULL,
        [InsuranceDeduction] decimal(18, 2) NOT NULL,
        [StationeryCharges] decimal(18, 2) NOT NULL,
        [OtherDeductions] decimal(18, 2) NOT NULL,
        [NetAmountPaid] decimal(18, 2) NOT NULL,
        [PaymentMode] nvarchar(50) NOT NULL,
        [BankName] nvarchar(100) NULL,
        [ChequeNo] nvarchar(50) NULL,
        [BankAccountLedgerID] int NULL,
        [TransferToSavingAccountNo] nvarchar(50) NULL,
        [VoucherID] int NULL,
        [Remarks] nvarchar(200) NULL,
        [LoanInstallmentType] nvarchar(100) NULL,
        CONSTRAINT [PK_LoanDisbursements] PRIMARY KEY CLUSTERED ([LoanDisbursementID])
    );
    PRINT 'Created table [LoanDisbursements]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LoanDocuments]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LoanDocuments]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LoanDocuments] (
        [LoanDocumentID] int IDENTITY(1,1) NOT NULL,
        [LoanAccountID] int NOT NULL,
        [DocumentType] nvarchar(100) NOT NULL,
        [DocumentName] nvarchar(200) NOT NULL,
        [FilePath] nvarchar(500) NOT NULL,
        [UploadedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_LoanDocuments] PRIMARY KEY CLUSTERED ([LoanDocumentID])
    );
    PRINT 'Created table [LoanDocuments]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LoanInstallmentSchedules]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LoanInstallmentSchedules]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LoanInstallmentSchedules] (
        [ScheduleID] int IDENTITY(1,1) NOT NULL,
        [LoanAccountID] int NOT NULL,
        [InstallmentNo] int NOT NULL,
        [DueDate] datetime2 NOT NULL,
        [PrincipalAmount] decimal(18, 2) NOT NULL,
        [InterestAmount] decimal(18, 2) NOT NULL,
        [TotalAmount] decimal(18, 2) NOT NULL,
        [BalanceAmount] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [PaidDate] datetime2 NULL,
        [OpeningBalance] decimal(18, 2) NOT NULL,
        [ClosingBalance] decimal(18, 2) NOT NULL,
        [Days] int NOT NULL,
        [InterestRate] decimal(18, 2) NOT NULL,
        CONSTRAINT [PK_LoanInstallmentSchedules] PRIMARY KEY CLUSTERED ([ScheduleID])
    );
    PRINT 'Created table [LoanInstallmentSchedules]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LoanRates]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LoanRates]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LoanRates] (
        [LoanRateID] int IDENTITY(1,1) NOT NULL,
        [LoanType] nvarchar(100) NOT NULL,
        [LoanCode] nvarchar(50) NOT NULL,
        [LoanLedgerID] int NULL,
        [InterestLedgerID] int NULL,
        [OverdueInterestLedgerID] int NULL,
        [ReceivableInterestLedgerID] int NULL,
        [SurchargeLedgerID] int NULL,
        [RecoveryFeeLedgerID] int NULL,
        [ProcessingFeeLedgerID] int NULL,
        [InterestRate] decimal(18, 2) NOT NULL,
        [OverdueInterestRate] decimal(18, 2) NOT NULL,
        [InterestPostingType] nvarchar(100) NOT NULL,
        [InterestCalculationMethod] nvarchar(100) NOT NULL,
        [ShortName] nvarchar(100) NOT NULL,
        [DurationMonths] int NOT NULL,
        [InstallmentType] nvarchar(100) NOT NULL,
        [InstallmentCount] int NOT NULL,
        [LoanInstallmentType] nvarchar(100) NOT NULL,
        [SecurityType] nvarchar(100) NOT NULL,
        [IsCcOrOd] bit NOT NULL,
        [IsActive] bit NOT NULL,
        [InterestPostingFrequency] nvarchar(100) NULL,
        CONSTRAINT [PK_LoanRates] PRIMARY KEY CLUSTERED ([LoanRateID])
    );
    PRINT 'Created table [LoanRates]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LockerAllotments]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LockerAllotments]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LockerAllotments] (
        [AllotmentID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [LockerAccountNo] nvarchar(50) NOT NULL,
        [LockerID] int NOT NULL,
        [MemberID] int NOT NULL,
        [JointMember1_ID] int NULL,
        [JointMember2_ID] int NULL,
        [OperatingInstruction] nvarchar(50) NOT NULL DEFAULT ('Self'),
        [AllotmentDate] datetime2 NOT NULL DEFAULT (getdate()),
        [RentStartDate] datetime2 NOT NULL DEFAULT (getdate()),
        [ExpiryDate] datetime2 NOT NULL,
        [AnnualRent] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [SecurityDepositAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [AdvanceRentPaid] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [LinkedSavingAccountID] int NULL,
        [IsAutoDebitEnabled] bit NOT NULL DEFAULT ((0)),
        [NomineeName] nvarchar(150) NULL,
        [NomineeRelation] nvarchar(50) NULL,
        [NomineeAge] int NULL,
        [NomineeAadhaar] nvarchar(20) NULL,
        [NomineeAddress] nvarchar(200) NULL,
        [DepositVoucherID] int NULL,
        [AdvanceRentVoucherID] int NULL,
        [Status] nvarchar(30) NOT NULL DEFAULT ('Active'),
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        [CustomerID] int NULL,
        CONSTRAINT [PK__LockerAl__E9FEF62F16644E42] PRIMARY KEY CLUSTERED ([AllotmentID])
    );
    PRINT 'Created table [LockerAllotments]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LockerRentPostings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LockerRentPostings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LockerRentPostings] (
        [PostingID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [AllotmentID] int NOT NULL,
        [FinancialYear] nvarchar(20) NOT NULL,
        [FromDate] datetime2 NOT NULL,
        [ToDate] datetime2 NOT NULL,
        [RentAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [GstAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [PenaltyAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [TotalAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [PaymentMode] nvarchar(50) NOT NULL DEFAULT ('Cash'),
        [PaymentDate] datetime2 NULL,
        [ReceiptNo] nvarchar(50) NULL,
        [VoucherID] int NULL,
        [IsPaid] bit NOT NULL DEFAULT ((0)),
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK__LockerRe__C31796A52F2FFC0C] PRIMARY KEY CLUSTERED ([PostingID])
    );
    PRINT 'Created table [LockerRentPostings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Lockers]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Lockers]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Lockers] (
        [LockerID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [CabinetNo] nvarchar(50) NOT NULL DEFAULT ('C-1'),
        [LockerNo] nvarchar(50) NOT NULL,
        [KeyNo] nvarchar(50) NOT NULL,
        [LockerTypeID] int NOT NULL,
        [Status] nvarchar(50) NOT NULL DEFAULT ('Available'),
        [Remarks] nvarchar(250) NULL,
        [IsActive] bit NOT NULL DEFAULT ((1)),
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK__Lockers__50B47B390CDAE408] PRIMARY KEY CLUSTERED ([LockerID])
    );
    PRINT 'Created table [Lockers]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LockerSurrenders]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LockerSurrenders]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LockerSurrenders] (
        [SurrenderID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [AllotmentID] int NOT NULL,
        [SurrenderDate] datetime2 NOT NULL DEFAULT (getdate()),
        [KeyReceived] bit NOT NULL DEFAULT ((1)),
        [KeysCondition] nvarchar(100) NOT NULL DEFAULT ('Good'),
        [DepositAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [UnpaidRentDeduction] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [DamagePenaltyDeduction] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [NetRefundAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [RefundPaymentMode] nvarchar(50) NOT NULL DEFAULT ('Cash'),
        [VoucherID] int NULL,
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK__LockerSu__694B5B613B95D2F1] PRIMARY KEY CLUSTERED ([SurrenderID])
    );
    PRINT 'Created table [LockerSurrenders]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LockerTypes]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LockerTypes]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LockerTypes] (
        [LockerTypeID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [TypeCode] nvarchar(50) NOT NULL,
        [TypeName] nvarchar(100) NOT NULL,
        [Dimensions] nvarchar(100) NULL,
        [AnnualRent] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [SecurityDeposit] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [LateFeePerMonth] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [GstRate] decimal(5, 2) NOT NULL DEFAULT ((0)),
        [DepositLiabilityLedgerID] int NULL,
        [RentIncomeLedgerID] int NULL,
        [LateFeeIncomeLedgerID] int NULL,
        [GstLiabilityLedgerID] int NULL,
        [IsActive] bit NOT NULL DEFAULT ((1)),
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK__LockerTy__533EE4C6025D5595] PRIMARY KEY CLUSTERED ([LockerTypeID])
    );
    PRINT 'Created table [LockerTypes]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [LockerVisitRegisters]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[LockerVisitRegisters]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LockerVisitRegisters] (
        [VisitID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [AllotmentID] int NOT NULL,
        [VisitDate] datetime2 NOT NULL DEFAULT (getdate()),
        [TimeIn] nvarchar(20) NOT NULL,
        [TimeOut] nvarchar(20) NULL,
        [OperatedBy] nvarchar(50) NOT NULL DEFAULT ('PrimaryMember'),
        [OperatorName] nvarchar(150) NOT NULL,
        [IsSignatureVerified] bit NOT NULL DEFAULT ((1)),
        [BankOfficerName] nvarchar(100) NULL,
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK__LockerVi__4D3AA1BE25A691D2] PRIMARY KEY CLUSTERED ([VisitID])
    );
    PRINT 'Created table [LockerVisitRegisters]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [MemberOpeningBalances]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[MemberOpeningBalances]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[MemberOpeningBalances] (
        [MemberOpeningBalanceID] int IDENTITY(1,1) NOT NULL,
        [MemberID] int NOT NULL,
        [LedgerID] int NOT NULL,
        [Amount] decimal(18, 2) NOT NULL,
        [BalanceType] nvarchar(2) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        CONSTRAINT [PK_MemberOpeningBalances] PRIMARY KEY CLUSTERED ([MemberOpeningBalanceID])
    );
    PRINT 'Created table [MemberOpeningBalances]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Members]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Members]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Members] (
        [MemberID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL,
        [MemberCode] nvarchar(20) NULL,
        [OldMemberCode] nvarchar(20) NULL,
        [CIFNo] nvarchar(20) NULL,
        [FirstName] nvarchar(50) NOT NULL,
        [MiddleName] nvarchar(50) NULL,
        [LastName] nvarchar(50) NOT NULL,
        [Address] nvarchar(500) NULL,
        [Village] nvarchar(100) NULL,
        [Taluka] nvarchar(100) NULL,
        [District] nvarchar(100) NULL,
        [MobileNo] nvarchar(15) NULL,
        [AadhaarNo] nvarchar(12) NOT NULL,
        [PANNo] nvarchar(10) NULL,
        [JoiningDate] datetime2 NOT NULL,
        [NomineeName] nvarchar(150) NULL,
        [NomineeRelation] nvarchar(50) NULL,
        [PhotoPath] nvarchar(MAX) NULL,
        [Gender] nvarchar(10) NULL,
        [BirthDate] datetime2 NULL,
        [Occupation] nvarchar(100) NULL,
        [SignaturePath] nvarchar(MAX) NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        [EmployerId] int NULL,
        [LegacyMemberId] int NULL,
        [LegacyMemberNo] nvarchar(50) NULL,
        [FirstNameEng] nvarchar(50) NULL,
        [MiddleNameEng] nvarchar(50) NULL,
        [LastNameEng] nvarchar(50) NULL,
        [AddressEng] nvarchar(500) NULL,
        [NomineeNameEng] nvarchar(150) NULL,
        [CasteCategory] nvarchar(50) NULL,
        [Caste] nvarchar(100) NULL,
        [Email] nvarchar(150) NULL,
        [IsMinor] bit NOT NULL DEFAULT ((0)),
        [GuardianName] nvarchar(150) NULL,
        [GuardianNameEng] nvarchar(150) NULL,
        [GuardianRelation] nvarchar(50) NULL,
        [GuardianAadhaarNo] nvarchar(12) NULL,
        [GuardianMobileNo] nvarchar(15) NULL,
        [GuardianAddress] nvarchar(500) NULL,
        [NickName] nvarchar(100) NULL,
        [AadhaarDocPath] nvarchar(MAX) NULL,
        [PanDocPath] nvarchar(MAX) NULL,
        [IsDeleted] bit NOT NULL DEFAULT ((0)),
        [MembershipType] nvarchar(30) NOT NULL DEFAULT ('Regular'),
        [NomineeAddress] nvarchar(500) NULL,
        [NomineeBirthDate] datetime2 NULL,
        [NomineeIsMinor] bit NOT NULL DEFAULT ((0)),
        [NomineeGuardianName] nvarchar(150) NULL,
        [CustomerID] int NULL,
        CONSTRAINT [PK_Members] PRIMARY KEY CLUSTERED ([MemberID])
    );
    PRINT 'Created table [Members]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [NpaClassificationRuns]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[NpaClassificationRuns]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[NpaClassificationRuns] (
        [NpaClassificationRunID] int IDENTITY(1,1) NOT NULL,
        [RunDate] datetime2 NOT NULL,
        [TriggeredBy] nvarchar(100) NOT NULL,
        [RecordsProcessed] int NOT NULL,
        [Status] nvarchar(50) NOT NULL,
        [Remarks] nvarchar(500) NULL,
        CONSTRAINT [PK_NpaClassificationRuns] PRIMARY KEY CLUSTERED ([NpaClassificationRunID])
    );
    PRINT 'Created table [NpaClassificationRuns]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [NpaConfigs]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[NpaConfigs]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[NpaConfigs] (
        [FinancialYear] nvarchar(10) NOT NULL,
        [ConcessionPeriodDays] int NOT NULL,
        CONSTRAINT [PK_NpaConfigs] PRIMARY KEY CLUSTERED ([FinancialYear])
    );
    PRINT 'Created table [NpaConfigs]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [NpaProvisionSlabs]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[NpaProvisionSlabs]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[NpaProvisionSlabs] (
        [NpaProvisionSlabID] int IDENTITY(1,1) NOT NULL,
        [FinancialYear] nvarchar(10) NOT NULL,
        [Category] nvarchar(50) NOT NULL,
        [SecurityType] nvarchar(20) NOT NULL,
        [OverdueOrOutOfOrderMonthsFrom] decimal(18, 2) NOT NULL,
        [OverdueOrOutOfOrderMonthsTo] decimal(18, 2) NOT NULL,
        [NpaMonthsFrom] decimal(18, 2) NOT NULL,
        [NpaMonthsTo] decimal(18, 2) NOT NULL,
        [MinProvisionPercent] decimal(18, 2) NOT NULL,
        CONSTRAINT [PK_NpaProvisionSlabs] PRIMARY KEY CLUSTERED ([NpaProvisionSlabID])
    );
    PRINT 'Created table [NpaProvisionSlabs]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [OverdueInterestLedgers]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[OverdueInterestLedgers]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[OverdueInterestLedgers] (
        [OverdueInterestLedgerID] int IDENTITY(1,1) NOT NULL,
        [LoanAccountID] int NOT NULL,
        [TransactionDate] datetime2 NOT NULL,
        [DebitAmount] decimal(18, 2) NOT NULL,
        [CreditAmount] decimal(18, 2) NOT NULL,
        [VoucherID] int NULL,
        [Particulars] nvarchar(250) NOT NULL,
        CONSTRAINT [PK_OverdueInterestLedgers] PRIMARY KEY CLUSTERED ([OverdueInterestLedgerID])
    );
    PRINT 'Created table [OverdueInterestLedgers]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [OverdueRecoveryLedgers]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[OverdueRecoveryLedgers]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[OverdueRecoveryLedgers] (
        [OverdueRecoveryLedgerID] int IDENTITY(1,1) NOT NULL,
        [LoanAccountID] int NOT NULL,
        [TransactionDate] datetime2 NOT NULL,
        [DebitAmount] decimal(18, 2) NOT NULL,
        [CreditAmount] decimal(18, 2) NOT NULL,
        [VoucherID] int NULL,
        [Particulars] nvarchar(250) NOT NULL,
        CONSTRAINT [PK_OverdueRecoveryLedgers] PRIMARY KEY CLUSTERED ([OverdueRecoveryLedgerID])
    );
    PRINT 'Created table [OverdueRecoveryLedgers]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyAccounts]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyAccounts]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyAccounts] (
        [PigmyAccountID] int IDENTITY(1,1) NOT NULL,
        [AccountNo] nvarchar(30) NOT NULL,
        [MemberID] int NOT NULL,
        [BranchID] int NOT NULL,
        [PigmySchemeID] int NOT NULL,
        [PigmyAgentID] int NOT NULL,
        [OpeningDate] datetime2 NOT NULL,
        [InterestRate] decimal(5, 2) NOT NULL,
        [MaturityDate] datetime2 NOT NULL,
        [TotalDepositedAmount] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [LegacyAccountId] int NULL,
        [LegacyAccountNumber] nvarchar(50) NULL,
        [CustomerID] int NULL,
        CONSTRAINT [PK_PigmyAccounts] PRIMARY KEY CLUSTERED ([PigmyAccountID])
    );
    PRINT 'Created table [PigmyAccounts]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyAccountSequences]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyAccountSequences]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyAccountSequences] (
        [ID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL,
        [LastSequenceNumber] int NOT NULL,
        CONSTRAINT [PK_PigmyAccountSequences] PRIMARY KEY CLUSTERED ([ID])
    );
    PRINT 'Created table [PigmyAccountSequences]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyAgentCashDeposits]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyAgentCashDeposits]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyAgentCashDeposits] (
        [DepositId] int IDENTITY(1,1) NOT NULL,
        [AgentId] int NOT NULL,
        [DepositDate] datetime2 NOT NULL,
        [Amount] decimal(18, 2) NOT NULL,
        [ReceiptNo] nvarchar(50) NOT NULL,
        [Narration] nvarchar(255) NULL,
        [VoucherId] int NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [PaymentMode] nvarchar(50) NOT NULL DEFAULT (''),
        CONSTRAINT [PK_PigmyAgentCashDeposits] PRIMARY KEY CLUSTERED ([DepositId])
    );
    PRINT 'Created table [PigmyAgentCashDeposits]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyAgentCommissions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyAgentCommissions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyAgentCommissions] (
        [CommissionId] int IDENTITY(1,1) NOT NULL,
        [AgentId] int NOT NULL,
        [CalculationFrequency] nvarchar(20) NOT NULL,
        [PeriodStartDate] datetime2 NOT NULL,
        [PeriodEndDate] datetime2 NOT NULL,
        [TotalCollectionAmount] decimal(18, 2) NOT NULL,
        [CalculatedCommission] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [VoucherId] int NULL,
        [CalculatedOn] datetime2 NOT NULL,
        CONSTRAINT [PK_PigmyAgentCommissions] PRIMARY KEY CLUSTERED ([CommissionId])
    );
    PRINT 'Created table [PigmyAgentCommissions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyAgents]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyAgents]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyAgents] (
        [PigmyAgentID] int IDENTITY(1,1) NOT NULL,
        [AgentName] nvarchar(100) NOT NULL,
        [MobileNo] nvarchar(15) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [JoiningDate] datetime2 NULL,
        [BranchID] int NULL,
        [MaxCashLimit] decimal(18, 2) NOT NULL DEFAULT ((20000.00)),
        [PasswordHash] nvarchar(255) NULL,
        [Pin] nvarchar(10) NULL,
        CONSTRAINT [PK_PigmyAgents] PRIMARY KEY CLUSTERED ([PigmyAgentID])
    );
    PRINT 'Created table [PigmyAgents]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyCollections]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyCollections]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyCollections] (
        [CollectionId] bigint IDENTITY(1,1) NOT NULL,
        [PigmyAccountId] int NOT NULL,
        [AgentId] int NOT NULL,
        [CollectionDate] datetime2 NOT NULL,
        [OpeningBalance] decimal(18, 2) NOT NULL,
        [CollectionAmount] decimal(18, 2) NOT NULL,
        [ClosingBalance] decimal(18, 2) NOT NULL,
        [ReceiptNo] nvarchar(50) NOT NULL,
        [CollectionSource] nvarchar(20) NOT NULL,
        [ImportBatchId] uniqueidentifier NULL,
        [SyncReferenceId] nvarchar(100) NULL,
        [IsVoucherGenerated] bit NOT NULL,
        [VoucherId] int NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [TransactionId] nvarchar(64) NULL,
        [PaymentMode] nvarchar(10) NOT NULL DEFAULT ('CASH'),
        [Notes] nvarchar(255) NULL,
        CONSTRAINT [PK_PigmyCollections] PRIMARY KEY CLUSTERED ([CollectionId])
    );
    PRINT 'Created table [PigmyCollections]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyCommissionSettings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyCommissionSettings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyCommissionSettings] (
        [SettingId] int IDENTITY(1,1) NOT NULL,
        [AgentId] int NULL,
        [CommissionType] nvarchar(20) NOT NULL,
        [CommissionValue] decimal(5, 2) NOT NULL,
        [CalculationFrequency] nvarchar(20) NOT NULL,
        [EffectiveFrom] datetime2 NOT NULL,
        [EffectiveTo] datetime2 NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_PigmyCommissionSettings] PRIMARY KEY CLUSTERED ([SettingId])
    );
    PRINT 'Created table [PigmyCommissionSettings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyInterestLogs]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyInterestLogs]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyInterestLogs] (
        [LogId] int IDENTITY(1,1) NOT NULL,
        [PigmyAccountId] int NOT NULL,
        [CalculationDate] datetime2 NOT NULL,
        [PeriodStartDate] datetime2 NOT NULL,
        [PeriodEndDate] datetime2 NOT NULL,
        [InterestAmount] decimal(18, 2) NOT NULL,
        [VoucherId] int NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        CONSTRAINT [PK_PigmyInterestLogs] PRIMARY KEY CLUSTERED ([LogId])
    );
    PRINT 'Created table [PigmyInterestLogs]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyOpeningBalances]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyOpeningBalances]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyOpeningBalances] (
        [PigmyOpeningBalanceID] int IDENTITY(1,1) NOT NULL,
        [PigmyAccountID] int NOT NULL,
        [FinancialYear] nvarchar(9) NOT NULL,
        [AsOfDate] datetime2 NOT NULL,
        [MigratedBalanceAmount] decimal(18, 2) NOT NULL,
        [MigrationRemarks] nvarchar(255) NULL,
        [IsPostedToLedger] bit NOT NULL,
        [MigratedBy] int NOT NULL,
        [MigratedOn] datetime2 NOT NULL,
        CONSTRAINT [PK_PigmyOpeningBalances] PRIMARY KEY CLUSTERED ([PigmyOpeningBalanceID])
    );
    PRINT 'Created table [PigmyOpeningBalances]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmySchemes]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmySchemes]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmySchemes] (
        [PigmySchemeID] int IDENTITY(1,1) NOT NULL,
        [SchemeName] nvarchar(100) NOT NULL,
        [InterestRate] decimal(5, 2) NOT NULL,
        [DurationMonths] int NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [PigmyLiabilityLedgerID] int NULL,
        [InterestExpenseLedgerID] int NULL,
        [InterestPayableLedgerID] int NULL,
        [CommissionExpenseLedgerID] int NULL,
        [SchemeCode] nvarchar(50) NULL,
        CONSTRAINT [PK_PigmySchemes] PRIMARY KEY CLUSTERED ([PigmySchemeID])
    );
    PRINT 'Created table [PigmySchemes]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyTransactions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyTransactions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyTransactions] (
        [PigmyTransactionID] int IDENTITY(1,1) NOT NULL,
        [PigmyAccountID] int NOT NULL,
        [TransactionDate] datetime2 NOT NULL,
        [ValueDate] datetime2 NOT NULL,
        [TransactionType] nvarchar(20) NOT NULL,
        [DrAmount] decimal(18, 2) NOT NULL,
        [CrAmount] decimal(18, 2) NOT NULL,
        [BalanceAmount] decimal(18, 2) NOT NULL,
        [Narration] nvarchar(255) NOT NULL,
        [ReferenceId] nvarchar(50) NULL,
        [MakerId] int NOT NULL,
        [PostedOn] datetime2 NOT NULL,
        CONSTRAINT [PK_PigmyTransactions] PRIMARY KEY CLUSTERED ([PigmyTransactionID])
    );
    PRINT 'Created table [PigmyTransactions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [PigmyVoucherMappings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[PigmyVoucherMappings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PigmyVoucherMappings] (
        [MappingId] int IDENTITY(1,1) NOT NULL,
        [BranchId] int NOT NULL,
        [CollectionSource] nvarchar(20) NOT NULL,
        [DebitLedgerId] int NOT NULL,
        [CreditLedgerId] int NOT NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_PigmyVoucherMappings] PRIMARY KEY CLUSTERED ([MappingId])
    );
    PRINT 'Created table [PigmyVoucherMappings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [RdAccounts]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[RdAccounts]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[RdAccounts] (
        [RdAccountID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [MemberID] int NOT NULL,
        [RdSchemeID] int NOT NULL,
        [AccountNo] nvarchar(30) NOT NULL,
        [OpeningDate] datetime2 NOT NULL,
        [InstallmentAmount] decimal(18, 2) NOT NULL,
        [DurationMonths] int NOT NULL,
        [InterestRate] decimal(5, 2) NOT NULL,
        [MaturityDate] datetime2 NOT NULL,
        [MaturityAmount] decimal(18, 2) NOT NULL,
        [TotalPaidInstallments] int NOT NULL,
        [TotalDepositedAmount] decimal(18, 2) NOT NULL,
        [IsLegacyAccount] bit NOT NULL,
        [LegacyAccruedInt] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [NomineeName] nvarchar(100) NULL,
        [NomineeRelation] nvarchar(50) NULL,
        [Remarks] nvarchar(250) NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        [LegacyAccountId] int NULL,
        [LegacyAccountNumber] nvarchar(50) NULL,
        [AccountType] nvarchar(20) NOT NULL DEFAULT ('Single'),
        [JointMemberID] int NULL,
        [GuardianName] nvarchar(100) NULL,
        [GuardianRelation] nvarchar(50) NULL,
        [PaymentMode] nvarchar(30) NOT NULL DEFAULT ('Cash'),
        [SavingAccountID] int NULL,
        [MaturityInstruction] nvarchar(30) NOT NULL DEFAULT ('Cash_Payout'),
        [AgentID] int NULL,
        [PassbookNo] nvarchar(50) NULL,
        [CustomerID] int NULL,
        CONSTRAINT [PK_RdAccounts] PRIMARY KEY CLUSTERED ([RdAccountID])
    );
    PRINT 'Created table [RdAccounts]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [RdAccountSequences]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[RdAccountSequences]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[RdAccountSequences] (
        [SequenceID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL,
        [ProductType] nvarchar(10) NOT NULL,
        [CurrentValue] int NOT NULL,
        CONSTRAINT [PK_RdAccountSequences] PRIMARY KEY CLUSTERED ([SequenceID])
    );
    PRINT 'Created table [RdAccountSequences]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [RdInterestAccruals]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[RdInterestAccruals]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[RdInterestAccruals] (
        [AccrualID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [RdAccountID] int NOT NULL,
        [VoucherID] int NOT NULL,
        [AccrualDate] datetime2 NOT NULL,
        [InterestAmount] decimal(18, 2) NOT NULL,
        [IsPosted] bit NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_RdInterestAccruals] PRIMARY KEY CLUSTERED ([AccrualID])
    );
    PRINT 'Created table [RdInterestAccruals]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [RdSchemes]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[RdSchemes]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[RdSchemes] (
        [RdSchemeID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [SchemeCode] nvarchar(20) NOT NULL,
        [SchemeName] nvarchar(100) NOT NULL,
        [DurationMonths] int NOT NULL,
        [InstallmentAmount] decimal(18, 2) NOT NULL,
        [MinimumInstallment] decimal(18, 2) NOT NULL,
        [MaximumInstallment] decimal(18, 2) NOT NULL,
        [InterestRate] decimal(5, 2) NOT NULL,
        [InterestMethod] nvarchar(20) NOT NULL,
        [PenaltyAmount] decimal(18, 2) NOT NULL,
        [EffectiveDate] datetime2 NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        [PrematurePenaltyRate] decimal(5, 2) NOT NULL DEFAULT ((1.00)),
        [RdLiabilityLedgerID] int NULL,
        [InterestExpenseLedgerID] int NULL,
        [InterestPayableLedgerID] int NULL,
        [PenaltyIncomeLedgerID] int NULL,
        CONSTRAINT [PK_RdSchemes] PRIMARY KEY CLUSTERED ([RdSchemeID])
    );
    PRINT 'Created table [RdSchemes]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [RdTransactions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[RdTransactions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[RdTransactions] (
        [RdTransactionID] int IDENTITY(1,1) NOT NULL,
        [InstitutionID] int NOT NULL,
        [BranchID] int NOT NULL,
        [FinancialYearID] int NOT NULL,
        [RdAccountID] int NOT NULL,
        [VoucherID] int NOT NULL,
        [TransactionDate] datetime2 NOT NULL,
        [TransactionType] nvarchar(20) NOT NULL,
        [InstallmentNo] int NULL,
        [DebitCredit] nvarchar(2) NOT NULL,
        [PrincipalAmount] decimal(18, 2) NOT NULL,
        [PenaltyAmount] decimal(18, 2) NOT NULL,
        [InterestAmount] decimal(18, 2) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        CONSTRAINT [PK_RdTransactions] PRIMARY KEY CLUSTERED ([RdTransactionID])
    );
    PRINT 'Created table [RdTransactions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [RolePermissions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[RolePermissions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[RolePermissions] (
        [RolePermissionID] int IDENTITY(1,1) NOT NULL,
        [RoleID] int NOT NULL,
        [ModuleCode] nvarchar(50) NOT NULL,
        [CanView] bit NOT NULL DEFAULT ((0)),
        [CanAdd] bit NOT NULL DEFAULT ((0)),
        [CanEdit] bit NOT NULL DEFAULT ((0)),
        [CanDelete] bit NOT NULL DEFAULT ((0)),
        [CanPrint] bit NOT NULL DEFAULT ((0)),
        [CanApprove] bit NOT NULL DEFAULT ((0)),
        [ScopeLevel] nvarchar(20) NOT NULL DEFAULT ('BranchOnly'),
        CONSTRAINT [PK__RolePerm__120F469A4FD1D5C8] PRIMARY KEY CLUSTERED ([RolePermissionID])
    );
    PRINT 'Created table [RolePermissions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Roles]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Roles]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Roles] (
        [RoleID] int IDENTITY(1,1) NOT NULL,
        [RoleName] nvarchar(100) NOT NULL,
        [Description] nvarchar(250) NULL,
        [RoleCode] nvarchar(30) NOT NULL DEFAULT (''),
        [IsSystemRole] bit NOT NULL DEFAULT ((1)),
        [Status] bit NOT NULL DEFAULT ((1)),
        CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED ([RoleID])
    );
    PRINT 'Created table [Roles]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SansthaDetails]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SansthaDetails]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SansthaDetails] (
        [SansthaID] int IDENTITY(1,1) NOT NULL,
        [SansthaName] nvarchar(200) NOT NULL,
        [Address] nvarchar(500) NULL,
        [ContactNo] nvarchar(20) NULL,
        [Email] nvarchar(100) NULL,
        [RegistrationNo] nvarchar(50) NULL,
        [GSTNo] nvarchar(50) NULL,
        [LogoPath] nvarchar(500) NULL,
        [IsMigrationLocked] bit NOT NULL,
        [AutoPostVouchers] bit NOT NULL DEFAULT (CONVERT([bit],(0),0)),
        [Village] nvarchar(100) NULL,
        [Taluka] nvarchar(100) NULL,
        [District] nvarchar(100) NULL,
        [State] nvarchar(100) NULL,
        [PinCode] nvarchar(20) NULL,
        [RegistrationDate] datetime2 NULL,
        [AutoPostVoucherLimit] decimal(18, 2) NOT NULL DEFAULT ((50000.00)),
        [IsMobileCompulsory] bit NOT NULL DEFAULT ((1)),
        [IsAadhaarCompulsory] bit NOT NULL DEFAULT ((1)),
        [IsPanCompulsory] bit NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_SansthaDetails] PRIMARY KEY CLUSTERED ([SansthaID])
    );
    PRINT 'Created table [SansthaDetails]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SavingAccountClosings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SavingAccountClosings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SavingAccountClosings] (
        [ClosingID] int IDENTITY(1,1) NOT NULL,
        [SavingAccountID] int NOT NULL,
        [ClosureDate] datetime2 NOT NULL,
        [GrossBalance] decimal(18, 2) NOT NULL,
        [ClosingCharges] decimal(18, 2) NOT NULL,
        [NetPayable] decimal(18, 2) NOT NULL,
        [PaymentMode] nvarchar(20) NOT NULL,
        [VoucherNo] nvarchar(50) NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        CONSTRAINT [PK_SavingAccountClosings] PRIMARY KEY CLUSTERED ([ClosingID])
    );
    PRINT 'Created table [SavingAccountClosings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SavingAccountJointHolders]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SavingAccountJointHolders]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SavingAccountJointHolders] (
        [JointHolderID] int IDENTITY(1,1) NOT NULL,
        [SavingAccountID] int NOT NULL,
        [MemberID] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        CONSTRAINT [PK_SavingAccountJointHolders] PRIMARY KEY CLUSTERED ([JointHolderID])
    );
    PRINT 'Created table [SavingAccountJointHolders]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SavingAccountMasters]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SavingAccountMasters]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SavingAccountMasters] (
        [SavingAccountID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL,
        [AccountNo] nvarchar(20) NOT NULL,
        [MemberID] int NOT NULL,
        [AccountType] nvarchar(20) NOT NULL,
        [OpeningDate] datetime2 NOT NULL,
        [IsLegacyAccount] bit NOT NULL,
        [LedgerID] int NOT NULL,
        [OpeningBalance] decimal(18, 2) NOT NULL,
        [CurrentBalance] decimal(18, 2) NOT NULL,
        [InterestRate] decimal(5, 2) NOT NULL,
        [MinimumBalance] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [ClosingDate] datetime2 NULL,
        [NomineeName] nvarchar(150) NULL,
        [NomineeRelation] nvarchar(50) NULL,
        [NomineeAddress] nvarchar(500) NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        [LegacyAccountId] int NULL,
        [LegacyAccountNumber] nvarchar(50) NULL,
        [LienAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [LienReason] nvarchar(250) NULL,
        [CustomerID] int NULL,
        CONSTRAINT [PK_SavingAccountMasters] PRIMARY KEY CLUSTERED ([SavingAccountID])
    );
    PRINT 'Created table [SavingAccountMasters]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SavingInterestPostings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SavingInterestPostings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SavingInterestPostings] (
        [PostingID] int IDENTITY(1,1) NOT NULL,
        [FinancialYearID] int NOT NULL,
        [PeriodStart] datetime2 NOT NULL,
        [PeriodEnd] datetime2 NOT NULL,
        [TotalInterest] decimal(18, 2) NOT NULL,
        [VoucherNo] nvarchar(50) NULL,
        [PostedOn] datetime2 NOT NULL,
        [PostedBy] int NOT NULL,
        CONSTRAINT [PK_SavingInterestPostings] PRIMARY KEY CLUSTERED ([PostingID])
    );
    PRINT 'Created table [SavingInterestPostings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SavingInterestSettings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SavingInterestSettings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SavingInterestSettings] (
        [SettingID] int IDENTITY(1,1) NOT NULL,
        [InterestRate] decimal(5, 2) NOT NULL,
        [CalculationMethod] nvarchar(50) NOT NULL,
        [PostingFrequency] nvarchar(20) NOT NULL,
        [EffectiveDate] datetime2 NOT NULL,
        [LedgerID] int NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [SavingLiabilityLedgerID] int NULL,
        [InterestExpenseLedgerID] int NULL,
        [InterestPayableLedgerID] int NULL,
        [SchemeName] nvarchar(100) NULL,
        [SchemeCode] nvarchar(50) NULL,
        CONSTRAINT [PK_SavingInterestSettings] PRIMARY KEY CLUSTERED ([SettingID])
    );
    PRINT 'Created table [SavingInterestSettings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SavingPassbooks]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SavingPassbooks]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SavingPassbooks] (
        [PassbookLogID] int IDENTITY(1,1) NOT NULL,
        [SavingAccountID] int NOT NULL,
        [TransactionID] int NOT NULL,
        [PrintedLineNo] int NOT NULL,
        [PrintedPageNo] int NOT NULL,
        [PrintedOn] datetime2 NOT NULL,
        [PrintedBy] int NOT NULL,
        CONSTRAINT [PK_SavingPassbooks] PRIMARY KEY CLUSTERED ([PassbookLogID])
    );
    PRINT 'Created table [SavingPassbooks]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SavingTransactions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SavingTransactions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SavingTransactions] (
        [TransactionID] int IDENTITY(1,1) NOT NULL,
        [SavingAccountID] int NOT NULL,
        [TransactionDate] datetime2 NOT NULL,
        [TransactionType] nvarchar(20) NOT NULL,
        [PaymentMode] nvarchar(20) NOT NULL,
        [Amount] decimal(18, 2) NOT NULL,
        [BalanceAfterTxn] decimal(18, 2) NOT NULL,
        [Narration] nvarchar(255) NULL,
        [VoucherNo] nvarchar(50) NULL,
        [IsPrintedOnPassbook] bit NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [TargetSavingAccountID] int NULL,
        CONSTRAINT [PK_SavingTransactions] PRIMARY KEY CLUSTERED ([TransactionID])
    );
    PRINT 'Created table [SavingTransactions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SavingVoucherMappings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SavingVoucherMappings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SavingVoucherMappings] (
        [MappingID] int IDENTITY(1,1) NOT NULL,
        [OperationType] nvarchar(50) NOT NULL,
        [LedgerID] int NOT NULL,
        [Description] nvarchar(255) NULL,
        CONSTRAINT [PK_SavingVoucherMappings] PRIMARY KEY CLUSTERED ([MappingID])
    );
    PRINT 'Created table [SavingVoucherMappings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Sec101AttachmentAuctions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Sec101AttachmentAuctions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Sec101AttachmentAuctions] (
        [AttachmentId] int IDENTITY(1,1) NOT NULL,
        [ExecutionId] int NULL,
        [CaseId] int NOT NULL,
        [SroName] nvarchar(100) NOT NULL DEFAULT (''),
        [ExecutionType] nvarchar(50) NOT NULL DEFAULT ('AUCTION'),
        [ExecutionOrderNo] nvarchar(50) NULL,
        [OrderDate] datetime2 NULL,
        [EmployerName] nvarchar(150) NULL,
        [EmployerAddress] nvarchar(250) NULL,
        [MonthlyDeductionAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [PropertyDetails] nvarchar(MAX) NULL,
        [ValuationAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [EstimatedValue] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [WarrantIssueDate] datetime2 NULL,
        [PanchanamaDate] datetime2 NULL,
        [AuctionNoticeDate] datetime2 NULL,
        [AuctionDate] datetime2 NULL,
        [ReservePrice] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [HighestBidAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [BuyerName] nvarchar(150) NULL,
        [BuyerContact] nvarchar(100) NULL,
        [SaleCertificateDate] datetime2 NULL,
        [SaleCertificateNo] nvarchar(50) NULL,
        [ExecutionStatus] nvarchar(50) NULL,
        [Status] nvarchar(50) NOT NULL DEFAULT ('PENDING'),
        [RecoveredAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [Remarks] nvarchar(500) NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        [CreatedAt] datetime2 NOT NULL DEFAULT (getutcdate()),
        [CreatedBy] int NOT NULL DEFAULT ((1)),
        CONSTRAINT [PK__Sec101At__442C64BE5EAA0504] PRIMARY KEY CLUSTERED ([AttachmentId])
    );
    PRINT 'Created table [Sec101AttachmentAuctions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Sec101CaseMasters]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Sec101CaseMasters]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Sec101CaseMasters] (
        [CaseId] int IDENTITY(1,1) NOT NULL,
        [BranchId] int NOT NULL DEFAULT ((1)),
        [LoanAccountId] int NOT NULL,
        [MemberId] int NOT NULL DEFAULT ((0)),
        [CaseNumber] nvarchar(50) NOT NULL,
        [CourtName] nvarchar(200) NOT NULL DEFAULT (''),
        [CourtOrAuthority] nvarchar(150) NOT NULL DEFAULT (''),
        [AdvocateName] nvarchar(150) NULL,
        [AdvocatePhone] nvarchar(20) NULL,
        [FilingDate] datetime2 NOT NULL,
        [PrincipalClaim] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [InterestClaim] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [PenalInterestClaim] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [OtherChargesClaim] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [TotalClaimAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [ClaimAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [CourtFeeAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [CourtFeeChallanNo] nvarchar(50) NULL,
        [CertificateNo] nvarchar(50) NULL,
        [CertificateNumber] nvarchar(50) NULL,
        [CertificateDate] datetime2 NULL,
        [SanctionedAmount] decimal(18, 2) NULL,
        [GrantedAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [FutureInterestRate] decimal(18, 2) NULL,
        [GrantedInterestRate] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [CurrentStage] nvarchar(100) NOT NULL DEFAULT (''),
        [NextHearingDate] datetime2 NULL,
        [CaseStatus] nvarchar(50) NULL,
        [Status] nvarchar(50) NOT NULL DEFAULT ('PENDING'),
        [Remarks] nvarchar(500) NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        [CreatedAt] datetime2 NOT NULL DEFAULT (getutcdate()),
        [CreatedBy] int NOT NULL DEFAULT ((1)),
        CONSTRAINT [PK__Sec101Ca__6CAE524C40257DE4] PRIMARY KEY CLUSTERED ([CaseId])
    );
    PRINT 'Created table [Sec101CaseMasters]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Sec101HearingLogs]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Sec101HearingLogs]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Sec101HearingLogs] (
        [HearingId] int IDENTITY(1,1) NOT NULL,
        [CaseId] int NOT NULL,
        [HearingLogId] int NULL,
        [HearingDate] datetime2 NOT NULL,
        [NextHearingDate] datetime2 NULL,
        [HearingStage] nvarchar(100) NULL,
        [Stage] nvarchar(100) NOT NULL DEFAULT (''),
        [PresenceType] nvarchar(50) NULL,
        [BorrowerPresence] nvarchar(20) NOT NULL DEFAULT ('NO'),
        [GuarantorPresence] nvarchar(20) NOT NULL DEFAULT ('NO'),
        [ProceedingsSummary] nvarchar(MAX) NULL,
        [CourtOrderSummary] nvarchar(MAX) NULL,
        [NextHearingPurpose] nvarchar(250) NULL,
        [AdvocateNotes] nvarchar(MAX) NULL,
        [OrdersPassed] nvarchar(MAX) NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        [CreatedAt] datetime2 NOT NULL DEFAULT (getutcdate()),
        [CreatedBy] int NOT NULL DEFAULT ((1)),
        CONSTRAINT [PK__Sec101He__669775D855209ACA] PRIMARY KEY CLUSTERED ([HearingId])
    );
    PRINT 'Created table [Sec101HearingLogs]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Sec101LegalExpenses]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Sec101LegalExpenses]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Sec101LegalExpenses] (
        [ExpenseId] int IDENTITY(1,1) NOT NULL,
        [BranchId] int NOT NULL DEFAULT ((1)),
        [CaseId] int NULL,
        [LegalExpenseId] int NULL,
        [LoanAccountId] int NOT NULL DEFAULT ((0)),
        [ExpenseType] nvarchar(50) NOT NULL,
        [Amount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [ExpenseDate] datetime2 NOT NULL,
        [PaidTo] nvarchar(150) NULL,
        [PayeeName] nvarchar(150) NULL,
        [PaymentMode] nvarchar(50) NULL,
        [VoucherId] int NULL,
        [VoucherNumber] nvarchar(50) NULL,
        [IsDebitedToLoan] bit NOT NULL DEFAULT ((0)),
        [IsDebitedToBorrower] bit NOT NULL DEFAULT ((0)),
        [DebitLedgerId] int NULL,
        [CreditLedgerId] int NULL,
        [Remarks] nvarchar(500) NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        [CreatedAt] datetime2 NOT NULL DEFAULT (getutcdate()),
        [CreatedBy] int NOT NULL DEFAULT ((1)),
        CONSTRAINT [PK__Sec101Le__1445CFD36DEC4894] PRIMARY KEY CLUSTERED ([ExpenseId])
    );
    PRINT 'Created table [Sec101LegalExpenses]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Sec101NoticeHistories]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Sec101NoticeHistories]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Sec101NoticeHistories] (
        [NoticeId] int IDENTITY(1,1) NOT NULL,
        [BranchId] int NOT NULL DEFAULT ((1)),
        [LoanAccountId] int NOT NULL,
        [MemberId] int NOT NULL DEFAULT ((0)),
        [NoticeType] nvarchar(50) NOT NULL,
        [NoticeNumber] nvarchar(50) NOT NULL DEFAULT (''),
        [NoticeDate] datetime2 NOT NULL,
        [DueDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        [PrincipalDue] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [InterestDue] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [PenalInterestDue] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [NoticeFee] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [OverduePrincipal] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [OverdueInterest] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [NoticeFees] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [TotalDemandAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [ComplianceDeadlineDays] int NOT NULL DEFAULT ((15)),
        [PostalTrackingNo] nvarchar(100) NULL,
        [PostalStatus] nvarchar(50) NOT NULL DEFAULT ('PENDING'),
        [DispatchMode] nvarchar(50) NULL,
        [TrackingNumber] nvarchar(100) NULL,
        [DeliveryStatus] nvarchar(50) NULL,
        [DeliveredDate] datetime2 NULL,
        [Remarks] nvarchar(500) NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        [CreatedAt] datetime2 NOT NULL DEFAULT (getutcdate()),
        [CreatedBy] int NOT NULL DEFAULT ((1)),
        CONSTRAINT [PK__Sec101No__CE83CBE52C1E8537] PRIMARY KEY CLUSTERED ([NoticeId])
    );
    PRINT 'Created table [Sec101NoticeHistories]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SecurityTypes]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SecurityTypes]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SecurityTypes] (
        [SecurityTypeID] int IDENTITY(1,1) NOT NULL,
        [Name] nvarchar(100) NOT NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_SecurityTypes] PRIMARY KEY CLUSTERED ([SecurityTypeID])
    );
    PRINT 'Created table [SecurityTypes]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [ShareAccounts]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[ShareAccounts]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ShareAccounts] (
        [ShareAccountId] int IDENTITY(1,1) NOT NULL,
        [AccountNo] nvarchar(20) NOT NULL,
        [MemberId] int NOT NULL,
        [TotalShareAmount] decimal(18, 2) NOT NULL,
        [TotalShareCount] int NOT NULL,
        [DividendPayableBalance] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [OpeningDate] datetime2 NOT NULL,
        [LegacyAccountId] int NULL,
        [LegacyAccountNumber] nvarchar(50) NULL,
        [CustomerID] int NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_ShareAccounts] PRIMARY KEY CLUSTERED ([ShareAccountId])
    );
    PRINT 'Created table [ShareAccounts]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [ShareCertificatePrintHistories]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[ShareCertificatePrintHistories]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ShareCertificatePrintHistories] (
        [PrintHistoryId] int IDENTITY(1,1) NOT NULL,
        [CertificateId] int NOT NULL,
        [ActionType] nvarchar(20) NOT NULL,
        [PrintedBy] int NOT NULL,
        [PrintedOn] datetime2 NOT NULL,
        [IPAddress] nvarchar(50) NULL,
        CONSTRAINT [PK_ShareCertificatePrintHistories] PRIMARY KEY CLUSTERED ([PrintHistoryId])
    );
    PRINT 'Created table [ShareCertificatePrintHistories]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [ShareCertificates]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[ShareCertificates]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ShareCertificates] (
        [CertificateId] int IDENTITY(1,1) NOT NULL,
        [ShareAccountId] int NOT NULL,
        [CertificateNo] nvarchar(50) NOT NULL,
        [IssueDate] datetime2 NOT NULL,
        [FromShareNo] bigint NOT NULL,
        [ToShareNo] bigint NOT NULL,
        [NumberOfShares] int NOT NULL,
        [FaceValue] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [PrintCount] int NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL,
        [ModifiedBy] int NULL,
        [ModifiedDate] datetime2 NULL,
        [CancellationReason] nvarchar(MAX) NULL,
        [CustomerID] int NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_ShareCertificates] PRIMARY KEY CLUSTERED ([CertificateId])
    );
    PRINT 'Created table [ShareCertificates]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [ShareSchemes]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[ShareSchemes]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ShareSchemes] (
        [ShareSchemeId] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [SchemeCode] nvarchar(50) NOT NULL,
        [SchemeName] nvarchar(100) NOT NULL,
        [MemberType] nvarchar(50) NOT NULL DEFAULT ('Regular'),
        [ShareFaceValue] decimal(18, 2) NOT NULL DEFAULT ((100.00)),
        [MinSharesCount] int NOT NULL DEFAULT ((1)),
        [MaxSharesCount] int NOT NULL DEFAULT ((1000)),
        [EntranceFee] decimal(18, 2) NOT NULL DEFAULT ((10.00)),
        [BuildingFund] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [ShareTransferFee] decimal(18, 2) NOT NULL DEFAULT ((25.00)),
        [DividendRate] decimal(18, 2) NOT NULL DEFAULT ((10.00)),
        [HasVotingRights] bit NOT NULL DEFAULT ((1)),
        [IsMobileCompulsory] bit NOT NULL DEFAULT ((1)),
        [IsAadhaarCompulsory] bit NOT NULL DEFAULT ((1)),
        [IsPanCompulsory] bit NOT NULL DEFAULT ((0)),
        [LoanEligibilityMultiplier] int NOT NULL DEFAULT ((10)),
        [EffectiveDate] datetime2 NOT NULL DEFAULT (getdate()),
        [IsActive] bit NOT NULL DEFAULT ((1)),
        [ShareCapitalLedgerID] int NULL,
        [EntranceFeeLedgerID] int NULL,
        [ShareTransferFeeLedgerID] int NULL,
        [BuildingFundLedgerID] int NULL,
        [DividendPayableLedgerID] int NULL,
        CONSTRAINT [PK__ShareSch__CD1CAD6305F8DC4F] PRIMARY KEY CLUSTERED ([ShareSchemeId])
    );
    PRINT 'Created table [ShareSchemes]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [ShareTransactions]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[ShareTransactions]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ShareTransactions] (
        [TransactionId] int IDENTITY(1,1) NOT NULL,
        [ShareAccountId] int NOT NULL,
        [TransactionDate] datetime2 NOT NULL,
        [TransactionType] nvarchar(50) NOT NULL,
        [NumberOfShares] int NOT NULL,
        [Amount] decimal(18, 2) NOT NULL,
        [Narration] nvarchar(255) NOT NULL,
        [VoucherId] int NULL,
        [CustomerID] int NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_ShareTransactions] PRIMARY KEY CLUSTERED ([TransactionId])
    );
    PRINT 'Created table [ShareTransactions]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SystemNotifications]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SystemNotifications]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SystemNotifications] (
        [NotificationID] bigint IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL DEFAULT ((1)),
        [UserID] int NULL,
        [RoleName] nvarchar(50) NULL,
        [ModuleName] nvarchar(50) NOT NULL,
        [NotificationType] nvarchar(50) NOT NULL,
        [Title] nvarchar(250) NOT NULL,
        [Description] nvarchar(500) NOT NULL,
        [Priority] nvarchar(20) NOT NULL DEFAULT ('MEDIUM'),
        [TargetTab] nvarchar(100) NOT NULL,
        [EntityName] nvarchar(50) NULL,
        [EntityID] nvarchar(50) NULL,
        [Amount] decimal(18, 2) NULL,
        [DueDate] datetime2 NULL,
        [Status] nvarchar(20) NOT NULL DEFAULT ('Active'),
        [CreatedOn] datetime2 NOT NULL DEFAULT (getdate()),
        [CompletedOn] datetime2 NULL,
        [CompletedBy] int NULL,
        CONSTRAINT [PK__SystemNo__20CF2E3260FC61CA] PRIMARY KEY CLUSTERED ([NotificationID])
    );
    PRINT 'Created table [SystemNotifications]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [SystemVersionHistories]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[SystemVersionHistories]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[SystemVersionHistories] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [VersionNumber] nvarchar(50) NOT NULL,
        [AppliedOn] datetime2 NOT NULL DEFAULT (getutcdate()),
        [PatchName] nvarchar(150) NOT NULL,
        [Status] nvarchar(50) NOT NULL DEFAULT ('SUCCESS'),
        [Remarks] nvarchar(MAX) NULL,
        [AppliedBy] nvarchar(100) NULL,
        CONSTRAINT [PK__SystemVe__3214EC071AF3F935] PRIMARY KEY CLUSTERED ([Id])
    );
    PRINT 'Created table [SystemVersionHistories]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [UserLoginAudits]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[UserLoginAudits]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[UserLoginAudits] (
        [AuditID] int IDENTITY(1,1) NOT NULL,
        [UserID] int NOT NULL,
        [LoginTime] datetime2 NOT NULL,
        [LogoutTime] datetime2 NULL,
        [IPAddress] nvarchar(50) NULL,
        [DeviceDetails] nvarchar(255) NULL,
        [Status] nvarchar(50) NOT NULL,
        CONSTRAINT [PK_UserLoginAudits] PRIMARY KEY CLUSTERED ([AuditID])
    );
    PRINT 'Created table [UserLoginAudits]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Users]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Users]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Users] (
        [UserID] int IDENTITY(1,1) NOT NULL,
        [Username] nvarchar(50) NOT NULL,
        [PasswordHash] nvarchar(255) NOT NULL,
        [RoleID] int NOT NULL,
        [DefaultBranchID] int NULL,
        [IsActive] bit NOT NULL,
        [IsLocked] bit NOT NULL,
        [FailedLoginAttempts] int NOT NULL,
        [RequirePasswordChange] bit NOT NULL,
        [LastPasswordChangeDate] datetime2 NULL,
        [LastLoginDate] datetime2 NULL,
        [ActiveSessionToken] nvarchar(1000) NULL,
        [Email] nvarchar(100) NULL,
        [MobileNumber] nvarchar(20) NULL,
        CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([UserID])
    );
    PRINT 'Created table [Users]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [VoucherDetails]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[VoucherDetails]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[VoucherDetails] (
        [VoucherDetailID] int IDENTITY(1,1) NOT NULL,
        [VoucherID] int NOT NULL,
        [LedgerID] int NOT NULL,
        [MemberID] int NULL,
        [DrCr] nvarchar(2) NOT NULL,
        [Amount] decimal(18, 2) NOT NULL,
        CONSTRAINT [PK_VoucherDetails] PRIMARY KEY CLUSTERED ([VoucherDetailID])
    );
    PRINT 'Created table [VoucherDetails]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [VoucherMappings]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[VoucherMappings]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[VoucherMappings] (
        [MappingID] int IDENTITY(1,1) NOT NULL,
        [TransactionType] nvarchar(100) NOT NULL,
        [DebitLedgerID] int NULL,
        [CreditLedgerID] int NULL,
        CONSTRAINT [PK_VoucherMappings] PRIMARY KEY CLUSTERED ([MappingID])
    );
    PRINT 'Created table [VoucherMappings]';
END;
GO

-- -----------------------------------------------------------------------------------------
-- Table: [Vouchers]
-- -----------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.[Vouchers]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Vouchers] (
        [VoucherID] int IDENTITY(1,1) NOT NULL,
        [BranchID] int NOT NULL,
        [VoucherNo] nvarchar(50) NOT NULL,
        [VoucherDate] datetime2 NOT NULL,
        [VoucherType] nvarchar(20) NOT NULL,
        [Narration] nvarchar(500) NULL,
        [TotalAmount] decimal(18, 2) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [ApprovedBy] int NULL,
        [ApprovedOn] datetime2 NULL,
        [RejectionReason] nvarchar(500) NULL,
        [ScrollNo] int NULL,
        CONSTRAINT [PK_Vouchers] PRIMARY KEY CLUSTERED ([VoucherID])
    );
    PRINT 'Created table [Vouchers]';
END;
GO

-- =========================================================================================
-- INDEXES
-- =========================================================================================
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AccountGroups_ParentGroupID' AND object_id = OBJECT_ID('dbo.[AccountGroups]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AccountGroups_ParentGroupID] ON dbo.[AccountGroups] ([ParentGroupID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetAllocations_AllocatedBranchID' AND object_id = OBJECT_ID('dbo.[AssetAllocations]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetAllocations_AllocatedBranchID] ON dbo.[AssetAllocations] ([AllocatedBranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetAllocations_AssetID' AND object_id = OBJECT_ID('dbo.[AssetAllocations]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetAllocations_AssetID] ON dbo.[AssetAllocations] ([AssetID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetAllocations_BranchID' AND object_id = OBJECT_ID('dbo.[AssetAllocations]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetAllocations_BranchID] ON dbo.[AssetAllocations] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetAllocations_FinancialYearID' AND object_id = OBJECT_ID('dbo.[AssetAllocations]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetAllocations_FinancialYearID] ON dbo.[AssetAllocations] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetCategories_BranchID' AND object_id = OBJECT_ID('dbo.[AssetCategories]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetCategories_BranchID] ON dbo.[AssetCategories] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetCategories_FinancialYearID' AND object_id = OBJECT_ID('dbo.[AssetCategories]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetCategories_FinancialYearID] ON dbo.[AssetCategories] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetDepreciations_AssetID' AND object_id = OBJECT_ID('dbo.[AssetDepreciations]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetDepreciations_AssetID] ON dbo.[AssetDepreciations] ([AssetID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetDepreciations_BranchID' AND object_id = OBJECT_ID('dbo.[AssetDepreciations]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetDepreciations_BranchID] ON dbo.[AssetDepreciations] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetDepreciations_FinancialYearID' AND object_id = OBJECT_ID('dbo.[AssetDepreciations]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetDepreciations_FinancialYearID] ON dbo.[AssetDepreciations] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetDepreciations_VoucherID' AND object_id = OBJECT_ID('dbo.[AssetDepreciations]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetDepreciations_VoucherID] ON dbo.[AssetDepreciations] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetDisposals_AssetID' AND object_id = OBJECT_ID('dbo.[AssetDisposals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetDisposals_AssetID] ON dbo.[AssetDisposals] ([AssetID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetDisposals_BranchID' AND object_id = OBJECT_ID('dbo.[AssetDisposals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetDisposals_BranchID] ON dbo.[AssetDisposals] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetDisposals_FinancialYearID' AND object_id = OBJECT_ID('dbo.[AssetDisposals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetDisposals_FinancialYearID] ON dbo.[AssetDisposals] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetDisposals_VoucherID' AND object_id = OBJECT_ID('dbo.[AssetDisposals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetDisposals_VoucherID] ON dbo.[AssetDisposals] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetMaintenances_AssetID' AND object_id = OBJECT_ID('dbo.[AssetMaintenances]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetMaintenances_AssetID] ON dbo.[AssetMaintenances] ([AssetID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetMaintenances_BranchID' AND object_id = OBJECT_ID('dbo.[AssetMaintenances]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetMaintenances_BranchID] ON dbo.[AssetMaintenances] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetMaintenances_FinancialYearID' AND object_id = OBJECT_ID('dbo.[AssetMaintenances]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetMaintenances_FinancialYearID] ON dbo.[AssetMaintenances] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetMaintenances_VoucherID' AND object_id = OBJECT_ID('dbo.[AssetMaintenances]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetMaintenances_VoucherID] ON dbo.[AssetMaintenances] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetPurchases_BankLedgerID' AND object_id = OBJECT_ID('dbo.[AssetPurchases]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetPurchases_BankLedgerID] ON dbo.[AssetPurchases] ([BankLedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetPurchases_BranchID' AND object_id = OBJECT_ID('dbo.[AssetPurchases]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetPurchases_BranchID] ON dbo.[AssetPurchases] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetPurchases_FinancialYearID' AND object_id = OBJECT_ID('dbo.[AssetPurchases]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetPurchases_FinancialYearID] ON dbo.[AssetPurchases] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetPurchases_VoucherID' AND object_id = OBJECT_ID('dbo.[AssetPurchases]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetPurchases_VoucherID] ON dbo.[AssetPurchases] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Assets_BranchID' AND object_id = OBJECT_ID('dbo.[Assets]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Assets_BranchID] ON dbo.[Assets] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Assets_CategoryID' AND object_id = OBJECT_ID('dbo.[Assets]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Assets_CategoryID] ON dbo.[Assets] ([CategoryID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Assets_FinancialYearID' AND object_id = OBJECT_ID('dbo.[Assets]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Assets_FinancialYearID] ON dbo.[Assets] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetTransfers_AssetID' AND object_id = OBJECT_ID('dbo.[AssetTransfers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetTransfers_AssetID] ON dbo.[AssetTransfers] ([AssetID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetTransfers_BranchID' AND object_id = OBJECT_ID('dbo.[AssetTransfers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetTransfers_BranchID] ON dbo.[AssetTransfers] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetTransfers_FinancialYearID' AND object_id = OBJECT_ID('dbo.[AssetTransfers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetTransfers_FinancialYearID] ON dbo.[AssetTransfers] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetTransfers_FromBranchID' AND object_id = OBJECT_ID('dbo.[AssetTransfers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetTransfers_FromBranchID] ON dbo.[AssetTransfers] ([FromBranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetTransfers_ToBranchID' AND object_id = OBJECT_ID('dbo.[AssetTransfers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetTransfers_ToBranchID] ON dbo.[AssetTransfers] ([ToBranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetVerifications_AssetID' AND object_id = OBJECT_ID('dbo.[AssetVerifications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetVerifications_AssetID] ON dbo.[AssetVerifications] ([AssetID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetVerifications_BranchID' AND object_id = OBJECT_ID('dbo.[AssetVerifications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetVerifications_BranchID] ON dbo.[AssetVerifications] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AssetVerifications_FinancialYearID' AND object_id = OBJECT_ID('dbo.[AssetVerifications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AssetVerifications_FinancialYearID] ON dbo.[AssetVerifications] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_AuditLedgerMappings_CategoryCode' AND object_id = OBJECT_ID('dbo.[AuditLedgerMappings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AuditLedgerMappings_CategoryCode] ON dbo.[AuditLedgerMappings] ([CategoryCode] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_BorrowerLinkedAccounts_LinkedMemberID' AND object_id = OBJECT_ID('dbo.[BorrowerLinkedAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_BorrowerLinkedAccounts_LinkedMemberID] ON dbo.[BorrowerLinkedAccounts] ([LinkedMemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_BorrowerLinkedAccounts_ParentMemberID' AND object_id = OBJECT_ID('dbo.[BorrowerLinkedAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_BorrowerLinkedAccounts_ParentMemberID] ON dbo.[BorrowerLinkedAccounts] ([ParentMemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_BranchDayEndStatuses_BranchID' AND object_id = OBJECT_ID('dbo.[BranchDayEndStatuses]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_BranchDayEndStatuses_BranchID] ON dbo.[BranchDayEndStatuses] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_CollateralComplianceLogs_LoanAccountID' AND object_id = OBJECT_ID('dbo.[CollateralComplianceLogs]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_CollateralComplianceLogs_LoanAccountID] ON dbo.[CollateralComplianceLogs] ([LoanAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_CommitteeMembers_MemberID' AND object_id = OBJECT_ID('dbo.[CommitteeMembers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_CommitteeMembers_MemberID] ON dbo.[CommitteeMembers] ([MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Customers_AadhaarNo' AND object_id = OBJECT_ID('dbo.[Customers]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_Customers_AadhaarNo] ON dbo.[Customers] ([AadhaarNo] ASC) WHERE ([AadhaarNo] IS NOT NULL AND [AadhaarNo]<>'' AND [IsDeleted]=(0));
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Customers_CIFNo' AND object_id = OBJECT_ID('dbo.[Customers]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_Customers_CIFNo] ON dbo.[Customers] ([CIFNo] ASC) WHERE ([CIFNo] IS NOT NULL AND [CIFNo]<>'' AND [IsDeleted]=(0));
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Customers_MobileNo' AND object_id = OBJECT_ID('dbo.[Customers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Customers_MobileNo] ON dbo.[Customers] ([MobileNo] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_DemandMemberDetails_DemandNoticeId' AND object_id = OBJECT_ID('dbo.[DemandMemberDetails]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_DemandMemberDetails_DemandNoticeId] ON dbo.[DemandMemberDetails] ([DemandNoticeId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_DemandMemberDetails_MemberId' AND object_id = OBJECT_ID('dbo.[DemandMemberDetails]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_DemandMemberDetails_MemberId] ON dbo.[DemandMemberDetails] ([MemberId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_DemandNotices_BranchId' AND object_id = OBJECT_ID('dbo.[DemandNotices]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_DemandNotices_BranchId] ON dbo.[DemandNotices] ([BranchId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_DemandNotices_EmployerId' AND object_id = OBJECT_ID('dbo.[DemandNotices]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_DemandNotices_EmployerId] ON dbo.[DemandNotices] ([EmployerId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_DemandRecoveries_DemandNoticeId' AND object_id = OBJECT_ID('dbo.[DemandRecoveries]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_DemandRecoveries_DemandNoticeId] ON dbo.[DemandRecoveries] ([DemandNoticeId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_DemandRecoveries_VoucherId' AND object_id = OBJECT_ID('dbo.[DemandRecoveries]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_DemandRecoveries_VoucherId] ON dbo.[DemandRecoveries] ([VoucherId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_DividendDistributions_ShareAccountId' AND object_id = OBJECT_ID('dbo.[DividendDistributions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_DividendDistributions_ShareAccountId] ON dbo.[DividendDistributions] ([ShareAccountId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_DividendDistributions_VoucherId' AND object_id = OBJECT_ID('dbo.[DividendDistributions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_DividendDistributions_VoucherId] ON dbo.[DividendDistributions] ([VoucherId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_EmployeeBankDetails_BranchID' AND object_id = OBJECT_ID('dbo.[EmployeeBankDetails]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_EmployeeBankDetails_BranchID] ON dbo.[EmployeeBankDetails] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_EmployeeBankDetails_CIFNo' AND object_id = OBJECT_ID('dbo.[EmployeeBankDetails]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_EmployeeBankDetails_CIFNo] ON dbo.[EmployeeBankDetails] ([CIFNo] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_EmployeeBankDetails_DepartmentID' AND object_id = OBJECT_ID('dbo.[EmployeeBankDetails]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_EmployeeBankDetails_DepartmentID] ON dbo.[EmployeeBankDetails] ([DepartmentID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_EmployeeBankDetails_EmployeeID' AND object_id = OBJECT_ID('dbo.[EmployeeBankDetails]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_EmployeeBankDetails_EmployeeID] ON dbo.[EmployeeBankDetails] ([EmployeeID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_EodBatchProcessLogs_BranchID' AND object_id = OBJECT_ID('dbo.[EodBatchProcessLogs]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_EodBatchProcessLogs_BranchID] ON dbo.[EodBatchProcessLogs] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdAccounts_BankAccountLedgerID' AND object_id = OBJECT_ID('dbo.[FdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdAccounts_BankAccountLedgerID] ON dbo.[FdAccounts] ([BankAccountLedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdAccounts_BranchID' AND object_id = OBJECT_ID('dbo.[FdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdAccounts_BranchID] ON dbo.[FdAccounts] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdAccounts_FdSchemeID' AND object_id = OBJECT_ID('dbo.[FdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdAccounts_FdSchemeID] ON dbo.[FdAccounts] ([FdSchemeID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdAccounts_FinancialYearID' AND object_id = OBJECT_ID('dbo.[FdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdAccounts_FinancialYearID] ON dbo.[FdAccounts] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdAccounts_MemberID' AND object_id = OBJECT_ID('dbo.[FdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdAccounts_MemberID] ON dbo.[FdAccounts] ([MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdAccounts_SavingAccountID' AND object_id = OBJECT_ID('dbo.[FdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdAccounts_SavingAccountID] ON dbo.[FdAccounts] ([SavingAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdAccountSequences_BranchID' AND object_id = OBJECT_ID('dbo.[FdAccountSequences]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdAccountSequences_BranchID] ON dbo.[FdAccountSequences] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdInterestAccruals_BranchID' AND object_id = OBJECT_ID('dbo.[FdInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdInterestAccruals_BranchID] ON dbo.[FdInterestAccruals] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdInterestAccruals_FdAccountID' AND object_id = OBJECT_ID('dbo.[FdInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdInterestAccruals_FdAccountID] ON dbo.[FdInterestAccruals] ([FdAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdInterestAccruals_FinancialYearID' AND object_id = OBJECT_ID('dbo.[FdInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdInterestAccruals_FinancialYearID] ON dbo.[FdInterestAccruals] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdInterestAccruals_VoucherID' AND object_id = OBJECT_ID('dbo.[FdInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdInterestAccruals_VoucherID] ON dbo.[FdInterestAccruals] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdSchemes_BranchID' AND object_id = OBJECT_ID('dbo.[FdSchemes]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdSchemes_BranchID] ON dbo.[FdSchemes] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdTransactions_BranchID' AND object_id = OBJECT_ID('dbo.[FdTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdTransactions_BranchID] ON dbo.[FdTransactions] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdTransactions_FdAccountID' AND object_id = OBJECT_ID('dbo.[FdTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdTransactions_FdAccountID] ON dbo.[FdTransactions] ([FdAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdTransactions_FinancialYearID' AND object_id = OBJECT_ID('dbo.[FdTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdTransactions_FinancialYearID] ON dbo.[FdTransactions] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdTransactions_VoucherID' AND object_id = OBJECT_ID('dbo.[FdTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdTransactions_VoucherID] ON dbo.[FdTransactions] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_GoldLoanDetails_LoanAccountID' AND object_id = OBJECT_ID('dbo.[GoldLoanDetails]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_GoldLoanDetails_LoanAccountID] ON dbo.[GoldLoanDetails] ([LoanAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentAccounts_BranchID' AND object_id = OBJECT_ID('dbo.[InvestmentAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentAccounts_BranchID] ON dbo.[InvestmentAccounts] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentAccounts_FinancialYearID' AND object_id = OBJECT_ID('dbo.[InvestmentAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentAccounts_FinancialYearID] ON dbo.[InvestmentAccounts] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentAccounts_InvestmentInstitutionID' AND object_id = OBJECT_ID('dbo.[InvestmentAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentAccounts_InvestmentInstitutionID] ON dbo.[InvestmentAccounts] ([InvestmentInstitutionID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentAccounts_SchemeID' AND object_id = OBJECT_ID('dbo.[InvestmentAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentAccounts_SchemeID] ON dbo.[InvestmentAccounts] ([SchemeID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentAccountSequences_BranchID' AND object_id = OBJECT_ID('dbo.[InvestmentAccountSequences]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentAccountSequences_BranchID] ON dbo.[InvestmentAccountSequences] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentInstitutions_BranchID' AND object_id = OBJECT_ID('dbo.[InvestmentInstitutions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentInstitutions_BranchID] ON dbo.[InvestmentInstitutions] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentInterestAccruals_BranchID' AND object_id = OBJECT_ID('dbo.[InvestmentInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentInterestAccruals_BranchID] ON dbo.[InvestmentInterestAccruals] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentInterestAccruals_FinancialYearID' AND object_id = OBJECT_ID('dbo.[InvestmentInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentInterestAccruals_FinancialYearID] ON dbo.[InvestmentInterestAccruals] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentInterestAccruals_InvestmentAccountID' AND object_id = OBJECT_ID('dbo.[InvestmentInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentInterestAccruals_InvestmentAccountID] ON dbo.[InvestmentInterestAccruals] ([InvestmentAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentInterestAccruals_VoucherID' AND object_id = OBJECT_ID('dbo.[InvestmentInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentInterestAccruals_VoucherID] ON dbo.[InvestmentInterestAccruals] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentInterestReceipts_BranchID' AND object_id = OBJECT_ID('dbo.[InvestmentInterestReceipts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentInterestReceipts_BranchID] ON dbo.[InvestmentInterestReceipts] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentInterestReceipts_FinancialYearID' AND object_id = OBJECT_ID('dbo.[InvestmentInterestReceipts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentInterestReceipts_FinancialYearID] ON dbo.[InvestmentInterestReceipts] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentInterestReceipts_InvestmentAccountID' AND object_id = OBJECT_ID('dbo.[InvestmentInterestReceipts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentInterestReceipts_InvestmentAccountID] ON dbo.[InvestmentInterestReceipts] ([InvestmentAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentInterestReceipts_VoucherID' AND object_id = OBJECT_ID('dbo.[InvestmentInterestReceipts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentInterestReceipts_VoucherID] ON dbo.[InvestmentInterestReceipts] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentMaturities_BranchID' AND object_id = OBJECT_ID('dbo.[InvestmentMaturities]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentMaturities_BranchID] ON dbo.[InvestmentMaturities] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentMaturities_FinancialYearID' AND object_id = OBJECT_ID('dbo.[InvestmentMaturities]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentMaturities_FinancialYearID] ON dbo.[InvestmentMaturities] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentMaturities_InvestmentAccountID' AND object_id = OBJECT_ID('dbo.[InvestmentMaturities]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentMaturities_InvestmentAccountID] ON dbo.[InvestmentMaturities] ([InvestmentAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentMaturities_VoucherID' AND object_id = OBJECT_ID('dbo.[InvestmentMaturities]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentMaturities_VoucherID] ON dbo.[InvestmentMaturities] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentPrematureWithdrawals_BranchID' AND object_id = OBJECT_ID('dbo.[InvestmentPrematureWithdrawals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentPrematureWithdrawals_BranchID] ON dbo.[InvestmentPrematureWithdrawals] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentPrematureWithdrawals_FinancialYearID' AND object_id = OBJECT_ID('dbo.[InvestmentPrematureWithdrawals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentPrematureWithdrawals_FinancialYearID] ON dbo.[InvestmentPrematureWithdrawals] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentPrematureWithdrawals_InvestmentAccountID' AND object_id = OBJECT_ID('dbo.[InvestmentPrematureWithdrawals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentPrematureWithdrawals_InvestmentAccountID] ON dbo.[InvestmentPrematureWithdrawals] ([InvestmentAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentPrematureWithdrawals_VoucherID' AND object_id = OBJECT_ID('dbo.[InvestmentPrematureWithdrawals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentPrematureWithdrawals_VoucherID] ON dbo.[InvestmentPrematureWithdrawals] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentRenewals_BranchID' AND object_id = OBJECT_ID('dbo.[InvestmentRenewals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentRenewals_BranchID] ON dbo.[InvestmentRenewals] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentRenewals_FinancialYearID' AND object_id = OBJECT_ID('dbo.[InvestmentRenewals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentRenewals_FinancialYearID] ON dbo.[InvestmentRenewals] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentRenewals_NewInvestmentAccountID' AND object_id = OBJECT_ID('dbo.[InvestmentRenewals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentRenewals_NewInvestmentAccountID] ON dbo.[InvestmentRenewals] ([NewInvestmentAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentRenewals_OldInvestmentAccountID' AND object_id = OBJECT_ID('dbo.[InvestmentRenewals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentRenewals_OldInvestmentAccountID] ON dbo.[InvestmentRenewals] ([OldInvestmentAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentRenewals_VoucherID' AND object_id = OBJECT_ID('dbo.[InvestmentRenewals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentRenewals_VoucherID] ON dbo.[InvestmentRenewals] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentSchemes_BranchID' AND object_id = OBJECT_ID('dbo.[InvestmentSchemes]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentSchemes_BranchID] ON dbo.[InvestmentSchemes] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentSchemes_InterestIncomeLedgerID' AND object_id = OBJECT_ID('dbo.[InvestmentSchemes]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentSchemes_InterestIncomeLedgerID] ON dbo.[InvestmentSchemes] ([InterestIncomeLedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentSchemes_InterestReceivableLedgerID' AND object_id = OBJECT_ID('dbo.[InvestmentSchemes]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentSchemes_InterestReceivableLedgerID] ON dbo.[InvestmentSchemes] ([InterestReceivableLedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentSchemes_InvestmentAssetLedgerID' AND object_id = OBJECT_ID('dbo.[InvestmentSchemes]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentSchemes_InvestmentAssetLedgerID] ON dbo.[InvestmentSchemes] ([InvestmentAssetLedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentSchemes_InvestmentInstitutionID' AND object_id = OBJECT_ID('dbo.[InvestmentSchemes]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentSchemes_InvestmentInstitutionID] ON dbo.[InvestmentSchemes] ([InvestmentInstitutionID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_InvestmentVoucherMappings_BranchID' AND object_id = OBJECT_ID('dbo.[InvestmentVoucherMappings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_InvestmentVoucherMappings_BranchID] ON dbo.[InvestmentVoucherMappings] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Ledgers_GroupID' AND object_id = OBJECT_ID('dbo.[Ledgers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Ledgers_GroupID] ON dbo.[Ledgers] ([GroupID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccountNpaStatuses_LastClassificationRunId' AND object_id = OBJECT_ID('dbo.[LoanAccountNpaStatuses]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccountNpaStatuses_LastClassificationRunId] ON dbo.[LoanAccountNpaStatuses] ([LastClassificationRunId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccountNpaStatuses_LoanAccountID' AND object_id = OBJECT_ID('dbo.[LoanAccountNpaStatuses]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccountNpaStatuses_LoanAccountID] ON dbo.[LoanAccountNpaStatuses] ([LoanAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccounts_BranchID' AND object_id = OBJECT_ID('dbo.[LoanAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_BranchID] ON dbo.[LoanAccounts] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccounts_CoMember2ID' AND object_id = OBJECT_ID('dbo.[LoanAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_CoMember2ID] ON dbo.[LoanAccounts] ([CoMember2ID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccounts_CoMemberID' AND object_id = OBJECT_ID('dbo.[LoanAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_CoMemberID] ON dbo.[LoanAccounts] ([CoMemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccounts_Guarantor1MemberID' AND object_id = OBJECT_ID('dbo.[LoanAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_Guarantor1MemberID] ON dbo.[LoanAccounts] ([Guarantor1MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccounts_Guarantor2MemberID' AND object_id = OBJECT_ID('dbo.[LoanAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_Guarantor2MemberID] ON dbo.[LoanAccounts] ([Guarantor2MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccounts_LoanApplicationID' AND object_id = OBJECT_ID('dbo.[LoanAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_LoanApplicationID] ON dbo.[LoanAccounts] ([LoanApplicationID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccounts_LoanRateID' AND object_id = OBJECT_ID('dbo.[LoanAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_LoanRateID] ON dbo.[LoanAccounts] ([LoanRateID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccounts_MemberID' AND object_id = OBJECT_ID('dbo.[LoanAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_MemberID] ON dbo.[LoanAccounts] ([MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanAccounts_RecommendedByDirectorID' AND object_id = OBJECT_ID('dbo.[LoanAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_RecommendedByDirectorID] ON dbo.[LoanAccounts] ([RecommendedByDirectorID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanApplications_CoMember2ID' AND object_id = OBJECT_ID('dbo.[LoanApplications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanApplications_CoMember2ID] ON dbo.[LoanApplications] ([CoMember2ID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanApplications_CoMemberID' AND object_id = OBJECT_ID('dbo.[LoanApplications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanApplications_CoMemberID] ON dbo.[LoanApplications] ([CoMemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanApplications_Guarantor1MemberID' AND object_id = OBJECT_ID('dbo.[LoanApplications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanApplications_Guarantor1MemberID] ON dbo.[LoanApplications] ([Guarantor1MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanApplications_Guarantor2MemberID' AND object_id = OBJECT_ID('dbo.[LoanApplications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanApplications_Guarantor2MemberID] ON dbo.[LoanApplications] ([Guarantor2MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanApplications_LoanRateID' AND object_id = OBJECT_ID('dbo.[LoanApplications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanApplications_LoanRateID] ON dbo.[LoanApplications] ([LoanRateID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanApplications_MemberID' AND object_id = OBJECT_ID('dbo.[LoanApplications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanApplications_MemberID] ON dbo.[LoanApplications] ([MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanApplications_RecommendedByDirectorID' AND object_id = OBJECT_ID('dbo.[LoanApplications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanApplications_RecommendedByDirectorID] ON dbo.[LoanApplications] ([RecommendedByDirectorID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanCollectionFees_LedgerID' AND object_id = OBJECT_ID('dbo.[LoanCollectionFees]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanCollectionFees_LedgerID] ON dbo.[LoanCollectionFees] ([LedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanCollectionFees_LoanCollectionID' AND object_id = OBJECT_ID('dbo.[LoanCollectionFees]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanCollectionFees_LoanCollectionID] ON dbo.[LoanCollectionFees] ([LoanCollectionID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanCollections_CollectionDate' AND object_id = OBJECT_ID('dbo.[LoanCollections]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanCollections_CollectionDate] ON dbo.[LoanCollections] ([CollectionDate] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanCollections_LoanAccountID' AND object_id = OBJECT_ID('dbo.[LoanCollections]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanCollections_LoanAccountID] ON dbo.[LoanCollections] ([LoanAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanCollections_VoucherID' AND object_id = OBJECT_ID('dbo.[LoanCollections]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanCollections_VoucherID] ON dbo.[LoanCollections] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanDisbursementDeductions_LedgerID' AND object_id = OBJECT_ID('dbo.[LoanDisbursementDeductions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanDisbursementDeductions_LedgerID] ON dbo.[LoanDisbursementDeductions] ([LedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanDisbursementDeductions_LoanDisbursementID' AND object_id = OBJECT_ID('dbo.[LoanDisbursementDeductions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanDisbursementDeductions_LoanDisbursementID] ON dbo.[LoanDisbursementDeductions] ([LoanDisbursementID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanDisbursements_BankAccountLedgerID' AND object_id = OBJECT_ID('dbo.[LoanDisbursements]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanDisbursements_BankAccountLedgerID] ON dbo.[LoanDisbursements] ([BankAccountLedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanDisbursements_DisbursementDate' AND object_id = OBJECT_ID('dbo.[LoanDisbursements]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanDisbursements_DisbursementDate] ON dbo.[LoanDisbursements] ([DisbursementDate] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanDisbursements_LoanAccountID' AND object_id = OBJECT_ID('dbo.[LoanDisbursements]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanDisbursements_LoanAccountID] ON dbo.[LoanDisbursements] ([LoanAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanDisbursements_VoucherID' AND object_id = OBJECT_ID('dbo.[LoanDisbursements]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanDisbursements_VoucherID] ON dbo.[LoanDisbursements] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanDocuments_LoanAccountID' AND object_id = OBJECT_ID('dbo.[LoanDocuments]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanDocuments_LoanAccountID] ON dbo.[LoanDocuments] ([LoanAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_LoanInstallmentSchedules_LoanAccountID' AND object_id = OBJECT_ID('dbo.[LoanInstallmentSchedules]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanInstallmentSchedules_LoanAccountID] ON dbo.[LoanInstallmentSchedules] ([LoanAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_MemberOpeningBalances_LedgerID' AND object_id = OBJECT_ID('dbo.[MemberOpeningBalances]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_MemberOpeningBalances_LedgerID] ON dbo.[MemberOpeningBalances] ([LedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_MemberOpeningBalances_MemberID' AND object_id = OBJECT_ID('dbo.[MemberOpeningBalances]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_MemberOpeningBalances_MemberID] ON dbo.[MemberOpeningBalances] ([MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Members_AadhaarNo' AND object_id = OBJECT_ID('dbo.[Members]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_AadhaarNo] ON dbo.[Members] ([AadhaarNo] ASC) WHERE ([AadhaarNo] IS NOT NULL AND [AadhaarNo]<>'' AND [IsDeleted]=(0));
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Members_BranchID' AND object_id = OBJECT_ID('dbo.[Members]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Members_BranchID] ON dbo.[Members] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Members_CIFNo' AND object_id = OBJECT_ID('dbo.[Members]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_CIFNo] ON dbo.[Members] ([CIFNo] ASC) WHERE ([CIFNo] IS NOT NULL AND [CIFNo]<>'' AND [IsDeleted]=(0));
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Members_EmployerId' AND object_id = OBJECT_ID('dbo.[Members]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Members_EmployerId] ON dbo.[Members] ([EmployerId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Members_MemberCode' AND object_id = OBJECT_ID('dbo.[Members]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_MemberCode] ON dbo.[Members] ([MemberCode] ASC) WHERE ([MemberCode] IS NOT NULL AND [MemberCode]<>'' AND [IsDeleted]=(0));
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Members_MobileNo' AND object_id = OBJECT_ID('dbo.[Members]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Members_MobileNo] ON dbo.[Members] ([MobileNo] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Members_PANNo' AND object_id = OBJECT_ID('dbo.[Members]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_PANNo] ON dbo.[Members] ([PANNo] ASC) WHERE ([PANNo] IS NOT NULL AND [PANNo]<>'' AND [IsDeleted]=(0));
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Members_Village' AND object_id = OBJECT_ID('dbo.[Members]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Members_Village] ON dbo.[Members] ([Village] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_OverdueInterestLedgers_LoanAccountID' AND object_id = OBJECT_ID('dbo.[OverdueInterestLedgers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_OverdueInterestLedgers_LoanAccountID] ON dbo.[OverdueInterestLedgers] ([LoanAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_OverdueInterestLedgers_VoucherID' AND object_id = OBJECT_ID('dbo.[OverdueInterestLedgers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_OverdueInterestLedgers_VoucherID] ON dbo.[OverdueInterestLedgers] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_OverdueRecoveryLedgers_LoanAccountID' AND object_id = OBJECT_ID('dbo.[OverdueRecoveryLedgers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_OverdueRecoveryLedgers_LoanAccountID] ON dbo.[OverdueRecoveryLedgers] ([LoanAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_OverdueRecoveryLedgers_VoucherID' AND object_id = OBJECT_ID('dbo.[OverdueRecoveryLedgers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_OverdueRecoveryLedgers_VoucherID] ON dbo.[OverdueRecoveryLedgers] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyAccounts_BranchID' AND object_id = OBJECT_ID('dbo.[PigmyAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyAccounts_BranchID] ON dbo.[PigmyAccounts] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyAccounts_MemberID' AND object_id = OBJECT_ID('dbo.[PigmyAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyAccounts_MemberID] ON dbo.[PigmyAccounts] ([MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyAccounts_PigmyAgentID' AND object_id = OBJECT_ID('dbo.[PigmyAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyAccounts_PigmyAgentID] ON dbo.[PigmyAccounts] ([PigmyAgentID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyAccounts_PigmySchemeID' AND object_id = OBJECT_ID('dbo.[PigmyAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyAccounts_PigmySchemeID] ON dbo.[PigmyAccounts] ([PigmySchemeID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyAgentCashDeposits_AgentId' AND object_id = OBJECT_ID('dbo.[PigmyAgentCashDeposits]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyAgentCashDeposits_AgentId] ON dbo.[PigmyAgentCashDeposits] ([AgentId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyAgentCashDeposits_VoucherId' AND object_id = OBJECT_ID('dbo.[PigmyAgentCashDeposits]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyAgentCashDeposits_VoucherId] ON dbo.[PigmyAgentCashDeposits] ([VoucherId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyAgentCommissions_AgentId' AND object_id = OBJECT_ID('dbo.[PigmyAgentCommissions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyAgentCommissions_AgentId] ON dbo.[PigmyAgentCommissions] ([AgentId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyAgentCommissions_VoucherId' AND object_id = OBJECT_ID('dbo.[PigmyAgentCommissions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyAgentCommissions_VoucherId] ON dbo.[PigmyAgentCommissions] ([VoucherId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyAgents_BranchID' AND object_id = OBJECT_ID('dbo.[PigmyAgents]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyAgents_BranchID] ON dbo.[PigmyAgents] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyCollections_AgentId' AND object_id = OBJECT_ID('dbo.[PigmyCollections]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyCollections_AgentId] ON dbo.[PigmyCollections] ([AgentId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyCollections_PigmyAccountId_CollectionDate' AND object_id = OBJECT_ID('dbo.[PigmyCollections]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_PigmyCollections_PigmyAccountId_CollectionDate] ON dbo.[PigmyCollections] ([PigmyAccountId] ASC, [CollectionDate] ASC) WHERE ([CollectionSource] IN ('MANUAL', 'IMPORT'));
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyCollections_VoucherId' AND object_id = OBJECT_ID('dbo.[PigmyCollections]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyCollections_VoucherId] ON dbo.[PigmyCollections] ([VoucherId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'UQ_PigmyCollections_TransactionId' AND object_id = OBJECT_ID('dbo.[PigmyCollections]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_PigmyCollections_TransactionId] ON dbo.[PigmyCollections] ([TransactionId] ASC) WHERE ([TransactionId] IS NOT NULL);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyCommissionSettings_AgentId' AND object_id = OBJECT_ID('dbo.[PigmyCommissionSettings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyCommissionSettings_AgentId] ON dbo.[PigmyCommissionSettings] ([AgentId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyInterestLogs_PigmyAccountId' AND object_id = OBJECT_ID('dbo.[PigmyInterestLogs]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyInterestLogs_PigmyAccountId] ON dbo.[PigmyInterestLogs] ([PigmyAccountId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyInterestLogs_VoucherId' AND object_id = OBJECT_ID('dbo.[PigmyInterestLogs]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyInterestLogs_VoucherId] ON dbo.[PigmyInterestLogs] ([VoucherId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyOpeningBalances_PigmyAccountID' AND object_id = OBJECT_ID('dbo.[PigmyOpeningBalances]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyOpeningBalances_PigmyAccountID] ON dbo.[PigmyOpeningBalances] ([PigmyAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyTransactions_PigmyAccountID' AND object_id = OBJECT_ID('dbo.[PigmyTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyTransactions_PigmyAccountID] ON dbo.[PigmyTransactions] ([PigmyAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyVoucherMappings_BranchId' AND object_id = OBJECT_ID('dbo.[PigmyVoucherMappings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyVoucherMappings_BranchId] ON dbo.[PigmyVoucherMappings] ([BranchId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyVoucherMappings_CreditLedgerId' AND object_id = OBJECT_ID('dbo.[PigmyVoucherMappings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyVoucherMappings_CreditLedgerId] ON dbo.[PigmyVoucherMappings] ([CreditLedgerId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyVoucherMappings_DebitLedgerId' AND object_id = OBJECT_ID('dbo.[PigmyVoucherMappings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyVoucherMappings_DebitLedgerId] ON dbo.[PigmyVoucherMappings] ([DebitLedgerId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdAccounts_BranchID' AND object_id = OBJECT_ID('dbo.[RdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdAccounts_BranchID] ON dbo.[RdAccounts] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdAccounts_FinancialYearID' AND object_id = OBJECT_ID('dbo.[RdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdAccounts_FinancialYearID] ON dbo.[RdAccounts] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdAccounts_MemberID' AND object_id = OBJECT_ID('dbo.[RdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdAccounts_MemberID] ON dbo.[RdAccounts] ([MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdAccounts_RdSchemeID' AND object_id = OBJECT_ID('dbo.[RdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdAccounts_RdSchemeID] ON dbo.[RdAccounts] ([RdSchemeID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdAccountSequences_BranchID' AND object_id = OBJECT_ID('dbo.[RdAccountSequences]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdAccountSequences_BranchID] ON dbo.[RdAccountSequences] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdInterestAccruals_BranchID' AND object_id = OBJECT_ID('dbo.[RdInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdInterestAccruals_BranchID] ON dbo.[RdInterestAccruals] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdInterestAccruals_FinancialYearID' AND object_id = OBJECT_ID('dbo.[RdInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdInterestAccruals_FinancialYearID] ON dbo.[RdInterestAccruals] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdInterestAccruals_RdAccountID' AND object_id = OBJECT_ID('dbo.[RdInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdInterestAccruals_RdAccountID] ON dbo.[RdInterestAccruals] ([RdAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdInterestAccruals_VoucherID' AND object_id = OBJECT_ID('dbo.[RdInterestAccruals]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdInterestAccruals_VoucherID] ON dbo.[RdInterestAccruals] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdSchemes_BranchID' AND object_id = OBJECT_ID('dbo.[RdSchemes]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdSchemes_BranchID] ON dbo.[RdSchemes] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdTransactions_BranchID' AND object_id = OBJECT_ID('dbo.[RdTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdTransactions_BranchID] ON dbo.[RdTransactions] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdTransactions_FinancialYearID' AND object_id = OBJECT_ID('dbo.[RdTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdTransactions_FinancialYearID] ON dbo.[RdTransactions] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdTransactions_RdAccountID' AND object_id = OBJECT_ID('dbo.[RdTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdTransactions_RdAccountID] ON dbo.[RdTransactions] ([RdAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdTransactions_VoucherID' AND object_id = OBJECT_ID('dbo.[RdTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdTransactions_VoucherID] ON dbo.[RdTransactions] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingAccountClosings_SavingAccountID' AND object_id = OBJECT_ID('dbo.[SavingAccountClosings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingAccountClosings_SavingAccountID] ON dbo.[SavingAccountClosings] ([SavingAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingAccountJointHolders_MemberID' AND object_id = OBJECT_ID('dbo.[SavingAccountJointHolders]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingAccountJointHolders_MemberID] ON dbo.[SavingAccountJointHolders] ([MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingAccountJointHolders_SavingAccountID' AND object_id = OBJECT_ID('dbo.[SavingAccountJointHolders]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingAccountJointHolders_SavingAccountID] ON dbo.[SavingAccountJointHolders] ([SavingAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingAccountMasters_BranchID' AND object_id = OBJECT_ID('dbo.[SavingAccountMasters]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingAccountMasters_BranchID] ON dbo.[SavingAccountMasters] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingAccountMasters_LedgerID' AND object_id = OBJECT_ID('dbo.[SavingAccountMasters]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingAccountMasters_LedgerID] ON dbo.[SavingAccountMasters] ([LedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingAccountMasters_MemberID' AND object_id = OBJECT_ID('dbo.[SavingAccountMasters]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingAccountMasters_MemberID] ON dbo.[SavingAccountMasters] ([MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingInterestPostings_FinancialYearID' AND object_id = OBJECT_ID('dbo.[SavingInterestPostings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingInterestPostings_FinancialYearID] ON dbo.[SavingInterestPostings] ([FinancialYearID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingInterestSettings_LedgerID' AND object_id = OBJECT_ID('dbo.[SavingInterestSettings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingInterestSettings_LedgerID] ON dbo.[SavingInterestSettings] ([LedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingPassbooks_SavingAccountID' AND object_id = OBJECT_ID('dbo.[SavingPassbooks]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingPassbooks_SavingAccountID] ON dbo.[SavingPassbooks] ([SavingAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingPassbooks_TransactionID' AND object_id = OBJECT_ID('dbo.[SavingPassbooks]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingPassbooks_TransactionID] ON dbo.[SavingPassbooks] ([TransactionID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingTransactions_SavingAccountID' AND object_id = OBJECT_ID('dbo.[SavingTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingTransactions_SavingAccountID] ON dbo.[SavingTransactions] ([SavingAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingTransactions_TargetSavingAccountID' AND object_id = OBJECT_ID('dbo.[SavingTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingTransactions_TargetSavingAccountID] ON dbo.[SavingTransactions] ([TargetSavingAccountID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SavingVoucherMappings_LedgerID' AND object_id = OBJECT_ID('dbo.[SavingVoucherMappings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SavingVoucherMappings_LedgerID] ON dbo.[SavingVoucherMappings] ([LedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_ShareAccounts_MemberId' AND object_id = OBJECT_ID('dbo.[ShareAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_ShareAccounts_MemberId] ON dbo.[ShareAccounts] ([MemberId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_ShareCertificatePrintHistories_CertificateId' AND object_id = OBJECT_ID('dbo.[ShareCertificatePrintHistories]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_ShareCertificatePrintHistories_CertificateId] ON dbo.[ShareCertificatePrintHistories] ([CertificateId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_ShareCertificates_ShareAccountId' AND object_id = OBJECT_ID('dbo.[ShareCertificates]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_ShareCertificates_ShareAccountId] ON dbo.[ShareCertificates] ([ShareAccountId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_ShareTransactions_ShareAccountId' AND object_id = OBJECT_ID('dbo.[ShareTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_ShareTransactions_ShareAccountId] ON dbo.[ShareTransactions] ([ShareAccountId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_ShareTransactions_VoucherId' AND object_id = OBJECT_ID('dbo.[ShareTransactions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_ShareTransactions_VoucherId] ON dbo.[ShareTransactions] ([VoucherId] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SystemNotifications_Branch_Status_Priority' AND object_id = OBJECT_ID('dbo.[SystemNotifications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SystemNotifications_Branch_Status_Priority] ON dbo.[SystemNotifications] ([BranchID] ASC, [Status] ASC, [Priority] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_SystemNotifications_ModuleName_Status' AND object_id = OBJECT_ID('dbo.[SystemNotifications]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SystemNotifications_ModuleName_Status] ON dbo.[SystemNotifications] ([ModuleName] ASC, [Status] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_UserLoginAudits_UserID' AND object_id = OBJECT_ID('dbo.[UserLoginAudits]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UserLoginAudits_UserID] ON dbo.[UserLoginAudits] ([UserID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Users_DefaultBranchID' AND object_id = OBJECT_ID('dbo.[Users]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Users_DefaultBranchID] ON dbo.[Users] ([DefaultBranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Users_RoleID' AND object_id = OBJECT_ID('dbo.[Users]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Users_RoleID] ON dbo.[Users] ([RoleID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_VoucherDetails_LedgerID' AND object_id = OBJECT_ID('dbo.[VoucherDetails]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VoucherDetails_LedgerID] ON dbo.[VoucherDetails] ([LedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_VoucherDetails_LedgerID_DrCr' AND object_id = OBJECT_ID('dbo.[VoucherDetails]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VoucherDetails_LedgerID_DrCr] ON dbo.[VoucherDetails] ([Amount] ASC, [VoucherID] ASC, [LedgerID] ASC, [DrCr] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_VoucherDetails_MemberID' AND object_id = OBJECT_ID('dbo.[VoucherDetails]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VoucherDetails_MemberID] ON dbo.[VoucherDetails] ([MemberID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_VoucherDetails_VoucherID' AND object_id = OBJECT_ID('dbo.[VoucherDetails]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VoucherDetails_VoucherID] ON dbo.[VoucherDetails] ([VoucherID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_VoucherMappings_CreditLedgerID' AND object_id = OBJECT_ID('dbo.[VoucherMappings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VoucherMappings_CreditLedgerID] ON dbo.[VoucherMappings] ([CreditLedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_VoucherMappings_DebitLedgerID' AND object_id = OBJECT_ID('dbo.[VoucherMappings]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VoucherMappings_DebitLedgerID] ON dbo.[VoucherMappings] ([DebitLedgerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Vouchers_BranchID' AND object_id = OBJECT_ID('dbo.[Vouchers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Vouchers_BranchID] ON dbo.[Vouchers] ([BranchID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Vouchers_VoucherDate_BranchID' AND object_id = OBJECT_ID('dbo.[Vouchers]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Vouchers_VoucherDate_BranchID] ON dbo.[Vouchers] ([VoucherDate] ASC, [BranchID] ASC, [Status] ASC);
END;
GO

-- =========================================================================================
-- PRESERVED CORE MASTER SEED DATA (Chart of Accounts & Essential Configs)
-- =========================================================================================
SET NOCOUNT ON;
GO
-- Table Seed: [AccountGroups] (31 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[AccountGroups])
BEGIN
    SET IDENTITY_INSERT dbo.[AccountGroups] ON;
    INSERT INTO dbo.[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupNameEnglish], [DisplayOrder], [GroupCode]) VALUES
        (1, N'अधिकृत भागभांडवल ', NULL, N'Liabilities', 1, NULL, NULL, 1, NULL),
        (2, N'वसूल भागभांडवल ', NULL, N'Liabilities', 1, NULL, NULL, 1, NULL),
        (3, N'राखीव व इतर निधी ', NULL, N'Liabilities', 1, NULL, N'Reserve Fund', 2, NULL),
        (4, N'ठेवी ', NULL, N'Liabilities', 1, NULL, NULL, 2, NULL),
        (5, N'बँक कर्ज ', NULL, N'Liabilities', 1, NULL, NULL, 0, NULL),
        (6, N'इतर देणे ', NULL, N'Liabilities', 1, NULL, NULL, 5, NULL),
        (7, N'नफा ', NULL, N'Liabilities', 1, NULL, NULL, 6, NULL),
        (8, N'रोख शिल्लक ', NULL, N'Assets', 1, NULL, NULL, 1, NULL),
        (9, N'बँकातील शिल्लक ', NULL, N'Assets', 1, NULL, NULL, 0, NULL),
        (10, N'गुंतवणूक ', NULL, N'Assets', 1, NULL, NULL, 3, NULL),
        (11, N'कर्जे ', NULL, N'Assets', 1, NULL, NULL, 4, NULL),
        (12, N'मालमत्ता ', NULL, N'Assets', 1, NULL, NULL, 5, NULL),
        (13, N'इतर येणे ', NULL, N'Assets', 1, NULL, NULL, 6, NULL),
        (14, N'मिळालेले व्याज ', NULL, N'Income', 1, NULL, NULL, 0, NULL),
        (15, N'गुंतवणुकीवरील लाभांश  ', NULL, N'Income', 1, NULL, NULL, 4, NULL),
        (16, N'इतर उत्पन्न ', NULL, N'Income', 1, NULL, NULL, 1, NULL),
        (17, N'ठेवीवरील व्याज ', NULL, N'Expenses', 1, NULL, NULL, 3, NULL),
        (18, N'पगार व भत्ते ', NULL, N'Expenses', 1, NULL, NULL, 5, NULL),
        (19, N'स्टेशनरी व प्रिंटिंग ', NULL, N'Expenses', 1, NULL, NULL, 0, NULL),
        (20, N'कर व वीज ', NULL, N'Expenses', 1, NULL, NULL, 0, NULL),
        (21, N'झीज व घसारा ', NULL, N'Expenses', 1, NULL, NULL, 0, NULL),
        (22, N'इतर तरतुदी ', NULL, N'Expenses', 1, NULL, NULL, 0, NULL),
        (23, N'इतर किरकोळ खर्च ', NULL, N'Expenses', 1, NULL, NULL, 1, NULL),
        (25, N'इतर देणे', NULL, N'Liabilities', 1, NULL, NULL, 5, NULL),
        (26, N'शाखा येणे देणे ', NULL, N'Liabilities', 1, NULL, NULL, 0, NULL),
        (27, N'तरतुदी ', NULL, N'Liabilities', 1, NULL, NULL, 0, NULL),
        (28, N'शाखा येणे देणे ', NULL, N'Assets', 1, NULL, NULL, 0, NULL),
        (29, N'तोटा ', NULL, N'Assets', 1, NULL, NULL, 7, NULL),
        (30, N'कमिशन जमा ', NULL, N'Income', 1, NULL, NULL, 0, NULL),
        (31, N'बँक कमिशन व चार्जेस ', NULL, N'Expenses', 1, NULL, NULL, 1, NULL),
        (92, N'वसुल भाग भांडवल', NULL, N'Liabilities', 1, NULL, NULL, 1, NULL);
    SET IDENTITY_INSERT dbo.[AccountGroups] OFF;
    PRINT 'Seeded [AccountGroups] (31 records)';
END;
GO

-- Table Seed: [Ledgers] (195 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[Ledgers])
BEGIN
    SET IDENTITY_INSERT dbo.[Ledgers] ON;
    INSERT INTO dbo.[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES
        (1, N'सभासद भाग', 2, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (2, N'रिझर्व फंड ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, 2, NULL, 0, NULL),
        (3, N'इमारत निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, 4, NULL, 0, NULL),
        (4, N'लाभांश समीकरण निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, 3, NULL, 0, NULL),
        (5, N'अधिलाभांश निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (6, N'शैक्षणिक व सांस्कृतिक निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (7, N'सभासद कल्याण निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (8, N'धर्मादाय निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (9, N'सेवक कल्याण निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (10, N'सुवर्ण महोत्सव निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (11, N'सहकार प्रशिक्षण निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (12, N'उत्पादित जिंदगीवरील तरतुदी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (13, N'इमारत देखभाल निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (14, N'गुंतवणूक चढउतार निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (15, N'निवडणूक निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (16, N'इमारत झीज फंड ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (17, N'संगणक व तंत्रज्ञान निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (18, N'एन. पी. ए. ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (20, N'सेव्हिंग ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (21, N'श्री दत्त ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (22, N'मेंबर मुदतबंद ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, 18, NULL, 0, NULL),
        (23, N'दामदुप्पट ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (24, N'रिकारींग ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (25, N'पिग्मी ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (26, N'अधिकृत भागभांडवल ', 1, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (27, N'सांगली जिल्हा म. ठेव तारण सी. सी. ', 5, 0.00, N'Dr', N'ताळेबंद', N'Borrowing Account', 0, 1, NULL, NULL, 0, NULL),
        (28, N'विदर्भ कोकण ठेव तारण सी. सी. ', 5, 0.00, N'Dr', N'ताळेबंद', N'Borrowing Account', 0, 1, NULL, NULL, 0, NULL),
        (29, N'देणे सभासद ठेव व्याज ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (30, N'देणे आयकर सल्लागार फी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (31, N'सभासद अनामत ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, 72, NULL, 0, NULL),
        (32, N'देणे पाणीपट्टी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (33, N'देणे दत्त पूजा ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (34, N'देणे सभासद लाभांश ', 6, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (35, N'देणे वार्षिक सभा खर्च ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (36, N'देणे नोकर बोनस ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (37, N'बचत टी. डी. एस. ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (38, N'देणे सुवर्ण महोत्सव खर्च ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (39, N'देणे ऑडिट फी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (40, N'प्रवेश फी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (41, N'देणे सराफ फी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (42, N'देणे फोन बिल ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (43, N'देणे लाइट बिल ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (44, N'देणे नाममात्र फी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (45, N'शिल्लक नफा ', 7, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, 123, NULL, 0, NULL),
        (46, N'चालू नफा ', 7, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (47, N'हातावरील रोख शिल्लक ', 8, 0.00, N'Dr', N'ताळेबंद', N'Cash', 0, 1, NULL, NULL, 0, NULL),
        (48, N'नांदणी सहकारी बँक सेव्हिंग ', 9, 0.00, N'Dr', N'ताळेबंद', N'Bank Account', 0, 1, NULL, NULL, 0, NULL),
        (49, N'सारस्वत बँक बचत ', 9, 0.00, N'Dr', N'ताळेबंद', N'Bank Account', 0, 1, NULL, NULL, 0, NULL),
        (50, N'बँक ऑफ महाराष्ट्र', 9, 0.00, N'Dr', N'ताळेबंद', N'Bank Account', 0, 1, 308, NULL, 0, NULL),
        (51, N'विदर्भ कोकण ग्रामीण बँक ', 9, 0.00, N'Dr', N'ताळेबंद', N'Bank Account', 0, 1, NULL, NULL, 0, NULL),
        (52, N'सांगली मध्य. करंट ', 9, 0.00, N'Dr', N'ताळेबंद', N'Bank Account', 0, 1, NULL, NULL, 0, NULL),
        (53, N'रत्नाकर बँक करंट ', 9, 0.00, N'Dr', N'ताळेबंद', N'Bank Account', 0, 1, NULL, NULL, 0, NULL),
        (55, N'थकीत व्याज तरतूद खाते', 25, 0.00, N'Dr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL),
        (57, N'थकीत वसुली खर्च तरतूद खाते', 25, 0.00, N'Dr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL),
        (58, N'नाममात्र सभासद ', 2, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (59, N'महादेव सेव्हिंग ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (60, N'बुडीत फंड निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (61, N'संजीवनी ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (62, N'संस्था सेव्हिंग ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (63, N'सभासद वर्गणी ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (64, N'मावलाईदेवी दूध संस्था भविष्य निधी ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (65, N'शेअर्स एवजी ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (66, N'नॉन ऑफ खाते ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (67, N'देणे रिकरींग ठेव व्याज ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (68, N'देणे मुदत ठेवीवरील व्याज ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (69, N'नापरतावा ठेव व्याज ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (70, N'कर्मचारी भविष्य निर्वाह निधी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (71, N'कर्मचारी ग्रेड्युटी निधी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (72, N'कॅश सेक्युरिटी निधी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (73, N'सेवक एल. आय. सी.', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (74, N'सेवक व्यवसाय कर ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (75, N'सेवक व संचालक प्रशिक्षण फी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (76, N'देणे में. शेअर्स डिव्हिडंड ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (77, N'देणे वु. ए. सोसायटी ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (78, N'शाखा बांबवडे ', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (79, N'शाखा सोनावडे ', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (80, N'देणे एन. पी. ए. तरतूद ', 27, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (81, N'देणे थकव्याज तरतूद ', 27, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (82, N'देणे ऑडिट फी ', 27, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (83, N'उत्तम जिंदगीवरील एन.पी.ए. ', 27, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (84, N'बँक चालू ठेव (के. डी. सी.)', 9, 0.00, N'Dr', N'ताळेबंद', N'Bank Account', 0, 1, 319, NULL, 0, NULL),
        (85, N'कोडोली ना. पत संस्था सेव्हिंग ', 9, 0.00, N'Dr', N'ताळेबंद', N'Bank Account', 0, 1, NULL, NULL, 0, NULL),
        (86, N'के.डी.सी.सी. बँक शेअर्स ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (87, N'महाराष्ट्र राज्य फेडरेशन शेअर्स ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (88, N'के. डी. सी. सी. बँक मुदत ठेव ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (89, N'कोडोली ना. पतसंस्था मुदत ठेव ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (90, N'सेवक भविष्य निधी गुंतवणूक ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (91, N'सिद्धीविनायक मुदत बंद ठेव ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (92, N'के. डी. सी. सी. बँक रिझर्व फंड ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (93, N'के. डी. सी. सी. बँक बुडीत फंड ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (94, N'उदय सहकारी साखर कारखाना शेअर्स ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (95, N'के. डी. सी. सी.बँक आय. पी.डी. आय.', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (96, N'के. डी. सी. सी. बँक एल. टी. डी. गुंतवणूक ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (97, N'के. डी. सी. सी.बँक कर्मचारी ग्रॅज्युएटी ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (98, N'उदयगिरी शा. ता.खरेदी विक्री संघ शेअर्स ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (99, N'के. डी. सी. सी. इमारत निधी गुंतवणूक ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (100, N'के. डी. सी. सी. बँक झीज फंड गुंतवणूक ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (101, N'शिवनेरी को. ऑफ. सोसायटी गुंतवणूक ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (102, N'सुखकर्ता को ऑफ सोसायटी बांबवडे ', 10, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, NULL, 0, NULL),
        (103, N'में. पत कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, NULL, 0, NULL),
        (104, N'सोने तारण कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, NULL, 0, NULL),
        (105, N'ब वर्ग जामीनकी कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, NULL, 0, NULL),
        (106, N'मुदत ठेव तारण कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, NULL, 0, NULL),
        (107, N'गृहतारण कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, NULL, 0, NULL),
        (108, N'दूध संस्था म. मुदत कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, NULL, 0, NULL),
        (109, N'पिग्मी तारण कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, NULL, 0, NULL),
        (110, N'पगार तारण कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, NULL, 0, NULL),
        (111, N'वाहन तारण कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, NULL, 0, NULL),
        (112, N'डेडस्टॉक ', 12, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (113, N'संस्था इमारत ', 12, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (114, N'फर्निचर एडव्हान्स ', 12, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (115, N'संस्था फर्निचर हेड ऑफिस ', 12, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (116, N'संस्था फर्निचर शाखा बांबवडे ', 12, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (117, N'संस्था फर्निचर शाखा शाहूवाडी ', 12, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (118, N'संस्था फर्निचर शाखा सोनवडे ', 12, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (119, N'येणे शाखा शाहूवाडी ', 28, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (121, N'गुंतवणुकीवरील येणे व्याज ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (127, N'नळ डिपॉजिट ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (129, N'येणे ऑफिस भाडे ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (130, N'टेलिफोन डिपॉजिट ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (131, N'लॉकर डिपॉजिट ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (132, N'लाइट डिपॉजिट ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (133, N'सॉफ्टवेअर अडवांस ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, 242, NULL, 0, NULL),
        (134, N'बँक टी. डी. एस. ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, 339, NULL, 0, NULL),
        (135, N'नळ डिपॉजिट ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (136, N'शाखा शाहूवाडी डिपॉजिट ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (137, N'शाखा बांबवडे ऑफिस डिपॉजिट ', 13, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (138, N'तोटा खाते ', 29, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (139, N'में जादा व्याज ', 14, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (140, N'मेंबर व्याज ', 14, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (141, N'बँक व्याज जमा (के. डी. सी.)', 15, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, 12, NULL, 0, NULL),
        (142, N'बँक व्याज मिळालेले कोडोली ', 15, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (143, N'बँक व्याज सिद्धीविनायक ', 15, 0.00, N'Dr', N'ताळेबंद', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (144, N'बँक व्याज शिवनेरी ', 15, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (145, N'बँक लाभांश (मिळालेले)', 15, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (146, N'गुंतवणूक व्याज शाखा ', 15, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (147, N'सराफ फी जमा नावे खाते ', 30, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (148, N'कर्ज वसुली चार्जेस ', 30, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (149, N'पिग्मी कमिशन उत्पन्न ', 30, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (150, N'स्टेशनरी उत्पन्न ', 16, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, NULL, 0, NULL),
        (151, N'मुदत ठेवीवरील व्याज ', 17, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (152, N'दामदुप्पट ठेवीवरील व्याज', 17, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (153, N'धनलक्ष्मी ठेवीवरील व्याज ', 17, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (154, N'रिकरींग ठेवीवरील व्याज ', 17, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (155, N'पिग्मी ठेव व्याज ', 17, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (156, N'नोकर पगार', 18, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (157, N'प्रो. फंड कंन्सलटंट फी ', 18, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (158, N'इतर पगार व भत्ते ', 18, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (159, N'स्टेशनरी खर्च ', 19, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (160, N'लाइट बिल ', 20, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (161, N'वार्षिक सर्वसाधारण सभा खर्च ', 20, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (162, N'ऑडिट फी ', 20, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (163, N'इतर प्रशासकीय खर्च ', 20, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (164, N'टॅक्स फी ', 20, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (165, N'डेडस्टॉक झिज ', 21, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, 259, NULL, 0, NULL),
        (166, N'नोकर ग्रडयूइटी तरतूद ', 22, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (167, N'नोकर बोनस ', 22, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (168, N'लाभांश समीकरण नावे ', 22, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (169, N'बँक चार्जेस ', 31, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (170, N'किरकोळ खर्च ', 31, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (171, N'पिग्मी एजंट कमिशन ', 31, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (172, N'मिटींग भत्ता ', 31, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (173, N'घरफळा व पाणीबिल ', 31, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (174, N'विमा खर्च ', 31, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (175, N'प्रा. फंड वर्गणी ', 31, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (176, N'सभा समारंभ खर्च ', 31, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (177, N'शैक्षणिक भेट ', 31, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (178, N'अहवाल छपाई खर्च ', 31, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, NULL, 0, NULL),
        (179, N'थकीत व्याज येणे खाते', 13, 0.00, N'Dr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL),
        (180, N'थकीत वसुली खर्च येणे खाते', 13, 0.00, N'Dr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL),
        (512, N'संशयित बुडीत कर्ज निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (513, N'कुटुंब कल्याण निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (514, N'सभासद पुरस्कार निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (515, N'हिरक महोत्सव निधी ', 3, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (516, N'में कायम ठेव ', 4, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (517, N'देणे कायम ठेव व्याज ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (518, N'देणे अंतरिम लाभांश तरतूद ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (519, N'देणे मध्यम/ अ. मुदत कर्ज ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (520, N'देणे रा. स. कन्याशाळा ', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, NULL, 0, NULL),
        (521, N'अकस्मित कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (522, N'में. मोठे कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (523, N'सभासद मध्यम मुदत कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (524, N'में. अकस्मित व्याज ', 14, 0.00, N'Dr', N'नफातोटा पत्रक', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (525, N'मेंबर व्याज मध्यम मुदत कर्ज ', 14, 0.00, N'Dr', N'नफातोटा पत्रक', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (526, N'मेंबर व्याज मोठे कर्ज ', 14, 0.00, N'Dr', N'नफातोटा पत्रक', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (527, N'थकीत येणे व्याज ', 13, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (528, N'सरचार्ज ', 25, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (529, N'प्रोसेसिंग फी ', 16, 0.00, N'Dr', N'नफातोटा पत्रक', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (530, N'मेंबर व्याज ठेव पावती तारण ', 14, 0.00, N'Dr', N'नफातोटा पत्रक', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (531, N'रिकरींग तारण कर्ज ', 11, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (532, N'में. व्याज रिकारींग तारण कर्ज ', 14, 0.00, N'Dr', N'नफातोटा पत्रक', N'Personal Account', 0, 1, NULL, NULL, 0, NULL),
        (533, N'बचत ठेव (Saving Deposit)', 4, 0.00, N'Dr', NULL, NULL, 0, 1, NULL, NULL, 0, NULL),
        (534, N'सभासद शेअर भांडवल', 92, 0.00, N'Dr', NULL, NULL, 0, 1, NULL, NULL, 0, NULL),
        (535, N'१३३ कर्ज व्याज सूट / तडजोड तोटा (Interest Waiver)', 23, 0.00, N'Dr', NULL, NULL, 0, 1, NULL, NULL, 0, NULL),
        (536, N'सेव्हिंग ठेवीवरील व्याज ', 17, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'', 0, NULL);
    SET IDENTITY_INSERT dbo.[Ledgers] OFF;
    PRINT 'Seeded [Ledgers] (195 records)';
END;
GO

-- Table Seed: [Roles] (5 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[Roles])
BEGIN
    SET IDENTITY_INSERT dbo.[Roles] ON;
    INSERT INTO dbo.[Roles] ([RoleID], [RoleName], [Description], [RoleCode], [IsSystemRole], [Status]) VALUES
        (1, N'Admin', N'System Administrator', N'Admin', 1, 1),
        (2, N'Manager', N'Branch Manager', N'Manager', 1, 1),
        (3, N'Cashier', N'Cashier', N'Cashier', 1, 1),
        (4, N'Clerk', N'Account Clerk', N'Clerk', 1, 1),
        (5, N'Auditor', N'Statutory Auditor', N'Auditor', 1, 1);
    SET IDENTITY_INSERT dbo.[Roles] OFF;
    PRINT 'Seeded [Roles] (5 records)';
END;
GO

-- Table Seed: [Users] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[Users])
BEGIN
    SET IDENTITY_INSERT dbo.[Users] ON;
    INSERT INTO dbo.[Users] ([UserID], [Username], [PasswordHash], [RoleID], [DefaultBranchID], [IsActive], [IsLocked], [FailedLoginAttempts], [RequirePasswordChange], [LastPasswordChangeDate], [LastLoginDate], [ActiveSessionToken], [Email], [MobileNumber]) VALUES
        (1, N'admin', N'$2a$11$wRjQVbT4NvRzLkb3Wb8C6OSKuL25WJ5SyhQ1.IyIFoQYqfmFcZwrq', 1, NULL, 1, 0, 0, 1, NULL, NULL, NULL, NULL, NULL);
    SET IDENTITY_INSERT dbo.[Users] OFF;
    PRINT 'Seeded [Users] (1 records)';
END;
GO

-- Table Seed: [Branches] (2 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[Branches])
BEGIN
    SET IDENTITY_INSERT dbo.[Branches] ON;
    INSERT INTO dbo.[Branches] ([BranchID], [BranchCode], [BranchName], [Address], [IFSCCode], [IsActive], [BranchType], [MobileNo], [Email], [DefaultCashLedgerID]) VALUES
        (1, N'100', N'मुख्य कार्यालय', N'सांगली ', N'IFSC0000001', 1, N'HeadOffice', N'9975446204', N'', NULL),
        (3, N'200', N'बांबवडे ', N'', N'', 1, N'Branch', N'9623451017 ', N'', NULL);
    SET IDENTITY_INSERT dbo.[Branches] OFF;
    PRINT 'Seeded [Branches] (2 records)';
END;
GO

-- Table Seed: [FinancialYears] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[FinancialYears])
BEGIN
    SET IDENTITY_INSERT dbo.[FinancialYears] ON;
    INSERT INTO dbo.[FinancialYears] ([FinancialYearID], [YearCode], [StartDate], [EndDate], [IsActive], [IsClosed]) VALUES
        (1, N'2026-2027 ', CONVERT(datetime2, '2026-04-01T00:00:00.000', 126), CONVERT(datetime2, '2027-03-31T00:00:00.000', 126), 1, 0);
    SET IDENTITY_INSERT dbo.[FinancialYears] OFF;
    PRINT 'Seeded [FinancialYears] (1 records)';
END;
GO

-- Table Seed: [SansthaDetails] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[SansthaDetails])
BEGIN
    SET IDENTITY_INSERT dbo.[SansthaDetails] ON;
    INSERT INTO dbo.[SansthaDetails] ([SansthaID], [SansthaName], [Address], [ContactNo], [Email], [RegistrationNo], [GSTNo], [LogoPath], [IsMigrationLocked], [AutoPostVouchers], [Village], [Taluka], [District], [State], [PinCode], [RegistrationDate], [AutoPostVoucherLimit], [IsMobileCompulsory], [IsAadhaarCompulsory], [IsPanCompulsory]) VALUES
        (1, N'श्री. स्वामी समर्थ  बिगरशेती सहकारी पतसंस्था मर्या. देवाळे ', N'ता. देवाळे , जि. कोल्हापूर ', N'9975446204 ', N'mindspaceconsultancy2026@gmail.com', N'', N'', N'', 0, 0, N'देवाळे ', N'करवीर ', N'कोल्हापूर ', N'महाराष्ट्र ', NULL, NULL, 50000.00, 1, 1, 0);
    SET IDENTITY_INSERT dbo.[SansthaDetails] OFF;
    PRINT 'Seeded [SansthaDetails] (1 records)';
END;
GO

-- Table Seed: [SecurityTypes] (4 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[SecurityTypes])
BEGIN
    SET IDENTITY_INSERT dbo.[SecurityTypes] ON;
    INSERT INTO dbo.[SecurityTypes] ([SecurityTypeID], [Name], [IsActive]) VALUES
        (0, N'वाहन तारण ', 1),
        (1, N'घर तारण ', 1),
        (2, N'सोने तारण ', 1),
        (3, N'जमीन तारण ', 1);
    SET IDENTITY_INSERT dbo.[SecurityTypes] OFF;
    PRINT 'Seeded [SecurityTypes] (4 records)';
END;
GO

-- Table Seed: [SavingInterestSettings] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[SavingInterestSettings])
BEGIN
    SET IDENTITY_INSERT dbo.[SavingInterestSettings] ON;
    INSERT INTO dbo.[SavingInterestSettings] ([SettingID], [InterestRate], [CalculationMethod], [PostingFrequency], [EffectiveDate], [LedgerID], [CreatedBy], [CreatedOn], [SavingLiabilityLedgerID], [InterestExpenseLedgerID], [InterestPayableLedgerID], [SchemeName], [SchemeCode]) VALUES
        (4, 4.00, N'Minimum Balance', N'Yearly', CONVERT(datetime2, '2026-04-01T00:00:00.000', 126), 536, 1, CONVERT(datetime2, '2026-08-13T19:36:10.477', 126), 20, 536, 29, N'सेव्हिंग ठेव', N'SAV004');
    SET IDENTITY_INSERT dbo.[SavingInterestSettings] OFF;
    PRINT 'Seeded [SavingInterestSettings] (1 records)';
END;
GO

-- Table Seed: [CashManagementSettings] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[CashManagementSettings])
BEGIN
    SET IDENTITY_INSERT dbo.[CashManagementSettings] ON;
    INSERT INTO dbo.[CashManagementSettings] ([Id], [BranchId], [MainVaultLedgerId], [CashShortageLedgerId], [CashExcessLedgerId], [AutoGenerateVouchers], [EnableDenominationMandatory], [MaxBranchVaultLimit], [DefaultCounterLimit], [Remarks], [LastUpdated]) VALUES
        (5, 1, NULL, NULL, NULL, 0, 1, 5000000.00, 500000.00, N'मुख्य तिजोरी व रोख योजना सेटिंग', CONVERT(datetime2, '2026-08-25T08:08:32.557', 126));
    SET IDENTITY_INSERT dbo.[CashManagementSettings] OFF;
    PRINT 'Seeded [CashManagementSettings] (1 records)';
END;
GO


-- =========================================================================================
-- FOREIGN KEY CONSTRAINTS
-- =========================================================================================
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AccountGroups_AccountGroups_ParentGroupID')
BEGIN
    ALTER TABLE dbo.[AccountGroups] WITH CHECK ADD CONSTRAINT [FK_AccountGroups_AccountGroups_ParentGroupID] FOREIGN KEY ([ParentGroupID]) REFERENCES dbo.[AccountGroups] ([GroupID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AgentCustomerRequests_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[AgentCustomerRequests] WITH CHECK ADD CONSTRAINT [FK_AgentCustomerRequests_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetAllocations_Assets_AssetID')
BEGIN
    ALTER TABLE dbo.[AssetAllocations] WITH CHECK ADD CONSTRAINT [FK_AssetAllocations_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES dbo.[Assets] ([AssetID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetAllocations_Branches_AllocatedBranchID')
BEGIN
    ALTER TABLE dbo.[AssetAllocations] WITH CHECK ADD CONSTRAINT [FK_AssetAllocations_Branches_AllocatedBranchID] FOREIGN KEY ([AllocatedBranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetAllocations_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[AssetAllocations] WITH CHECK ADD CONSTRAINT [FK_AssetAllocations_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetAllocations_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[AssetAllocations] WITH CHECK ADD CONSTRAINT [FK_AssetAllocations_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetCategories_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[AssetCategories] WITH CHECK ADD CONSTRAINT [FK_AssetCategories_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetCategories_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[AssetCategories] WITH CHECK ADD CONSTRAINT [FK_AssetCategories_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetDepreciations_Assets_AssetID')
BEGIN
    ALTER TABLE dbo.[AssetDepreciations] WITH CHECK ADD CONSTRAINT [FK_AssetDepreciations_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES dbo.[Assets] ([AssetID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetDepreciations_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[AssetDepreciations] WITH CHECK ADD CONSTRAINT [FK_AssetDepreciations_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetDepreciations_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[AssetDepreciations] WITH CHECK ADD CONSTRAINT [FK_AssetDepreciations_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetDepreciations_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[AssetDepreciations] WITH CHECK ADD CONSTRAINT [FK_AssetDepreciations_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetDisposals_Assets_AssetID')
BEGIN
    ALTER TABLE dbo.[AssetDisposals] WITH CHECK ADD CONSTRAINT [FK_AssetDisposals_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES dbo.[Assets] ([AssetID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetDisposals_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[AssetDisposals] WITH CHECK ADD CONSTRAINT [FK_AssetDisposals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetDisposals_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[AssetDisposals] WITH CHECK ADD CONSTRAINT [FK_AssetDisposals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetDisposals_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[AssetDisposals] WITH CHECK ADD CONSTRAINT [FK_AssetDisposals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetMaintenances_Assets_AssetID')
BEGIN
    ALTER TABLE dbo.[AssetMaintenances] WITH CHECK ADD CONSTRAINT [FK_AssetMaintenances_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES dbo.[Assets] ([AssetID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetMaintenances_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[AssetMaintenances] WITH CHECK ADD CONSTRAINT [FK_AssetMaintenances_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetMaintenances_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[AssetMaintenances] WITH CHECK ADD CONSTRAINT [FK_AssetMaintenances_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetMaintenances_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[AssetMaintenances] WITH CHECK ADD CONSTRAINT [FK_AssetMaintenances_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetPurchases_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[AssetPurchases] WITH CHECK ADD CONSTRAINT [FK_AssetPurchases_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetPurchases_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[AssetPurchases] WITH CHECK ADD CONSTRAINT [FK_AssetPurchases_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetPurchases_Ledgers_BankLedgerID')
BEGIN
    ALTER TABLE dbo.[AssetPurchases] WITH CHECK ADD CONSTRAINT [FK_AssetPurchases_Ledgers_BankLedgerID] FOREIGN KEY ([BankLedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetPurchases_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[AssetPurchases] WITH CHECK ADD CONSTRAINT [FK_AssetPurchases_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Assets_AssetCategories_CategoryID')
BEGIN
    ALTER TABLE dbo.[Assets] WITH CHECK ADD CONSTRAINT [FK_Assets_AssetCategories_CategoryID] FOREIGN KEY ([CategoryID]) REFERENCES dbo.[AssetCategories] ([CategoryID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Assets_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[Assets] WITH CHECK ADD CONSTRAINT [FK_Assets_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Assets_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[Assets] WITH CHECK ADD CONSTRAINT [FK_Assets_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetTransfers_Assets_AssetID')
BEGIN
    ALTER TABLE dbo.[AssetTransfers] WITH CHECK ADD CONSTRAINT [FK_AssetTransfers_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES dbo.[Assets] ([AssetID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetTransfers_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[AssetTransfers] WITH CHECK ADD CONSTRAINT [FK_AssetTransfers_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetTransfers_Branches_FromBranchID')
BEGIN
    ALTER TABLE dbo.[AssetTransfers] WITH CHECK ADD CONSTRAINT [FK_AssetTransfers_Branches_FromBranchID] FOREIGN KEY ([FromBranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetTransfers_Branches_ToBranchID')
BEGIN
    ALTER TABLE dbo.[AssetTransfers] WITH CHECK ADD CONSTRAINT [FK_AssetTransfers_Branches_ToBranchID] FOREIGN KEY ([ToBranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetTransfers_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[AssetTransfers] WITH CHECK ADD CONSTRAINT [FK_AssetTransfers_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetVerifications_Assets_AssetID')
BEGIN
    ALTER TABLE dbo.[AssetVerifications] WITH CHECK ADD CONSTRAINT [FK_AssetVerifications_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES dbo.[Assets] ([AssetID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetVerifications_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[AssetVerifications] WITH CHECK ADD CONSTRAINT [FK_AssetVerifications_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AssetVerifications_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[AssetVerifications] WITH CHECK ADD CONSTRAINT [FK_AssetVerifications_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AuditLedgerMappings_Ledgers')
BEGIN
    ALTER TABLE dbo.[AuditLedgerMappings] WITH CHECK ADD CONSTRAINT [FK_AuditLedgerMappings_Ledgers] FOREIGN KEY ([LedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE CASCADE;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_BorrowerLinkedAccounts_Members_LinkedMemberID')
BEGIN
    ALTER TABLE dbo.[BorrowerLinkedAccounts] WITH CHECK ADD CONSTRAINT [FK_BorrowerLinkedAccounts_Members_LinkedMemberID] FOREIGN KEY ([LinkedMemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_BorrowerLinkedAccounts_Members_ParentMemberID')
BEGIN
    ALTER TABLE dbo.[BorrowerLinkedAccounts] WITH CHECK ADD CONSTRAINT [FK_BorrowerLinkedAccounts_Members_ParentMemberID] FOREIGN KEY ([ParentMemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_BranchDayEndStatuses_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[BranchDayEndStatuses] WITH CHECK ADD CONSTRAINT [FK_BranchDayEndStatuses_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_CollateralComplianceLogs_LoanAccounts_LoanAccountID')
BEGIN
    ALTER TABLE dbo.[CollateralComplianceLogs] WITH CHECK ADD CONSTRAINT [FK_CollateralComplianceLogs_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES dbo.[LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_CommitteeMembers_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[CommitteeMembers] WITH CHECK ADD CONSTRAINT [FK_CommitteeMembers_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_CustomerOpeningBalances_Customers')
BEGIN
    ALTER TABLE dbo.[CustomerOpeningBalances] WITH CHECK ADD CONSTRAINT [FK_CustomerOpeningBalances_Customers] FOREIGN KEY ([CustomerID]) REFERENCES dbo.[Customers] ([CustomerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_DeceasedClaimSettlements_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[DeceasedClaimSettlements] WITH CHECK ADD CONSTRAINT [FK_DeceasedClaimSettlements_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE CASCADE;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_DemandMemberDetails_DemandNotices_DemandNoticeId')
BEGIN
    ALTER TABLE dbo.[DemandMemberDetails] WITH CHECK ADD CONSTRAINT [FK_DemandMemberDetails_DemandNotices_DemandNoticeId] FOREIGN KEY ([DemandNoticeId]) REFERENCES dbo.[DemandNotices] ([DemandNoticeId]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_DemandMemberDetails_Members_MemberId')
BEGIN
    ALTER TABLE dbo.[DemandMemberDetails] WITH CHECK ADD CONSTRAINT [FK_DemandMemberDetails_Members_MemberId] FOREIGN KEY ([MemberId]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_DemandNotices_Branches_BranchId')
BEGIN
    ALTER TABLE dbo.[DemandNotices] WITH CHECK ADD CONSTRAINT [FK_DemandNotices_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_DemandNotices_EmployerMasters_EmployerId')
BEGIN
    ALTER TABLE dbo.[DemandNotices] WITH CHECK ADD CONSTRAINT [FK_DemandNotices_EmployerMasters_EmployerId] FOREIGN KEY ([EmployerId]) REFERENCES dbo.[EmployerMasters] ([Id]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_DemandRecoveries_DemandNotices_DemandNoticeId')
BEGIN
    ALTER TABLE dbo.[DemandRecoveries] WITH CHECK ADD CONSTRAINT [FK_DemandRecoveries_DemandNotices_DemandNoticeId] FOREIGN KEY ([DemandNoticeId]) REFERENCES dbo.[DemandNotices] ([DemandNoticeId]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_DemandRecoveries_Vouchers_VoucherId')
BEGIN
    ALTER TABLE dbo.[DemandRecoveries] WITH CHECK ADD CONSTRAINT [FK_DemandRecoveries_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_DividendDistributions_ShareAccounts_ShareAccountId')
BEGIN
    ALTER TABLE dbo.[DividendDistributions] WITH CHECK ADD CONSTRAINT [FK_DividendDistributions_ShareAccounts_ShareAccountId] FOREIGN KEY ([ShareAccountId]) REFERENCES dbo.[ShareAccounts] ([ShareAccountId]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_DividendDistributions_Vouchers_VoucherId')
BEGIN
    ALTER TABLE dbo.[DividendDistributions] WITH CHECK ADD CONSTRAINT [FK_DividendDistributions_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_EmployeeBankDetails_BranchMasters_BranchID')
BEGIN
    ALTER TABLE dbo.[EmployeeBankDetails] WITH CHECK ADD CONSTRAINT [FK_EmployeeBankDetails_BranchMasters_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[BranchMasters] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_EmployeeBankDetails_DepartmentMasters_DepartmentID')
BEGIN
    ALTER TABLE dbo.[EmployeeBankDetails] WITH CHECK ADD CONSTRAINT [FK_EmployeeBankDetails_DepartmentMasters_DepartmentID] FOREIGN KEY ([DepartmentID]) REFERENCES dbo.[DepartmentMasters] ([DepartmentID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_EodBatchProcessLogs_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[EodBatchProcessLogs] WITH CHECK ADD CONSTRAINT [FK_EodBatchProcessLogs_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdAccounts_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[FdAccounts] WITH CHECK ADD CONSTRAINT [FK_FdAccounts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdAccounts_FdSchemes_FdSchemeID')
BEGIN
    ALTER TABLE dbo.[FdAccounts] WITH CHECK ADD CONSTRAINT [FK_FdAccounts_FdSchemes_FdSchemeID] FOREIGN KEY ([FdSchemeID]) REFERENCES dbo.[FdSchemes] ([FdSchemeID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdAccounts_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[FdAccounts] WITH CHECK ADD CONSTRAINT [FK_FdAccounts_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdAccounts_Ledgers_BankAccountLedgerID')
BEGIN
    ALTER TABLE dbo.[FdAccounts] WITH CHECK ADD CONSTRAINT [FK_FdAccounts_Ledgers_BankAccountLedgerID] FOREIGN KEY ([BankAccountLedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdAccounts_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[FdAccounts] WITH CHECK ADD CONSTRAINT [FK_FdAccounts_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdAccounts_SavingAccountMasters_SavingAccountID')
BEGIN
    ALTER TABLE dbo.[FdAccounts] WITH CHECK ADD CONSTRAINT [FK_FdAccounts_SavingAccountMasters_SavingAccountID] FOREIGN KEY ([SavingAccountID]) REFERENCES dbo.[SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdAccountSequences_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[FdAccountSequences] WITH CHECK ADD CONSTRAINT [FK_FdAccountSequences_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdInterestAccruals_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[FdInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_FdInterestAccruals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdInterestAccruals_FdAccounts_FdAccountID')
BEGIN
    ALTER TABLE dbo.[FdInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_FdInterestAccruals_FdAccounts_FdAccountID] FOREIGN KEY ([FdAccountID]) REFERENCES dbo.[FdAccounts] ([FdAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdInterestAccruals_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[FdInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_FdInterestAccruals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdInterestAccruals_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[FdInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_FdInterestAccruals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdSchemes_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[FdSchemes] WITH CHECK ADD CONSTRAINT [FK_FdSchemes_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdTransactions_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[FdTransactions] WITH CHECK ADD CONSTRAINT [FK_FdTransactions_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdTransactions_FdAccounts_FdAccountID')
BEGIN
    ALTER TABLE dbo.[FdTransactions] WITH CHECK ADD CONSTRAINT [FK_FdTransactions_FdAccounts_FdAccountID] FOREIGN KEY ([FdAccountID]) REFERENCES dbo.[FdAccounts] ([FdAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdTransactions_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[FdTransactions] WITH CHECK ADD CONSTRAINT [FK_FdTransactions_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_FdTransactions_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[FdTransactions] WITH CHECK ADD CONSTRAINT [FK_FdTransactions_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_GoldLoanDetails_LoanAccounts_LoanAccountID')
BEGIN
    ALTER TABLE dbo.[GoldLoanDetails] WITH CHECK ADD CONSTRAINT [FK_GoldLoanDetails_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES dbo.[LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentAccounts_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[InvestmentAccounts] WITH CHECK ADD CONSTRAINT [FK_InvestmentAccounts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentAccounts_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[InvestmentAccounts] WITH CHECK ADD CONSTRAINT [FK_InvestmentAccounts_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentAccounts_InvestmentInstitutions_InvestmentInstitutionID')
BEGIN
    ALTER TABLE dbo.[InvestmentAccounts] WITH CHECK ADD CONSTRAINT [FK_InvestmentAccounts_InvestmentInstitutions_InvestmentInstitutionID] FOREIGN KEY ([InvestmentInstitutionID]) REFERENCES dbo.[InvestmentInstitutions] ([InstitutionID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentAccounts_InvestmentSchemes_SchemeID')
BEGIN
    ALTER TABLE dbo.[InvestmentAccounts] WITH CHECK ADD CONSTRAINT [FK_InvestmentAccounts_InvestmentSchemes_SchemeID] FOREIGN KEY ([SchemeID]) REFERENCES dbo.[InvestmentSchemes] ([SchemeID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentAccountSequences_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[InvestmentAccountSequences] WITH CHECK ADD CONSTRAINT [FK_InvestmentAccountSequences_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentInstitutions_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[InvestmentInstitutions] WITH CHECK ADD CONSTRAINT [FK_InvestmentInstitutions_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentInterestAccruals_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[InvestmentInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_InvestmentInterestAccruals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentInterestAccruals_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[InvestmentInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_InvestmentInterestAccruals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentInterestAccruals_InvestmentAccounts_InvestmentAccountID')
BEGIN
    ALTER TABLE dbo.[InvestmentInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_InvestmentInterestAccruals_InvestmentAccounts_InvestmentAccountID] FOREIGN KEY ([InvestmentAccountID]) REFERENCES dbo.[InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentInterestAccruals_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[InvestmentInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_InvestmentInterestAccruals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentInterestReceipts_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[InvestmentInterestReceipts] WITH CHECK ADD CONSTRAINT [FK_InvestmentInterestReceipts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentInterestReceipts_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[InvestmentInterestReceipts] WITH CHECK ADD CONSTRAINT [FK_InvestmentInterestReceipts_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentInterestReceipts_InvestmentAccounts_InvestmentAccountID')
BEGIN
    ALTER TABLE dbo.[InvestmentInterestReceipts] WITH CHECK ADD CONSTRAINT [FK_InvestmentInterestReceipts_InvestmentAccounts_InvestmentAccountID] FOREIGN KEY ([InvestmentAccountID]) REFERENCES dbo.[InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentInterestReceipts_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[InvestmentInterestReceipts] WITH CHECK ADD CONSTRAINT [FK_InvestmentInterestReceipts_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentMaturities_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[InvestmentMaturities] WITH CHECK ADD CONSTRAINT [FK_InvestmentMaturities_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentMaturities_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[InvestmentMaturities] WITH CHECK ADD CONSTRAINT [FK_InvestmentMaturities_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentMaturities_InvestmentAccounts_InvestmentAccountID')
BEGIN
    ALTER TABLE dbo.[InvestmentMaturities] WITH CHECK ADD CONSTRAINT [FK_InvestmentMaturities_InvestmentAccounts_InvestmentAccountID] FOREIGN KEY ([InvestmentAccountID]) REFERENCES dbo.[InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentMaturities_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[InvestmentMaturities] WITH CHECK ADD CONSTRAINT [FK_InvestmentMaturities_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentPrematureWithdrawals_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[InvestmentPrematureWithdrawals] WITH CHECK ADD CONSTRAINT [FK_InvestmentPrematureWithdrawals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentPrematureWithdrawals_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[InvestmentPrematureWithdrawals] WITH CHECK ADD CONSTRAINT [FK_InvestmentPrematureWithdrawals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentPrematureWithdrawals_InvestmentAccounts_InvestmentAccountID')
BEGIN
    ALTER TABLE dbo.[InvestmentPrematureWithdrawals] WITH CHECK ADD CONSTRAINT [FK_InvestmentPrematureWithdrawals_InvestmentAccounts_InvestmentAccountID] FOREIGN KEY ([InvestmentAccountID]) REFERENCES dbo.[InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentPrematureWithdrawals_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[InvestmentPrematureWithdrawals] WITH CHECK ADD CONSTRAINT [FK_InvestmentPrematureWithdrawals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentRenewals_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[InvestmentRenewals] WITH CHECK ADD CONSTRAINT [FK_InvestmentRenewals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentRenewals_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[InvestmentRenewals] WITH CHECK ADD CONSTRAINT [FK_InvestmentRenewals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentRenewals_InvestmentAccounts_NewInvestmentAccountID')
BEGIN
    ALTER TABLE dbo.[InvestmentRenewals] WITH CHECK ADD CONSTRAINT [FK_InvestmentRenewals_InvestmentAccounts_NewInvestmentAccountID] FOREIGN KEY ([NewInvestmentAccountID]) REFERENCES dbo.[InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentRenewals_InvestmentAccounts_OldInvestmentAccountID')
BEGIN
    ALTER TABLE dbo.[InvestmentRenewals] WITH CHECK ADD CONSTRAINT [FK_InvestmentRenewals_InvestmentAccounts_OldInvestmentAccountID] FOREIGN KEY ([OldInvestmentAccountID]) REFERENCES dbo.[InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentRenewals_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[InvestmentRenewals] WITH CHECK ADD CONSTRAINT [FK_InvestmentRenewals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentSchemes_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[InvestmentSchemes] WITH CHECK ADD CONSTRAINT [FK_InvestmentSchemes_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentSchemes_InvestmentInstitutions_InvestmentInstitutionID')
BEGIN
    ALTER TABLE dbo.[InvestmentSchemes] WITH CHECK ADD CONSTRAINT [FK_InvestmentSchemes_InvestmentInstitutions_InvestmentInstitutionID] FOREIGN KEY ([InvestmentInstitutionID]) REFERENCES dbo.[InvestmentInstitutions] ([InstitutionID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentSchemes_Ledgers_InterestIncomeLedgerID')
BEGIN
    ALTER TABLE dbo.[InvestmentSchemes] WITH CHECK ADD CONSTRAINT [FK_InvestmentSchemes_Ledgers_InterestIncomeLedgerID] FOREIGN KEY ([InterestIncomeLedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentSchemes_Ledgers_InterestReceivableLedgerID')
BEGIN
    ALTER TABLE dbo.[InvestmentSchemes] WITH CHECK ADD CONSTRAINT [FK_InvestmentSchemes_Ledgers_InterestReceivableLedgerID] FOREIGN KEY ([InterestReceivableLedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentSchemes_Ledgers_InvestmentAssetLedgerID')
BEGIN
    ALTER TABLE dbo.[InvestmentSchemes] WITH CHECK ADD CONSTRAINT [FK_InvestmentSchemes_Ledgers_InvestmentAssetLedgerID] FOREIGN KEY ([InvestmentAssetLedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_InvestmentVoucherMappings_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[InvestmentVoucherMappings] WITH CHECK ADD CONSTRAINT [FK_InvestmentVoucherMappings_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_JointMembers_Members_PrimaryMemberID')
BEGIN
    ALTER TABLE dbo.[JointMembers] WITH CHECK ADD CONSTRAINT [FK_JointMembers_Members_PrimaryMemberID] FOREIGN KEY ([PrimaryMemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE CASCADE;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Ledgers_AccountGroups_GroupID')
BEGIN
    ALTER TABLE dbo.[Ledgers] WITH CHECK ADD CONSTRAINT [FK_Ledgers_AccountGroups_GroupID] FOREIGN KEY ([GroupID]) REFERENCES dbo.[AccountGroups] ([GroupID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccountNpaStatuses_LoanAccounts_LoanAccountID')
BEGIN
    ALTER TABLE dbo.[LoanAccountNpaStatuses] WITH CHECK ADD CONSTRAINT [FK_LoanAccountNpaStatuses_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES dbo.[LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccountNpaStatuses_NpaClassificationRuns_LastClassificationRunId')
BEGIN
    ALTER TABLE dbo.[LoanAccountNpaStatuses] WITH CHECK ADD CONSTRAINT [FK_LoanAccountNpaStatuses_NpaClassificationRuns_LastClassificationRunId] FOREIGN KEY ([LastClassificationRunId]) REFERENCES dbo.[NpaClassificationRuns] ([NpaClassificationRunID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccounts_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[LoanAccounts] WITH CHECK ADD CONSTRAINT [FK_LoanAccounts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccounts_LoanApplications_LoanApplicationID')
BEGIN
    ALTER TABLE dbo.[LoanAccounts] WITH CHECK ADD CONSTRAINT [FK_LoanAccounts_LoanApplications_LoanApplicationID] FOREIGN KEY ([LoanApplicationID]) REFERENCES dbo.[LoanApplications] ([LoanApplicationID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccounts_LoanRates_LoanRateID')
BEGIN
    ALTER TABLE dbo.[LoanAccounts] WITH CHECK ADD CONSTRAINT [FK_LoanAccounts_LoanRates_LoanRateID] FOREIGN KEY ([LoanRateID]) REFERENCES dbo.[LoanRates] ([LoanRateID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccounts_Members_CoMember2ID')
BEGIN
    ALTER TABLE dbo.[LoanAccounts] WITH CHECK ADD CONSTRAINT [FK_LoanAccounts_Members_CoMember2ID] FOREIGN KEY ([CoMember2ID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccounts_Members_CoMemberID')
BEGIN
    ALTER TABLE dbo.[LoanAccounts] WITH CHECK ADD CONSTRAINT [FK_LoanAccounts_Members_CoMemberID] FOREIGN KEY ([CoMemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccounts_Members_Guarantor1MemberID')
BEGIN
    ALTER TABLE dbo.[LoanAccounts] WITH CHECK ADD CONSTRAINT [FK_LoanAccounts_Members_Guarantor1MemberID] FOREIGN KEY ([Guarantor1MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccounts_Members_Guarantor2MemberID')
BEGIN
    ALTER TABLE dbo.[LoanAccounts] WITH CHECK ADD CONSTRAINT [FK_LoanAccounts_Members_Guarantor2MemberID] FOREIGN KEY ([Guarantor2MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccounts_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[LoanAccounts] WITH CHECK ADD CONSTRAINT [FK_LoanAccounts_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanAccounts_Members_RecommendedByDirectorID')
BEGIN
    ALTER TABLE dbo.[LoanAccounts] WITH CHECK ADD CONSTRAINT [FK_LoanAccounts_Members_RecommendedByDirectorID] FOREIGN KEY ([RecommendedByDirectorID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanApplications_LoanRates_LoanRateID')
BEGIN
    ALTER TABLE dbo.[LoanApplications] WITH CHECK ADD CONSTRAINT [FK_LoanApplications_LoanRates_LoanRateID] FOREIGN KEY ([LoanRateID]) REFERENCES dbo.[LoanRates] ([LoanRateID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanApplications_Members_CoMember2ID')
BEGIN
    ALTER TABLE dbo.[LoanApplications] WITH CHECK ADD CONSTRAINT [FK_LoanApplications_Members_CoMember2ID] FOREIGN KEY ([CoMember2ID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanApplications_Members_CoMemberID')
BEGIN
    ALTER TABLE dbo.[LoanApplications] WITH CHECK ADD CONSTRAINT [FK_LoanApplications_Members_CoMemberID] FOREIGN KEY ([CoMemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanApplications_Members_Guarantor1MemberID')
BEGIN
    ALTER TABLE dbo.[LoanApplications] WITH CHECK ADD CONSTRAINT [FK_LoanApplications_Members_Guarantor1MemberID] FOREIGN KEY ([Guarantor1MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanApplications_Members_Guarantor2MemberID')
BEGIN
    ALTER TABLE dbo.[LoanApplications] WITH CHECK ADD CONSTRAINT [FK_LoanApplications_Members_Guarantor2MemberID] FOREIGN KEY ([Guarantor2MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanApplications_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[LoanApplications] WITH CHECK ADD CONSTRAINT [FK_LoanApplications_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanApplications_Members_RecommendedByDirectorID')
BEGIN
    ALTER TABLE dbo.[LoanApplications] WITH CHECK ADD CONSTRAINT [FK_LoanApplications_Members_RecommendedByDirectorID] FOREIGN KEY ([RecommendedByDirectorID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanCollectionFees_Ledgers_LedgerID')
BEGIN
    ALTER TABLE dbo.[LoanCollectionFees] WITH CHECK ADD CONSTRAINT [FK_LoanCollectionFees_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanCollectionFees_LoanCollections_LoanCollectionID')
BEGIN
    ALTER TABLE dbo.[LoanCollectionFees] WITH CHECK ADD CONSTRAINT [FK_LoanCollectionFees_LoanCollections_LoanCollectionID] FOREIGN KEY ([LoanCollectionID]) REFERENCES dbo.[LoanCollections] ([LoanCollectionID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanCollections_LoanAccounts_LoanAccountID')
BEGIN
    ALTER TABLE dbo.[LoanCollections] WITH CHECK ADD CONSTRAINT [FK_LoanCollections_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES dbo.[LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanCollections_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[LoanCollections] WITH CHECK ADD CONSTRAINT [FK_LoanCollections_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanDisbursementDeductions_Ledgers_LedgerID')
BEGIN
    ALTER TABLE dbo.[LoanDisbursementDeductions] WITH CHECK ADD CONSTRAINT [FK_LoanDisbursementDeductions_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanDisbursementDeductions_LoanDisbursements_LoanDisbursementID')
BEGIN
    ALTER TABLE dbo.[LoanDisbursementDeductions] WITH CHECK ADD CONSTRAINT [FK_LoanDisbursementDeductions_LoanDisbursements_LoanDisbursementID] FOREIGN KEY ([LoanDisbursementID]) REFERENCES dbo.[LoanDisbursements] ([LoanDisbursementID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanDisbursements_Ledgers_BankAccountLedgerID')
BEGIN
    ALTER TABLE dbo.[LoanDisbursements] WITH CHECK ADD CONSTRAINT [FK_LoanDisbursements_Ledgers_BankAccountLedgerID] FOREIGN KEY ([BankAccountLedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanDisbursements_LoanAccounts_LoanAccountID')
BEGIN
    ALTER TABLE dbo.[LoanDisbursements] WITH CHECK ADD CONSTRAINT [FK_LoanDisbursements_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES dbo.[LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanDisbursements_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[LoanDisbursements] WITH CHECK ADD CONSTRAINT [FK_LoanDisbursements_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanDocuments_LoanAccounts_LoanAccountID')
BEGIN
    ALTER TABLE dbo.[LoanDocuments] WITH CHECK ADD CONSTRAINT [FK_LoanDocuments_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES dbo.[LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LoanInstallmentSchedules_LoanAccounts_LoanAccountID')
BEGIN
    ALTER TABLE dbo.[LoanInstallmentSchedules] WITH CHECK ADD CONSTRAINT [FK_LoanInstallmentSchedules_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES dbo.[LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LockerAllotments_Lockers')
BEGIN
    ALTER TABLE dbo.[LockerAllotments] WITH CHECK ADD CONSTRAINT [FK_LockerAllotments_Lockers] FOREIGN KEY ([LockerID]) REFERENCES dbo.[Lockers] ([LockerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LockerAllotments_Members')
BEGIN
    ALTER TABLE dbo.[LockerAllotments] WITH CHECK ADD CONSTRAINT [FK_LockerAllotments_Members] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LockerRent_Allotments')
BEGIN
    ALTER TABLE dbo.[LockerRentPostings] WITH CHECK ADD CONSTRAINT [FK_LockerRent_Allotments] FOREIGN KEY ([AllotmentID]) REFERENCES dbo.[LockerAllotments] ([AllotmentID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Lockers_LockerTypes')
BEGIN
    ALTER TABLE dbo.[Lockers] WITH CHECK ADD CONSTRAINT [FK_Lockers_LockerTypes] FOREIGN KEY ([LockerTypeID]) REFERENCES dbo.[LockerTypes] ([LockerTypeID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LockerSurrender_Allotments')
BEGIN
    ALTER TABLE dbo.[LockerSurrenders] WITH CHECK ADD CONSTRAINT [FK_LockerSurrender_Allotments] FOREIGN KEY ([AllotmentID]) REFERENCES dbo.[LockerAllotments] ([AllotmentID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_LockerVisits_Allotments')
BEGIN
    ALTER TABLE dbo.[LockerVisitRegisters] WITH CHECK ADD CONSTRAINT [FK_LockerVisits_Allotments] FOREIGN KEY ([AllotmentID]) REFERENCES dbo.[LockerAllotments] ([AllotmentID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_MemberOpeningBalances_Ledgers_LedgerID')
BEGIN
    ALTER TABLE dbo.[MemberOpeningBalances] WITH CHECK ADD CONSTRAINT [FK_MemberOpeningBalances_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_MemberOpeningBalances_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[MemberOpeningBalances] WITH CHECK ADD CONSTRAINT [FK_MemberOpeningBalances_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Members_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[Members] WITH CHECK ADD CONSTRAINT [FK_Members_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Members_EmployerMasters_EmployerId')
BEGIN
    ALTER TABLE dbo.[Members] WITH CHECK ADD CONSTRAINT [FK_Members_EmployerMasters_EmployerId] FOREIGN KEY ([EmployerId]) REFERENCES dbo.[EmployerMasters] ([Id]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_OverdueInterestLedgers_LoanAccounts_LoanAccountID')
BEGIN
    ALTER TABLE dbo.[OverdueInterestLedgers] WITH CHECK ADD CONSTRAINT [FK_OverdueInterestLedgers_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES dbo.[LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_OverdueInterestLedgers_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[OverdueInterestLedgers] WITH CHECK ADD CONSTRAINT [FK_OverdueInterestLedgers_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_OverdueRecoveryLedgers_LoanAccounts_LoanAccountID')
BEGIN
    ALTER TABLE dbo.[OverdueRecoveryLedgers] WITH CHECK ADD CONSTRAINT [FK_OverdueRecoveryLedgers_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES dbo.[LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_OverdueRecoveryLedgers_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[OverdueRecoveryLedgers] WITH CHECK ADD CONSTRAINT [FK_OverdueRecoveryLedgers_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyAccounts_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[PigmyAccounts] WITH CHECK ADD CONSTRAINT [FK_PigmyAccounts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyAccounts_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[PigmyAccounts] WITH CHECK ADD CONSTRAINT [FK_PigmyAccounts_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyAccounts_PigmyAgents_PigmyAgentID')
BEGIN
    ALTER TABLE dbo.[PigmyAccounts] WITH CHECK ADD CONSTRAINT [FK_PigmyAccounts_PigmyAgents_PigmyAgentID] FOREIGN KEY ([PigmyAgentID]) REFERENCES dbo.[PigmyAgents] ([PigmyAgentID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyAccounts_PigmySchemes_PigmySchemeID')
BEGIN
    ALTER TABLE dbo.[PigmyAccounts] WITH CHECK ADD CONSTRAINT [FK_PigmyAccounts_PigmySchemes_PigmySchemeID] FOREIGN KEY ([PigmySchemeID]) REFERENCES dbo.[PigmySchemes] ([PigmySchemeID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyAgentCashDeposits_PigmyAgents_AgentId')
BEGIN
    ALTER TABLE dbo.[PigmyAgentCashDeposits] WITH CHECK ADD CONSTRAINT [FK_PigmyAgentCashDeposits_PigmyAgents_AgentId] FOREIGN KEY ([AgentId]) REFERENCES dbo.[PigmyAgents] ([PigmyAgentID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyAgentCashDeposits_Vouchers_VoucherId')
BEGIN
    ALTER TABLE dbo.[PigmyAgentCashDeposits] WITH CHECK ADD CONSTRAINT [FK_PigmyAgentCashDeposits_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyAgentCommissions_PigmyAgents_AgentId')
BEGIN
    ALTER TABLE dbo.[PigmyAgentCommissions] WITH CHECK ADD CONSTRAINT [FK_PigmyAgentCommissions_PigmyAgents_AgentId] FOREIGN KEY ([AgentId]) REFERENCES dbo.[PigmyAgents] ([PigmyAgentID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyAgentCommissions_Vouchers_VoucherId')
BEGIN
    ALTER TABLE dbo.[PigmyAgentCommissions] WITH CHECK ADD CONSTRAINT [FK_PigmyAgentCommissions_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyAgents_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[PigmyAgents] WITH CHECK ADD CONSTRAINT [FK_PigmyAgents_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyCollections_PigmyAccounts_PigmyAccountId')
BEGIN
    ALTER TABLE dbo.[PigmyCollections] WITH CHECK ADD CONSTRAINT [FK_PigmyCollections_PigmyAccounts_PigmyAccountId] FOREIGN KEY ([PigmyAccountId]) REFERENCES dbo.[PigmyAccounts] ([PigmyAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyCollections_PigmyAgents_AgentId')
BEGIN
    ALTER TABLE dbo.[PigmyCollections] WITH CHECK ADD CONSTRAINT [FK_PigmyCollections_PigmyAgents_AgentId] FOREIGN KEY ([AgentId]) REFERENCES dbo.[PigmyAgents] ([PigmyAgentID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyCollections_Vouchers_VoucherId')
BEGIN
    ALTER TABLE dbo.[PigmyCollections] WITH CHECK ADD CONSTRAINT [FK_PigmyCollections_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyCommissionSettings_PigmyAgents_AgentId')
BEGIN
    ALTER TABLE dbo.[PigmyCommissionSettings] WITH CHECK ADD CONSTRAINT [FK_PigmyCommissionSettings_PigmyAgents_AgentId] FOREIGN KEY ([AgentId]) REFERENCES dbo.[PigmyAgents] ([PigmyAgentID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyInterestLogs_PigmyAccounts_PigmyAccountId')
BEGIN
    ALTER TABLE dbo.[PigmyInterestLogs] WITH CHECK ADD CONSTRAINT [FK_PigmyInterestLogs_PigmyAccounts_PigmyAccountId] FOREIGN KEY ([PigmyAccountId]) REFERENCES dbo.[PigmyAccounts] ([PigmyAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyInterestLogs_Vouchers_VoucherId')
BEGIN
    ALTER TABLE dbo.[PigmyInterestLogs] WITH CHECK ADD CONSTRAINT [FK_PigmyInterestLogs_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyOpeningBalances_PigmyAccounts_PigmyAccountID')
BEGIN
    ALTER TABLE dbo.[PigmyOpeningBalances] WITH CHECK ADD CONSTRAINT [FK_PigmyOpeningBalances_PigmyAccounts_PigmyAccountID] FOREIGN KEY ([PigmyAccountID]) REFERENCES dbo.[PigmyAccounts] ([PigmyAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyTransactions_PigmyAccounts_PigmyAccountID')
BEGIN
    ALTER TABLE dbo.[PigmyTransactions] WITH CHECK ADD CONSTRAINT [FK_PigmyTransactions_PigmyAccounts_PigmyAccountID] FOREIGN KEY ([PigmyAccountID]) REFERENCES dbo.[PigmyAccounts] ([PigmyAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyVoucherMappings_Branches_BranchId')
BEGIN
    ALTER TABLE dbo.[PigmyVoucherMappings] WITH CHECK ADD CONSTRAINT [FK_PigmyVoucherMappings_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyVoucherMappings_Ledgers_CreditLedgerId')
BEGIN
    ALTER TABLE dbo.[PigmyVoucherMappings] WITH CHECK ADD CONSTRAINT [FK_PigmyVoucherMappings_Ledgers_CreditLedgerId] FOREIGN KEY ([CreditLedgerId]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyVoucherMappings_Ledgers_DebitLedgerId')
BEGIN
    ALTER TABLE dbo.[PigmyVoucherMappings] WITH CHECK ADD CONSTRAINT [FK_PigmyVoucherMappings_Ledgers_DebitLedgerId] FOREIGN KEY ([DebitLedgerId]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdAccounts_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[RdAccounts] WITH CHECK ADD CONSTRAINT [FK_RdAccounts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdAccounts_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[RdAccounts] WITH CHECK ADD CONSTRAINT [FK_RdAccounts_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdAccounts_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[RdAccounts] WITH CHECK ADD CONSTRAINT [FK_RdAccounts_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdAccounts_RdSchemes_RdSchemeID')
BEGIN
    ALTER TABLE dbo.[RdAccounts] WITH CHECK ADD CONSTRAINT [FK_RdAccounts_RdSchemes_RdSchemeID] FOREIGN KEY ([RdSchemeID]) REFERENCES dbo.[RdSchemes] ([RdSchemeID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdAccountSequences_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[RdAccountSequences] WITH CHECK ADD CONSTRAINT [FK_RdAccountSequences_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdInterestAccruals_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[RdInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_RdInterestAccruals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdInterestAccruals_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[RdInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_RdInterestAccruals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdInterestAccruals_RdAccounts_RdAccountID')
BEGIN
    ALTER TABLE dbo.[RdInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_RdInterestAccruals_RdAccounts_RdAccountID] FOREIGN KEY ([RdAccountID]) REFERENCES dbo.[RdAccounts] ([RdAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdInterestAccruals_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[RdInterestAccruals] WITH CHECK ADD CONSTRAINT [FK_RdInterestAccruals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdSchemes_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[RdSchemes] WITH CHECK ADD CONSTRAINT [FK_RdSchemes_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdTransactions_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[RdTransactions] WITH CHECK ADD CONSTRAINT [FK_RdTransactions_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdTransactions_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[RdTransactions] WITH CHECK ADD CONSTRAINT [FK_RdTransactions_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdTransactions_RdAccounts_RdAccountID')
BEGIN
    ALTER TABLE dbo.[RdTransactions] WITH CHECK ADD CONSTRAINT [FK_RdTransactions_RdAccounts_RdAccountID] FOREIGN KEY ([RdAccountID]) REFERENCES dbo.[RdAccounts] ([RdAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdTransactions_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[RdTransactions] WITH CHECK ADD CONSTRAINT [FK_RdTransactions_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingAccountClosings_SavingAccountMasters_SavingAccountID')
BEGIN
    ALTER TABLE dbo.[SavingAccountClosings] WITH CHECK ADD CONSTRAINT [FK_SavingAccountClosings_SavingAccountMasters_SavingAccountID] FOREIGN KEY ([SavingAccountID]) REFERENCES dbo.[SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingAccountJointHolders_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[SavingAccountJointHolders] WITH CHECK ADD CONSTRAINT [FK_SavingAccountJointHolders_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingAccountJointHolders_SavingAccountMasters_SavingAccountID')
BEGIN
    ALTER TABLE dbo.[SavingAccountJointHolders] WITH CHECK ADD CONSTRAINT [FK_SavingAccountJointHolders_SavingAccountMasters_SavingAccountID] FOREIGN KEY ([SavingAccountID]) REFERENCES dbo.[SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingAccountMasters_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[SavingAccountMasters] WITH CHECK ADD CONSTRAINT [FK_SavingAccountMasters_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingAccountMasters_Ledgers_LedgerID')
BEGIN
    ALTER TABLE dbo.[SavingAccountMasters] WITH CHECK ADD CONSTRAINT [FK_SavingAccountMasters_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingAccountMasters_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[SavingAccountMasters] WITH CHECK ADD CONSTRAINT [FK_SavingAccountMasters_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingInterestPostings_FinancialYears_FinancialYearID')
BEGIN
    ALTER TABLE dbo.[SavingInterestPostings] WITH CHECK ADD CONSTRAINT [FK_SavingInterestPostings_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES dbo.[FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingInterestSettings_Ledgers_LedgerID')
BEGIN
    ALTER TABLE dbo.[SavingInterestSettings] WITH CHECK ADD CONSTRAINT [FK_SavingInterestSettings_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingPassbooks_SavingAccountMasters_SavingAccountID')
BEGIN
    ALTER TABLE dbo.[SavingPassbooks] WITH CHECK ADD CONSTRAINT [FK_SavingPassbooks_SavingAccountMasters_SavingAccountID] FOREIGN KEY ([SavingAccountID]) REFERENCES dbo.[SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingPassbooks_SavingTransactions_TransactionID')
BEGIN
    ALTER TABLE dbo.[SavingPassbooks] WITH CHECK ADD CONSTRAINT [FK_SavingPassbooks_SavingTransactions_TransactionID] FOREIGN KEY ([TransactionID]) REFERENCES dbo.[SavingTransactions] ([TransactionID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingTransactions_SavingAccountMasters_SavingAccountID')
BEGIN
    ALTER TABLE dbo.[SavingTransactions] WITH CHECK ADD CONSTRAINT [FK_SavingTransactions_SavingAccountMasters_SavingAccountID] FOREIGN KEY ([SavingAccountID]) REFERENCES dbo.[SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingTransactions_SavingAccountMasters_TargetSavingAccountID')
BEGIN
    ALTER TABLE dbo.[SavingTransactions] WITH CHECK ADD CONSTRAINT [FK_SavingTransactions_SavingAccountMasters_TargetSavingAccountID] FOREIGN KEY ([TargetSavingAccountID]) REFERENCES dbo.[SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_SavingVoucherMappings_Ledgers_LedgerID')
BEGIN
    ALTER TABLE dbo.[SavingVoucherMappings] WITH CHECK ADD CONSTRAINT [FK_SavingVoucherMappings_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_ShareAccounts_Members_MemberId')
BEGIN
    ALTER TABLE dbo.[ShareAccounts] WITH CHECK ADD CONSTRAINT [FK_ShareAccounts_Members_MemberId] FOREIGN KEY ([MemberId]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_ShareCertificatePrintHistories_ShareCertificates_CertificateId')
BEGIN
    ALTER TABLE dbo.[ShareCertificatePrintHistories] WITH CHECK ADD CONSTRAINT [FK_ShareCertificatePrintHistories_ShareCertificates_CertificateId] FOREIGN KEY ([CertificateId]) REFERENCES dbo.[ShareCertificates] ([CertificateId]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_ShareCertificates_ShareAccounts_ShareAccountId')
BEGIN
    ALTER TABLE dbo.[ShareCertificates] WITH CHECK ADD CONSTRAINT [FK_ShareCertificates_ShareAccounts_ShareAccountId] FOREIGN KEY ([ShareAccountId]) REFERENCES dbo.[ShareAccounts] ([ShareAccountId]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_ShareTransactions_ShareAccounts_ShareAccountId')
BEGIN
    ALTER TABLE dbo.[ShareTransactions] WITH CHECK ADD CONSTRAINT [FK_ShareTransactions_ShareAccounts_ShareAccountId] FOREIGN KEY ([ShareAccountId]) REFERENCES dbo.[ShareAccounts] ([ShareAccountId]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_ShareTransactions_Vouchers_VoucherId')
BEGIN
    ALTER TABLE dbo.[ShareTransactions] WITH CHECK ADD CONSTRAINT [FK_ShareTransactions_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_UserLoginAudits_Users_UserID')
BEGIN
    ALTER TABLE dbo.[UserLoginAudits] WITH CHECK ADD CONSTRAINT [FK_UserLoginAudits_Users_UserID] FOREIGN KEY ([UserID]) REFERENCES dbo.[Users] ([UserID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Users_Branches_DefaultBranchID')
BEGIN
    ALTER TABLE dbo.[Users] WITH CHECK ADD CONSTRAINT [FK_Users_Branches_DefaultBranchID] FOREIGN KEY ([DefaultBranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Users_Roles_RoleID')
BEGIN
    ALTER TABLE dbo.[Users] WITH CHECK ADD CONSTRAINT [FK_Users_Roles_RoleID] FOREIGN KEY ([RoleID]) REFERENCES dbo.[Roles] ([RoleID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_VoucherDetails_Ledgers_LedgerID')
BEGIN
    ALTER TABLE dbo.[VoucherDetails] WITH CHECK ADD CONSTRAINT [FK_VoucherDetails_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_VoucherDetails_Members_MemberID')
BEGIN
    ALTER TABLE dbo.[VoucherDetails] WITH CHECK ADD CONSTRAINT [FK_VoucherDetails_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES dbo.[Members] ([MemberID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_VoucherDetails_Vouchers_VoucherID')
BEGIN
    ALTER TABLE dbo.[VoucherDetails] WITH CHECK ADD CONSTRAINT [FK_VoucherDetails_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES dbo.[Vouchers] ([VoucherID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_VoucherMappings_Ledgers_CreditLedgerID')
BEGIN
    ALTER TABLE dbo.[VoucherMappings] WITH CHECK ADD CONSTRAINT [FK_VoucherMappings_Ledgers_CreditLedgerID] FOREIGN KEY ([CreditLedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_VoucherMappings_Ledgers_DebitLedgerID')
BEGIN
    ALTER TABLE dbo.[VoucherMappings] WITH CHECK ADD CONSTRAINT [FK_VoucherMappings_Ledgers_DebitLedgerID] FOREIGN KEY ([DebitLedgerID]) REFERENCES dbo.[Ledgers] ([LedgerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Vouchers_Branches_BranchID')
BEGIN
    ALTER TABLE dbo.[Vouchers] WITH CHECK ADD CONSTRAINT [FK_Vouchers_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES dbo.[Branches] ([BranchID]) ON DELETE NO ACTION;
END;
GO
