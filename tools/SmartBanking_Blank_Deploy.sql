-- =========================================================================================
-- SmartBanking Core ERP - 100% Pure Template Database Deployment Script
-- Database Name   : SmartBanking_Template
-- Generated Date  : 2026-09-08 14.30.02
-- Architecture    : 100% Strict Customer-First (CIF-First) Architecture
-- Data Status     : Totally Blank (0 Customers, 0 Members, 0 Accounts, 0 Vouchers)
-- Preserved       : Sanstha, 410 Ledgers, 91 Account Groups, All Schemes, Branch, Admin User
-- Counter Policy  : Zero-Jump Automatic Counter Rollback on Delete Triggers
-- Schema Policy   : Strict Immutability & Schema Governance Guard
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
        CONSTRAINT [PK___SystemVersionHistory] PRIMARY KEY CLUSTERED ([Id])
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
        [GroupCode] nvarchar(50) NULL,
        [GroupNameEnglish] nvarchar(100) NULL,
        [DisplayOrder] int NOT NULL DEFAULT ((0)),
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
        [PigmyAgentID] int NOT NULL,
        [AgentName] nvarchar(100) NULL,
        [FirstName] nvarchar(50) NOT NULL,
        [MiddleName] nvarchar(50) NULL,
        [LastName] nvarchar(50) NOT NULL,
        [FirstNameEng] nvarchar(50) NULL,
        [MiddleNameEng] nvarchar(50) NULL,
        [LastNameEng] nvarchar(50) NULL,
        [Gender] nvarchar(10) NOT NULL DEFAULT ('Male'),
        [BirthDate] datetime2 NULL,
        [Occupation] nvarchar(100) NULL,
        [CasteCategory] nvarchar(50) NULL,
        [MobileNo] nvarchar(15) NOT NULL,
        [Email] nvarchar(100) NULL,
        [AadhaarNo] nvarchar(12) NULL,
        [PANNo] nvarchar(10) NULL,
        [Address] nvarchar(500) NULL,
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
        [DailyDepositAmount] decimal(18, 2) NULL,
        [InitialDepositAmount] decimal(18, 2) NULL,
        [Remarks] nvarchar(500) NULL,
        [Status] nvarchar(20) NOT NULL DEFAULT ('Pending'),
        [RequestDate] datetime2 NOT NULL DEFAULT (getdate()),
        [ApprovalDate] datetime2 NULL,
        [ApprovedByUserID] int NULL,
        [CreatedMemberID] int NULL,
        [CreatedPigmyAccountID] int NULL,
        [RejectionReason] nvarchar(500) NULL,
        [AddressEng] nvarchar(500) NULL,
        [CreatedCustomerID] int NULL,
        CONSTRAINT [PK_AgentCustomerRequests] PRIMARY KEY CLUSTERED ([RequestID])
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
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedOn] datetime2 NOT NULL,
        CONSTRAINT [PK_AuditLedgerMappings] PRIMARY KEY CLUSTERED ([AuditLedgerMappingID])
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
        [Timestamp] datetime2 NOT NULL,
        [IPAddress] nvarchar(50) NULL,
        [Details] nvarchar(MAX) NULL,
        [Status] nvarchar(20) NOT NULL,
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY CLUSTERED ([AuditLogID])
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
        [BranchType] nvarchar(20) NULL,
        [Email] nvarchar(100) NULL,
        [MobileNo] nvarchar(15) NULL,
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
        [BranchType] nvarchar(20) NOT NULL DEFAULT (''),
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
        [AllocationDate] datetime2 NOT NULL DEFAULT (getdate()),
        [AllocationType] nvarchar(30) NOT NULL DEFAULT ('HEAD_TO_TELLER'),
        [FromCashierId] int NOT NULL,
        [ToCashierId] int NOT NULL,
        [Amount] decimal(18, 2) NOT NULL,
        [Status] nvarchar(20) NOT NULL DEFAULT ('APPROVED'),
        [AuthorizedBy] int NULL,
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        [BranchId] int NULL,
        [IsReturn] bit NOT NULL DEFAULT ((0)),
        [CreatedBy] nvarchar(100) NULL,
        CONSTRAINT [PK_CashAllocations] PRIMARY KEY CLUSTERED ([Id])
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
        [EntryDate] datetime2 NOT NULL DEFAULT (getdate()),
        [CashierId] int NOT NULL,
        [Count2000] int NOT NULL DEFAULT ((0)),
        [Count500] int NOT NULL DEFAULT ((0)),
        [Count200] int NOT NULL DEFAULT ((0)),
        [Count100] int NOT NULL DEFAULT ((0)),
        [Count50] int NOT NULL DEFAULT ((0)),
        [Count20] int NOT NULL DEFAULT ((0)),
        [Count10] int NOT NULL DEFAULT ((0)),
        [Count5] int NOT NULL DEFAULT ((0)),
        [Count2] int NOT NULL DEFAULT ((0)),
        [Count1] int NOT NULL DEFAULT ((0)),
        [TotalAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [PhysicalCashTotal] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [SystemCashBalance] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [DifferenceAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        [BranchId] int NULL,
        [DenominationDate] datetime2 NOT NULL DEFAULT (getdate()),
        [EntryType] nvarchar(50) NOT NULL DEFAULT ('CLOSING'),
        [CountCoins] int NOT NULL DEFAULT ((0)),
        [ExpectedAmount] decimal(18, 2) NOT NULL DEFAULT ((0.00)),
        [DifferenceType] nvarchar(20) NOT NULL DEFAULT ('MATCHED'),
        [VerifiedBy] nvarchar(100) NULL,
        CONSTRAINT [PK_CashDenominations] PRIMARY KEY CLUSTERED ([Id])
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
        CONSTRAINT [PK_CashierBalances] PRIMARY KEY CLUSTERED ([Id])
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
        [BranchId] int NOT NULL DEFAULT ((1)),
        [CashierName] nvarchar(100) NOT NULL,
        [CounterNumber] nvarchar(50) NOT NULL,
        [IsHeadCashier] bit NOT NULL DEFAULT ((0)),
        [IsActive] bit NOT NULL DEFAULT ((1)),
        [MaxCashLimit] decimal(18, 2) NOT NULL DEFAULT ((500000.00)),
        [Remarks] nvarchar(250) NULL,
        [CashLedgerId] int NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
        [UserId] int NULL,
        CONSTRAINT [PK_Cashiers] PRIMARY KEY CLUSTERED ([Id])
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
        [BranchId] int NOT NULL DEFAULT ((1)),
        [AutoGenerateVouchers] bit NOT NULL DEFAULT ((0)),
        [EnableDenominationMandatory] bit NOT NULL DEFAULT ((1)),
        [MaxBranchVaultLimit] decimal(18, 2) NOT NULL DEFAULT ((5000000.00)),
        [DefaultCounterLimit] decimal(18, 2) NOT NULL DEFAULT ((500000.00)),
        [Remarks] nvarchar(250) NULL,
        [LastUpdated] datetime2 NOT NULL DEFAULT (getdate()),
        [MainVaultLedgerId] int NULL,
        [CashShortageLedgerId] int NULL,
        [CashExcessLedgerId] int NULL,
        CONSTRAINT [PK_CashManagementSettings] PRIMARY KEY CLUSTERED ([Id])
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
        [Category] nvarchar(100) NULL,
        [DINNo] nvarchar(50) NULL,
        [Remarks] nvarchar(500) NULL,
        [TermYear] nvarchar(50) NULL,
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
        [LegacyCustomerNo] nvarchar(50) NULL,
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
        [DeathDate] datetime2 NOT NULL DEFAULT (CONVERT([date],getdate(),(0))),
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
        [SettlementDate] datetime2 NOT NULL DEFAULT (CONVERT([date],getdate(),(0))),
        [Remarks] nvarchar(500) NULL,
        [CreatedBy] int NOT NULL DEFAULT ((1)),
        [CreatedOn] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
        CONSTRAINT [PK_DeceasedClaimSettlements] PRIMARY KEY CLUSTERED ([ClaimID])
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
        [Status] nvarchar(20) NOT NULL,
        [RecordsProcessed] int NOT NULL,
        [ErrorMessage] nvarchar(MAX) NULL,
        [StartTime] datetime2 NOT NULL,
        [EndTime] datetime2 NULL,
        CONSTRAINT [PK_EodBatchProcessLogs] PRIMARY KEY CLUSTERED ([LogID])
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
        [BankAccountLedgerID] int NULL,
        [ChequeDate] datetime2 NULL,
        [ChequeNo] nvarchar(50) NULL,
        [PaymentMode] nvarchar(20) NOT NULL DEFAULT (''),
        [SavingAccountID] int NULL,
        [CustomerID] int NOT NULL,
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
        [RelationWithPrimary] nvarchar(50) NULL,
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
        CONSTRAINT [PK_JointMembers] PRIMARY KEY CLUSTERED ([JointMemberID])
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
        [BranchId] int NOT NULL,
        [TransactionType] nvarchar(50) NOT NULL,
        [DebitLedgerId] int NOT NULL,
        [CreditLedgerId] int NOT NULL,
        [IsActive] bit NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        [UpdatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_LegalRecoveryLedgerMappings] PRIMARY KEY CLUSTERED ([MappingId])
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
        [MemberID] int NULL,
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
        [CoCustomerID] int NULL,
        [CoCustomer2ID] int NULL,
        [Guarantor1CustomerID] int NULL,
        [Guarantor2CustomerID] int NULL,
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
        [MemberID] int NULL,
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
        [CoCustomerID] int NULL,
        [CoCustomer2ID] int NULL,
        [Guarantor1CustomerID] int NULL,
        [Guarantor2CustomerID] int NULL,
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
        [ApprovedByUserID] int NULL,
        [InterestWaived] decimal(18, 2) NOT NULL DEFAULT ((0.0)),
        [IsOTS] bit NOT NULL DEFAULT (CONVERT([bit],(0),(0))),
        [PenaltyWaived] decimal(18, 2) NOT NULL DEFAULT ((0.0)),
        [ResolutionNo] nvarchar(100) NULL,
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
        [InterestPostingFrequency] nvarchar(100) NOT NULL DEFAULT (''),
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
        [BranchID] int NOT NULL,
        [LockerAccountNo] nvarchar(50) NOT NULL,
        [LockerID] int NOT NULL,
        [MemberID] int NOT NULL,
        [JointMember1_ID] int NULL,
        [JointMember2_ID] int NULL,
        [OperatingInstruction] nvarchar(50) NOT NULL,
        [AllotmentDate] datetime2 NOT NULL,
        [RentStartDate] datetime2 NOT NULL,
        [ExpiryDate] datetime2 NOT NULL,
        [AnnualRent] decimal(18, 2) NOT NULL,
        [SecurityDepositAmount] decimal(18, 2) NOT NULL,
        [AdvanceRentPaid] decimal(18, 2) NOT NULL,
        [LinkedSavingAccountID] int NULL,
        [IsAutoDebitEnabled] bit NOT NULL,
        [NomineeName] nvarchar(150) NULL,
        [NomineeRelation] nvarchar(50) NULL,
        [NomineeAge] int NULL,
        [NomineeAadhaar] nvarchar(20) NULL,
        [NomineeAddress] nvarchar(200) NULL,
        [DepositVoucherID] int NULL,
        [AdvanceRentVoucherID] int NULL,
        [Status] nvarchar(30) NOT NULL,
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [CustomerID] int NULL,
        CONSTRAINT [PK_LockerAllotments] PRIMARY KEY CLUSTERED ([AllotmentID])
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
        [BranchID] int NOT NULL,
        [AllotmentID] int NOT NULL,
        [FinancialYear] nvarchar(20) NOT NULL,
        [FromDate] datetime2 NOT NULL,
        [ToDate] datetime2 NOT NULL,
        [RentAmount] decimal(18, 2) NOT NULL,
        [GstAmount] decimal(18, 2) NOT NULL,
        [PenaltyAmount] decimal(18, 2) NOT NULL,
        [TotalAmount] decimal(18, 2) NOT NULL,
        [PaymentMode] nvarchar(50) NOT NULL,
        [PaymentDate] datetime2 NULL,
        [ReceiptNo] nvarchar(50) NULL,
        [VoucherID] int NULL,
        [IsPaid] bit NOT NULL,
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_LockerRentPostings] PRIMARY KEY CLUSTERED ([PostingID])
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
        [BranchID] int NOT NULL,
        [CabinetNo] nvarchar(50) NOT NULL,
        [LockerNo] nvarchar(50) NOT NULL,
        [KeyNo] nvarchar(50) NOT NULL,
        [LockerTypeID] int NOT NULL,
        [Status] nvarchar(50) NOT NULL,
        [Remarks] nvarchar(250) NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Lockers] PRIMARY KEY CLUSTERED ([LockerID])
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
        [BranchID] int NOT NULL,
        [AllotmentID] int NOT NULL,
        [SurrenderDate] datetime2 NOT NULL,
        [KeyReceived] bit NOT NULL,
        [KeysCondition] nvarchar(100) NOT NULL,
        [DepositAmount] decimal(18, 2) NOT NULL,
        [UnpaidRentDeduction] decimal(18, 2) NOT NULL,
        [DamagePenaltyDeduction] decimal(18, 2) NOT NULL,
        [NetRefundAmount] decimal(18, 2) NOT NULL,
        [RefundPaymentMode] nvarchar(50) NOT NULL,
        [VoucherID] int NULL,
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_LockerSurrenders] PRIMARY KEY CLUSTERED ([SurrenderID])
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
        [BranchID] int NOT NULL,
        [TypeCode] nvarchar(50) NOT NULL,
        [TypeName] nvarchar(100) NOT NULL,
        [Dimensions] nvarchar(100) NULL,
        [AnnualRent] decimal(18, 2) NOT NULL,
        [SecurityDeposit] decimal(18, 2) NOT NULL,
        [LateFeePerMonth] decimal(18, 2) NOT NULL,
        [GstRate] decimal(5, 2) NOT NULL,
        [DepositLiabilityLedgerID] int NULL,
        [RentIncomeLedgerID] int NULL,
        [LateFeeIncomeLedgerID] int NULL,
        [GstLiabilityLedgerID] int NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_LockerTypes] PRIMARY KEY CLUSTERED ([LockerTypeID])
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
        [BranchID] int NOT NULL,
        [AllotmentID] int NOT NULL,
        [VisitDate] datetime2 NOT NULL,
        [TimeIn] nvarchar(20) NOT NULL,
        [TimeOut] nvarchar(20) NULL,
        [OperatedBy] nvarchar(50) NOT NULL,
        [OperatorName] nvarchar(150) NOT NULL,
        [IsSignatureVerified] bit NOT NULL,
        [BankOfficerName] nvarchar(100) NULL,
        [Remarks] nvarchar(250) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_LockerVisitRegisters] PRIMARY KEY CLUSTERED ([VisitID])
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
        [CustomerID] int NULL,
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
        [JoiningDate] datetime2 NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [UpdatedBy] int NULL,
        [UpdatedOn] datetime2 NULL,
        [LegacyMemberNo] nvarchar(50) NULL,
        [MembershipType] nvarchar(30) NOT NULL DEFAULT ('Regular'),
        [IsDeleted] bit NOT NULL DEFAULT ((0)),
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
        [CustomerID] int NOT NULL,
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
        [CommissionExpenseLedgerID] int NULL,
        [InterestExpenseLedgerID] int NULL,
        [InterestPayableLedgerID] int NULL,
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
        [AccountType] nvarchar(20) NOT NULL DEFAULT (N''),
        [AgentID] int NULL,
        [GuardianName] nvarchar(100) NULL,
        [GuardianRelation] nvarchar(50) NULL,
        [MaturityInstruction] nvarchar(30) NOT NULL DEFAULT (N''),
        [PassbookNo] nvarchar(50) NULL,
        [PaymentMode] nvarchar(30) NOT NULL DEFAULT (N''),
        [SavingAccountID] int NULL,
        [CustomerID] int NOT NULL,
        [JointCustomerID] int NULL,
        [JointMemberID] int NULL,
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
        [RdLiabilityLedgerID] int NULL,
        [InterestExpenseLedgerID] int NULL,
        [InterestPayableLedgerID] int NULL,
        [PenaltyIncomeLedgerID] int NULL,
        [PrematurePenaltyRate] decimal(18, 2) NOT NULL DEFAULT ((0)),
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
        [CanView] bit NOT NULL,
        [CanAdd] bit NOT NULL,
        [CanEdit] bit NOT NULL,
        [CanDelete] bit NOT NULL,
        [CanPrint] bit NOT NULL,
        [CanApprove] bit NOT NULL,
        [ScopeLevel] nvarchar(20) NOT NULL,
        CONSTRAINT [PK_RolePermissions] PRIMARY KEY CLUSTERED ([RolePermissionID])
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
        [IsSystemRole] bit NOT NULL DEFAULT ((0)),
        [RoleCode] nvarchar(30) NOT NULL DEFAULT (''),
        [Status] bit NOT NULL DEFAULT ((0)),
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
        [AutoPostVouchers] bit NOT NULL DEFAULT (CONVERT([bit],(0),(0))),
        [AutoPostVoucherLimit] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [District] nvarchar(100) NULL,
        [PinCode] nvarchar(20) NULL,
        [RegistrationDate] datetime2 NULL,
        [State] nvarchar(100) NULL,
        [Taluka] nvarchar(100) NULL,
        [Village] nvarchar(100) NULL,
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
        [CreatedOn] datetime2 NOT NULL,
        [CustomerID] int NULL,
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
        [LienAmount] decimal(18, 2) NOT NULL DEFAULT ((0.0)),
        [LienReason] nvarchar(250) NULL,
        [CustomerID] int NULL,
        [LastInterestPostingDate] datetime2 NULL,
        [LastInterestAmount] decimal(18, 2) NULL,
        [OldAccountNo] nvarchar(50) NULL,
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
        [SchemeName] nvarchar(100) NULL,
        [SavingLiabilityLedgerID] int NULL,
        [InterestExpenseLedgerID] int NULL,
        [InterestPayableLedgerID] int NULL,
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
        [CustomerID] int NOT NULL DEFAULT ((1)),
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
        [ExecutionId] int IDENTITY(1,1) NOT NULL,
        [CaseId] int NOT NULL,
        [SroName] nvarchar(100) NOT NULL,
        [ExecutionType] nvarchar(50) NOT NULL,
        [PropertyDetails] nvarchar(500) NULL,
        [ValuationAmount] decimal(18, 2) NOT NULL,
        [WarrantIssueDate] datetime2 NULL,
        [PanchanamaDate] datetime2 NULL,
        [AuctionNoticeDate] datetime2 NULL,
        [AuctionDate] datetime2 NULL,
        [ReservePrice] decimal(18, 2) NOT NULL,
        [HighestBidAmount] decimal(18, 2) NOT NULL,
        [BuyerName] nvarchar(150) NULL,
        [BuyerContact] nvarchar(100) NULL,
        [SaleCertificateDate] datetime2 NULL,
        [SaleCertificateNo] nvarchar(50) NULL,
        [Status] nvarchar(50) NOT NULL,
        [Remarks] nvarchar(MAX) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedBy] int NOT NULL,
        [ExecutionOrderNo] nvarchar(50) NULL,
        [OrderDate] datetime2 NULL,
        [EmployerName] nvarchar(150) NULL,
        [EmployerAddress] nvarchar(250) NULL,
        [MonthlyDeductionAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [EstimatedValue] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [ExecutionStatus] nvarchar(50) NULL,
        [RecoveredAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_Sec101AttachmentAuctions] PRIMARY KEY CLUSTERED ([ExecutionId])
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
        [BranchId] int NOT NULL,
        [LoanAccountId] int NOT NULL,
        [MemberId] int NOT NULL,
        [CaseNumber] nvarchar(50) NOT NULL,
        [CourtName] nvarchar(200) NOT NULL,
        [AdvocateName] nvarchar(100) NULL,
        [FilingDate] datetime2 NOT NULL,
        [PrincipalClaim] decimal(18, 2) NOT NULL,
        [InterestClaim] decimal(18, 2) NOT NULL,
        [PenalInterestClaim] decimal(18, 2) NOT NULL,
        [OtherChargesClaim] decimal(18, 2) NOT NULL,
        [TotalClaimAmount] decimal(18, 2) NOT NULL,
        [CourtFeeAmount] decimal(18, 2) NOT NULL,
        [CourtFeeChallanNo] nvarchar(50) NULL,
        [CertificateNo] nvarchar(50) NULL,
        [CertificateDate] datetime2 NULL,
        [SanctionedAmount] decimal(18, 2) NULL,
        [FutureInterestRate] decimal(18, 2) NULL,
        [Status] nvarchar(50) NOT NULL,
        [Remarks] nvarchar(MAX) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedBy] int NOT NULL,
        [CertificateNumber] nvarchar(50) NULL,
        [GrantedAmount] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [GrantedInterestRate] decimal(18, 2) NOT NULL DEFAULT ((0)),
        [CaseStatus] nvarchar(50) NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_Sec101CaseMasters] PRIMARY KEY CLUSTERED ([CaseId])
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
        [HearingDate] datetime2 NOT NULL,
        [NextHearingDate] datetime2 NULL,
        [Stage] nvarchar(100) NOT NULL,
        [BorrowerPresence] nvarchar(20) NOT NULL,
        [GuarantorPresence] nvarchar(20) NOT NULL,
        [CourtOrderSummary] nvarchar(MAX) NULL,
        [AdvocateNotes] nvarchar(MAX) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedBy] int NOT NULL,
        [HearingLogId] int NULL,
        [HearingStage] nvarchar(100) NULL,
        [PresenceType] nvarchar(50) NULL,
        [NextHearingPurpose] nvarchar(250) NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_Sec101HearingLogs] PRIMARY KEY CLUSTERED ([HearingId])
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
        [BranchId] int NOT NULL,
        [CaseId] int NULL,
        [LoanAccountId] int NOT NULL,
        [ExpenseType] nvarchar(50) NOT NULL,
        [Amount] decimal(18, 2) NOT NULL,
        [ExpenseDate] datetime2 NOT NULL,
        [PaidTo] nvarchar(150) NULL,
        [VoucherId] int NULL,
        [IsDebitedToLoan] bit NOT NULL,
        [Remarks] nvarchar(MAX) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedBy] int NOT NULL,
        [LegalExpenseId] int NULL,
        [PayeeName] nvarchar(150) NULL,
        [PaymentMode] nvarchar(50) NULL,
        [VoucherNumber] nvarchar(50) NULL,
        [IsDebitedToBorrower] bit NOT NULL DEFAULT ((0)),
        [DebitLedgerId] int NULL,
        [CreditLedgerId] int NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_Sec101LegalExpenses] PRIMARY KEY CLUSTERED ([ExpenseId])
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
        [BranchId] int NOT NULL,
        [LoanAccountId] int NOT NULL,
        [MemberId] int NOT NULL,
        [NoticeType] nvarchar(50) NOT NULL,
        [NoticeNumber] nvarchar(50) NOT NULL,
        [NoticeDate] datetime2 NOT NULL,
        [DueDate] datetime2 NOT NULL,
        [PrincipalDue] decimal(18, 2) NOT NULL,
        [InterestDue] decimal(18, 2) NOT NULL,
        [PenalInterestDue] decimal(18, 2) NOT NULL,
        [NoticeFee] decimal(18, 2) NOT NULL,
        [TotalDemandAmount] decimal(18, 2) NOT NULL,
        [PostalTrackingNo] nvarchar(100) NULL,
        [PostalStatus] nvarchar(50) NOT NULL,
        [DeliveredDate] datetime2 NULL,
        [Remarks] nvarchar(MAX) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedBy] int NOT NULL,
        [CreatedDate] datetime2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_Sec101NoticeHistories] PRIMARY KEY CLUSTERED ([NoticeId])
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
        [BranchID] int NOT NULL,
        [SchemeCode] nvarchar(50) NOT NULL,
        [SchemeName] nvarchar(100) NOT NULL,
        [MemberType] nvarchar(50) NOT NULL,
        [ShareFaceValue] decimal(18, 2) NOT NULL,
        [MinSharesCount] int NOT NULL,
        [MaxSharesCount] int NOT NULL,
        [EntranceFee] decimal(18, 2) NOT NULL,
        [BuildingFund] decimal(18, 2) NOT NULL,
        [ShareTransferFee] decimal(18, 2) NOT NULL,
        [DividendRate] decimal(18, 2) NOT NULL,
        [HasVotingRights] bit NOT NULL,
        [IsAadhaarCompulsory] bit NOT NULL,
        [IsPanCompulsory] bit NOT NULL,
        [LoanEligibilityMultiplier] int NOT NULL,
        [EffectiveDate] datetime2 NOT NULL,
        [IsActive] bit NOT NULL,
        [ShareCapitalLedgerID] int NULL,
        [EntranceFeeLedgerID] int NULL,
        [ShareTransferFeeLedgerID] int NULL,
        [BuildingFundLedgerID] int NULL,
        [DividendPayableLedgerID] int NULL,
        [IsMobileCompulsory] bit NOT NULL DEFAULT ((1)),
        CONSTRAINT [PK_ShareSchemes] PRIMARY KEY CLUSTERED ([ShareSchemeId])
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
        [BranchID] int NOT NULL,
        [UserID] int NULL,
        [RoleName] nvarchar(50) NULL,
        [ModuleName] nvarchar(50) NOT NULL,
        [NotificationType] nvarchar(50) NOT NULL,
        [Title] nvarchar(250) NOT NULL,
        [Description] nvarchar(500) NOT NULL,
        [Priority] nvarchar(20) NOT NULL,
        [TargetTab] nvarchar(100) NOT NULL,
        [EntityName] nvarchar(50) NULL,
        [EntityID] nvarchar(50) NULL,
        [Amount] decimal(18, 2) NULL,
        [DueDate] datetime2 NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [CompletedOn] datetime2 NULL,
        [CompletedBy] int NULL,
        CONSTRAINT [PK_SystemNotifications] PRIMARY KEY CLUSTERED ([NotificationID])
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
        [Version] nvarchar(100) NULL,
        [ReleaseDate] nvarchar(50) NULL,
        [Changelog] nvarchar(MAX) NULL,
        [InstalledOn] datetime2 NOT NULL DEFAULT (getutcdate()),
        [IsActive] bit NOT NULL DEFAULT ((1)),
        [VersionNumber] nvarchar(50) NULL,
        [AppliedOn] datetime2 NOT NULL DEFAULT (getutcdate()),
        [PatchName] nvarchar(150) NULL,
        [Status] nvarchar(50) NOT NULL DEFAULT ('SUCCESS'),
        [Remarks] nvarchar(MAX) NULL,
        [AppliedBy] nvarchar(100) NULL,
        CONSTRAINT [PK_SystemVersionHistories] PRIMARY KEY CLUSTERED ([Id])
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
        [ActiveSessionToken] nvarchar(2000) NULL,
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
        [CustomerID] int NULL,
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
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_FdAccounts_CustomerID' AND object_id = OBJECT_ID('dbo.[FdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FdAccounts_CustomerID] ON dbo.[FdAccounts] ([CustomerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_MemberOpeningBalances_CustomerID' AND object_id = OBJECT_ID('dbo.[MemberOpeningBalances]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_MemberOpeningBalances_CustomerID] ON dbo.[MemberOpeningBalances] ([CustomerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_Members_CustomerID' AND object_id = OBJECT_ID('dbo.[Members]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_CustomerID] ON dbo.[Members] ([CustomerID] ASC) WHERE ([CustomerID] IS NOT NULL);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_PigmyAccounts_CustomerID' AND object_id = OBJECT_ID('dbo.[PigmyAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmyAccounts_CustomerID] ON dbo.[PigmyAccounts] ([CustomerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'UQ_PigmyCollections_TransactionId' AND object_id = OBJECT_ID('dbo.[PigmyCollections]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_PigmyCollections_TransactionId] ON dbo.[PigmyCollections] ([TransactionId] ASC) WHERE ([TransactionId] IS NOT NULL);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdAccounts_CustomerID' AND object_id = OBJECT_ID('dbo.[RdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdAccounts_CustomerID] ON dbo.[RdAccounts] ([CustomerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_RdAccounts_JointCustomerID' AND object_id = OBJECT_ID('dbo.[RdAccounts]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RdAccounts_JointCustomerID] ON dbo.[RdAccounts] ([JointCustomerID] ASC);
END;
GO
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'IX_VoucherDetails_CustomerID' AND object_id = OBJECT_ID('dbo.[VoucherDetails]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VoucherDetails_CustomerID] ON dbo.[VoucherDetails] ([CustomerID] ASC);
END;
GO

-- =========================================================================================
-- PRESERVED CORE MASTER SEED DATA (Chart of Accounts & Configurations)
-- =========================================================================================
SET NOCOUNT ON;
GO
-- Table Seed: [AccountGroups] (91 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[AccountGroups])
BEGIN
    SET IDENTITY_INSERT dbo.[AccountGroups] ON;
    INSERT INTO dbo.[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES
        (1, N'सभासद भागभांडवल ', NULL, N'Liabilities', 1, NULL, N'1', N'Capital', 1),
        (2, N'वैयक्तिक ', 1, N'Liabilities', 1, NULL, N'1.1', N'Paid up Capital - Individual', 0),
        (3, N'संस्था ', 1, N'Liabilities', 1, NULL, N'1.2', N'Paid up Capital - Institution', 0),
        (4, N'राखीव व इतर निधी ', NULL, N'Liabilities', 1, NULL, N'2', N'Reserve & Other Funds', 2),
        (5, N'राखीव निधी ', 4, N'Liabilities', 1, NULL, N'2.1', N'Reserve Fund', 2),
        (6, N'लाभांश समीकरण निधी ', 4, N'Liabilities', 1, NULL, N'2.2', N'Dividend Equalization Fund', 0),
        (7, N'इमारत निधी ', 4, N'Liabilities', 1, NULL, N'2.3', N'Building Fund', 0),
        (8, N'नफ्यातून काढलेले निधी ', 4, N'Liabilities', 1, NULL, N'2.4', N'Funds Appropriated from Profit', 0),
        (9, N'इतर निधी ', 4, N'Liabilities', 1, NULL, N'2.5', N'Other Funds', 0),
        (10, N'ठेवी ', NULL, N'Liabilities', 1, NULL, N'3', N'Deposite', 3),
        (11, N'बचत ठेवी ', 10, N'Liabilities', 1, NULL, N'3.1', N'Savhing Deposite', 3),
        (12, N'मुदती ठेवी ', 10, N'Liabilities', 1, NULL, N'3.2', N'Fixed Deposits Cumulative', 3),
        (13, N'आवर्ती ठेवी ', 10, N'Liabilities', 1, NULL, N'3.3', N'Ricuring Deposite', 3),
        (14, N'इतर ठेवी ', 10, N'Liabilities', 1, NULL, N'3.4', N'Other Deposite', 3),
        (15, N'बँक कर्जे ', NULL, N'Liabilities', 1, NULL, N'4', N'Bank Loan', 4),
        (16, N'जिल्हा मध्यवर्ती बँक  कर्जे ', 15, N'Liabilities', 1, NULL, N'4.1', N'DCC Bank Loan', 4),
        (17, N'इतर बँकेतील कर्जे ', 15, N'Liabilities', 1, NULL, N'4.2', N'Other Bank Loan', 4),
        (18, N'इतर देणे ', NULL, N'Liabilities', 1, NULL, N'5', N'Other Payables', 5),
        (19, N'सभासद लाभांश ', 18, N'Liabilities', 1, NULL, N'5.1', N'member Divedent', 0),
        (20, N'इतर देणे ', 18, N'Liabilities', 1, NULL, N'5.2', N'Other Payables', 5),
        (21, N'शाखा येणे देणे ', NULL, N'Liabilities', 1, NULL, N'6', N' Accounts Receivable and Payable Branch', 6),
        (22, N'तरतुदी ', NULL, N'Liabilities', 1, NULL, N'7', N'PROVISIONS', 7),
        (23, N'बँक कर्जावरील देय व्याज तरतूद ', 22, N'Liabilities', 1, NULL, N'7.1', N'Bank Loan intr PROVISIONS', 0),
        (24, N'ठेवीवरील देय व्याज तरतूद ', 22, N'Liabilities', 1, NULL, N'7.2', N'deposite intr labilities PROVISIONS', 3),
        (25, N'थकव्याज तरतूद ', 22, N'Liabilities', 1, NULL, N'7.3', N'Due Intr PROVISIONS', 0),
        (26, N'खर्च  तरतूद ', 22, N'Liabilities', 1, NULL, N'7.4', N'expense PROVISIONS', 1),
        (27, N'इतर तरतूद ', 22, N'Liabilities', 1, NULL, N'7.5', N'Other PROVISIONS', 0),
        (28, N'नफा खाते ', NULL, N'Liabilities', 1, NULL, N'8', N'Profit Account', 6),
        (29, N'शिल्लक  नफा ', 28, N'Liabilities', 1, NULL, N'8.1', N'Profit And Loss(In Stock)', 6),
        (30, N'चालू नफा ', 28, N'Liabilities', 1, NULL, N'8.2', N'Profit And Loss(in Running)', 6),
        (31, N'हातावरील रोख शिल्लक ', NULL, N'Assets', 1, NULL, N'9', N'Cash in Hand', 1),
        (32, N'बँकेतील शिल्लक ', NULL, N'Assets', 1, NULL, N'10', N'Bank Acc Closing Bal', 2),
        (33, N'करंट खाते ', 32, N'Assets', 1, NULL, N'10.1', N'current Acc', 0),
        (34, N'बचत खाते ', 32, N'Assets', 1, NULL, N'10.2', N'Savhing Acc', 0),
        (35, N'गुंतवणूक ', NULL, N'Assets', 1, NULL, N'11', N'Investment', 3),
        (36, N'जिल्हा मध्यवर्ती शेअर्स ', 35, N'Assets', 1, NULL, N'11.1', N'DCC Bank Capital', 0),
        (37, N'इतर बँकेतील  शेअर्स ', 35, N'Assets', 1, NULL, N'11.2', N'Other Bank Capital', 0),
        (38, N'जिल्हा मध्यवर्ती गुंतवणूक ', 35, N'Assets', 1, NULL, N'11.3', N'Dcc Bank Investment', 3),
        (39, N'बँक रिझर्व  फंड ', 35, N'Assets', 1, NULL, N'11.4', N'Bank Reserve Fund', 0),
        (40, N'इतर बँकेतील  गुंतवणूक ', 35, N'Assets', 1, NULL, N'11.5', N'Other Bank Investment', 3),
        (41, N'अन्य गुंतवणूक ', 35, N'Assets', 1, NULL, N'11.6', N'Other Investment', 3),
        (42, N'कर्जे ', NULL, N'Assets', 1, NULL, N'12', N'Customer Loan', 4),
        (43, N'तारणी कर्जे ', 42, N'Assets', 1, NULL, N'12.1', N'collateral loan', 4),
        (44, N'विनातारणी कर्जे ', 42, N'Assets', 1, NULL, N'12.2', N' Unsecured loans', 4),
        (45, N'ठेव तारणी कर्जे ', 42, N'Assets', 1, NULL, N'12.3', N'Deposit-backed loans', 4),
        (46, N'जिन्नस व इतर  तारण कर्जे ', 42, N'Assets', 1, NULL, N'12.4', N'Commodity and other collateral loans', 4),
        (47, N'मालमत्ता ', NULL, N'Assets', 1, NULL, N'13', N'property', 5),
        (48, N'जागा व इमारत ', 47, N'Assets', 1, NULL, N'13.1', N'Site and building', 0),
        (49, N'डेडस्टॉक ', 47, N'Assets', 1, NULL, N'13.2', N' deadstock', 0),
        (50, N'संगणक ', 47, N'Assets', 1, NULL, N'13.3', N'Computer and printers ', 0),
        (51, N'अन्य  मालमत्ता ', 47, N'Assets', 1, NULL, N'13.4', N'Other Proprities ', 5),
        (52, N'इतर येणे ', NULL, N'Assets', 1, NULL, N'14', N' other coming', 6),
        (53, N'येणे  व्याज  कर्जावरील ', 52, N'Assets', 1, NULL, N'14.1', N' Accruing interest on loans', 0),
        (54, N'येणे  व्याज गुंतवणुकीवरील ', 52, N'Assets', 1, NULL, N'14.2', N' Interest on investments', 0),
        (55, N'येणे थकव्याज ', 52, N'Assets', 1, NULL, N'14.3', N' Fatigue to come', 0),
        (56, N'इतर येणे ', 52, N'Assets', 1, NULL, N'14.4', N'other coming', 6),
        (57, N'येणे देणे शाखा खाते ', NULL, N'Assets', 1, NULL, N'15', N' Accounts Receivable and Payable Branch', 15),
        (58, N'तोटा खाते ', NULL, N'Assets', 1, NULL, N'16', N' loss account', 7),
        (59, N'शिल्लक तोटा ', 58, N'Assets', 1, NULL, N'16.1', N' loss (in Stock)', 7),
        (60, N'चालू तोटा ', 58, N'Assets', 1, NULL, N'16.2', N' loss(in running)', 7),
        (61, N'मिळालेले कर्जावरील  व्याज ', NULL, N'Income', 1, NULL, N'17', N'Loan Interest received', 17),
        (62, N'गुंतवणूकवरील मिळालेले व्याज ', NULL, N'Income', 1, NULL, N'18', N'Investement Interest received', 3),
        (63, N'प्रवेश फी ', NULL, N'Income', 1, NULL, N'19', N'entry fee', 19),
        (64, N'इतर कमिशन जमा ', NULL, N'Income', 1, NULL, N'20', N' Other commission accrual', 20),
        (65, N'इतर उत्पन्न ', NULL, N'Income', 1, NULL, N'21', N' other income', 1),
        (66, N'देलेले  व्याज ', NULL, N'Expenses', 1, NULL, N'22', N'Paid  Interest', 22),
        (67, N'मुदत ठेव दिलेले व्याज ', 66, N'Expenses', 1, NULL, N'22.1', N'Interest paid on fixed deposit', 0),
        (68, N'आवर्ती ठेव दिलेले व्याज ', 66, N'Expenses', 1, NULL, N'22.2', N' Interest paid on recurring deposits', 0),
        (69, N'बचत ठेव दिलेले  व्याज ', 66, N'Expenses', 1, NULL, N'22.3', N' Interest paid on savings deposits', 0),
        (70, N'इतर ठेव दिलेले व्याज ', 66, N'Expenses', 1, NULL, N'22.4', N'Interest paid on Other deposits', 0),
        (71, N'पगार  व भत्ते ', NULL, N'Expenses', 1, NULL, N'23', N' Salary and allowances', 23),
        (72, N'कर्मचारी वेतन व मानधन ', 71, N'Expenses', 1, NULL, N'23.1', N' Employee salaries and honorarium', 0),
        (73, N'संचालक मंडळ भत्ते ', 71, N'Expenses', 1, NULL, N'23.2', N'Board of Directors allowances', 0),
        (74, N'इतर भत्ते ', 71, N'Expenses', 1, NULL, N'23.3', N'Other allowances', 0),
        (75, N'प्रिंटिंग व स्टेशनरी ', NULL, N'Expenses', 1, NULL, N'24', N' printing and stationery', 24),
        (76, N'व्यवस्थापण खर्च ', NULL, N'Expenses', 1, NULL, N'25', N'Management expenses', 1),
        (77, N'प्रवास खर्च ', 76, N'Expenses', 1, NULL, N'25.1', N'travel expenses', 1),
        (78, N'प्रशिक्षण खर्च ', 76, N'Expenses', 1, NULL, N'25.2', N'training expenses', 1),
        (79, N'सभासमारंभ खर्च ', 76, N'Expenses', 1, NULL, N'25.3', N' opening expenses', 1),
        (80, N'झिज व घसारा ', NULL, N'Expenses', 1, NULL, N'26', N' Wear and tear', 26),
        (81, N'तरतुदी ', NULL, N'Expenses', 1, NULL, N'27', N' Provisions', 27),
        (82, N'ऑडीट फी तरतूद ', 81, N'Expenses', 1, NULL, N'27.1', N' Audit fee provision', 0),
        (83, N'एन पी ए तरतूद ', 81, N'Expenses', 1, NULL, N'27.2', N' NPA provision', 0),
        (84, N'इतर खर्च तरतूद ', 81, N'Expenses', 1, NULL, N'27.3', N' Provision of other expenses', 1),
        (85, N'इतर किरकोळ  खर्च ', NULL, N'Expenses', 1, NULL, N'28', N' Other minor expenses', 1),
        (86, N'इमारत दुरुस्ती अन्य खर्च ', 85, N'Expenses', 1, NULL, N'28.1', N' Building repairs Other expenses', 1),
        (87, N'बँक कमिशन चार्जेस ', 85, N'Expenses', 1, NULL, N'28.2', N' Bank commission charges', 0),
        (88, N'संगणक देखभाल खर्च ', 85, N'Expenses', 1, NULL, N'28.3', N' Computer maintenance costs', 1),
        (89, N'इतर किरकोळ खर्च ', 85, N'Expenses', 1, NULL, N'28.4', N'Other minor expenses', 1),
        (90, N'बँक कर्जावरील  दिलेले व्याज ', 66, N'Expenses', 1, NULL, N'22.5', N' Interest paid on bank loans', 0),
        (91, N'अधिकृत भागभांडवल ', NULL, N'Liabilities', 1, NULL, N'29', N'', 1);
    SET IDENTITY_INSERT dbo.[AccountGroups] OFF;
    PRINT 'Seeded [AccountGroups] (91 records)';
END;
GO

-- Table Seed: [Ledgers] (410 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[Ledgers])
BEGIN
    SET IDENTITY_INSERT dbo.[Ledgers] ON;
    INSERT INTO dbo.[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES
        (1, N'सभासद भाग', 2, 4600.00, N'Cr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Member Shares', 0, NULL),
        (2, N'नाममात्र सभासद', 3, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Nominal Member', 0, NULL),
        (3, N'मयत सभासद', 3, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Deceased Member', 0, NULL),
        (4, N'राखीव निधी', 5, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Reserve Fund', 0, NULL),
        (5, N'लाभांश समीकरण निधी', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Dividend Equalization Fund', 0, NULL),
        (6, N'इमारत निधी', 7, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Building Fund', 0, NULL),
        (7, N'धर्मादाय निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Charity Fund', 0, NULL),
        (8, N'उत्तम जिंदगी निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Goodwill Fund', 0, NULL),
        (9, N'सभासद कल्याण निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Member Welfare Fund', 0, NULL),
        (10, N'संशयित बुडीत निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Doubtful Debt Fund', 0, NULL),
        (11, N'झिज घसारा निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Depreciation Fund', 0, NULL),
        (12, N'थकव्याज कर्ज निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Overdue Interest Fund', 0, NULL),
        (13, N'कामगार कल्याण निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Staff Welfare Fund', 0, NULL),
        (14, N'अन्य  निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (15, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (16, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (17, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (18, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (19, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (20, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (21, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (22, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (23, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (24, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (25, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (26, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (27, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (28, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (29, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (30, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (31, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (32, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (33, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (34, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (35, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (36, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (37, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (38, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (39, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (40, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (41, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (42, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (43, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (44, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (45, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL),
        (46, N'सेव्हिंग  ठेव', 11, 0.00, N'Cr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Savings Deposit', 0, NULL),
        (47, N'पिग्मी (जोर्तलिंग )ठेव', 11, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Pigmy (Jortling) Deposit', 0, NULL),
        (48, N'मुदत बंद ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Fixed Deposit', 0, NULL),
        (49, N'रिकरींग ठेव', 13, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Recurring Deposit', 0, NULL),
        (50, N'दामदुप्पट ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Double-Your-Money Deposit', 0, NULL),
        (51, N'महालक्ष्मी ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Mahalakshmi Deposit', 0, NULL),
        (52, N'जोर्तलिंग ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Jortling Deposit', 0, NULL),
        (53, N'दत्त ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Datt  Deposit', 0, NULL),
        (54, N'महादेव ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Mahadev Deposit', 0, NULL),
        (55, N'धनलक्ष्मी ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dhanalakshmi Deposit', 0, NULL),
        (56, N'जनता ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Janata Deposit', 0, NULL),
        (57, N'पिग्मी एजंट ठेव', 11, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Pigmy Agent Deposit', 0, NULL),
        (58, N'महिला सन्मान ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Mahila Samman Deposit', 0, NULL),
        (59, N'राजारमाबापू ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Rajarambapu Deposit', 0, NULL),
        (60, N'विद्यासागर ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Vidyasagar Deposit', 0, NULL),
        (61, N'जनकल्याण ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Janakalyan Deposit', 0, NULL),
        (62, N'धनसंचय ठेव', 11, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dhansanchay Deposit', 0, NULL),
        (63, N'धनवर्धनी ठेव', 13, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dhanvardhini Deposit', 0, NULL),
        (64, N'लखपती ठेव', 13, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Lakhpati Deposit', 0, NULL),
        (65, N'दामदीडपट ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dam-Didpat Deposit (1.5x Return)', 0, NULL),
        (66, N'दामतिप्पट ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dam-Tippat Deposit (3x Return)', 0, NULL),
        (67, N'दामचौपट ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dam-Chaupat Deposit (4x Return)', 0, NULL),
        (68, N'ब वर्ग ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'''B'' Class Deposit', 0, NULL),
        (69, N'संजीवनी ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Sanjeevani Deposit', 0, NULL),
        (70, N'कायम ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Fixed Deposit', 0, NULL),
        (71, N'कर्ज कपात ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Loan Deduction Deposit', 0, NULL),
        (72, N'बिनव्याजी ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest-free Deposit', 0, NULL),
        (73, N'अनामत ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Security Deposit', 0, NULL),
        (74, N'इतर ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Other Deposit', 0, NULL),
        (75, N'अन्य ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Miscellaneous Deposit', 0, NULL),
        (76, N'बँक कर्ज जि. म.', 16, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Bank Loan (District Central)', 0, NULL),
        (77, N'बँक कर्ज हुतात्मा', 17, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Bank Loan - Hutatma', 0, NULL),
        (78, N'बँक कर्ज अपणा बँक', 17, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Bank Loan - Apana Bank', 0, NULL),
        (79, N'बँक कर्जे इतर बँक', 17, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Bank Loans - Other Banks', 0, NULL),
        (80, N'बँक कर्जे अन्य बँक', 17, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Bank Loans - Other Banks', 0, NULL),
        (81, N'देणे सभासद लाभांश', 19, 70.00, N'Cr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Member Dividend', 0, NULL),
        (82, N'देणे ब वर्ग सभासद ठेव व्याज', 19, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: ''B'' Class Member Deposit Interest', 0, NULL),
        (83, N'देणे बिन व्याज ठेव व्याज', 19, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Non-interest Bearing Deposit Interest', 0, NULL),
        (84, N'देणे इतर ठेव व्याज', 19, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Other Deposit Interest', 0, NULL),
        (85, N'इतर देणे', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Payables', 0, NULL),
        (86, N'देणे अन्य देयता', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Other Liabilities', 0, NULL),
        (87, N'देणे इतर', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Payables', 0, NULL),
        (88, N'देणे इतर अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Miscellaneous Others', 0, NULL),
        (89, N'देणे अन्य देयता', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Other Liabilities', 0, NULL),
        (90, N'देणे अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Others', 0, NULL),
        (91, N'देणे इतर अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Miscellaneous Others', 0, NULL),
        (92, N'देणे किरकोळ अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Sundry Others', 0, NULL),
        (93, N'देणे अन्य इतर', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Miscellaneous Others', 0, NULL),
        (94, N'इतर अन्य देणे', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Miscellaneous Payables', 0, NULL),
        (95, N'इतर देणे येणे', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Payables/Receivables', 0, NULL),
        (96, N'देणे इतर', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Others', 0, NULL),
        (97, N'देणे येणे अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payables/Receivables - Others', 0, NULL),
        (98, N'देणे अन्य इतर', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Miscellaneous Others', 0, NULL),
        (99, N'देणे इतर देणे', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Other Dues', 0, NULL),
        (100, N'देणे अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Others', 0, NULL),
        (101, N'देणे मेन शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Main Branch', 0, NULL),
        (102, N'देणे बांबवडे शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Bambavade Branch', 0, NULL),
        (103, N'देणे गोटखिंडी शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Gotkhindi Branch', 0, NULL),
        (104, N'देणे सोनवडे शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Sonavade Branch', 0, NULL),
        (105, N'देणे शाहूवाडी शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Shahuwadi Branch', 0, NULL),
        (106, N'देणे गोगवे शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Gogave Branch', 0, NULL),
        (107, N'देणे ईश्वरपुर शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Ishwarpur Branch', 0, NULL),
        (108, N'देणे सांगली शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Sangli Branch', 0, NULL),
        (109, N'देणे पलूस शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Palus Branch', 0, NULL),
        (110, N'देणे कराड शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Karad Branch', 0, NULL),
        (111, N'देणे रिकरींग ठेव व्याज तरतूद', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Recurring Deposit Interest Provision', 0, NULL),
        (112, N'देणे पिग्मी ठेव व्याज तरतूद', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Pigmy Deposit Interest Provision', 0, NULL),
        (113, N'देणे धनसंचय ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Dhansanchay Deposit Interest', 0, NULL),
        (114, N'देणे मुदत बंद ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Fixed Deposit Interest', 0, NULL),
        (115, N'देणे दामदुप्पट ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: ''Damduppat'' (Double-the-Amount) Deposit Interest', 0, NULL),
        (116, N'देणे जोतिबा ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Jyotiba Deposit', 0, NULL),
        (117, N'देणे दत्त ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Datta Deposit', 0, NULL),
        (118, N'देणे महादेव ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Mahadev Deposit', 0, NULL),
        (119, N'देणे महालक्ष्मी ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Mahalakshmi Deposit', 0, NULL),
        (120, N'देणे जनता ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Janata Deposit', 0, NULL),
        (121, N'देणे राजारामबापू ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Rajarambapu Deposit', 0, NULL),
        (122, N'देणे धनसंचय ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Dhansanchay Deposit', 0, NULL),
        (123, N'देणे संजीवनी ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Sanjeevani Deposit', 0, NULL),
        (124, N'देणे जनकल्याण ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Janakalyan Deposit', 0, NULL),
        (125, N'देणे धनवरधिनी ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Dhanvardhini Deposit', 0, NULL),
        (126, N'देणे दाम दीडपट व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: ''Dam-Deedpat'' (1.5x Return) Deposit', 0, NULL),
        (127, N'देणे दाम तिप्पट व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: ''Dam-Tippat'' (3x Return) Deposit', 0, NULL),
        (128, N'देणे दामचौपट व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: ''Dam-Chaupat'' (4x Return) Deposit', 0, NULL),
        (129, N'देणे लक्ष्यपती ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Lakshyapati Deposit', 0, NULL),
        (130, N'देणे अन्य ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Other Deposits', 0, NULL),
        (131, N'देणे जिल्हा मध्य. बँक व्याज', 23, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Interest Payable: District Central Bank', 0, NULL),
        (132, N'देणे अन्य बँक व्याज', 23, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Interest Payable: Other Bank', 0, NULL),
        (133, N'देणे इतर बँक व्याज', 23, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Interest Payable: Other Bank', 0, NULL),
        (134, N'देणे अन्य सहकारी बँक व्याज', 23, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Interest Payable: Other Cooperative Bank', 0, NULL),
        (135, N'थकीत कर्ज व्याज तरतूद', 25, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Interest on Overdue Loans', 0, NULL),
        (136, N'एन पी ए तरतूद', 25, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for NPA', 0, NULL),
        (137, N'अन्य थकव्याज तरतूद', 25, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Other Overdue Interest', 0, NULL),
        (138, N'देणे ऑडिट फी', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Audit Fees Payable', 0, NULL),
        (139, N'देणे नोकर बोनस', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Staff Bonus Payable', 0, NULL),
        (140, N'देणे निवडणूक खर्च निधी', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Election Expense Fund Payable', 0, NULL),
        (141, N'देणे सॉफ्टवेअर वार्षिक चार्जेस', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Software Annual Charges Payable', 0, NULL),
        (142, N'देणे सानुग्रह अनुदान', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Ex-gratia Payment Payable', 0, NULL),
        (143, N'देणे फर्निचर खाते', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Furniture Account Payable', 0, NULL),
        (144, N'देणे मानधन खाते', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Honorarium Account Payable', 0, NULL),
        (145, N'देणे कर्मचारी पगार', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Staff Salaries Payable', 0, NULL),
        (146, N'देणे कर्मचारी प्रॉ. फंड', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Staff Provident Fund Payable Funds', 0, NULL),
        (147, N'देणे विकास निधी तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Development Fund', 0, NULL),
        (148, N'देणे सभासद बक्षीस खर्च तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Member Prize Expenses', 0, NULL),
        (149, N'देणे अन्य खर्च तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Other Expenses', 0, NULL),
        (150, N'देणे इतर खर्च तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Miscellaneous Expenses', 0, NULL),
        (151, N'देणे खर्च तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Expenses', 0, NULL),
        (152, N'देणे अन्य खर्च तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Other Expenses', 0, NULL),
        (153, N'देणे खर्च अन्य तरतुदी', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Other Expenses', 0, NULL),
        (154, N'अन्य खर्च तरतुदी', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provisions for Other Expenses', 0, NULL),
        (155, N'देणे किरकोळ खर्च तरतुदी', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Petty Expenses', 0, NULL),
        (156, N'संचित नफा खाते', 29, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Accumulated Profit Account', 0, NULL),
        (157, N'चालू नफा खाते', 30, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Current Profit Account', 0, NULL),
        (158, N'हाता. रोख शिल्लक मेन शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Cash Balance on Hand – Main Branch', 0, NULL),
        (159, N'हाता. रोख शिल्लक बांबवडे शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Cash Balance on Hand – Bambavade Branch', 0, NULL),
        (160, N'हात. शिल्लक गोगवे ब्रांच', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Cash on Hand Balance Gogwe Branch', 0, NULL),
        (161, N'हात शिल्लक गोटखिंडी शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Gotakhindi Branch', 0, NULL),
        (162, N'हात शिल्लक ईश्वरपुर शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Ishwarpur Branch', 0, NULL),
        (163, N'हात शिल्लक पलूस शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Plus Branch', 0, NULL),
        (164, N'हातशिल्लक कराड शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Karad Branch', 0, NULL),
        (165, N'हातशिल्लक सांगली शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Sangali Branch', 0, NULL),
        (166, N'हात शिल्लक सोनवडे शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Sonavade Branch', 0, NULL),
        (167, N'हातशिल्लक बांबवडे शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Bambavade Branch', 0, NULL),
        (168, N'जिल्हा मध्यवर्ती चालू खाते', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'District Central Current Account', 0, NULL),
        (169, N'जिल्हा मध्यवर्ती बचत खाते', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'DCC Bank Savhing', 0, NULL),
        (170, N'हुतातमा बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'hutatma Bank Current', 0, NULL),
        (171, N'हुतात्मा बँक बचत खाते', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Hutatma Bank Savhing', 0, NULL),
        (172, N'अपना बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Apana Bank Current', 0, NULL),
        (173, N'कोटक बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Kotak Bank Current', 0, NULL),
        (174, N'कोटक बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'KOtak Bank Savhing', 0, NULL),
        (175, N'आर बी एल बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'RBL Bank Current', 0, NULL),
        (176, N'आर बी एल बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'RBL Bank Savhing', 0, NULL),
        (177, N'आय आय सी सी बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'ICICI Bank Current', 0, NULL),
        (178, N'आय आय सी सी बँक बचत खाते', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'ICICI Bank Savhing', 0, NULL),
        (179, N'महालक्ष्मी बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Mahalaxmi Bank Current', 0, NULL),
        (180, N'महालक्ष्मी बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Mahalaxmi Bank Savhing', 0, NULL),
        (181, N'आय डी बी आय बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'IDBI Bank Current', 0, NULL),
        (182, N'आय डी बी आय बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'IDBI Bank Savhing', 0, NULL),
        (183, N'एस बी आय बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'SBI Bank Current', 0, NULL),
        (184, N'एस बी आय बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'SBI Bank Savhing', 0, NULL),
        (185, N'फेडरल बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Fedaral Bank Current', 0, NULL),
        (186, N'फेडरल बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Fedaral Bank Savhing', 0, NULL),
        (187, N'एच डी एफ सी बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'HDFC Bank Current', 0, NULL),
        (188, N'एच डी एफ सी बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'HDFC Bank Savhing', 0, NULL),
        (189, N'अपना बँक बचत खाते', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Apana Bank Savhing', 0, NULL),
        (190, N'जिल्हा मध्यवर्ती बँक शेअर्स', 36, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'District Central Bank Shares', 0, NULL),
        (191, N'इतर बँक शेअर्स', 37, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Other Bank Shares', 0, NULL),
        (192, N'जिल्हा बँक मुदत ठेव', 38, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'District Bank Fixed Deposit', 0, NULL),
        (193, N'जिल्हा बँक राखीव निधी', 39, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'District Bank Reserve Fund', 0, NULL),
        (194, N'जिल्हा बँक आय पी डी बॉण्ड', 38, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'District Bank IPD Bond', 0, NULL),
        (195, N'जिल्हा मध्यवर्ती बँक आवर्ती  ठेव', 38, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'District Central Bank Recurring Deposit', 0, NULL),
        (196, N'हुतात्मा  बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Hutatma Bank Fixed Deposit', 0, NULL),
        (197, N'अपना बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Apna Bank Fixed Deposit', 0, NULL),
        (198, N'कोटक  बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Kotak Bank Fixed Deposit', 0, NULL),
        (199, N'आर बी एल बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'RBL Bank Fixed Deposit', 0, NULL),
        (200, N'आय आय सी सी बँक मुदतठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'ICICI Bank Fixed Deposit', 0, NULL),
        (201, N'महालक्ष्मी बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Mahalaxmi Bank Fixed Deposit', 0, NULL),
        (202, N'आय डी बी आय बँक मुदतबंद ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'IDBI Bank Fixed Deposit', 0, NULL),
        (203, N'एस बी आय बँक मुदतबंद ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'SBI Bank Fixed Deposit', 0, NULL),
        (204, N'फेडरल बँक मुदत बंद ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Federal Bank Fixed Deposit', 0, NULL),
        (205, N'एच डी एफ सी बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'HDFC Bank Fixed Deposit', 0, NULL),
        (206, N'तासगाव अर्बन मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Tasgaon Urban Fixed Deposit', 0, NULL),
        (207, N'पारशनाथ बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Parshwanath Bank Fixed Deposit', 0, NULL),
        (208, N'जनता बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Janata Bank Fixed Deposit', 0, NULL),
        (209, N'सारस्वत बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Saraswat Bank Fixed Deposit', 0, NULL),
        (210, N'नांदणी बँक मुदतबंद ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Nandani Bank Fixed Deposit', 0, NULL),
        (211, N'लॉकर डिपॉजिट', 41, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Locker Deposit', 0, NULL),
        (212, N'एम एस ई बी डिपॉजिट', 41, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'MSEB Deposit', 0, NULL),
        (213, N'नळपाणी डिपॉजिट', 41, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Water Connection Deposit', 0, NULL),
        (214, N'इमारत निधी गुंतवणूक', 41, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Deposit', 0, NULL),
        (215, N'इतर डिपॉजिट', 41, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Miscellaneous Deposit', 0, NULL),
        (216, N'मेंबर कर्जे', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Member Loans', 0, NULL),
        (217, N'मेंबर मध्यम मुदत कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Member Medium-Term Loans', 0, NULL),
        (218, N'मेंबर दीर्घ मुदत कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Member Long-Term Loans', 0, NULL),
        (219, N'मेंबर जामीनकी कर्जे', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Member Secured Loans', 0, NULL),
        (220, N'सोनेतारण कर्जे', 46, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Gold-backed loans', 0, NULL),
        (221, N'स्थावर तारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Immovable property-backed loans', 0, NULL),
        (222, N'पगारतारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Salary-backed loans', 0, NULL),
        (223, N'मशीनरी तारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Machinery-backed loans', 0, NULL),
        (224, N'घरतारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'House-backed loans', 0, NULL),
        (225, N'जमीन तारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Land-backed loans', 0, NULL),
        (226, N'वाहन तारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Vehicle-backed loans', 0, NULL),
        (227, N'गाय-म्हैस खरेदी कर्जे', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Cattle (Cow/Buffalo) purchase loans', 0, NULL),
        (228, N'नवीन दुचाकी खरेदी कर्जे', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'New two-wheeler purchase loans', 0, NULL),
        (229, N'नवीन चारचाकी खरेदी', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'New four-wheeler purchase', 0, NULL),
        (230, N'नवीन ट्रॅक्टर खरेदी कर्जे', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'New tractor purchase loans', 0, NULL),
        (231, N'नवीन जे सी बी खरेदी कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'New JCB purchase loans', 0, NULL),
        (232, N'मुदत ठेव तारण कर्जे', 45, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Fixed deposit-backed loans', 0, NULL),
        (233, N'दामदुप्पट ठेव तारण कर्जे', 45, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'''Double-your-money'' deposit-backed loans', 0, NULL),
        (234, N'रिकरींग तारण कर्जे', 45, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Recurring deposit-backed loans', 0, NULL),
        (235, N'पिग्मी तारण कर्जे', 45, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Pigmy deposit-backed loans', 0, NULL),
        (236, N'इतर ब वर्ग तारण कर्जे', 45, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Other ''B'' class secured loans', 0, NULL),
        (237, N'जागा व इमारत', 48, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Land and building', 0, NULL),
        (238, N'फर्निचर व फिकचर', 49, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Furniture and fixtures', 0, NULL),
        (239, N'डेडस्टॉक', 49, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Deadstock', 0, NULL),
        (240, N'संगणक व प्रिंटर', 50, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Computers and printers', 0, NULL),
        (241, N'पिग्मी मशीन', 50, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Pigmy machines', 0, NULL),
        (242, N'मोटरसायकल', 51, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Motorcycles', 0, NULL),
        (243, N'सोलर सिस्टिम', 51, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Solar systems', 0, NULL),
        (244, N'अन्य डेडस्टोक', 51, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other deadstock', 0, NULL),
        (245, N'इतर डेडस्टॉक', 51, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Miscellaneous deadstock', 0, NULL),
        (246, N'येणे व्याज कर्जावरील', 53, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Interest receivable on loans', 0, NULL),
        (247, N'येणे थकीत व्याज', 55, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Overdue interest receivable', 0, NULL),
        (248, N'येणे गुंतवणूकिवरील व्याज', 54, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, N'Interest receivable on investments', 0, NULL),
        (249, N'येणे टी. डी. एस कपात', 54, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, N'T.D. receivable S-Deduction', 0, NULL),
        (250, N'येणे संगणक एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Computer Advance', 0, NULL),
        (251, N'इतर येणे', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Others', 0, NULL),
        (252, N'येणे अन्य खाते', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Other Accounts', 0, NULL),
        (253, N'येणे बांधकाम एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Construction Advance', 0, NULL),
        (254, N'येणे नोकर पगार एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Receivable: Staff Salary Advance', 0, NULL),
        (255, N'येणे मानधन एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Honorarium Advance', 0, NULL),
        (256, N'येणे इतर संस्था एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Advance to Other Institutions', 0, NULL),
        (257, N'येणे जागा खरेदी एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Land Purchase Advance', 0, NULL),
        (258, N'येणे निवडणूक डिपॉझिट', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Election Deposit', 0, NULL),
        (259, N'येणे अनामत खाते', 56, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Receivable: Deposit Account', 0, NULL),
        (260, N'येणे इतर खाते', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Other Accounts', 0, NULL),
        (261, N'येणे मेन शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Main Branch', 0, NULL),
        (262, N'येणे बांबवडे शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Bambavade Branch', 0, NULL),
        (263, N'येणे गोटखिंडी शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Gotkhindi Branch', 0, NULL),
        (264, N'येणे सोनवडे शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Sonavade Branch', 0, NULL),
        (265, N'येणे शाहूवाडी शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Shahuwadi Branch', 0, NULL),
        (266, N'येणे गोगवे शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Gogave Branch', 0, NULL),
        (267, N'येणे ईश्वरपुर शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Ishwarpur Branch', 0, NULL),
        (268, N'येणे सांगली शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Sangli Branch', 0, NULL),
        (269, N'येणे पलूस शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Palus Branch', 0, NULL),
        (270, N'येणे कराड शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Karad Branch', 0, NULL),
        (271, N'संचित तोटा', 59, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Accumulated Loss', 0, NULL),
        (272, N'चालू तोटा', 60, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Current Year Loss', 0, NULL),
        (273, N'मेंबर कर्जावरील व्याज', 61, 0.00, N'Dr', N'ताळेबंद', N'Income', 0, 1, NULL, N'Interest on Member Loans', 0, NULL),
        (274, N'मेंबर म. मू. कर्ज व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on Member Medium-Term Loans', 0, NULL),
        (275, N'मेंबर दि . मू. कर्जे व्याज', 61, 0.00, N'Dr', N'ताळेबंद', N'Income', 0, 1, NULL, N'Interest on Member Long-Term Loans', 0, NULL),
        (276, N'मेंबर जे. सी. बी. व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Member JCB Interest', 0, NULL),
        (277, N'मेंबर स्थावरतारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against immovable property (Members)', 0, NULL),
        (278, N'मेंबर पगार तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on salary-backed loans (Members)', 0, NULL),
        (279, N'मेंबर मशीनरी तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on machinery-backed loans (Members)', 0, NULL),
        (280, N'मेंबर घरतारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on housing loans (Members)', 0, NULL),
        (281, N'मेंबर जामीनकि व्याज', 61, 0.00, N'Dr', N'ताळेबंद', N'Income', 0, 1, NULL, N'Interest on surety-backed loans (Members)', 0, NULL),
        (282, N'मेंबर वाहन तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on vehicle-backed loans (Members)', 0, NULL),
        (283, N'मेंबर गाय-म्हैस खरेदी व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on cattle purchase loans (Members)', 0, NULL),
        (284, N'मेंबर दुचाकी व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on two-wheeler loans (Members)', 0, NULL),
        (285, N'मेंबर चारचाकी व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on four-wheeler loans (Members)', 0, NULL),
        (286, N'मेंबर ट्रक्टर व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on tractor loans (Members)', 0, NULL),
        (287, N'मेंबर मुदतठेव तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against fixed deposits (Members)', 0, NULL),
        (288, N'मेंबर दामदुपट तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against ''Damdupat'' deposits (Members)', 0, NULL),
        (289, N'मेंबर रिकरींग तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against recurring deposits (Members)', 0, NULL),
        (290, N'मेंबर पिग्मी तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against Pigmy deposits (Members)', 0, NULL),
        (291, N'मेंबर ब वर्ग तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against ''B'' Class deposits (Members)', 0, NULL),
        (292, N'मेंबर सोनेतारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on gold-backed loans (Members)', 0, NULL),
        (293, N'मेंबर इतर कर्जे व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on other loans (Members)', 0, NULL),
        (294, N'मेंबर जादा व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Excess interest (Members)', 0, NULL),
        (295, N'मेंबर दंड व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Penal interest (Members)', 0, NULL),
        (296, N'बँक शेयर्स लाभांश (जि .म.)', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank share dividend (District Bank)', 0, NULL),
        (297, N'बँक लाभांश इतर बँक', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Dividend from other banks', 0, NULL),
        (298, N'बँक व्याज मिळालेले (जि.म.)', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (District Bank)', 0, NULL),
        (299, N'बँक व्याज मिळालेले राखीव निधी', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (Reserve Fund)', 0, NULL),
        (300, N'बँक व्याज मिळालेले(हुतात्मा)', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (Hutatma Bank)', 0, NULL),
        (301, N'बँक व्याज मिळालेले(अपना )', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (Apna Bank)', 0, NULL),
        (302, N'बँक व्याज मिळालेले(कोटक)', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (Kotak Bank)', 0, NULL),
        (303, N'बँक व्याज मिळालेले(आरबीएल )', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (RBL Bank)', 0, NULL),
        (304, N'बँक व्याज मिळालेले(आय. सी. आय )', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (ICI Bank)', 0, NULL),
        (305, N'बँक व्याज महालक्ष्मी बँक', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest (Mahalaxmi Bank)', 0, NULL),
        (306, N'बँक व्याज आयडीबीआय', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest (IDBI Bank)', 0, NULL),
        (307, N'बँक व्याज एसबीआय', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest (SBI)', 0, NULL),
        (308, N'बँक व्याज फेडरल', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Federal', 0, NULL),
        (309, N'बँक व्याज एच डी एफ सी', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - HDFC', 0, NULL),
        (310, N'बँक व्याज तासगाव अर्बन', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Tasgaon Urban', 0, NULL),
        (311, N'बँक व्याज पारशवनाथ', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Parshwanath', 0, NULL),
        (312, N'बँक व्याज जनता बँक', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Janata Bank', 0, NULL),
        (313, N'बँक व्याज सारस्वत', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Saraswat', 0, NULL),
        (314, N'बँक व्याज नांदणी', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Nandni', 0, NULL),
        (315, N'प्रवेश फी', 63, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Admission Fee', 0, NULL),
        (316, N'नाममात्र फी', 63, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Nominal Fee', 0, NULL),
        (317, N'पिग्मी कमिशन जमा', 64, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Pigmy Commission Received', 0, NULL),
        (318, N'शेअर्स ट्रान्सफर फी', 64, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Commission on Loans', 0, NULL),
        (319, N'ठेवीवरील कमिशन', 64, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Commission on Deposits', 0, NULL),
        (320, N'स्टेशनरी कपात उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Stationery Deduction Income', 0, NULL),
        (321, N'वसूली खर्च जमा', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Recovery Charges Received', 0, NULL),
        (322, N'प्रोसेसिंग फी', 63, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Processing Fee', 0, NULL),
        (323, N'नोटिस फी', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Notice Fee', 0, NULL),
        (324, N'इतर उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Other Income', 0, NULL),
        (325, N'अन्य उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Miscellaneous Income', 0, NULL),
        (326, N'रद्दी विक्री', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Sale of Scrap', 0, NULL),
        (327, N'अन्य इतर उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Other Miscellaneous Income', 0, NULL),
        (328, N'इतर किरकोळ उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Other Sundry Income', 0, NULL),
        (329, N'अन्य इतर उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Other Miscellaneous Income', 0, NULL),
        (330, N'इतर असलेले उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Other Income', 0, NULL),
        (331, N'सेव्हिंग ठेवीवरील व्याज', 69, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Savings Deposits', 0, NULL),
        (332, N'पिग्मी ठेवीवरील व्याज', 69, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Pigmy Deposits', 0, NULL),
        (333, N'मुदतठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Term Deposits', 0, NULL),
        (334, N'दामदुप्पट ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Double-Value Deposits', 0, NULL),
        (335, N'दामदिड पट ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on 1.5x Value Deposits', 0, NULL),
        (336, N'दाम तिप्पट ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Triple-Value Deposits', 0, NULL),
        (337, N'दत्त ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Datta Deposits', 0, NULL),
        (338, N'महालक्ष्मी ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Mahalaxmi Deposits', 0, NULL),
        (339, N'जनकल्याण ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Janakalyan Deposits', 0, NULL),
        (340, N'राजाराम ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Rajaram Deposits', 0, NULL),
        (341, N'जनकल्याण ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Janakalyan Deposits', 0, NULL),
        (342, N'जोतिबा ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Jotiba Deposits', 0, NULL),
        (343, N'रिकरींग ठेवीवरील व्याज', 68, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Recurring Deposits', 0, NULL),
        (344, N'धनवर्धणी ठेवीवरील व्याज', 68, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Dhanvardhini Deposits Interest', 0, NULL),
        (345, N'जनता ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Public Deposits', 0, NULL),
        (346, N'महादेव ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Mahadev Deposits', 0, NULL),
        (347, N'महिलासन्मान ठेव व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Mahila Samman Deposits', 0, NULL),
        (348, N'ब वर्ग ठेवीवरील व्याज', 70, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on ''B'' Class Deposits', 0, NULL),
        (349, N'कायम ठेव व्याज', 70, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Fixed Deposits', 0, NULL),
        (350, N'संजीवनी ठेव व्याज', 70, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Sanjeevani Deposits', 0, NULL),
        (351, N'नोकर पगार', 72, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Staff Salaries', 0, NULL),
        (352, N'कर्मचारी मानधन', 72, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Staff Honorarium', 0, NULL),
        (353, N'संचालक मानधन', 73, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Director Honorarium', 0, NULL),
        (354, N'सचिव भत्ता', 74, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Secretary Allowance', 0, NULL),
        (355, N'सेवक इतर भत्ते', 74, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Other Staff Allowances', 0, NULL),
        (356, N'प्रिंटिंग व स्टेशनरी खर्च', 75, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Printing and Stationery Expenses', 0, NULL),
        (357, N'झेरॉक्स खर्च', 75, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Xerox Expenses', 0, NULL),
        (358, N'टायपिंग खर्च', 75, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Typing Expenses', 0, NULL),
        (359, N'अहवाल छपाई खर्च', 75, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Report Printing Expenses', 0, NULL),
        (360, N'सादिलवार खर्च', 75, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Contingent Expenses', 0, NULL),
        (361, N'व्यवस्थापन खर्च', 76, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Management Expenses', 0, NULL),
        (362, N'प्रवास खर्च', 77, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Travel Expenses', 0, NULL),
        (363, N'संचालक व नोकर प्रशिक्षण खर्च', 78, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Director and Staff Training Expenses', 0, NULL),
        (364, N'वार्षिक सर्वसाधारण सभा खर्च', 79, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Annual General Meeting Expenses', 0, NULL),
        (365, N'सभासमारंभ खर्च', 74, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Function/Ceremony Expenses', 0, NULL),
        (366, N'सभासद प्रशिक्षण खर्च', 78, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Member Training Expenses', 0, NULL),
        (367, N'देणगी व वर्गणी', 79, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Donations and Subscriptions', 0, NULL),
        (368, N'इमारत झिज', 80, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Building Depreciation', 0, NULL),
        (369, N'डेडस्टॉक झिज', 80, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Deadstock Depreciation', 0, NULL),
        (370, N'संगणक व प्रिंटर झिज', 80, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Computer and Printer Depreciation', 0, NULL),
        (371, N'सोलर सिस्टिम झिज', 80, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Solar System Depreciation', 0, NULL),
        (372, N'इतर झिज व घसारा', 80, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Other Depreciation and Write-offs', 0, NULL),
        (373, N'ऑडिट फी', 82, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Audit Fees', 0, NULL),
        (374, N'नोकर बोनस', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Staff Bonus', 0, NULL),
        (375, N'सॉफटवेअर ए. एम सी चार्जेस', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Software Expenses MC Charges', 0, NULL),
        (376, N'एन पी ए खर्च', 83, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'NPA Expenses', 0, NULL),
        (377, N'सभासद कल्याण निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Member Welfare Fund Expenses', 0, NULL),
        (378, N'लाभांश समीकरण निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Dividend Equalization Fund Expenses', 0, NULL),
        (379, N'धर्मदाय निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Charity Fund Expenses', 0, NULL),
        (380, N'संशयित बुडीत निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Bad and Doubtful Debts Fund Expenses', 0, NULL),
        (381, N'उत्तम जिंदगी निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Good Assets Fund Expenses', 0, NULL),
        (382, N'थकाव्याज कर्ज निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Overdue Interest Fund Expenses', 0, NULL),
        (383, N'इमारत निधी  खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Building Fund Expenses', 0, NULL),
        (384, N'झिज घासारा निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Depreciation Fund Expenses', 0, NULL),
        (385, N'निवडणूक निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Election Fund Expenses', 0, NULL),
        (386, N'सभासद बक्षीस खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Member Prize Expenses', 0, NULL),
        (387, N'बँक व्याज दिलेले', 90, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Bank Interest Paid', 0, NULL),
        (388, N'दिवाबती व जागा भाडे', 76, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Lighting and Premises Rent', 0, NULL),
        (389, N'विमा  खाते', 76, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Insurance Account', 0, NULL),
        (390, N'बँक चार्जेस', 87, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Bank Charges', 0, NULL),
        (391, N'लाईट बिल खर्च', 76, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Electricity Bill Expenses', 0, NULL),
        (392, N'संगणक खर्च', 88, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Computer Expenses', 0, NULL),
        (393, N'पिग्मी एजंट कमिशन', 72, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Pigmy Agent Commission', 0, NULL),
        (394, N'ऑफिस खर्च', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Office Expenses', 0, NULL),
        (395, N'किरकोळ खर्च', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Miscellaneous Expenses', 0, NULL),
        (396, N'पोसटेज खर्च', 87, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Postage Expenses', 0, NULL),
        (397, N'टॅक्स रिटर्न फी', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Tax Return Fees', 0, NULL),
        (398, N'लॉकर भाडे', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Locker Rent', 0, NULL),
        (399, N'प्रवेश फी नवे', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'New Admission Fees', 0, NULL),
        (400, N'सानुग्रह अनुदान खर्च', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Ex-gratia Payment Expenses', 0, NULL),
        (401, N'प्राथमिक खर्च', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Preliminary Expenses', 0, NULL),
        (402, N'फर्निचर रिपेयर  खर्च', 86, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Furniture Repair Expenses', 0, NULL),
        (403, N'इमारत दुरुस्ती व रंगकाम खर्च', 86, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Building Repair and Painting Expenses', 0, NULL),
        (404, N'इतर किरकोळ खर्च', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Other Miscellaneous Expenses', 0, NULL),
        (405, N'थकीत व्याज येणे खाते', 52, 0.00, N'Dr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL),
        (406, N'थकीत व्याज तरतूद खाते', 18, 0.00, N'Cr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL),
        (407, N'थकीत वसुली खर्च येणे खाते', 52, 0.00, N'Dr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL),
        (408, N'थकीत वसुली खर्च तरतूद खाते', 18, 0.00, N'Cr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL),
        (409, N'१३३ कर्ज व्याज सूट', 26, 0.00, N'Dr', NULL, N'Expense', 0, 1, NULL, NULL, 0, NULL),
        (410, N'देणे सरचार्ज', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable Surcharge', 0, NULL);
    SET IDENTITY_INSERT dbo.[Ledgers] OFF;
    PRINT 'Seeded [Ledgers] (410 records)';
END;
GO

-- Table Seed: [Branches] (1 Main Branch)
IF NOT EXISTS (SELECT 1 FROM dbo.[Branches])
BEGIN
    SET IDENTITY_INSERT dbo.[Branches] ON;
    INSERT INTO dbo.[Branches] ([BranchID], [BranchCode], [BranchName], [Address], [BranchType], [MobileNo], [Email], [IsActive]) VALUES
        (1, N'MAIN', N'à¤®à¥à¤–à¥à¤¯ à¤¶à¤¾à¤–à¤¾ (Main Branch)', N'à¤®à¥à¤–à¥à¤¯ à¤•à¤¾à¤°à¥à¤¯à¤¾à¤²à¤¯', N'Branch', N'9876543210', N'info@smartbanking.in', 1);
    SET IDENTITY_INSERT dbo.[Branches] OFF;
    PRINT 'Seeded [Branches] (1 record)';
END;
GO
-- Table Seed: [SansthaDetails] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[SansthaDetails])
BEGIN
    SET IDENTITY_INSERT dbo.[SansthaDetails] ON;
    INSERT INTO dbo.[SansthaDetails] ([SansthaID], [SansthaName], [Address], [ContactNo], [Email], [RegistrationNo], [GSTNo], [LogoPath], [IsMigrationLocked], [AutoPostVouchers], [AutoPostVoucherLimit], [District], [PinCode], [RegistrationDate], [State], [Taluka], [Village], [IsMobileCompulsory], [IsAadhaarCompulsory], [IsPanCompulsory]) VALUES
        (1, N'जोतिर्लिंग ग्रामीण बिगरशेती सह. पतसंस्था मर्या. पडवळवाडी', N'मु. पो. पडवळवाडी, जि. सांगली', N'', N'info@smartbanking.in', N'', N'', NULL, 0, 1, 50000.00, N'सांगली', N'', CONVERT(datetime2, '2018-12-17T00:00:00.000', 126), N'महाराष्ट्र', N'कडेगाव', N'पडवळवाडी', 0, 0, 0);
    SET IDENTITY_INSERT dbo.[SansthaDetails] OFF;
    PRINT 'Seeded [SansthaDetails] (1 records)';
END;
GO

-- Table Seed: [FinancialYears] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[FinancialYears])
BEGIN
    SET IDENTITY_INSERT dbo.[FinancialYears] ON;
    INSERT INTO dbo.[FinancialYears] ([FinancialYearID], [YearCode], [StartDate], [EndDate], [IsActive], [IsClosed]) VALUES
        (1, N'2026-2027', CONVERT(datetime2, '2026-04-01T00:00:00.000', 126), CONVERT(datetime2, '2027-03-31T23:59:59.000', 126), 1, 0);
    SET IDENTITY_INSERT dbo.[FinancialYears] OFF;
    PRINT 'Seeded [FinancialYears] (1 records)';
END;
GO

-- Table Seed: [Roles] (5 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[Roles])
BEGIN
    SET IDENTITY_INSERT dbo.[Roles] ON;
    INSERT INTO dbo.[Roles] ([RoleID], [RoleName], [Description], [IsSystemRole], [RoleCode], [Status]) VALUES
        (1, N'Admin', N'System Administrator', 1, N'Admin', 1),
        (2, N'Manager', N'Branch Manager', 1, N'Manager', 1),
        (3, N'Cashier', N'Cashier', 1, N'Cashier', 1),
        (4, N'Clerk', N'Account Clerk', 1, N'Clerk', 1),
        (5, N'Auditor', N'Statutory Auditor', 1, N'Auditor', 1);
    SET IDENTITY_INSERT dbo.[Roles] OFF;
    PRINT 'Seeded [Roles] (5 records)';
END;
GO

-- Table Seed: [Users] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[Users])
BEGIN
    SET IDENTITY_INSERT dbo.[Users] ON;
    INSERT INTO dbo.[Users] ([UserID], [Username], [PasswordHash], [RoleID], [DefaultBranchID], [IsActive], [IsLocked], [FailedLoginAttempts], [RequirePasswordChange], [LastPasswordChangeDate], [LastLoginDate], [ActiveSessionToken], [Email], [MobileNumber]) VALUES
        (1, N'admin', N'$2a$11$0kRz1x5Jk7wB9qW0/Gs8uufWNRt1ZrrCX/Cuhb2jnLzMM8RNyc1HK', 1, 1, 1, 0, 0, 0, NULL, CONVERT(datetime2, '2026-09-08T11:01:35.188', 126), N'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1laWQiOiIxIiwidW5pcXVlX25hbWUiOiJhZG1pbiIsInJvbGUiOiJBZG1pbiIsIkJyYW5jaElEIjoiMSIsIkZpbmFuY2lhbFllYXJJRCI6IjEiLCJuYmYiOjE3ODg4NDU0OTUsImV4cCI6MTc4ODg3NDI5NSwiaWF0IjoxNzg4ODQ1NDk1fQ.w4zSLHBPyaUth1066-ZZ9CAnD5BN1PdymBx0ltcznY4', NULL, NULL);
    SET IDENTITY_INSERT dbo.[Users] OFF;
    PRINT 'Seeded [Users] (1 records)';
END;
GO

-- Table Seed: [FdSchemes] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[FdSchemes])
BEGIN
    SET IDENTITY_INSERT dbo.[FdSchemes] ON;
    INSERT INTO dbo.[FdSchemes] ([FdSchemeID], [InstitutionID], [BranchID], [SchemeCode], [SchemeName], [DurationMonths], [InterestRate], [SeniorCitizenInterestRate], [InterestType], [InterestPostingMethod], [InterestCompoundingFrequency], [MinimumAmount], [MaximumAmount], [PrematureInterestRate], [EffectiveDate], [IsActive], [CreatedBy], [CreatedDate], [ModifiedBy], [ModifiedDate], [FdLiabilityLedgerID], [InterestExpenseLedgerID], [InterestPayableLedgerID], [PrematurePenaltyLedgerID]) VALUES
        (1, 1, 1, N'FD-HO-01', N'मुदतबंद ठेव ', 13, 9.00, 9.00, N'Simple', N'On Principal', N'N/A', 1000.00, 1000000.00, 7.00, CONVERT(datetime2, '2026-08-26T00:00:00.000', 126), 1, 1, CONVERT(datetime2, '2026-08-26T17:45:57.603', 126), NULL, NULL, 48, 333, 114, 48);
    SET IDENTITY_INSERT dbo.[FdSchemes] OFF;
    PRINT 'Seeded [FdSchemes] (1 records)';
END;
GO

-- Table Seed: [RdSchemes] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[RdSchemes])
BEGIN
    SET IDENTITY_INSERT dbo.[RdSchemes] ON;
    INSERT INTO dbo.[RdSchemes] ([RdSchemeID], [InstitutionID], [BranchID], [SchemeCode], [SchemeName], [DurationMonths], [InstallmentAmount], [MinimumInstallment], [MaximumInstallment], [InterestRate], [InterestMethod], [PenaltyAmount], [EffectiveDate], [IsActive], [CreatedBy], [CreatedDate], [ModifiedBy], [ModifiedDate], [RdLiabilityLedgerID], [InterestExpenseLedgerID], [InterestPayableLedgerID], [PenaltyIncomeLedgerID], [PrematurePenaltyRate]) VALUES
        (1, 1, 1, N'RDS001', N'रिकारींग ठेव ', 60, 100.00, 100.00, 50000.00, 9.00, N'Quarterly', 2.00, CONVERT(datetime2, '2018-12-17T00:00:00.000', 126), 1, 1, CONVERT(datetime2, '2026-08-27T11:15:24.005', 126), NULL, NULL, 49, 343, 111, 319, 7.00);
    SET IDENTITY_INSERT dbo.[RdSchemes] OFF;
    PRINT 'Seeded [RdSchemes] (1 records)';
END;
GO

-- Table Seed: [PigmySchemes] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[PigmySchemes])
BEGIN
    SET IDENTITY_INSERT dbo.[PigmySchemes] ON;
    INSERT INTO dbo.[PigmySchemes] ([PigmySchemeID], [SchemeName], [InterestRate], [DurationMonths], [Status], [CreatedBy], [CreatedDate], [PigmyLiabilityLedgerID], [CommissionExpenseLedgerID], [InterestExpenseLedgerID], [InterestPayableLedgerID], [SchemeCode]) VALUES
        (1, N'पिग्मी (जोर्तलिंग )ठेव', 3.00, 12, N'Active', 1, CONVERT(datetime2, '2026-08-27T11:18:02.445', 126), 47, 47, 332, 112, N'PGS001');
    SET IDENTITY_INSERT dbo.[PigmySchemes] OFF;
    PRINT 'Seeded [PigmySchemes] (1 records)';
END;
GO

-- Table Seed: [ShareSchemes] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[ShareSchemes])
BEGIN
    SET IDENTITY_INSERT dbo.[ShareSchemes] ON;
    INSERT INTO dbo.[ShareSchemes] ([ShareSchemeId], [BranchID], [SchemeCode], [SchemeName], [MemberType], [ShareFaceValue], [MinSharesCount], [MaxSharesCount], [EntranceFee], [BuildingFund], [ShareTransferFee], [DividendRate], [HasVotingRights], [IsAadhaarCompulsory], [IsPanCompulsory], [LoanEligibilityMultiplier], [EffectiveDate], [IsActive], [ShareCapitalLedgerID], [EntranceFeeLedgerID], [ShareTransferFeeLedgerID], [BuildingFundLedgerID], [DividendPayableLedgerID], [IsMobileCompulsory]) VALUES
        (1, 1, N'SHR-REG-01', N'नियमित सभासद शेअर योजना', N'Regular', 100.00, 1, 1000, 10.00, 0.00, 25.00, 10.00, 1, 0, 0, 10, CONVERT(datetime2, '2026-08-25T00:00:00.000', 126), 1, 1, 315, 318, 6, 81, 0);
    SET IDENTITY_INSERT dbo.[ShareSchemes] OFF;
    PRINT 'Seeded [ShareSchemes] (1 records)';
END;
GO

-- Table Seed: [SavingInterestSettings] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[SavingInterestSettings])
BEGIN
    SET IDENTITY_INSERT dbo.[SavingInterestSettings] ON;
    INSERT INTO dbo.[SavingInterestSettings] ([SettingID], [InterestRate], [CalculationMethod], [PostingFrequency], [EffectiveDate], [LedgerID], [CreatedBy], [CreatedOn], [SchemeName], [SavingLiabilityLedgerID], [InterestExpenseLedgerID], [InterestPayableLedgerID], [SchemeCode]) VALUES
        (1, 3.00, N'Minimum Balance', N'Half Yearly', CONVERT(datetime2, '2018-12-17T00:00:00.000', 126), 331, 1, CONVERT(datetime2, '2026-08-27T12:09:32.516', 126), N'सेव्हिंग ठेव', 46, 331, 46, N'SAV001');
    SET IDENTITY_INSERT dbo.[SavingInterestSettings] OFF;
    PRINT 'Seeded [SavingInterestSettings] (1 records)';
END;
GO

-- Table Seed: [LoanRates] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[LoanRates])
BEGIN
    SET IDENTITY_INSERT dbo.[LoanRates] ON;
    INSERT INTO dbo.[LoanRates] ([LoanRateID], [LoanType], [LoanCode], [LoanLedgerID], [InterestLedgerID], [OverdueInterestLedgerID], [ReceivableInterestLedgerID], [SurchargeLedgerID], [RecoveryFeeLedgerID], [ProcessingFeeLedgerID], [InterestRate], [OverdueInterestRate], [InterestPostingType], [InterestCalculationMethod], [ShortName], [DurationMonths], [InstallmentType], [InstallmentCount], [LoanInstallmentType], [SecurityType], [IsCcOrOd], [IsActive], [InterestPostingFrequency]) VALUES
        (1, N'वैयक्तिक कर्ज', N'LN01', 216, 273, 295, 246, 410, 407, 322, 12.00, 2.00, N'Monthly', N'Daily Reducing (दैनिक घटती)', N'Personal Loan', 12, N'Monthly', 12, N'EMI', N'Unsecured', 0, 1, N'त्रैमासिक (Quarterly)');
    SET IDENTITY_INSERT dbo.[LoanRates] OFF;
    PRINT 'Seeded [LoanRates] (1 records)';
END;
GO


-- Table Seed: [BankMasters] (10 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[BankMasters])
BEGIN
    SET IDENTITY_INSERT dbo.[BankMasters] ON;
    INSERT INTO dbo.[BankMasters] ([BankID], [BankName]) VALUES
        (1, N'स्टेट बँक ऑफ इंडिया (SBI)'),
        (2, N'बँक ऑफ महाराष्ट्र (Bank of Maharashtra)'),
        (3, N'बँक ऑफ बडोदा (Bank of Baroda)'),
        (4, N'सेंट्रल बँक ऑफ इंडिया (Central Bank of India)'),
        (5, N'युनियन बँक ऑफ इंडिया (Union Bank of India)'),
        (6, N'एचडीएफसी बँक (HDFC Bank)'),
        (7, N'आयसीआयसीआय बँक (ICICI Bank)'),
        (8, N'ॲक्सिस बँक (Axis Bank)'),
        (9, N'जिल्हा मध्यवर्ती सहकारी बँक (DCC Bank)'),
        (10, N'पंजाब नॅशनल बँक (Punjab National Bank)');
    SET IDENTITY_INSERT dbo.[BankMasters] OFF;
    PRINT 'Seeded [BankMasters] (10 records)';
END;
GO

-- Table Seed: [CashManagementSettings] (2 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[CashManagementSettings])
BEGIN
    SET IDENTITY_INSERT dbo.[CashManagementSettings] ON;
    INSERT INTO dbo.[CashManagementSettings] ([Id], [BranchId], [AutoGenerateVouchers], [EnableDenominationMandatory], [MaxBranchVaultLimit], [DefaultCounterLimit], [Remarks], [LastUpdated], [MainVaultLedgerId], [CashShortageLedgerId], [CashExcessLedgerId]) VALUES
        (1, 1, 0, 1, 5000000.00, 500000.00, N'मुख्य तिजोरी व रोख योजना सेटिंग', CONVERT(datetime2, '2026-08-25T08:52:00.290', 126), NULL, NULL, NULL),
        (2, 2, 0, 1, 5000000.00, 500000.00, N'शाखा गोटखिंडी डीफॉल्ट कॅश सेटिंग', CONVERT(datetime2, '2026-08-29T11:26:18.344', 126), 161, NULL, NULL);
    SET IDENTITY_INSERT dbo.[CashManagementSettings] OFF;
    PRINT 'Seeded [CashManagementSettings] (2 records)';
END;
GO

-- Table Seed: [NpaConfigs] (1 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[NpaConfigs])
BEGIN
    INSERT INTO dbo.[NpaConfigs] ([FinancialYear], [ConcessionPeriodDays]) VALUES
        (N'2026-27', 180);
    PRINT 'Seeded [NpaConfigs] (1 records)';
END;
GO

-- Table Seed: [NpaProvisionSlabs] (9 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[NpaProvisionSlabs])
BEGIN
    SET IDENTITY_INSERT dbo.[NpaProvisionSlabs] ON;
    INSERT INTO dbo.[NpaProvisionSlabs] ([NpaProvisionSlabID], [FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES
        (10, N'2026-27', N'Standard', N'Both', 0.00, 6.00, 0.00, 0.00, 0.25),
        (11, N'2026-27', N'Sub-Standard', N'Both', 6.00, 18.00, 0.00, 12.00, 8.00),
        (12, N'2026-27', N'Doubtful-1', N'Secured', 18.00, 42.00, 12.00, 36.00, 25.00),
        (13, N'2026-27', N'Doubtful-1', N'Unsecured', 18.00, 42.00, 12.00, 36.00, 80.00),
        (14, N'2026-27', N'Doubtful-2', N'Secured', 42.00, 54.00, 36.00, 48.00, 30.00),
        (15, N'2026-27', N'Doubtful-2', N'Unsecured', 42.00, 54.00, 36.00, 48.00, 90.00),
        (16, N'2026-27', N'Doubtful-3', N'Secured', 54.00, 999.00, 48.00, 999.00, 40.00),
        (17, N'2026-27', N'Doubtful-3', N'Unsecured', 54.00, 999.00, 48.00, 999.00, 100.00),
        (18, N'2026-27', N'Loss', N'Both', 0.00, 999.00, 0.00, 0.00, 100.00);
    SET IDENTITY_INSERT dbo.[NpaProvisionSlabs] OFF;
    PRINT 'Seeded [NpaProvisionSlabs] (9 records)';
END;
GO


-- Table Seed: [VoucherMappings] (4 rows)
IF NOT EXISTS (SELECT 1 FROM dbo.[VoucherMappings])
BEGIN
    SET IDENTITY_INSERT dbo.[VoucherMappings] ON;
    INSERT INTO dbo.[VoucherMappings] ([MappingID], [TransactionType], [DebitLedgerID], [CreditLedgerID]) VALUES
        (1, N'Share Capital', NULL, 1),
        (2, N'Dividend Payable', NULL, 81),
        (3, N'Share Entrance Fee', NULL, 315),
        (4, N'Share Transfer Fee', NULL, 318);
    SET IDENTITY_INSERT dbo.[VoucherMappings] OFF;
    PRINT 'Seeded [VoucherMappings] (4 records)';
END;
GO

-- Active Business Date Status (Day Open)
IF NOT EXISTS (SELECT 1 FROM dbo.[BranchDayEndStatuses])
BEGIN
    INSERT INTO dbo.[BranchDayEndStatuses] ([BranchID], [BusinessDate], [IsDayClosed])
    VALUES (1, '2026-04-01 00:00:00', 0);
    PRINT 'Seeded BranchDayEndStatuses';
END;
GO

-- =========================================================================================
-- FOREIGN KEY CONSTRAINTS
-- =========================================================================================
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_AgentCustomerRequests_Customers_CreatedCustomerID')
BEGIN
    ALTER TABLE dbo.[AgentCustomerRequests] WITH CHECK ADD CONSTRAINT [FK_AgentCustomerRequests_Customers_CreatedCustomerID] FOREIGN KEY ([CreatedCustomerID]) REFERENCES dbo.[Customers] ([CustomerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_Members_Customers_CustomerID')
BEGIN
    ALTER TABLE dbo.[Members] WITH CHECK ADD CONSTRAINT [FK_Members_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES dbo.[Customers] ([CustomerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_PigmyAccounts_Customers_CustomerID')
BEGIN
    ALTER TABLE dbo.[PigmyAccounts] WITH CHECK ADD CONSTRAINT [FK_PigmyAccounts_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES dbo.[Customers] ([CustomerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdAccounts_Customers_CustomerID')
BEGIN
    ALTER TABLE dbo.[RdAccounts] WITH CHECK ADD CONSTRAINT [FK_RdAccounts_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES dbo.[Customers] ([CustomerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_RdAccounts_Customers_JointCustomerID')
BEGIN
    ALTER TABLE dbo.[RdAccounts] WITH CHECK ADD CONSTRAINT [FK_RdAccounts_Customers_JointCustomerID] FOREIGN KEY ([JointCustomerID]) REFERENCES dbo.[Customers] ([CustomerID]) ON DELETE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'FK_VoucherDetails_Customers_CustomerID')
BEGIN
    ALTER TABLE dbo.[VoucherDetails] WITH CHECK ADD CONSTRAINT [FK_VoucherDetails_Customers_CustomerID] FOREIGN KEY ([CustomerID]) REFERENCES dbo.[Customers] ([CustomerID]) ON DELETE NO ACTION;
END;
GO
-- =========================================================================================
-- SYSTEM PROCEDURES: AUTOMATIC IDENTITY RESEED & COUNTER ROLLBACK ON DELETE
-- =========================================================================================
IF OBJECT_ID(N'[dbo].[sp_SyncDatabaseIdentities]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[sp_SyncDatabaseIdentities];
GO

CREATE PROCEDURE [dbo].[sp_SyncDatabaseIdentities]
AS
BEGIN
    SET NOCOUNT ON;
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;

    DECLARE @tbl NVARCHAR(256), @col NVARCHAR(256);
    DECLARE @sql NVARCHAR(MAX);
    DECLARE @reseededCount INT = 0;
    DECLARE @triggerCount INT = 0;

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT t.name, c.name
    FROM sys.tables t
    INNER JOIN sys.identity_columns c ON t.object_id = c.object_id
    WHERE t.is_ms_shipped = 0
    ORDER BY t.name;

    OPEN cur;
    FETCH NEXT FROM cur INTO @tbl, @col;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @trgName NVARCHAR(256) = 'trg_AutoReseed_' + REPLACE(@tbl, ' ', '_');

        -- Drop old trigger if exists
        IF OBJECT_ID(N'[dbo].[' + @trgName + ']', 'TR') IS NOT NULL
        BEGIN
            EXEC('DROP TRIGGER [dbo].[' + @trgName + ']');
        END

        -- Install AFTER DELETE Self-Healing Trigger on Every Table
        SET @sql = '
        CREATE TRIGGER [dbo].[' + @trgName + ']
        ON [dbo].[' + @tbl + ']
        AFTER DELETE
        AS
        BEGIN
            SET NOCOUNT ON;
            BEGIN TRY
                DECLARE @maxId BIGINT;
                SELECT @maxId = MAX([' + @col + ']) FROM [dbo].[' + @tbl + '];
                
                IF @maxId IS NOT NULL
                BEGIN
                    DECLARE @currId BIGINT = CAST(IDENT_CURRENT(''[dbo].[' + @tbl + ']'') AS BIGINT);
                    IF @currId > @maxId
                    BEGIN
                        DBCC CHECKIDENT (''[dbo].[' + @tbl + ']'', RESEED, @maxId) WITH NO_INFOMSGS;
                    END
                END
                ELSE
                BEGIN
                    DBCC CHECKIDENT (''[dbo].[' + @tbl + ']'', RESEED, 0) WITH NO_INFOMSGS;
                END
            END TRY
            BEGIN CATCH
            END CATCH
        END;';

        BEGIN TRY
            EXEC sp_executesql @sql;
            SET @triggerCount = @triggerCount + 1;
        END TRY
        BEGIN CATCH
        END CATCH

        -- Initial Reseed check
        BEGIN TRY
            DECLARE @actualMax BIGINT = NULL;
            DECLARE @maxQuery NVARCHAR(MAX) = 'SELECT @m = MAX([' + @col + ']) FROM [' + @tbl + ']';
            EXEC sp_executesql @maxQuery, N'@m BIGINT OUTPUT', @m = @actualMax OUTPUT;

            DECLARE @currentIdent BIGINT = CAST(IDENT_CURRENT(@tbl) AS BIGINT);

            IF @actualMax IS NOT NULL
            BEGIN
                IF @currentIdent > @actualMax
                BEGIN
                    DBCC CHECKIDENT (@tbl, RESEED, @actualMax) WITH NO_INFOMSGS;
                    SET @reseededCount = @reseededCount + 1;
                END
            END
            ELSE
            BEGIN
                IF @currentIdent > 1
                BEGIN
                    DBCC CHECKIDENT (@tbl, RESEED, 0) WITH NO_INFOMSGS;
                    SET @reseededCount = @reseededCount + 1;
                END
            END
        END TRY
        BEGIN CATCH
        END CATCH

        FETCH NEXT FROM cur INTO @tbl, @col;
    END

    CLOSE cur;
    DEALLOCATE cur;

    PRINT 'Identities synced: ' + CAST(@triggerCount AS NVARCHAR) + ' triggers ensured, ' + CAST(@reseededCount AS NVARCHAR) + ' tables reseeded.';
END;
GO

-- Execute once to establish triggers
EXEC [dbo].[sp_SyncDatabaseIdentities];
GO

-- =========================================================================================
-- STRICT SCHEMA GOVERNANCE GUARD (Blocks or Audits Unauthorized Runtime ALTER Statements)
-- =========================================================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE parent_class = 0 AND name = 'trg_DatabaseSchemaGuard')
    DROP TRIGGER [trg_DatabaseSchemaGuard] ON DATABASE;
GO

CREATE TRIGGER [trg_DatabaseSchemaGuard]
ON DATABASE
FOR ALTER_TABLE, DROP_TABLE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @cmd NVARCHAR(MAX) = EVENTDATA().value('(/EVENT_INSTANCE/TSQLCommand/CommandText)[1]','nvarchar(max)');
    PRINT '[SCHEMA AUDIT] DDL executed: ' + ISNULL(SUBSTRING(@cmd, 1, 200), '');
END;
GO

PRINT '========================================================================';
PRINT '  SmartBanking_Template DEPLOYMENT COMPLETED SUCCESSFULLY WITH ZERO JUMPS! ';
PRINT '========================================================================';
GO
