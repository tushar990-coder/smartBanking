-- ===========================================================================
-- SmartBanking_Template - Master Template Database Creation Script
-- Fully Compatible with: Microsoft SQL Server 2022 (Version 160) & Earlier
-- Pure CIF-First Architecture (Zero MemberID Fallback in FD/RD/Pigmy)
-- Generated Date: 2026-09-09 11.36.26
-- ===========================================================================
USE master;
GO
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'SmartBanking_Template')
BEGIN
    CREATE DATABASE [SmartBanking_Template];
END
GO
ALTER DATABASE [SmartBanking_Template] SET COMPATIBILITY_LEVEL = 160;
GO
USE [SmartBanking_Template];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[__SystemVersionHistory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[VersionNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[AppliedOn] [datetime2](7) NOT NULL,
	[PatchName] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AppliedBy] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK___SystemVersionHistory] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[__SystemVersionHistory] ADD  DEFAULT (getutcdate()) FOR [AppliedOn]
GO
ALTER TABLE [dbo].[__SystemVersionHistory] ADD  DEFAULT ('') FOR [PatchName]
GO
ALTER TABLE [dbo].[__SystemVersionHistory] ADD  DEFAULT ('SUCCESS') FOR [Status]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AccountGroups](
	[GroupID] [int] IDENTITY(1,1) NOT NULL,
	[GroupName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ParentGroupID] [int] NULL,
	[NatureOfGroup] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[IsActive] [bit] NOT NULL,
	[LegacyGroupId] [int] NULL,
	[GroupCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GroupNameEnglish] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[DisplayOrder] [int] NOT NULL,
 CONSTRAINT [PK_AccountGroups] PRIMARY KEY CLUSTERED 
(
	[GroupID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[AccountGroups] ADD  DEFAULT ((0)) FOR [DisplayOrder]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AgentCustomerRequests](
	[RequestID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[PigmyAgentID] [int] NOT NULL,
	[AgentName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[FirstName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MiddleName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LastName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[FirstNameEng] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MiddleNameEng] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LastNameEng] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Gender] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[BirthDate] [datetime2](7) NULL,
	[Occupation] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CasteCategory] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MobileNo] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Email] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AadhaarNo] [nvarchar](12) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PANNo] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Address] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Village] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Taluka] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[District] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Pincode] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeNameEng] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeRelation] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeAddress] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeBirthDate] [datetime2](7) NULL,
	[NomineeAge] [int] NULL,
	[PhotoPath] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SignaturePath] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AadhaarDocPath] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PanDocPath] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[OpenPigmyAccount] [bit] NOT NULL,
	[PigmySchemeID] [int] NULL,
	[DailyDepositAmount] [decimal](18, 2) NULL,
	[InitialDepositAmount] [decimal](18, 2) NULL,
	[Remarks] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[RequestDate] [datetime2](7) NOT NULL,
	[ApprovalDate] [datetime2](7) NULL,
	[ApprovedByUserID] [int] NULL,
	[CreatedMemberID] [int] NULL,
	[CreatedPigmyAccountID] [int] NULL,
	[RejectionReason] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AddressEng] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedCustomerID] [int] NULL,
 CONSTRAINT [PK_AgentCustomerRequests] PRIMARY KEY CLUSTERED 
(
	[RequestID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[AgentCustomerRequests] ADD  DEFAULT ((1)) FOR [BranchID]
GO
ALTER TABLE [dbo].[AgentCustomerRequests] ADD  DEFAULT ('Male') FOR [Gender]
GO
ALTER TABLE [dbo].[AgentCustomerRequests] ADD  DEFAULT ((1)) FOR [OpenPigmyAccount]
GO
ALTER TABLE [dbo].[AgentCustomerRequests] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[AgentCustomerRequests] ADD  DEFAULT (getdate()) FOR [RequestDate]
GO
ALTER TABLE [dbo].[AgentCustomerRequests]  WITH CHECK ADD  CONSTRAINT [FK_AgentCustomerRequests_Customers_CreatedCustomerID] FOREIGN KEY([CreatedCustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[AgentCustomerRequests] CHECK CONSTRAINT [FK_AgentCustomerRequests_Customers_CreatedCustomerID]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetAllocations](
	[AllocationID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[AssetID] [int] NOT NULL,
	[AllocatedBranchID] [int] NOT NULL,
	[AllocationDate] [datetime2](7) NOT NULL,
	[Department] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CustodianName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_AssetAllocations] PRIMARY KEY CLUSTERED 
(
	[AllocationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetCategories](
	[CategoryID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[CategoryCode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CategoryName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[UsefulLifeMonths] [int] NOT NULL,
	[DepreciationRate] [decimal](5, 2) NOT NULL,
	[DepreciationMethod] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_AssetCategories] PRIMARY KEY CLUSTERED 
(
	[CategoryID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetDepreciations](
	[DepreciationID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[AssetID] [int] NOT NULL,
	[CalculationDate] [datetime2](7) NOT NULL,
	[Method] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Rate] [decimal](5, 2) NOT NULL,
	[DepreciationAmount] [decimal](18, 2) NOT NULL,
	[BookValueBefore] [decimal](18, 2) NOT NULL,
	[BookValueAfter] [decimal](18, 2) NOT NULL,
	[VoucherID] [int] NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_AssetDepreciations] PRIMARY KEY CLUSTERED 
(
	[DepreciationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetDisposals](
	[DisposalID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[AssetID] [int] NOT NULL,
	[DisposalDate] [datetime2](7) NOT NULL,
	[DisposalType] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[BookValueAtDisposal] [decimal](18, 2) NOT NULL,
	[SaleAmount] [decimal](18, 2) NOT NULL,
	[ProfitOrLoss] [decimal](18, 2) NOT NULL,
	[BuyerName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[VoucherID] [int] NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_AssetDisposals] PRIMARY KEY CLUSTERED 
(
	[DisposalID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetMaintenances](
	[MaintenanceID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[AssetID] [int] NOT NULL,
	[MaintenanceDate] [datetime2](7) NOT NULL,
	[MaintenanceType] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ServiceProvider] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Cost] [decimal](18, 2) NOT NULL,
	[Remarks] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NextServiceDate] [datetime2](7) NULL,
	[VoucherID] [int] NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_AssetMaintenances] PRIMARY KEY CLUSTERED 
(
	[MaintenanceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetPurchases](
	[PurchaseID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[SupplierName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InvoiceNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InvoiceDate] [datetime2](7) NOT NULL,
	[TaxableAmount] [decimal](18, 2) NOT NULL,
	[GstAmount] [decimal](18, 2) NOT NULL,
	[TotalAmount] [decimal](18, 2) NOT NULL,
	[PaymentMode] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[BankLedgerID] [int] NULL,
	[VoucherID] [int] NULL,
	[AssetIdsJson] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_AssetPurchases] PRIMARY KEY CLUSTERED 
(
	[PurchaseID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Assets](
	[AssetID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[CategoryID] [int] NOT NULL,
	[AssetCode] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[AssetName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PurchaseDate] [datetime2](7) NOT NULL,
	[OriginalCost] [decimal](18, 2) NOT NULL,
	[AccumulatedDepreciation] [decimal](18, 2) NOT NULL,
	[CurrentBookValue] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Location] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Custodian] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsOpeningBalance] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_Assets] PRIMARY KEY CLUSTERED 
(
	[AssetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetTransfers](
	[TransferID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[AssetID] [int] NOT NULL,
	[FromBranchID] [int] NOT NULL,
	[ToBranchID] [int] NOT NULL,
	[TransferDate] [datetime2](7) NOT NULL,
	[FromCustodian] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ToCustodian] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_AssetTransfers] PRIMARY KEY CLUSTERED 
(
	[TransferID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetVerifications](
	[VerificationID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[AssetID] [int] NOT NULL,
	[VerificationDate] [datetime2](7) NOT NULL,
	[AuditorName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PhysicalStatus] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_AssetVerifications] PRIMARY KEY CLUSTERED 
(
	[VerificationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AuditLedgerMappings](
	[AuditLedgerMappingID] [int] IDENTITY(1,1) NOT NULL,
	[CategoryCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CategoryName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LedgerID] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedOn] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_AuditLedgerMappings] PRIMARY KEY CLUSTERED 
(
	[AuditLedgerMappingID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AuditLogs](
	[AuditLogID] [bigint] IDENTITY(1,1) NOT NULL,
	[UserID] [int] NULL,
	[Username] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Action] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[EntityName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[EntityID] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Timestamp] [datetime2](7) NOT NULL,
	[IPAddress] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Details] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 CONSTRAINT [PK_AuditLogs] PRIMARY KEY CLUSTERED 
(
	[AuditLogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BankMasters](
	[BankID] [int] IDENTITY(1,1) NOT NULL,
	[BankName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 CONSTRAINT [PK_BankMasters] PRIMARY KEY CLUSTERED 
(
	[BankID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BorrowerLinkedAccounts](
	[BorrowerLinkedAccountID] [int] IDENTITY(1,1) NOT NULL,
	[ParentMemberID] [int] NOT NULL,
	[LinkedMemberID] [int] NOT NULL,
	[LinkType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_BorrowerLinkedAccounts] PRIMARY KEY CLUSTERED 
(
	[BorrowerLinkedAccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BranchDayEndStatuses](
	[StatusID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[BusinessDate] [datetime2](7) NOT NULL,
	[IsDayClosed] [bit] NOT NULL,
 CONSTRAINT [PK_BranchDayEndStatuses] PRIMARY KEY CLUSTERED 
(
	[StatusID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Branches](
	[BranchID] [int] IDENTITY(1,1) NOT NULL,
	[BranchCode] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[BranchName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Address] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IFSCCode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsActive] [bit] NOT NULL,
	[BranchType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Email] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MobileNo] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[DefaultCashLedgerID] [int] NULL,
 CONSTRAINT [PK_Branches] PRIMARY KEY CLUSTERED 
(
	[BranchID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BranchMasters](
	[BranchID] [int] IDENTITY(1,1) NOT NULL,
	[BranchCode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[BranchName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Address] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[City] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[District] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[State] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Pincode] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MobileNo] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Email] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [bit] NOT NULL,
	[CreatedBy] [int] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[BranchType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 CONSTRAINT [PK_BranchMasters] PRIMARY KEY CLUSTERED 
(
	[BranchID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[BranchMasters] ADD  DEFAULT ('') FOR [BranchType]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CashAllocations](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AllocationDate] [datetime2](7) NOT NULL,
	[AllocationType] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[FromCashierId] [int] NOT NULL,
	[ToCashierId] [int] NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[AuthorizedBy] [int] NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[BranchId] [int] NULL,
	[IsReturn] [bit] NOT NULL,
	[CreatedBy] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_CashAllocations] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[CashAllocations] ADD  DEFAULT (getdate()) FOR [AllocationDate]
GO
ALTER TABLE [dbo].[CashAllocations] ADD  DEFAULT ('HEAD_TO_TELLER') FOR [AllocationType]
GO
ALTER TABLE [dbo].[CashAllocations] ADD  DEFAULT ('APPROVED') FOR [Status]
GO
ALTER TABLE [dbo].[CashAllocations] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CashAllocations] ADD  DEFAULT ((0)) FOR [IsReturn]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CashDenominations](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[EntryDate] [datetime2](7) NOT NULL,
	[CashierId] [int] NOT NULL,
	[Count2000] [int] NOT NULL,
	[Count500] [int] NOT NULL,
	[Count200] [int] NOT NULL,
	[Count100] [int] NOT NULL,
	[Count50] [int] NOT NULL,
	[Count20] [int] NOT NULL,
	[Count10] [int] NOT NULL,
	[Count5] [int] NOT NULL,
	[Count2] [int] NOT NULL,
	[Count1] [int] NOT NULL,
	[TotalAmount] [decimal](18, 2) NOT NULL,
	[PhysicalCashTotal] [decimal](18, 2) NOT NULL,
	[SystemCashBalance] [decimal](18, 2) NOT NULL,
	[DifferenceAmount] [decimal](18, 2) NOT NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[BranchId] [int] NULL,
	[DenominationDate] [datetime2](7) NOT NULL,
	[EntryType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CountCoins] [int] NOT NULL,
	[ExpectedAmount] [decimal](18, 2) NOT NULL,
	[DifferenceType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[VerifiedBy] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_CashDenominations] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT (getdate()) FOR [EntryDate]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [Count2000]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [Count500]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [Count200]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [Count100]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [Count50]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [Count20]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [Count10]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [Count5]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [Count2]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [Count1]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [TotalAmount]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [PhysicalCashTotal]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [SystemCashBalance]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [DifferenceAmount]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT (getdate()) FOR [DenominationDate]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ('CLOSING') FOR [EntryType]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0)) FOR [CountCoins]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ((0.00)) FOR [ExpectedAmount]
GO
ALTER TABLE [dbo].[CashDenominations] ADD  DEFAULT ('MATCHED') FOR [DifferenceType]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CashierBalances](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[BranchId] [int] NULL,
	[CashierId] [int] NOT NULL,
	[BalanceDate] [datetime2](7) NOT NULL,
	[OpeningBalance] [decimal](18, 2) NOT NULL,
	[ReceivedFromHead] [decimal](18, 2) NOT NULL,
	[TotalReceipts] [decimal](18, 2) NOT NULL,
	[TotalPayments] [decimal](18, 2) NOT NULL,
	[ReturnedToHead] [decimal](18, 2) NOT NULL,
	[ClosingBalance] [decimal](18, 2) NOT NULL,
	[PhysicalCashTally] [decimal](18, 2) NOT NULL,
	[CashDifference] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LastUpdated] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_CashierBalances] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT (getdate()) FOR [BalanceDate]
GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT ((0.00)) FOR [OpeningBalance]
GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT ((0.00)) FOR [ReceivedFromHead]
GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT ((0.00)) FOR [TotalReceipts]
GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT ((0.00)) FOR [TotalPayments]
GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT ((0.00)) FOR [ReturnedToHead]
GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT ((0.00)) FOR [ClosingBalance]
GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT ((0.00)) FOR [PhysicalCashTally]
GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT ((0.00)) FOR [CashDifference]
GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT ('OPEN') FOR [Status]
GO
ALTER TABLE [dbo].[CashierBalances] ADD  DEFAULT (getdate()) FOR [LastUpdated]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Cashiers](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[BranchId] [int] NOT NULL,
	[CashierName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CounterNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[IsHeadCashier] [bit] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[MaxCashLimit] [decimal](18, 2) NOT NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CashLedgerId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UserId] [int] NULL,
 CONSTRAINT [PK_Cashiers] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[Cashiers] ADD  DEFAULT ((1)) FOR [BranchId]
GO
ALTER TABLE [dbo].[Cashiers] ADD  DEFAULT ((0)) FOR [IsHeadCashier]
GO
ALTER TABLE [dbo].[Cashiers] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Cashiers] ADD  DEFAULT ((500000.00)) FOR [MaxCashLimit]
GO
ALTER TABLE [dbo].[Cashiers] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CashManagementSettings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[BranchId] [int] NOT NULL,
	[AutoGenerateVouchers] [bit] NOT NULL,
	[EnableDenominationMandatory] [bit] NOT NULL,
	[MaxBranchVaultLimit] [decimal](18, 2) NOT NULL,
	[DefaultCounterLimit] [decimal](18, 2) NOT NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LastUpdated] [datetime2](7) NOT NULL,
	[MainVaultLedgerId] [int] NULL,
	[CashShortageLedgerId] [int] NULL,
	[CashExcessLedgerId] [int] NULL,
 CONSTRAINT [PK_CashManagementSettings] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[CashManagementSettings] ADD  DEFAULT ((1)) FOR [BranchId]
GO
ALTER TABLE [dbo].[CashManagementSettings] ADD  DEFAULT ((0)) FOR [AutoGenerateVouchers]
GO
ALTER TABLE [dbo].[CashManagementSettings] ADD  DEFAULT ((1)) FOR [EnableDenominationMandatory]
GO
ALTER TABLE [dbo].[CashManagementSettings] ADD  DEFAULT ((5000000.00)) FOR [MaxBranchVaultLimit]
GO
ALTER TABLE [dbo].[CashManagementSettings] ADD  DEFAULT ((500000.00)) FOR [DefaultCounterLimit]
GO
ALTER TABLE [dbo].[CashManagementSettings] ADD  DEFAULT (getdate()) FOR [LastUpdated]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CifSequences](
	[SequenceID] [int] IDENTITY(1,1) NOT NULL,
	[SequenceCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Prefix] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CurrentValue] [bigint] NOT NULL,
	[PaddingLength] [int] NOT NULL,
	[LastUpdated] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[SequenceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[SequenceCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[CifSequences] ADD  DEFAULT ('CIF') FOR [Prefix]
GO
ALTER TABLE [dbo].[CifSequences] ADD  DEFAULT ((0)) FOR [CurrentValue]
GO
ALTER TABLE [dbo].[CifSequences] ADD  DEFAULT ((6)) FOR [PaddingLength]
GO
ALTER TABLE [dbo].[CifSequences] ADD  DEFAULT (getutcdate()) FOR [LastUpdated]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CollateralComplianceLogs](
	[CollateralComplianceLogID] [int] IDENTITY(1,1) NOT NULL,
	[LoanAccountID] [int] NOT NULL,
	[CollateralType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ValuationDate] [datetime2](7) NOT NULL,
	[ValuationValue] [decimal](18, 2) NOT NULL,
	[ValuersCount] [int] NOT NULL,
	[LastInspectionDate] [datetime2](7) NOT NULL,
	[InsuranceExpiryDate] [datetime2](7) NOT NULL,
	[LastStockStatementDate] [datetime2](7) NULL,
	[IsAuditorVerified] [bit] NOT NULL,
	[IsMarginMaintained] [bit] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[CollateralDescription] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CollateralValue] [decimal](18, 2) NULL,
	[InspectorName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MarginPercent] [decimal](5, 2) NULL,
	[Remarks] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_CollateralComplianceLogs] PRIMARY KEY CLUSTERED 
(
	[CollateralComplianceLogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CommitteeMembers](
	[CommitteeMemberID] [int] IDENTITY(1,1) NOT NULL,
	[MemberID] [int] NOT NULL,
	[Designation] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[JoiningDate] [datetime2](7) NOT NULL,
	[EndDate] [datetime2](7) NULL,
	[ResolutionNo] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[UpdatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Category] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[DINNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Remarks] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[TermYear] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_CommitteeMembers] PRIMARY KEY CLUSTERED 
(
	[CommitteeMemberID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CustomerImportBatches](
	[BatchID] [bigint] IDENTITY(1,1) NOT NULL,
	[BatchNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[FileName] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InputMode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[HomeBranchID] [int] NOT NULL,
	[TotalRecords] [int] NOT NULL,
	[ValidRecords] [int] NOT NULL,
	[InvalidRecords] [int] NOT NULL,
	[ImportedRecords] [int] NOT NULL,
	[SkippedRecords] [int] NOT NULL,
	[Status] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MakerUserID] [int] NOT NULL,
	[MakerUsername] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SubmittedOn] [datetime2](7) NOT NULL,
	[CheckerUserID] [int] NULL,
	[CheckerUsername] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ApprovedOn] [datetime2](7) NULL,
	[StartCif] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[EndCif] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ExecutionTimeMs] [bigint] NOT NULL,
	[RolledBackBy] [int] NULL,
	[RolledBackUsername] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[RolledBackOn] [datetime2](7) NULL,
	[RollbackReason] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SummaryJson] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ErrorLogJson] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[MergedRecords] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[BatchID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[BatchNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ('DirectGridEntry') FOR [FileName]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ('DirectGrid') FOR [InputMode]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ((1)) FOR [InstitutionID]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ((1)) FOR [HomeBranchID]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ((0)) FOR [TotalRecords]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ((0)) FOR [ValidRecords]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ((0)) FOR [InvalidRecords]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ((0)) FOR [ImportedRecords]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ((0)) FOR [SkippedRecords]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ('Completed') FOR [Status]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ((1)) FOR [MakerUserID]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ('System') FOR [MakerUsername]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT (getutcdate()) FOR [SubmittedOn]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ((0)) FOR [ExecutionTimeMs]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT (getutcdate()) FOR [CreatedOn]
GO
ALTER TABLE [dbo].[CustomerImportBatches] ADD  DEFAULT ((0)) FOR [MergedRecords]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CustomerOpeningBalances](
	[CustomerOpeningBalanceID] [int] IDENTITY(1,1) NOT NULL,
	[CustomerID] [int] NOT NULL,
	[LedgerID] [int] NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[BalanceType] [nvarchar](2) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_CustomerOpeningBalances] PRIMARY KEY CLUSTERED 
(
	[CustomerOpeningBalanceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[CustomerOpeningBalances] ADD  DEFAULT ((0)) FOR [Amount]
GO
ALTER TABLE [dbo].[CustomerOpeningBalances] ADD  DEFAULT ('Dr') FOR [BalanceType]
GO
ALTER TABLE [dbo].[CustomerOpeningBalances] ADD  DEFAULT ((1)) FOR [CreatedBy]
GO
ALTER TABLE [dbo].[CustomerOpeningBalances] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedOn]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Customers](
	[CustomerID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[CIFNo] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[FirstName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MiddleName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LastName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NickName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[FirstNameEng] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MiddleNameEng] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LastNameEng] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Address] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AddressEng] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Village] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Taluka] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[District] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MobileNo] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AadhaarNo] [nvarchar](12) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PANNo] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[RegistrationDate] [datetime2](7) NOT NULL,
	[NomineeName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeNameEng] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeRelation] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeAddress] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeBirthDate] [datetime2](7) NULL,
	[NomineeIsMinor] [bit] NOT NULL,
	[NomineeGuardianName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PhotoPath] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SignaturePath] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AadhaarDocPath] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PanDocPath] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Gender] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[BirthDate] [datetime2](7) NULL,
	[Occupation] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CasteCategory] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Caste] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Email] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsMinor] [bit] NOT NULL,
	[GuardianName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GuardianNameEng] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GuardianRelation] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GuardianAadhaarNo] [nvarchar](12) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GuardianMobileNo] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GuardianAddress] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[EmployerId] [int] NULL,
	[IsDeleted] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
	[LegacyCustomerNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CustomerType] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[KYCStatus] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CKYCNo] [nvarchar](14) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[RiskCategory] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[HomeBranchID] [int] NULL,
	[ImportBatchID] [bigint] NULL,
 CONSTRAINT [PK_Customers] PRIMARY KEY CLUSTERED 
(
	[CustomerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_PADDING ON

GO
CREATE UNIQUE NONCLUSTERED INDEX [IX_Customers_AadhaarNo] ON [dbo].[Customers]
(
	[AadhaarNo] ASC
)
WHERE ([AadhaarNo] IS NOT NULL AND [AadhaarNo]<>'' AND [IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON

GO
CREATE UNIQUE NONCLUSTERED INDEX [IX_Customers_CIFNo] ON [dbo].[Customers]
(
	[CIFNo] ASC
)
WHERE ([CIFNo] IS NOT NULL AND [CIFNo]<>'' AND [IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON

GO
CREATE NONCLUSTERED INDEX [IX_Customers_MobileNo] ON [dbo].[Customers]
(
	[MobileNo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ((1)) FOR [BranchID]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT (sysutcdatetime()) FOR [RegistrationDate]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ((0)) FOR [NomineeIsMinor]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ((0)) FOR [IsMinor]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ((1)) FOR [CreatedBy]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedOn]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ('Individual') FOR [CustomerType]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ('Verified') FOR [KYCStatus]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ('Low') FOR [RiskCategory]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeceasedClaimSettlements](
	[ClaimID] [int] IDENTITY(1,1) NOT NULL,
	[MemberID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[DeathDate] [datetime2](7) NOT NULL,
	[DeathCertificateNo] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NomineeRelation] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeAadhaarNo] [nvarchar](12) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeMobileNo] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeBankAccount] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[TotalSavingsBalance] [decimal](18, 2) NOT NULL,
	[TotalFdBalance] [decimal](18, 2) NOT NULL,
	[TotalRdBalance] [decimal](18, 2) NOT NULL,
	[TotalPigmyBalance] [decimal](18, 2) NOT NULL,
	[TotalShareAmount] [decimal](18, 2) NOT NULL,
	[TotalLoanLiability] [decimal](18, 2) NOT NULL,
	[NetPayableAmount] [decimal](18, 2) NOT NULL,
	[ResolutionNo] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ResolutionDate] [datetime2](7) NULL,
	[VoucherID] [int] NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SettlementDate] [datetime2](7) NOT NULL,
	[Remarks] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_DeceasedClaimSettlements] PRIMARY KEY CLUSTERED 
(
	[ClaimID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT ((1)) FOR [BranchID]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT (CONVERT([date],getdate(),(0))) FOR [DeathDate]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT ((0)) FOR [TotalSavingsBalance]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT ((0)) FOR [TotalFdBalance]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT ((0)) FOR [TotalRdBalance]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT ((0)) FOR [TotalPigmyBalance]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT ((0)) FOR [TotalShareAmount]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT ((0)) FOR [TotalLoanLiability]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT ((0)) FOR [NetPayableAmount]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT ('Settled') FOR [Status]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT (CONVERT([date],getdate(),(0))) FOR [SettlementDate]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT ((1)) FOR [CreatedBy]
GO
ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedOn]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DemandMemberDetails](
	[DemandMemberDetailId] [int] IDENTITY(1,1) NOT NULL,
	[DemandNoticeId] [int] NOT NULL,
	[MemberId] [int] NOT NULL,
	[LoanInstallment] [decimal](18, 2) NOT NULL,
	[SavingDeposit] [decimal](18, 2) NOT NULL,
	[ShareDeposit] [decimal](18, 2) NOT NULL,
	[PigmyDeposit] [decimal](18, 2) NOT NULL,
	[RdDeposit] [decimal](18, 2) NOT NULL,
	[TotalDeduction] [decimal](18, 2) NOT NULL,
	[IsProcessed] [bit] NOT NULL,
 CONSTRAINT [PK_DemandMemberDetails] PRIMARY KEY CLUSTERED 
(
	[DemandMemberDetailId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DemandNotices](
	[DemandNoticeId] [int] IDENTITY(1,1) NOT NULL,
	[NoticeNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Month] [int] NOT NULL,
	[Year] [int] NOT NULL,
	[EmployerId] [int] NOT NULL,
	[BranchId] [int] NOT NULL,
	[TotalDemandAmount] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NOT NULL,
 CONSTRAINT [PK_DemandNotices] PRIMARY KEY CLUSTERED 
(
	[DemandNoticeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DemandRecoveries](
	[DemandRecoveryId] [int] IDENTITY(1,1) NOT NULL,
	[DemandNoticeId] [int] NOT NULL,
	[RecoveryDate] [datetime2](7) NOT NULL,
	[TotalReceivedAmount] [decimal](18, 2) NOT NULL,
	[VoucherId] [int] NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NOT NULL,
 CONSTRAINT [PK_DemandRecoveries] PRIMARY KEY CLUSTERED 
(
	[DemandRecoveryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DepartmentMasters](
	[DepartmentID] [int] IDENTITY(1,1) NOT NULL,
	[DepartmentCode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DepartmentName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Description] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [bit] NOT NULL,
	[CreatedBy] [int] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
 CONSTRAINT [PK_DepartmentMasters] PRIMARY KEY CLUSTERED 
(
	[DepartmentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DividendDistributions](
	[DividendId] [int] IDENTITY(1,1) NOT NULL,
	[ShareAccountId] [int] NOT NULL,
	[FinancialYear] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DividendPercentage] [decimal](5, 2) NOT NULL,
	[DividendAmount] [decimal](18, 2) NOT NULL,
	[PayoutDate] [datetime2](7) NOT NULL,
	[IsPaid] [bit] NOT NULL,
	[VoucherId] [int] NULL,
 CONSTRAINT [PK_DividendDistributions] PRIMARY KEY CLUSTERED 
(
	[DividendId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmployeeBankDetails](
	[EmployeeBankDetailID] [int] IDENTITY(1,1) NOT NULL,
	[CIFNo] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[EmployeeID] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DepartmentID] [int] NOT NULL,
	[JoiningDate] [datetime2](7) NOT NULL,
	[EmployeeStatus] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MobileNumber] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[BankName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[IFSCCode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[AccountNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[AccountType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[BranchID] [int] NOT NULL,
	[CreatedBy] [int] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
 CONSTRAINT [PK_EmployeeBankDetails] PRIMARY KEY CLUSTERED 
(
	[EmployeeBankDetailID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmployerMasters](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ContactNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LegacyTypeId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[Address] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_EmployerMasters] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EodBatchProcessLogs](
	[LogID] [bigint] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[BusinessDate] [datetime2](7) NOT NULL,
	[StepNumber] [int] NOT NULL,
	[StepName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[RecordsProcessed] [int] NOT NULL,
	[ErrorMessage] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[StartTime] [datetime2](7) NOT NULL,
	[EndTime] [datetime2](7) NULL,
 CONSTRAINT [PK_EodBatchProcessLogs] PRIMARY KEY CLUSTERED 
(
	[LogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FdAccounts](
	[FdAccountID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[FdSchemeID] [int] NOT NULL,
	[AccountNo] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[OpeningDate] [datetime2](7) NOT NULL,
	[DepositAmount] [decimal](18, 2) NOT NULL,
	[InterestRate] [decimal](5, 2) NOT NULL,
	[MaturityDate] [datetime2](7) NOT NULL,
	[MaturityAmount] [decimal](18, 2) NOT NULL,
	[IsLegacyAccount] [bit] NOT NULL,
	[LegacyAccruedInt] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NomineeName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeRelation] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[LegacyAccountId] [int] NULL,
	[LegacyAccountNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[BankAccountLedgerID] [int] NULL,
	[ChequeDate] [datetime2](7) NULL,
	[ChequeNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PaymentMode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SavingAccountID] [int] NULL,
	[CustomerID] [int] NOT NULL,
 CONSTRAINT [PK_FdAccounts] PRIMARY KEY CLUSTERED 
(
	[FdAccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
CREATE NONCLUSTERED INDEX [IX_FdAccounts_CustomerID] ON [dbo].[FdAccounts]
(
	[CustomerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[FdAccounts] ADD  DEFAULT ('') FOR [PaymentMode]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FdAccountSequences](
	[SequenceID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[ProductType] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CurrentValue] [int] NOT NULL,
 CONSTRAINT [PK_FdAccountSequences] PRIMARY KEY CLUSTERED 
(
	[SequenceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FdInterestAccruals](
	[AccrualID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[FdAccountID] [int] NOT NULL,
	[VoucherID] [int] NOT NULL,
	[AccrualDate] [datetime2](7) NOT NULL,
	[CalculatedDays] [int] NOT NULL,
	[InterestAmount] [decimal](18, 2) NOT NULL,
	[IsPosted] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_FdInterestAccruals] PRIMARY KEY CLUSTERED 
(
	[AccrualID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FdSchemes](
	[FdSchemeID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[SchemeCode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SchemeName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DurationMonths] [int] NOT NULL,
	[InterestRate] [decimal](5, 2) NOT NULL,
	[SeniorCitizenInterestRate] [decimal](5, 2) NOT NULL,
	[InterestType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InterestPostingMethod] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InterestCompoundingFrequency] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MinimumAmount] [decimal](18, 2) NOT NULL,
	[MaximumAmount] [decimal](18, 2) NOT NULL,
	[PrematureInterestRate] [decimal](5, 2) NOT NULL,
	[EffectiveDate] [datetime2](7) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[FdLiabilityLedgerID] [int] NULL,
	[InterestExpenseLedgerID] [int] NULL,
	[InterestPayableLedgerID] [int] NULL,
	[PrematurePenaltyLedgerID] [int] NULL,
 CONSTRAINT [PK_FdSchemes] PRIMARY KEY CLUSTERED 
(
	[FdSchemeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FdTransactions](
	[FdTransactionID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[FdAccountID] [int] NOT NULL,
	[VoucherID] [int] NOT NULL,
	[TransactionDate] [datetime2](7) NOT NULL,
	[TransactionType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DebitCredit] [nvarchar](2) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_FdTransactions] PRIMARY KEY CLUSTERED 
(
	[FdTransactionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FinancialYears](
	[FinancialYearID] [int] IDENTITY(1,1) NOT NULL,
	[YearCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[StartDate] [datetime2](7) NOT NULL,
	[EndDate] [datetime2](7) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[IsClosed] [bit] NOT NULL,
 CONSTRAINT [PK_FinancialYears] PRIMARY KEY CLUSTERED 
(
	[FinancialYearID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[GoldLoanDetails](
	[GoldLoanDetailID] [int] IDENTITY(1,1) NOT NULL,
	[LoanAccountID] [int] NOT NULL,
	[OrnamentName] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Quantity] [int] NOT NULL,
	[GrossWeight] [decimal](18, 3) NOT NULL,
	[NetWeight] [decimal](18, 3) NOT NULL,
	[Purity] [decimal](18, 2) NOT NULL,
	[GoldRatePerGram] [decimal](18, 2) NOT NULL,
	[EstimatedValue] [decimal](18, 2) NOT NULL,
	[ImagePath] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_GoldLoanDetails] PRIMARY KEY CLUSTERED 
(
	[GoldLoanDetailID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InvestmentAccounts](
	[InvestmentAccountID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[InvestmentInstitutionID] [int] NOT NULL,
	[SchemeID] [int] NOT NULL,
	[InvestmentNo] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InvestmentDate] [datetime2](7) NOT NULL,
	[PrincipalAmount] [decimal](18, 2) NOT NULL,
	[InterestRate] [decimal](5, 2) NOT NULL,
	[MaturityDate] [datetime2](7) NOT NULL,
	[ExpectedMaturityAmount] [decimal](18, 2) NOT NULL,
	[AccruedInterestTillMigration] [decimal](18, 2) NOT NULL,
	[BookValue] [decimal](18, 2) NOT NULL,
	[IsLegacyAccount] [bit] NOT NULL,
	[NomineeName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeRelation] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[DepositReceiptNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_InvestmentAccounts] PRIMARY KEY CLUSTERED 
(
	[InvestmentAccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InvestmentAccountSequences](
	[SequenceID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[ProductType] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CurrentValue] [int] NOT NULL,
 CONSTRAINT [PK_InvestmentAccountSequences] PRIMARY KEY CLUSTERED 
(
	[SequenceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InvestmentInstitutions](
	[InstitutionID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionMasterID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[InstitutionName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InstitutionType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InstitutionBranchName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Address] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ContactPerson] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MobileNumber] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[EmailID] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
 CONSTRAINT [PK_InvestmentInstitutions] PRIMARY KEY CLUSTERED 
(
	[InstitutionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InvestmentInterestAccruals](
	[AccrualID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[InvestmentAccountID] [int] NOT NULL,
	[AccrualDate] [datetime2](7) NOT NULL,
	[InterestAmount] [decimal](18, 2) NOT NULL,
	[VoucherID] [int] NULL,
	[IsPosted] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_InvestmentInterestAccruals] PRIMARY KEY CLUSTERED 
(
	[AccrualID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InvestmentInterestReceipts](
	[ReceiptID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[InvestmentAccountID] [int] NOT NULL,
	[ReceiptDate] [datetime2](7) NOT NULL,
	[ReceivedAmount] [decimal](18, 2) NOT NULL,
	[VoucherID] [int] NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_InvestmentInterestReceipts] PRIMARY KEY CLUSTERED 
(
	[ReceiptID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InvestmentMaturities](
	[MaturityID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[InvestmentAccountID] [int] NOT NULL,
	[MaturityDate] [datetime2](7) NOT NULL,
	[PrincipalReceived] [decimal](18, 2) NOT NULL,
	[InterestReceived] [decimal](18, 2) NOT NULL,
	[TotalReceived] [decimal](18, 2) NOT NULL,
	[VoucherID] [int] NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_InvestmentMaturities] PRIMARY KEY CLUSTERED 
(
	[MaturityID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InvestmentPrematureWithdrawals](
	[WithdrawalID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[InvestmentAccountID] [int] NOT NULL,
	[WithdrawalDate] [datetime2](7) NOT NULL,
	[PrincipalPaid] [decimal](18, 2) NOT NULL,
	[RevisedInterestRate] [decimal](5, 2) NOT NULL,
	[InterestPaid] [decimal](18, 2) NOT NULL,
	[PenaltyAmount] [decimal](18, 2) NOT NULL,
	[NetPayout] [decimal](18, 2) NOT NULL,
	[VoucherID] [int] NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_InvestmentPrematureWithdrawals] PRIMARY KEY CLUSTERED 
(
	[WithdrawalID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InvestmentRenewals](
	[RenewalID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[OldInvestmentAccountID] [int] NOT NULL,
	[NewInvestmentAccountID] [int] NOT NULL,
	[RenewalType] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[RenewalAmount] [decimal](18, 2) NOT NULL,
	[RenewalDate] [datetime2](7) NOT NULL,
	[VoucherID] [int] NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_InvestmentRenewals] PRIMARY KEY CLUSTERED 
(
	[RenewalID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InvestmentSchemes](
	[SchemeID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[InvestmentInstitutionID] [int] NOT NULL,
	[SchemeCode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SchemeName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InterestRate] [decimal](5, 2) NOT NULL,
	[DurationMonths] [int] NOT NULL,
	[InterestCalculationMethod] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PrematureWithdrawalRate] [decimal](5, 2) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[InterestIncomeLedgerID] [int] NULL,
	[InterestReceivableLedgerID] [int] NULL,
	[InvestmentAssetLedgerID] [int] NULL,
	[InvestmentType] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 CONSTRAINT [PK_InvestmentSchemes] PRIMARY KEY CLUSTERED 
(
	[SchemeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[InvestmentSchemes] ADD  DEFAULT (N'') FOR [InvestmentType]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InvestmentVoucherMappings](
	[MappingID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[InvestmentType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InvestmentLedgerID] [int] NOT NULL,
	[InterestIncomeLedgerID] [int] NOT NULL,
	[InterestReceivableLedgerID] [int] NOT NULL,
 CONSTRAINT [PK_InvestmentVoucherMappings] PRIMARY KEY CLUSTERED 
(
	[MappingID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[JointMembers](
	[JointMemberID] [int] IDENTITY(1,1) NOT NULL,
	[PrimaryMemberID] [int] NOT NULL,
	[JointMemberCode] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[FirstName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MiddleName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LastName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[FirstNameEng] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MiddleNameEng] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LastNameEng] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[RelationWithPrimary] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AadhaarNo] [nvarchar](12) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PANNo] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MobileNo] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Address] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PhotoPath] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SignaturePath] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[IsDeleted] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
 CONSTRAINT [PK_JointMembers] PRIMARY KEY CLUSTERED 
(
	[JointMemberID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[JointMembers] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[JointMembers] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[JointMembers] ADD  DEFAULT ((1)) FOR [CreatedBy]
GO
ALTER TABLE [dbo].[JointMembers] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedOn]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Ledgers](
	[LedgerID] [int] IDENTITY(1,1) NOT NULL,
	[LedgerName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[GroupID] [int] NOT NULL,
	[OpeningBalance] [decimal](18, 2) NOT NULL,
	[OpeningBalanceType] [nvarchar](2) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ReportType] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AccountType] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ExcludeFromRule35Swanidhi] [bit] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[LegacyLedgerId] [int] NULL,
	[LedgerNameEnglish] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[DisplayOrder] [int] NOT NULL,
	[LedgerCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_Ledgers] PRIMARY KEY CLUSTERED 
(
	[LedgerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[Ledgers] ADD  DEFAULT ((0)) FOR [DisplayOrder]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LegalRecoveryLedgerMappings](
	[MappingId] [int] IDENTITY(1,1) NOT NULL,
	[BranchId] [int] NOT NULL,
	[TransactionType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DebitLedgerId] [int] NOT NULL,
	[CreditLedgerId] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[UpdatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_LegalRecoveryLedgerMappings] PRIMARY KEY CLUSTERED 
(
	[MappingId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD  DEFAULT (getutcdate()) FOR [UpdatedDate]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoanAccountNpaStatuses](
	[LoanAccountNpaStatusID] [int] IDENTITY(1,1) NOT NULL,
	[LoanAccountID] [int] NOT NULL,
	[AsOfDate] [datetime2](7) NOT NULL,
	[OverdueDate] [datetime2](7) NULL,
	[OutOfOrderDate] [datetime2](7) NULL,
	[Category] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SecurityType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[OutstandingBalance] [decimal](18, 2) NOT NULL,
	[CompliantCollateralValue] [decimal](18, 2) NOT NULL,
	[ProvisionRequired] [decimal](18, 2) NOT NULL,
	[ProvisionHeld] [decimal](18, 2) NOT NULL,
	[IsAutoClassified] [bit] NOT NULL,
	[LastClassificationRunId] [int] NOT NULL,
	[AuditorRemarks] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_LoanAccountNpaStatuses] PRIMARY KEY CLUSTERED 
(
	[LoanAccountNpaStatusID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoanAccounts](
	[LoanAccountID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[LoanApplicationID] [int] NULL,
	[MemberID] [int] NULL,
	[CoMemberID] [int] NULL,
	[CoMember2ID] [int] NULL,
	[LoanRateID] [int] NOT NULL,
	[LoanAccountNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PrincipalBalance] [decimal](18, 2) NOT NULL,
	[InterestBalance] [decimal](18, 2) NOT NULL,
	[OverdueInterestBalance] [decimal](18, 2) NOT NULL,
	[OpeningDate] [datetime2](7) NOT NULL,
	[LoanDisbursementDate] [datetime2](7) NULL,
	[SanctionedAmount] [decimal](18, 2) NOT NULL,
	[InterestRate] [decimal](18, 2) NOT NULL,
	[DurationMonths] [int] NOT NULL,
	[InstallmentAmount] [decimal](18, 2) NOT NULL,
	[FirstInstallmentDate] [datetime2](7) NULL,
	[MaturityDate] [datetime2](7) NULL,
	[InstallmentFrequency] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LastInstallmentPaidDate] [datetime2](7) NULL,
	[NoOfInstallments] [int] NOT NULL,
	[RecommendedByDirectorID] [int] NULL,
	[Guarantor1MemberID] [int] NULL,
	[Guarantor2MemberID] [int] NULL,
	[SecurityDetails] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SecurityValue] [decimal](18, 2) NOT NULL,
	[IsOpeningBalance] [bit] NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LegacyAccountId] [int] NULL,
	[LegacyAccountNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CustomerID] [int] NULL,
	[CoCustomerID] [int] NULL,
	[CoCustomer2ID] [int] NULL,
	[Guarantor1CustomerID] [int] NULL,
	[Guarantor2CustomerID] [int] NULL,
 CONSTRAINT [PK_LoanAccounts] PRIMARY KEY CLUSTERED 
(
	[LoanAccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoanApplications](
	[LoanApplicationID] [int] IDENTITY(1,1) NOT NULL,
	[ApplicationNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ApplicationDate] [datetime2](7) NOT NULL,
	[MemberID] [int] NULL,
	[CoMemberID] [int] NULL,
	[CoMember2ID] [int] NULL,
	[LoanRateID] [int] NOT NULL,
	[RequestedAmount] [decimal](18, 2) NOT NULL,
	[InterestRate] [decimal](18, 2) NOT NULL,
	[DurationMonths] [int] NOT NULL,
	[InstallmentFrequency] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InstallmentAmount] [decimal](18, 2) NOT NULL,
	[NoOfInstallments] [int] NOT NULL,
	[FirstInstallmentDate] [datetime2](7) NULL,
	[MaturityDate] [datetime2](7) NULL,
	[RecommendedByDirectorID] [int] NULL,
	[Purpose] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Guarantor1MemberID] [int] NULL,
	[Guarantor2MemberID] [int] NULL,
	[SecurityDetails] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SecurityValue] [decimal](18, 2) NOT NULL,
	[LoanAccountNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CustomerID] [int] NULL,
	[CoCustomerID] [int] NULL,
	[CoCustomer2ID] [int] NULL,
	[Guarantor1CustomerID] [int] NULL,
	[Guarantor2CustomerID] [int] NULL,
 CONSTRAINT [PK_LoanApplications] PRIMARY KEY CLUSTERED 
(
	[LoanApplicationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoanCollectionFees](
	[LoanCollectionFeeID] [int] IDENTITY(1,1) NOT NULL,
	[LoanCollectionID] [int] NOT NULL,
	[LedgerID] [int] NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
 CONSTRAINT [PK_LoanCollectionFees] PRIMARY KEY CLUSTERED 
(
	[LoanCollectionFeeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoanCollections](
	[LoanCollectionID] [int] IDENTITY(1,1) NOT NULL,
	[LoanAccountID] [int] NOT NULL,
	[CollectionDate] [datetime2](7) NOT NULL,
	[ReceiptNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TotalAmountReceived] [decimal](18, 2) NOT NULL,
	[SurchargeCollected] [decimal](18, 2) NOT NULL,
	[PenaltyInterestCollected] [decimal](18, 2) NOT NULL,
	[InterestCollected] [decimal](18, 2) NOT NULL,
	[PrincipalCollected] [decimal](18, 2) NOT NULL,
	[PaymentMode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[BankName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ChequeNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[BankAccountLedgerID] [int] NULL,
	[TransferFromSavingAccountNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[VoucherID] [int] NULL,
	[Remarks] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ApprovedByUserID] [int] NULL,
	[InterestWaived] [decimal](18, 2) NOT NULL,
	[IsOTS] [bit] NOT NULL,
	[PenaltyWaived] [decimal](18, 2) NOT NULL,
	[ResolutionNo] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_LoanCollections] PRIMARY KEY CLUSTERED 
(
	[LoanCollectionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[LoanCollections] ADD  DEFAULT ((0.0)) FOR [InterestWaived]
GO
ALTER TABLE [dbo].[LoanCollections] ADD  DEFAULT (CONVERT([bit],(0),(0))) FOR [IsOTS]
GO
ALTER TABLE [dbo].[LoanCollections] ADD  DEFAULT ((0.0)) FOR [PenaltyWaived]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoanDisbursementDeductions](
	[LoanDisbursementDeductionID] [int] IDENTITY(1,1) NOT NULL,
	[LoanDisbursementID] [int] NOT NULL,
	[LedgerID] [int] NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
 CONSTRAINT [PK_LoanDisbursementDeductions] PRIMARY KEY CLUSTERED 
(
	[LoanDisbursementDeductionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoanDisbursements](
	[LoanDisbursementID] [int] IDENTITY(1,1) NOT NULL,
	[LoanAccountID] [int] NOT NULL,
	[DisbursementDate] [datetime2](7) NOT NULL,
	[SanctionedAmount] [decimal](18, 2) NOT NULL,
	[DisbursementAmount] [decimal](18, 2) NOT NULL,
	[ProcessingFee] [decimal](18, 2) NOT NULL,
	[ShareDeduction] [decimal](18, 2) NOT NULL,
	[InsuranceDeduction] [decimal](18, 2) NOT NULL,
	[StationeryCharges] [decimal](18, 2) NOT NULL,
	[OtherDeductions] [decimal](18, 2) NOT NULL,
	[NetAmountPaid] [decimal](18, 2) NOT NULL,
	[PaymentMode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[BankName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ChequeNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[BankAccountLedgerID] [int] NULL,
	[TransferToSavingAccountNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[VoucherID] [int] NULL,
	[Remarks] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LoanInstallmentType] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_LoanDisbursements] PRIMARY KEY CLUSTERED 
(
	[LoanDisbursementID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoanDocuments](
	[LoanDocumentID] [int] IDENTITY(1,1) NOT NULL,
	[LoanAccountID] [int] NOT NULL,
	[DocumentType] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DocumentName] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[FilePath] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[UploadedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_LoanDocuments] PRIMARY KEY CLUSTERED 
(
	[LoanDocumentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoanInstallmentSchedules](
	[ScheduleID] [int] IDENTITY(1,1) NOT NULL,
	[LoanAccountID] [int] NOT NULL,
	[InstallmentNo] [int] NOT NULL,
	[DueDate] [datetime2](7) NOT NULL,
	[PrincipalAmount] [decimal](18, 2) NOT NULL,
	[InterestAmount] [decimal](18, 2) NOT NULL,
	[TotalAmount] [decimal](18, 2) NOT NULL,
	[BalanceAmount] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PaidDate] [datetime2](7) NULL,
	[OpeningBalance] [decimal](18, 2) NOT NULL,
	[ClosingBalance] [decimal](18, 2) NOT NULL,
	[Days] [int] NOT NULL,
	[InterestRate] [decimal](18, 2) NOT NULL,
 CONSTRAINT [PK_LoanInstallmentSchedules] PRIMARY KEY CLUSTERED 
(
	[ScheduleID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoanRates](
	[LoanRateID] [int] IDENTITY(1,1) NOT NULL,
	[LoanType] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LoanCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LoanLedgerID] [int] NULL,
	[InterestLedgerID] [int] NULL,
	[OverdueInterestLedgerID] [int] NULL,
	[ReceivableInterestLedgerID] [int] NULL,
	[SurchargeLedgerID] [int] NULL,
	[RecoveryFeeLedgerID] [int] NULL,
	[ProcessingFeeLedgerID] [int] NULL,
	[InterestRate] [decimal](18, 2) NOT NULL,
	[OverdueInterestRate] [decimal](18, 2) NOT NULL,
	[InterestPostingType] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InterestCalculationMethod] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ShortName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DurationMonths] [int] NOT NULL,
	[InstallmentType] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InstallmentCount] [int] NOT NULL,
	[LoanInstallmentType] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SecurityType] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[IsCcOrOd] [bit] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[InterestPostingFrequency] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 CONSTRAINT [PK_LoanRates] PRIMARY KEY CLUSTERED 
(
	[LoanRateID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[LoanRates] ADD  DEFAULT ('') FOR [InterestPostingFrequency]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LockerAllotments](
	[AllotmentID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[LockerAccountNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LockerID] [int] NOT NULL,
	[MemberID] [int] NOT NULL,
	[JointMember1_ID] [int] NULL,
	[JointMember2_ID] [int] NULL,
	[OperatingInstruction] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[AllotmentDate] [datetime2](7) NOT NULL,
	[RentStartDate] [datetime2](7) NOT NULL,
	[ExpiryDate] [datetime2](7) NOT NULL,
	[AnnualRent] [decimal](18, 2) NOT NULL,
	[SecurityDepositAmount] [decimal](18, 2) NOT NULL,
	[AdvanceRentPaid] [decimal](18, 2) NOT NULL,
	[LinkedSavingAccountID] [int] NULL,
	[IsAutoDebitEnabled] [bit] NOT NULL,
	[NomineeName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeRelation] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeAge] [int] NULL,
	[NomineeAadhaar] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeAddress] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[DepositVoucherID] [int] NULL,
	[AdvanceRentVoucherID] [int] NULL,
	[Status] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CustomerID] [int] NULL,
 CONSTRAINT [PK_LockerAllotments] PRIMARY KEY CLUSTERED 
(
	[AllotmentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LockerRentPostings](
	[PostingID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[AllotmentID] [int] NOT NULL,
	[FinancialYear] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[FromDate] [datetime2](7) NOT NULL,
	[ToDate] [datetime2](7) NOT NULL,
	[RentAmount] [decimal](18, 2) NOT NULL,
	[GstAmount] [decimal](18, 2) NOT NULL,
	[PenaltyAmount] [decimal](18, 2) NOT NULL,
	[TotalAmount] [decimal](18, 2) NOT NULL,
	[PaymentMode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PaymentDate] [datetime2](7) NULL,
	[ReceiptNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[VoucherID] [int] NULL,
	[IsPaid] [bit] NOT NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_LockerRentPostings] PRIMARY KEY CLUSTERED 
(
	[PostingID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Lockers](
	[LockerID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[CabinetNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LockerNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[KeyNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LockerTypeID] [int] NOT NULL,
	[Status] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_Lockers] PRIMARY KEY CLUSTERED 
(
	[LockerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LockerSurrenders](
	[SurrenderID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[AllotmentID] [int] NOT NULL,
	[SurrenderDate] [datetime2](7) NOT NULL,
	[KeyReceived] [bit] NOT NULL,
	[KeysCondition] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DepositAmount] [decimal](18, 2) NOT NULL,
	[UnpaidRentDeduction] [decimal](18, 2) NOT NULL,
	[DamagePenaltyDeduction] [decimal](18, 2) NOT NULL,
	[NetRefundAmount] [decimal](18, 2) NOT NULL,
	[RefundPaymentMode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[VoucherID] [int] NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_LockerSurrenders] PRIMARY KEY CLUSTERED 
(
	[SurrenderID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LockerTypes](
	[LockerTypeID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[TypeCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TypeName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Dimensions] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AnnualRent] [decimal](18, 2) NOT NULL,
	[SecurityDeposit] [decimal](18, 2) NOT NULL,
	[LateFeePerMonth] [decimal](18, 2) NOT NULL,
	[GstRate] [decimal](5, 2) NOT NULL,
	[DepositLiabilityLedgerID] [int] NULL,
	[RentIncomeLedgerID] [int] NULL,
	[LateFeeIncomeLedgerID] [int] NULL,
	[GstLiabilityLedgerID] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_LockerTypes] PRIMARY KEY CLUSTERED 
(
	[LockerTypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LockerVisitRegisters](
	[VisitID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[AllotmentID] [int] NOT NULL,
	[VisitDate] [datetime2](7) NOT NULL,
	[TimeIn] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TimeOut] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[OperatedBy] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[OperatorName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[IsSignatureVerified] [bit] NOT NULL,
	[BankOfficerName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_LockerVisitRegisters] PRIMARY KEY CLUSTERED 
(
	[VisitID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MemberOpeningBalances](
	[MemberOpeningBalanceID] [int] IDENTITY(1,1) NOT NULL,
	[MemberID] [int] NOT NULL,
	[LedgerID] [int] NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[BalanceType] [nvarchar](2) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
	[CustomerID] [int] NULL,
 CONSTRAINT [PK_MemberOpeningBalances] PRIMARY KEY CLUSTERED 
(
	[MemberOpeningBalanceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
CREATE NONCLUSTERED INDEX [IX_MemberOpeningBalances_CustomerID] ON [dbo].[MemberOpeningBalances]
(
	[CustomerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Members](
	[MemberID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[MemberCode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[JoiningDate] [datetime2](7) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
	[LegacyMemberNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MembershipType] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[IsDeleted] [bit] NOT NULL,
	[CustomerID] [int] NULL,
 CONSTRAINT [PK_Members] PRIMARY KEY CLUSTERED 
(
	[MemberID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_CustomerID] ON [dbo].[Members]
(
	[CustomerID] ASC
)
WHERE ([CustomerID] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON

GO
CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_MemberCode] ON [dbo].[Members]
(
	[MemberCode] ASC
)
WHERE ([MemberCode] IS NOT NULL AND [MemberCode]<>'' AND [IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Members] ADD  DEFAULT ('Regular') FOR [MembershipType]
GO
ALTER TABLE [dbo].[Members] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[Members]  WITH CHECK ADD  CONSTRAINT [FK_Members_Customers_CustomerID] FOREIGN KEY([CustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[Members] CHECK CONSTRAINT [FK_Members_Customers_CustomerID]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NpaClassificationRuns](
	[NpaClassificationRunID] [int] IDENTITY(1,1) NOT NULL,
	[RunDate] [datetime2](7) NOT NULL,
	[TriggeredBy] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[RecordsProcessed] [int] NOT NULL,
	[Status] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_NpaClassificationRuns] PRIMARY KEY CLUSTERED 
(
	[NpaClassificationRunID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NpaConfigs](
	[FinancialYear] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ConcessionPeriodDays] [int] NOT NULL,
 CONSTRAINT [PK_NpaConfigs] PRIMARY KEY CLUSTERED 
(
	[FinancialYear] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NpaProvisionSlabs](
	[NpaProvisionSlabID] [int] IDENTITY(1,1) NOT NULL,
	[FinancialYear] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Category] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SecurityType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[OverdueOrOutOfOrderMonthsFrom] [decimal](18, 2) NOT NULL,
	[OverdueOrOutOfOrderMonthsTo] [decimal](18, 2) NOT NULL,
	[NpaMonthsFrom] [decimal](18, 2) NOT NULL,
	[NpaMonthsTo] [decimal](18, 2) NOT NULL,
	[MinProvisionPercent] [decimal](18, 2) NOT NULL,
 CONSTRAINT [PK_NpaProvisionSlabs] PRIMARY KEY CLUSTERED 
(
	[NpaProvisionSlabID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OverdueInterestLedgers](
	[OverdueInterestLedgerID] [int] IDENTITY(1,1) NOT NULL,
	[LoanAccountID] [int] NOT NULL,
	[TransactionDate] [datetime2](7) NOT NULL,
	[DebitAmount] [decimal](18, 2) NOT NULL,
	[CreditAmount] [decimal](18, 2) NOT NULL,
	[VoucherID] [int] NULL,
	[Particulars] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 CONSTRAINT [PK_OverdueInterestLedgers] PRIMARY KEY CLUSTERED 
(
	[OverdueInterestLedgerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OverdueRecoveryLedgers](
	[OverdueRecoveryLedgerID] [int] IDENTITY(1,1) NOT NULL,
	[LoanAccountID] [int] NOT NULL,
	[TransactionDate] [datetime2](7) NOT NULL,
	[DebitAmount] [decimal](18, 2) NOT NULL,
	[CreditAmount] [decimal](18, 2) NOT NULL,
	[VoucherID] [int] NULL,
	[Particulars] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 CONSTRAINT [PK_OverdueRecoveryLedgers] PRIMARY KEY CLUSTERED 
(
	[OverdueRecoveryLedgerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyAccounts](
	[PigmyAccountID] [int] IDENTITY(1,1) NOT NULL,
	[AccountNo] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[BranchID] [int] NOT NULL,
	[PigmySchemeID] [int] NOT NULL,
	[PigmyAgentID] [int] NOT NULL,
	[OpeningDate] [datetime2](7) NOT NULL,
	[InterestRate] [decimal](5, 2) NOT NULL,
	[MaturityDate] [datetime2](7) NOT NULL,
	[TotalDepositedAmount] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[LegacyAccountId] [int] NULL,
	[LegacyAccountNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CustomerID] [int] NOT NULL,
 CONSTRAINT [PK_PigmyAccounts] PRIMARY KEY CLUSTERED 
(
	[PigmyAccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
CREATE NONCLUSTERED INDEX [IX_PigmyAccounts_CustomerID] ON [dbo].[PigmyAccounts]
(
	[CustomerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[PigmyAccounts]  WITH CHECK ADD  CONSTRAINT [FK_PigmyAccounts_Customers_CustomerID] FOREIGN KEY([CustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[PigmyAccounts] CHECK CONSTRAINT [FK_PigmyAccounts_Customers_CustomerID]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyAccountSequences](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[LastSequenceNumber] [int] NOT NULL,
 CONSTRAINT [PK_PigmyAccountSequences] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyAgentCashDeposits](
	[DepositId] [int] IDENTITY(1,1) NOT NULL,
	[AgentId] [int] NOT NULL,
	[DepositDate] [datetime2](7) NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[ReceiptNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Narration] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[VoucherId] [int] NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[PaymentMode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 CONSTRAINT [PK_PigmyAgentCashDeposits] PRIMARY KEY CLUSTERED 
(
	[DepositId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[PigmyAgentCashDeposits] ADD  DEFAULT ('') FOR [PaymentMode]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyAgentCommissions](
	[CommissionId] [int] IDENTITY(1,1) NOT NULL,
	[AgentId] [int] NOT NULL,
	[CalculationFrequency] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PeriodStartDate] [datetime2](7) NOT NULL,
	[PeriodEndDate] [datetime2](7) NOT NULL,
	[TotalCollectionAmount] [decimal](18, 2) NOT NULL,
	[CalculatedCommission] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[VoucherId] [int] NULL,
	[CalculatedOn] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_PigmyAgentCommissions] PRIMARY KEY CLUSTERED 
(
	[CommissionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyAgents](
	[PigmyAgentID] [int] IDENTITY(1,1) NOT NULL,
	[AgentName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MobileNo] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[JoiningDate] [datetime2](7) NULL,
	[BranchID] [int] NULL,
	[MaxCashLimit] [decimal](18, 2) NOT NULL,
	[PasswordHash] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Pin] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_PigmyAgents] PRIMARY KEY CLUSTERED 
(
	[PigmyAgentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[PigmyAgents] ADD  DEFAULT ((20000.00)) FOR [MaxCashLimit]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyCollections](
	[CollectionId] [bigint] IDENTITY(1,1) NOT NULL,
	[PigmyAccountId] [int] NOT NULL,
	[AgentId] [int] NOT NULL,
	[CollectionDate] [datetime2](7) NOT NULL,
	[OpeningBalance] [decimal](18, 2) NOT NULL,
	[CollectionAmount] [decimal](18, 2) NOT NULL,
	[ClosingBalance] [decimal](18, 2) NOT NULL,
	[ReceiptNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CollectionSource] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ImportBatchId] [uniqueidentifier] NULL,
	[SyncReferenceId] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsVoucherGenerated] [bit] NOT NULL,
	[VoucherId] [int] NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[TransactionId] [nvarchar](64) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PaymentMode] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Notes] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_PigmyCollections] PRIMARY KEY CLUSTERED 
(
	[CollectionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_PADDING ON

GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_PigmyCollections_TransactionId] ON [dbo].[PigmyCollections]
(
	[TransactionId] ASC
)
WHERE ([TransactionId] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[PigmyCollections] ADD  DEFAULT ('CASH') FOR [PaymentMode]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyCommissionSettings](
	[SettingId] [int] IDENTITY(1,1) NOT NULL,
	[AgentId] [int] NULL,
	[CommissionType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CommissionValue] [decimal](5, 2) NOT NULL,
	[CalculationFrequency] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[EffectiveFrom] [datetime2](7) NOT NULL,
	[EffectiveTo] [datetime2](7) NULL,
	[IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_PigmyCommissionSettings] PRIMARY KEY CLUSTERED 
(
	[SettingId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyInterestLogs](
	[LogId] [int] IDENTITY(1,1) NOT NULL,
	[PigmyAccountId] [int] NOT NULL,
	[CalculationDate] [datetime2](7) NOT NULL,
	[PeriodStartDate] [datetime2](7) NOT NULL,
	[PeriodEndDate] [datetime2](7) NOT NULL,
	[InterestAmount] [decimal](18, 2) NOT NULL,
	[VoucherId] [int] NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_PigmyInterestLogs] PRIMARY KEY CLUSTERED 
(
	[LogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyOpeningBalances](
	[PigmyOpeningBalanceID] [int] IDENTITY(1,1) NOT NULL,
	[PigmyAccountID] [int] NOT NULL,
	[FinancialYear] [nvarchar](9) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[AsOfDate] [datetime2](7) NOT NULL,
	[MigratedBalanceAmount] [decimal](18, 2) NOT NULL,
	[MigrationRemarks] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsPostedToLedger] [bit] NOT NULL,
	[MigratedBy] [int] NOT NULL,
	[MigratedOn] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_PigmyOpeningBalances] PRIMARY KEY CLUSTERED 
(
	[PigmyOpeningBalanceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmySchemes](
	[PigmySchemeID] [int] IDENTITY(1,1) NOT NULL,
	[SchemeName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InterestRate] [decimal](5, 2) NOT NULL,
	[DurationMonths] [int] NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[PigmyLiabilityLedgerID] [int] NULL,
	[CommissionExpenseLedgerID] [int] NULL,
	[InterestExpenseLedgerID] [int] NULL,
	[InterestPayableLedgerID] [int] NULL,
	[SchemeCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_PigmySchemes] PRIMARY KEY CLUSTERED 
(
	[PigmySchemeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyTransactions](
	[PigmyTransactionID] [int] IDENTITY(1,1) NOT NULL,
	[PigmyAccountID] [int] NOT NULL,
	[TransactionDate] [datetime2](7) NOT NULL,
	[ValueDate] [datetime2](7) NOT NULL,
	[TransactionType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DrAmount] [decimal](18, 2) NOT NULL,
	[CrAmount] [decimal](18, 2) NOT NULL,
	[BalanceAmount] [decimal](18, 2) NOT NULL,
	[Narration] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ReferenceId] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MakerId] [int] NOT NULL,
	[PostedOn] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_PigmyTransactions] PRIMARY KEY CLUSTERED 
(
	[PigmyTransactionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PigmyVoucherMappings](
	[MappingId] [int] IDENTITY(1,1) NOT NULL,
	[BranchId] [int] NOT NULL,
	[CollectionSource] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DebitLedgerId] [int] NOT NULL,
	[CreditLedgerId] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_PigmyVoucherMappings] PRIMARY KEY CLUSTERED 
(
	[MappingId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RdAccounts](
	[RdAccountID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[RdSchemeID] [int] NOT NULL,
	[AccountNo] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[OpeningDate] [datetime2](7) NOT NULL,
	[InstallmentAmount] [decimal](18, 2) NOT NULL,
	[DurationMonths] [int] NOT NULL,
	[InterestRate] [decimal](5, 2) NOT NULL,
	[MaturityDate] [datetime2](7) NOT NULL,
	[MaturityAmount] [decimal](18, 2) NOT NULL,
	[TotalPaidInstallments] [int] NOT NULL,
	[TotalDepositedAmount] [decimal](18, 2) NOT NULL,
	[IsLegacyAccount] [bit] NOT NULL,
	[LegacyAccruedInt] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NomineeName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeRelation] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Remarks] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[LegacyAccountId] [int] NULL,
	[LegacyAccountNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AccountType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[AgentID] [int] NULL,
	[GuardianName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GuardianRelation] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MaturityInstruction] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PassbookNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PaymentMode] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SavingAccountID] [int] NULL,
	[CustomerID] [int] NOT NULL,
	[JointCustomerID] [int] NULL,
	[JointMemberID] [int] NULL,
 CONSTRAINT [PK_RdAccounts] PRIMARY KEY CLUSTERED 
(
	[RdAccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
CREATE NONCLUSTERED INDEX [IX_RdAccounts_CustomerID] ON [dbo].[RdAccounts]
(
	[CustomerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_RdAccounts_JointCustomerID] ON [dbo].[RdAccounts]
(
	[JointCustomerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[RdAccounts] ADD  DEFAULT (N'') FOR [AccountType]
GO
ALTER TABLE [dbo].[RdAccounts] ADD  DEFAULT (N'') FOR [MaturityInstruction]
GO
ALTER TABLE [dbo].[RdAccounts] ADD  DEFAULT (N'') FOR [PaymentMode]
GO
ALTER TABLE [dbo].[RdAccounts]  WITH CHECK ADD  CONSTRAINT [FK_RdAccounts_Customers_CustomerID] FOREIGN KEY([CustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[RdAccounts] CHECK CONSTRAINT [FK_RdAccounts_Customers_CustomerID]
GO
ALTER TABLE [dbo].[RdAccounts]  WITH CHECK ADD  CONSTRAINT [FK_RdAccounts_Customers_JointCustomerID] FOREIGN KEY([JointCustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[RdAccounts] CHECK CONSTRAINT [FK_RdAccounts_Customers_JointCustomerID]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RdAccountSequences](
	[SequenceID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[ProductType] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CurrentValue] [int] NOT NULL,
 CONSTRAINT [PK_RdAccountSequences] PRIMARY KEY CLUSTERED 
(
	[SequenceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RdInterestAccruals](
	[AccrualID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[RdAccountID] [int] NOT NULL,
	[VoucherID] [int] NOT NULL,
	[AccrualDate] [datetime2](7) NOT NULL,
	[InterestAmount] [decimal](18, 2) NOT NULL,
	[IsPosted] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_RdInterestAccruals] PRIMARY KEY CLUSTERED 
(
	[AccrualID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RdSchemes](
	[RdSchemeID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[SchemeCode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SchemeName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DurationMonths] [int] NOT NULL,
	[InstallmentAmount] [decimal](18, 2) NOT NULL,
	[MinimumInstallment] [decimal](18, 2) NOT NULL,
	[MaximumInstallment] [decimal](18, 2) NOT NULL,
	[InterestRate] [decimal](5, 2) NOT NULL,
	[InterestMethod] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PenaltyAmount] [decimal](18, 2) NOT NULL,
	[EffectiveDate] [datetime2](7) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[RdLiabilityLedgerID] [int] NULL,
	[InterestExpenseLedgerID] [int] NULL,
	[InterestPayableLedgerID] [int] NULL,
	[PenaltyIncomeLedgerID] [int] NULL,
	[PrematurePenaltyRate] [decimal](18, 2) NOT NULL,
 CONSTRAINT [PK_RdSchemes] PRIMARY KEY CLUSTERED 
(
	[RdSchemeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[RdSchemes] ADD  DEFAULT ((0)) FOR [PrematurePenaltyRate]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RdTransactions](
	[RdTransactionID] [int] IDENTITY(1,1) NOT NULL,
	[InstitutionID] [int] NOT NULL,
	[BranchID] [int] NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[RdAccountID] [int] NOT NULL,
	[VoucherID] [int] NOT NULL,
	[TransactionDate] [datetime2](7) NOT NULL,
	[TransactionType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[InstallmentNo] [int] NULL,
	[DebitCredit] [nvarchar](2) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PrincipalAmount] [decimal](18, 2) NOT NULL,
	[PenaltyAmount] [decimal](18, 2) NOT NULL,
	[InterestAmount] [decimal](18, 2) NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_RdTransactions] PRIMARY KEY CLUSTERED 
(
	[RdTransactionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RolePermissions](
	[RolePermissionID] [int] IDENTITY(1,1) NOT NULL,
	[RoleID] [int] NOT NULL,
	[ModuleCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CanView] [bit] NOT NULL,
	[CanAdd] [bit] NOT NULL,
	[CanEdit] [bit] NOT NULL,
	[CanDelete] [bit] NOT NULL,
	[CanPrint] [bit] NOT NULL,
	[CanApprove] [bit] NOT NULL,
	[ScopeLevel] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 CONSTRAINT [PK_RolePermissions] PRIMARY KEY CLUSTERED 
(
	[RolePermissionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Roles](
	[RoleID] [int] IDENTITY(1,1) NOT NULL,
	[RoleName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Description] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsSystemRole] [bit] NOT NULL,
	[RoleCode] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Status] [bit] NOT NULL,
 CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED 
(
	[RoleID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT ((0)) FOR [IsSystemRole]
GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT ('') FOR [RoleCode]
GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT ((0)) FOR [Status]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SansthaDetails](
	[SansthaID] [int] IDENTITY(1,1) NOT NULL,
	[SansthaName] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Address] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ContactNo] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Email] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[RegistrationNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GSTNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LogoPath] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsMigrationLocked] [bit] NOT NULL,
	[AutoPostVouchers] [bit] NOT NULL,
	[AutoPostVoucherLimit] [decimal](18, 2) NOT NULL,
	[District] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PinCode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[RegistrationDate] [datetime2](7) NULL,
	[State] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Taluka] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Village] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsMobileCompulsory] [bit] NOT NULL,
	[IsAadhaarCompulsory] [bit] NOT NULL,
	[IsPanCompulsory] [bit] NOT NULL,
 CONSTRAINT [PK_SansthaDetails] PRIMARY KEY CLUSTERED 
(
	[SansthaID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[SansthaDetails] ADD  DEFAULT (CONVERT([bit],(0),(0))) FOR [AutoPostVouchers]
GO
ALTER TABLE [dbo].[SansthaDetails] ADD  DEFAULT ((0)) FOR [AutoPostVoucherLimit]
GO
ALTER TABLE [dbo].[SansthaDetails] ADD  DEFAULT ((1)) FOR [IsMobileCompulsory]
GO
ALTER TABLE [dbo].[SansthaDetails] ADD  DEFAULT ((1)) FOR [IsAadhaarCompulsory]
GO
ALTER TABLE [dbo].[SansthaDetails] ADD  DEFAULT ((0)) FOR [IsPanCompulsory]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SavingAccountClosings](
	[ClosingID] [int] IDENTITY(1,1) NOT NULL,
	[SavingAccountID] [int] NOT NULL,
	[ClosureDate] [datetime2](7) NOT NULL,
	[GrossBalance] [decimal](18, 2) NOT NULL,
	[ClosingCharges] [decimal](18, 2) NOT NULL,
	[NetPayable] [decimal](18, 2) NOT NULL,
	[PaymentMode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[VoucherNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_SavingAccountClosings] PRIMARY KEY CLUSTERED 
(
	[ClosingID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SavingAccountJointHolders](
	[JointHolderID] [int] IDENTITY(1,1) NOT NULL,
	[SavingAccountID] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[CustomerID] [int] NULL,
 CONSTRAINT [PK_SavingAccountJointHolders] PRIMARY KEY CLUSTERED 
(
	[JointHolderID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SavingAccountMasters](
	[SavingAccountID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[AccountNo] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[AccountType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[OpeningDate] [datetime2](7) NOT NULL,
	[IsLegacyAccount] [bit] NOT NULL,
	[LedgerID] [int] NOT NULL,
	[OpeningBalance] [decimal](18, 2) NOT NULL,
	[CurrentBalance] [decimal](18, 2) NOT NULL,
	[InterestRate] [decimal](5, 2) NOT NULL,
	[MinimumBalance] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ClosingDate] [datetime2](7) NULL,
	[NomineeName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeRelation] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NomineeAddress] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedOn] [datetime2](7) NULL,
	[LegacyAccountId] [int] NULL,
	[LegacyAccountNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LienAmount] [decimal](18, 2) NOT NULL,
	[LienReason] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CustomerID] [int] NULL,
	[LastInterestPostingDate] [datetime2](7) NULL,
	[LastInterestAmount] [decimal](18, 2) NULL,
	[OldAccountNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_SavingAccountMasters] PRIMARY KEY CLUSTERED 
(
	[SavingAccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[SavingAccountMasters] ADD  DEFAULT ((0.0)) FOR [LienAmount]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SavingInterestPostings](
	[PostingID] [int] IDENTITY(1,1) NOT NULL,
	[FinancialYearID] [int] NOT NULL,
	[PeriodStart] [datetime2](7) NOT NULL,
	[PeriodEnd] [datetime2](7) NOT NULL,
	[TotalInterest] [decimal](18, 2) NOT NULL,
	[VoucherNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PostedOn] [datetime2](7) NOT NULL,
	[PostedBy] [int] NOT NULL,
 CONSTRAINT [PK_SavingInterestPostings] PRIMARY KEY CLUSTERED 
(
	[PostingID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SavingInterestSettings](
	[SettingID] [int] IDENTITY(1,1) NOT NULL,
	[InterestRate] [decimal](5, 2) NOT NULL,
	[CalculationMethod] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PostingFrequency] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[EffectiveDate] [datetime2](7) NOT NULL,
	[LedgerID] [int] NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[SchemeName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SavingLiabilityLedgerID] [int] NULL,
	[InterestExpenseLedgerID] [int] NULL,
	[InterestPayableLedgerID] [int] NULL,
	[SchemeCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_SavingInterestSettings] PRIMARY KEY CLUSTERED 
(
	[SettingID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SavingPassbooks](
	[PassbookLogID] [int] IDENTITY(1,1) NOT NULL,
	[SavingAccountID] [int] NOT NULL,
	[TransactionID] [int] NOT NULL,
	[PrintedLineNo] [int] NOT NULL,
	[PrintedPageNo] [int] NOT NULL,
	[PrintedOn] [datetime2](7) NOT NULL,
	[PrintedBy] [int] NOT NULL,
 CONSTRAINT [PK_SavingPassbooks] PRIMARY KEY CLUSTERED 
(
	[PassbookLogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SavingTransactions](
	[TransactionID] [int] IDENTITY(1,1) NOT NULL,
	[SavingAccountID] [int] NOT NULL,
	[TransactionDate] [datetime2](7) NOT NULL,
	[TransactionType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PaymentMode] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[BalanceAfterTxn] [decimal](18, 2) NOT NULL,
	[Narration] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[VoucherNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsPrintedOnPassbook] [bit] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[TargetSavingAccountID] [int] NULL,
	[CustomerID] [int] NOT NULL,
 CONSTRAINT [PK_SavingTransactions] PRIMARY KEY CLUSTERED 
(
	[TransactionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[SavingTransactions] ADD  DEFAULT ((1)) FOR [CustomerID]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SavingVoucherMappings](
	[MappingID] [int] IDENTITY(1,1) NOT NULL,
	[OperationType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LedgerID] [int] NOT NULL,
	[Description] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_SavingVoucherMappings] PRIMARY KEY CLUSTERED 
(
	[MappingID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sec101AttachmentAuctions](
	[ExecutionId] [int] IDENTITY(1,1) NOT NULL,
	[CaseId] [int] NOT NULL,
	[SroName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ExecutionType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PropertyDetails] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ValuationAmount] [decimal](18, 2) NOT NULL,
	[WarrantIssueDate] [datetime2](7) NULL,
	[PanchanamaDate] [datetime2](7) NULL,
	[AuctionNoticeDate] [datetime2](7) NULL,
	[AuctionDate] [datetime2](7) NULL,
	[ReservePrice] [decimal](18, 2) NOT NULL,
	[HighestBidAmount] [decimal](18, 2) NOT NULL,
	[BuyerName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[BuyerContact] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SaleCertificateDate] [datetime2](7) NULL,
	[SaleCertificateNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[ExecutionOrderNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[OrderDate] [datetime2](7) NULL,
	[EmployerName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[EmployerAddress] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MonthlyDeductionAmount] [decimal](18, 2) NOT NULL,
	[EstimatedValue] [decimal](18, 2) NOT NULL,
	[ExecutionStatus] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[RecoveredAmount] [decimal](18, 2) NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_Sec101AttachmentAuctions] PRIMARY KEY CLUSTERED 
(
	[ExecutionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD  DEFAULT ((0)) FOR [MonthlyDeductionAmount]
GO
ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD  DEFAULT ((0)) FOR [EstimatedValue]
GO
ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD  DEFAULT ((0)) FOR [RecoveredAmount]
GO
ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sec101CaseMasters](
	[CaseId] [int] IDENTITY(1,1) NOT NULL,
	[BranchId] [int] NOT NULL,
	[LoanAccountId] [int] NOT NULL,
	[MemberId] [int] NOT NULL,
	[CaseNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CourtName] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[AdvocateName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[FilingDate] [datetime2](7) NOT NULL,
	[PrincipalClaim] [decimal](18, 2) NOT NULL,
	[InterestClaim] [decimal](18, 2) NOT NULL,
	[PenalInterestClaim] [decimal](18, 2) NOT NULL,
	[OtherChargesClaim] [decimal](18, 2) NOT NULL,
	[TotalClaimAmount] [decimal](18, 2) NOT NULL,
	[CourtFeeAmount] [decimal](18, 2) NOT NULL,
	[CourtFeeChallanNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CertificateNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CertificateDate] [datetime2](7) NULL,
	[SanctionedAmount] [decimal](18, 2) NULL,
	[FutureInterestRate] [decimal](18, 2) NULL,
	[Status] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CertificateNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GrantedAmount] [decimal](18, 2) NOT NULL,
	[GrantedInterestRate] [decimal](18, 2) NOT NULL,
	[CaseStatus] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_Sec101CaseMasters] PRIMARY KEY CLUSTERED 
(
	[CaseId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[Sec101CaseMasters] ADD  DEFAULT ((0)) FOR [GrantedAmount]
GO
ALTER TABLE [dbo].[Sec101CaseMasters] ADD  DEFAULT ((0)) FOR [GrantedInterestRate]
GO
ALTER TABLE [dbo].[Sec101CaseMasters] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sec101HearingLogs](
	[HearingId] [int] IDENTITY(1,1) NOT NULL,
	[CaseId] [int] NOT NULL,
	[HearingDate] [datetime2](7) NOT NULL,
	[NextHearingDate] [datetime2](7) NULL,
	[Stage] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[BorrowerPresence] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[GuarantorPresence] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CourtOrderSummary] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AdvocateNotes] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[HearingLogId] [int] NULL,
	[HearingStage] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PresenceType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NextHearingPurpose] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_Sec101HearingLogs] PRIMARY KEY CLUSTERED 
(
	[HearingId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[Sec101HearingLogs] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sec101LegalExpenses](
	[ExpenseId] [int] IDENTITY(1,1) NOT NULL,
	[BranchId] [int] NOT NULL,
	[CaseId] [int] NULL,
	[LoanAccountId] [int] NOT NULL,
	[ExpenseType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[ExpenseDate] [datetime2](7) NOT NULL,
	[PaidTo] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[VoucherId] [int] NULL,
	[IsDebitedToLoan] [bit] NOT NULL,
	[Remarks] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[LegalExpenseId] [int] NULL,
	[PayeeName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PaymentMode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[VoucherNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[IsDebitedToBorrower] [bit] NOT NULL,
	[DebitLedgerId] [int] NULL,
	[CreditLedgerId] [int] NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_Sec101LegalExpenses] PRIMARY KEY CLUSTERED 
(
	[ExpenseId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[Sec101LegalExpenses] ADD  DEFAULT ((0)) FOR [IsDebitedToBorrower]
GO
ALTER TABLE [dbo].[Sec101LegalExpenses] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sec101NoticeHistories](
	[NoticeId] [int] IDENTITY(1,1) NOT NULL,
	[BranchId] [int] NOT NULL,
	[LoanAccountId] [int] NOT NULL,
	[MemberId] [int] NOT NULL,
	[NoticeType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NoticeNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NoticeDate] [datetime2](7) NOT NULL,
	[DueDate] [datetime2](7) NOT NULL,
	[PrincipalDue] [decimal](18, 2) NOT NULL,
	[InterestDue] [decimal](18, 2) NOT NULL,
	[PenalInterestDue] [decimal](18, 2) NOT NULL,
	[NoticeFee] [decimal](18, 2) NOT NULL,
	[TotalDemandAmount] [decimal](18, 2) NOT NULL,
	[PostalTrackingNo] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[PostalStatus] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DeliveredDate] [datetime2](7) NULL,
	[Remarks] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_Sec101NoticeHistories] PRIMARY KEY CLUSTERED 
(
	[NoticeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[Sec101NoticeHistories] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityTypes](
	[SecurityTypeID] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_SecurityTypes] PRIMARY KEY CLUSTERED 
(
	[SecurityTypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ShareAccounts](
	[ShareAccountId] [int] IDENTITY(1,1) NOT NULL,
	[AccountNo] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MemberId] [int] NOT NULL,
	[TotalShareAmount] [decimal](18, 2) NOT NULL,
	[TotalShareCount] [int] NOT NULL,
	[DividendPayableBalance] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[OpeningDate] [datetime2](7) NOT NULL,
	[LegacyAccountId] [int] NULL,
	[LegacyAccountNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CustomerID] [int] NOT NULL,
 CONSTRAINT [PK_ShareAccounts] PRIMARY KEY CLUSTERED 
(
	[ShareAccountId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[ShareAccounts] ADD  DEFAULT ((0)) FOR [CustomerID]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ShareCertificatePrintHistories](
	[PrintHistoryId] [int] IDENTITY(1,1) NOT NULL,
	[CertificateId] [int] NOT NULL,
	[ActionType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PrintedBy] [int] NOT NULL,
	[PrintedOn] [datetime2](7) NOT NULL,
	[IPAddress] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_ShareCertificatePrintHistories] PRIMARY KEY CLUSTERED 
(
	[PrintHistoryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ShareCertificates](
	[CertificateId] [int] IDENTITY(1,1) NOT NULL,
	[ShareAccountId] [int] NOT NULL,
	[CertificateNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[IssueDate] [datetime2](7) NOT NULL,
	[FromShareNo] [bigint] NOT NULL,
	[ToShareNo] [bigint] NOT NULL,
	[NumberOfShares] [int] NOT NULL,
	[FaceValue] [decimal](18, 2) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PrintCount] [int] NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime2](7) NULL,
	[CancellationReason] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[CustomerID] [int] NOT NULL,
 CONSTRAINT [PK_ShareCertificates] PRIMARY KEY CLUSTERED 
(
	[CertificateId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[ShareCertificates] ADD  DEFAULT ((0)) FOR [CustomerID]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ShareSchemes](
	[ShareSchemeId] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[SchemeCode] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SchemeName] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MemberType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ShareFaceValue] [decimal](18, 2) NOT NULL,
	[MinSharesCount] [int] NOT NULL,
	[MaxSharesCount] [int] NOT NULL,
	[EntranceFee] [decimal](18, 2) NOT NULL,
	[BuildingFund] [decimal](18, 2) NOT NULL,
	[ShareTransferFee] [decimal](18, 2) NOT NULL,
	[DividendRate] [decimal](18, 2) NOT NULL,
	[HasVotingRights] [bit] NOT NULL,
	[IsAadhaarCompulsory] [bit] NOT NULL,
	[IsPanCompulsory] [bit] NOT NULL,
	[LoanEligibilityMultiplier] [int] NOT NULL,
	[EffectiveDate] [datetime2](7) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[ShareCapitalLedgerID] [int] NULL,
	[EntranceFeeLedgerID] [int] NULL,
	[ShareTransferFeeLedgerID] [int] NULL,
	[BuildingFundLedgerID] [int] NULL,
	[DividendPayableLedgerID] [int] NULL,
	[IsMobileCompulsory] [bit] NOT NULL,
 CONSTRAINT [PK_ShareSchemes] PRIMARY KEY CLUSTERED 
(
	[ShareSchemeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[ShareSchemes] ADD  DEFAULT ((1)) FOR [IsMobileCompulsory]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ShareTransactions](
	[TransactionId] [int] IDENTITY(1,1) NOT NULL,
	[ShareAccountId] [int] NOT NULL,
	[TransactionDate] [datetime2](7) NOT NULL,
	[TransactionType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NumberOfShares] [int] NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[Narration] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[VoucherId] [int] NULL,
	[CustomerID] [int] NOT NULL,
 CONSTRAINT [PK_ShareTransactions] PRIMARY KEY CLUSTERED 
(
	[TransactionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
ALTER TABLE [dbo].[ShareTransactions] ADD  DEFAULT ((0)) FOR [CustomerID]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SystemNotifications](
	[NotificationID] [bigint] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[UserID] [int] NULL,
	[RoleName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ModuleName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NotificationType] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Title] [nvarchar](250) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Description] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Priority] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TargetTab] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[EntityName] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[EntityID] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Amount] [decimal](18, 2) NULL,
	[DueDate] [datetime2](7) NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[CompletedOn] [datetime2](7) NULL,
	[CompletedBy] [int] NULL,
 CONSTRAINT [PK_SystemNotifications] PRIMARY KEY CLUSTERED 
(
	[NotificationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SystemVersionHistories](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Version] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ReleaseDate] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Changelog] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[InstalledOn] [datetime2](7) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[VersionNumber] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AppliedOn] [datetime2](7) NOT NULL,
	[PatchName] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Remarks] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[AppliedBy] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_SystemVersionHistories] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
ALTER TABLE [dbo].[SystemVersionHistories] ADD  DEFAULT (getutcdate()) FOR [InstalledOn]
GO
ALTER TABLE [dbo].[SystemVersionHistories] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[SystemVersionHistories] ADD  DEFAULT (getutcdate()) FOR [AppliedOn]
GO
ALTER TABLE [dbo].[SystemVersionHistories] ADD  DEFAULT ('SUCCESS') FOR [Status]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserLoginAudits](
	[AuditID] [int] IDENTITY(1,1) NOT NULL,
	[UserID] [int] NOT NULL,
	[LoginTime] [datetime2](7) NOT NULL,
	[LogoutTime] [datetime2](7) NULL,
	[IPAddress] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[DeviceDetails] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Status] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 CONSTRAINT [PK_UserLoginAudits] PRIMARY KEY CLUSTERED 
(
	[AuditID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[UserID] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PasswordHash] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[RoleID] [int] NOT NULL,
	[DefaultBranchID] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsLocked] [bit] NOT NULL,
	[FailedLoginAttempts] [int] NOT NULL,
	[RequirePasswordChange] [bit] NOT NULL,
	[LastPasswordChangeDate] [datetime2](7) NULL,
	[LastLoginDate] [datetime2](7) NULL,
	[ActiveSessionToken] [nvarchar](2000) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Email] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MobileNumber] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED 
(
	[UserID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VoucherDetails](
	[VoucherDetailID] [int] IDENTITY(1,1) NOT NULL,
	[VoucherID] [int] NOT NULL,
	[LedgerID] [int] NOT NULL,
	[MemberID] [int] NULL,
	[DrCr] [nvarchar](2) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[CustomerID] [int] NULL,
 CONSTRAINT [PK_VoucherDetails] PRIMARY KEY CLUSTERED 
(
	[VoucherDetailID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
CREATE NONCLUSTERED INDEX [IX_VoucherDetails_CustomerID] ON [dbo].[VoucherDetails]
(
	[CustomerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[VoucherDetails]  WITH CHECK ADD  CONSTRAINT [FK_VoucherDetails_Customers_CustomerID] FOREIGN KEY([CustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[VoucherDetails] CHECK CONSTRAINT [FK_VoucherDetails_Customers_CustomerID]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VoucherMappings](
	[MappingID] [int] IDENTITY(1,1) NOT NULL,
	[TransactionType] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DebitLedgerID] [int] NULL,
	[CreditLedgerID] [int] NULL,
 CONSTRAINT [PK_VoucherMappings] PRIMARY KEY CLUSTERED 
(
	[MappingID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Vouchers](
	[VoucherID] [int] IDENTITY(1,1) NOT NULL,
	[BranchID] [int] NOT NULL,
	[VoucherNo] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[VoucherDate] [datetime2](7) NOT NULL,
	[VoucherType] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Narration] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[TotalAmount] [decimal](18, 2) NOT NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedOn] [datetime2](7) NOT NULL,
	[Status] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ApprovedBy] [int] NULL,
	[ApprovedOn] [datetime2](7) NULL,
	[RejectionReason] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ScrollNo] [int] NULL,
 CONSTRAINT [PK_Vouchers] PRIMARY KEY CLUSTERED 
(
	[VoucherID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[Roles] (5 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[Roles] ON;
GO
INSERT INTO [dbo].[Roles] ([RoleID], [RoleName], [Description], [IsSystemRole], [RoleCode], [Status]) VALUES (1, N'Admin', N'System Administrator', 1, N'Admin', 1);
INSERT INTO [dbo].[Roles] ([RoleID], [RoleName], [Description], [IsSystemRole], [RoleCode], [Status]) VALUES (2, N'Manager', N'Branch Manager', 1, N'Manager', 1);
INSERT INTO [dbo].[Roles] ([RoleID], [RoleName], [Description], [IsSystemRole], [RoleCode], [Status]) VALUES (3, N'Cashier', N'Cashier', 1, N'Cashier', 1);
INSERT INTO [dbo].[Roles] ([RoleID], [RoleName], [Description], [IsSystemRole], [RoleCode], [Status]) VALUES (4, N'Clerk', N'Account Clerk', 1, N'Clerk', 1);
INSERT INTO [dbo].[Roles] ([RoleID], [RoleName], [Description], [IsSystemRole], [RoleCode], [Status]) VALUES (5, N'Auditor', N'Statutory Auditor', 1, N'Auditor', 1);
GO
SET IDENTITY_INSERT [dbo].[Roles] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[Branches] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[Branches] ON;
GO
INSERT INTO [dbo].[Branches] ([BranchID], [BranchCode], [BranchName], [Address], [IFSCCode], [IsActive], [BranchType], [Email], [MobileNo], [DefaultCashLedgerID]) VALUES (1, N'HO1', N'मुख्य शाखा (Main Branch)', N'मुख्य कार्यालय', N'', 1, N'Branch', N'info@smartbanking.in', N'9975446204', 158);
GO
SET IDENTITY_INSERT [dbo].[Branches] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[SansthaDetails] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[SansthaDetails] ON;
GO
INSERT INTO [dbo].[SansthaDetails] ([SansthaID], [SansthaName], [Address], [ContactNo], [Email], [RegistrationNo], [GSTNo], [LogoPath], [IsMigrationLocked], [AutoPostVouchers], [AutoPostVoucherLimit], [District], [PinCode], [RegistrationDate], [State], [Taluka], [Village], [IsMobileCompulsory], [IsAadhaarCompulsory], [IsPanCompulsory]) VALUES (1, N'जोतिर्लिंग ग्रामीण बिगरशेती सह. पतसंस्था मर्या. पडवळवाडी', N'मु. पो. पडवळवाडी, जि. सांगली', NULL, N'info@smartbanking.in', NULL, NULL, NULL, 0, 0, 50000.00, N'सांगली', NULL, '2018-12-17 00.00.00.000', N'महाराष्ट्र', N'कडेगाव', N'पडवळवाडी', 0, 0, 0);
GO
SET IDENTITY_INSERT [dbo].[SansthaDetails] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[FinancialYears] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[FinancialYears] ON;
GO
INSERT INTO [dbo].[FinancialYears] ([FinancialYearID], [YearCode], [StartDate], [EndDate], [IsActive], [IsClosed]) VALUES (1, N'2026-2027', '2026-04-01 00.00.00.000', '2027-03-31 23.59.59.000', 1, 0);
GO
SET IDENTITY_INSERT [dbo].[FinancialYears] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[Users] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[Users] ON;
GO
INSERT INTO [dbo].[Users] ([UserID], [Username], [PasswordHash], [RoleID], [DefaultBranchID], [IsActive], [IsLocked], [FailedLoginAttempts], [RequirePasswordChange], [LastPasswordChangeDate], [LastLoginDate], [ActiveSessionToken], [Email], [MobileNumber]) VALUES (1, N'admin', N'$2a$11$6fxAYBVHsmYhkIWjlMOe0OG98hAkMMAUUifrbG4Ju.jE/SMOyJtAK', 1, 1, 1, 0, 0, 0, NULL, '2026-09-08 22.42.16.076', N'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1laWQiOiIxIiwidW5pcXVlX25hbWUiOiJhZG1pbiIsInJvbGUiOiJBZG1pbiIsIkJyYW5jaElEIjoiMSIsIkZpbmFuY2lhbFllYXJJRCI6IjEiLCJuYmYiOjE3ODg4ODc1MzYsImV4cCI6MTc4ODkxNjMzNiwiaWF0IjoxNzg4ODg3NTM2fQ.LSMxVHBMkJVUGq83jb8eAHvg3CHeokEqqAUXgQ3_jrQ', NULL, NULL);
GO
SET IDENTITY_INSERT [dbo].[Users] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[BankMasters] (10 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[BankMasters] ON;
GO
INSERT INTO [dbo].[BankMasters] ([BankID], [BankName]) VALUES (1, N'स्टेट बँक ऑफ इंडिया (SBI)');
INSERT INTO [dbo].[BankMasters] ([BankID], [BankName]) VALUES (2, N'बँक ऑफ महाराष्ट्र (Bank of Maharashtra)');
INSERT INTO [dbo].[BankMasters] ([BankID], [BankName]) VALUES (3, N'बँक ऑफ बडोदा (Bank of Baroda)');
INSERT INTO [dbo].[BankMasters] ([BankID], [BankName]) VALUES (4, N'सेंट्रल बँक ऑफ इंडिया (Central Bank of India)');
INSERT INTO [dbo].[BankMasters] ([BankID], [BankName]) VALUES (5, N'युनियन बँक ऑफ इंडिया (Union Bank of India)');
INSERT INTO [dbo].[BankMasters] ([BankID], [BankName]) VALUES (6, N'एचडीएफसी बँक (HDFC Bank)');
INSERT INTO [dbo].[BankMasters] ([BankID], [BankName]) VALUES (7, N'आयसीआयसीआय बँक (ICICI Bank)');
INSERT INTO [dbo].[BankMasters] ([BankID], [BankName]) VALUES (8, N'ॲक्सिस बँक (Axis Bank)');
INSERT INTO [dbo].[BankMasters] ([BankID], [BankName]) VALUES (9, N'जिल्हा मध्यवर्ती सहकारी बँक (DCC Bank)');
INSERT INTO [dbo].[BankMasters] ([BankID], [BankName]) VALUES (10, N'पंजाब नॅशनल बँक (Punjab National Bank)');
GO
SET IDENTITY_INSERT [dbo].[BankMasters] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[CashManagementSettings] (2 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[CashManagementSettings] ON;
GO
INSERT INTO [dbo].[CashManagementSettings] ([Id], [BranchId], [AutoGenerateVouchers], [EnableDenominationMandatory], [MaxBranchVaultLimit], [DefaultCounterLimit], [Remarks], [LastUpdated], [MainVaultLedgerId], [CashShortageLedgerId], [CashExcessLedgerId]) VALUES (1, 1, 0, 1, 5000000.00, 500000.00, N'मुख्य तिजोरी व रोख योजना सेटिंग', '2026-08-25 08.52.00.290', NULL, NULL, NULL);
INSERT INTO [dbo].[CashManagementSettings] ([Id], [BranchId], [AutoGenerateVouchers], [EnableDenominationMandatory], [MaxBranchVaultLimit], [DefaultCounterLimit], [Remarks], [LastUpdated], [MainVaultLedgerId], [CashShortageLedgerId], [CashExcessLedgerId]) VALUES (2, 2, 0, 1, 5000000.00, 500000.00, N'शाखा गोटखिंडी डीफॉल्ट कॅश सेटिंग', '2026-08-29 11.26.18.344', 161, NULL, NULL);
GO
SET IDENTITY_INSERT [dbo].[CashManagementSettings] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[Cashiers] (3 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[Cashiers] ON;
GO
INSERT INTO [dbo].[Cashiers] ([Id], [BranchId], [CashierName], [CounterNumber], [IsHeadCashier], [IsActive], [MaxCashLimit], [Remarks], [CashLedgerId], [CreatedAt], [UserId]) VALUES (1, 1, N'मुख्य कॅशिअर (Head Cashier)', N'तिजोरी कक्ष (Main Vault)', 1, 1, 2500000.00, N'मुख्य तिजोरी व बँक रोख व्यवस्थापन', NULL, '2026-09-08 10.06.21.311', NULL);
INSERT INTO [dbo].[Cashiers] ([Id], [BranchId], [CashierName], [CounterNumber], [IsHeadCashier], [IsActive], [MaxCashLimit], [Remarks], [CashLedgerId], [CreatedAt], [UserId]) VALUES (2, 1, N'काउंटर १ (जमा-नावे टेलर)', N'काउंटर १', 0, 1, 500000.00, N'दैनंदिन बचत, ठेव व कर्ज रोख व्यवहार', NULL, '2026-09-08 10.06.21.311', NULL);
INSERT INTO [dbo].[Cashiers] ([Id], [BranchId], [CashierName], [CounterNumber], [IsHeadCashier], [IsActive], [MaxCashLimit], [Remarks], [CashLedgerId], [CreatedAt], [UserId]) VALUES (3, 1, N'काउंटर २ (पिग्मी व इतर संकलन)', N'काउंटर २', 0, 1, 300000.00, N'पिग्मी एजंट संकलन व इतर रोख पावत्या', NULL, '2026-09-08 10.06.21.311', NULL);
GO
SET IDENTITY_INSERT [dbo].[Cashiers] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[AccountGroups] (91 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[AccountGroups] ON;
GO
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (1, N'सभासद भागभांडवल ', NULL, N'Liabilities', 1, NULL, N'1', N'Capital', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (2, N'वैयक्तिक ', 1, N'Liabilities', 1, NULL, N'1.1', N'Paid up Capital - Individual', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (3, N'संस्था ', 1, N'Liabilities', 1, NULL, N'1.2', N'Paid up Capital - Institution', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (4, N'राखीव व इतर निधी ', NULL, N'Liabilities', 1, NULL, N'2', N'Reserve & Other Funds', 2);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (5, N'राखीव निधी ', 4, N'Liabilities', 1, NULL, N'2.1', N'Reserve Fund', 2);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (6, N'लाभांश समीकरण निधी ', 4, N'Liabilities', 1, NULL, N'2.2', N'Dividend Equalization Fund', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (7, N'इमारत निधी ', 4, N'Liabilities', 1, NULL, N'2.3', N'Building Fund', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (8, N'नफ्यातून काढलेले निधी ', 4, N'Liabilities', 1, NULL, N'2.4', N'Funds Appropriated from Profit', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (9, N'इतर निधी ', 4, N'Liabilities', 1, NULL, N'2.5', N'Other Funds', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (10, N'ठेवी ', NULL, N'Liabilities', 1, NULL, N'3', N'Deposite', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (11, N'बचत ठेवी ', 10, N'Liabilities', 1, NULL, N'3.1', N'Savhing Deposite', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (12, N'मुदती ठेवी ', 10, N'Liabilities', 1, NULL, N'3.2', N'Fixed Deposits Cumulative', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (13, N'आवर्ती ठेवी ', 10, N'Liabilities', 1, NULL, N'3.3', N'Ricuring Deposite', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (14, N'इतर ठेवी ', 10, N'Liabilities', 1, NULL, N'3.4', N'Other Deposite', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (15, N'बँक कर्जे ', NULL, N'Liabilities', 1, NULL, N'4', N'Bank Loan', 4);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (16, N'जिल्हा मध्यवर्ती बँक  कर्जे ', 15, N'Liabilities', 1, NULL, N'4.1', N'DCC Bank Loan', 4);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (17, N'इतर बँकेतील कर्जे ', 15, N'Liabilities', 1, NULL, N'4.2', N'Other Bank Loan', 4);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (18, N'इतर देणे ', NULL, N'Liabilities', 1, NULL, N'5', N'Other Payables', 5);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (19, N'सभासद लाभांश ', 18, N'Liabilities', 1, NULL, N'5.1', N'member Divedent', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (20, N'इतर देणे ', 18, N'Liabilities', 1, NULL, N'5.2', N'Other Payables', 5);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (21, N'शाखा येणे देणे ', NULL, N'Liabilities', 1, NULL, N'6', N' Accounts Receivable and Payable Branch', 6);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (22, N'तरतुदी ', NULL, N'Liabilities', 1, NULL, N'7', N'PROVISIONS', 7);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (23, N'बँक कर्जावरील देय व्याज तरतूद ', 22, N'Liabilities', 1, NULL, N'7.1', N'Bank Loan intr PROVISIONS', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (24, N'ठेवीवरील देय व्याज तरतूद ', 22, N'Liabilities', 1, NULL, N'7.2', N'deposite intr labilities PROVISIONS', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (25, N'थकव्याज तरतूद ', 22, N'Liabilities', 1, NULL, N'7.3', N'Due Intr PROVISIONS', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (26, N'खर्च  तरतूद ', 22, N'Liabilities', 1, NULL, N'7.4', N'expense PROVISIONS', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (27, N'इतर तरतूद ', 22, N'Liabilities', 1, NULL, N'7.5', N'Other PROVISIONS', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (28, N'नफा खाते ', NULL, N'Liabilities', 1, NULL, N'8', N'Profit Account', 6);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (29, N'शिल्लक  नफा ', 28, N'Liabilities', 1, NULL, N'8.1', N'Profit And Loss(In Stock)', 6);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (30, N'चालू नफा ', 28, N'Liabilities', 1, NULL, N'8.2', N'Profit And Loss(in Running)', 6);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (31, N'हातावरील रोख शिल्लक ', NULL, N'Assets', 1, NULL, N'9', N'Cash in Hand', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (32, N'बँकेतील शिल्लक ', NULL, N'Assets', 1, NULL, N'10', N'Bank Acc Closing Bal', 2);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (33, N'करंट खाते ', 32, N'Assets', 1, NULL, N'10.1', N'current Acc', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (34, N'बचत खाते ', 32, N'Assets', 1, NULL, N'10.2', N'Savhing Acc', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (35, N'गुंतवणूक ', NULL, N'Assets', 1, NULL, N'11', N'Investment', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (36, N'जिल्हा मध्यवर्ती शेअर्स ', 35, N'Assets', 1, NULL, N'11.1', N'DCC Bank Capital', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (37, N'इतर बँकेतील  शेअर्स ', 35, N'Assets', 1, NULL, N'11.2', N'Other Bank Capital', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (38, N'जिल्हा मध्यवर्ती गुंतवणूक ', 35, N'Assets', 1, NULL, N'11.3', N'Dcc Bank Investment', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (39, N'बँक रिझर्व  फंड ', 35, N'Assets', 1, NULL, N'11.4', N'Bank Reserve Fund', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (40, N'इतर बँकेतील  गुंतवणूक ', 35, N'Assets', 1, NULL, N'11.5', N'Other Bank Investment', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (41, N'अन्य गुंतवणूक ', 35, N'Assets', 1, NULL, N'11.6', N'Other Investment', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (42, N'कर्जे ', NULL, N'Assets', 1, NULL, N'12', N'Customer Loan', 4);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (43, N'तारणी कर्जे ', 42, N'Assets', 1, NULL, N'12.1', N'collateral loan', 4);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (44, N'विनातारणी कर्जे ', 42, N'Assets', 1, NULL, N'12.2', N' Unsecured loans', 4);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (45, N'ठेव तारणी कर्जे ', 42, N'Assets', 1, NULL, N'12.3', N'Deposit-backed loans', 4);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (46, N'जिन्नस व इतर  तारण कर्जे ', 42, N'Assets', 1, NULL, N'12.4', N'Commodity and other collateral loans', 4);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (47, N'मालमत्ता ', NULL, N'Assets', 1, NULL, N'13', N'property', 5);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (48, N'जागा व इमारत ', 47, N'Assets', 1, NULL, N'13.1', N'Site and building', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (49, N'डेडस्टॉक ', 47, N'Assets', 1, NULL, N'13.2', N' deadstock', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (50, N'संगणक ', 47, N'Assets', 1, NULL, N'13.3', N'Computer and printers ', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (51, N'अन्य  मालमत्ता ', 47, N'Assets', 1, NULL, N'13.4', N'Other Proprities ', 5);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (52, N'इतर येणे ', NULL, N'Assets', 1, NULL, N'14', N' other coming', 6);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (53, N'येणे  व्याज  कर्जावरील ', 52, N'Assets', 1, NULL, N'14.1', N' Accruing interest on loans', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (54, N'येणे  व्याज गुंतवणुकीवरील ', 52, N'Assets', 1, NULL, N'14.2', N' Interest on investments', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (55, N'येणे थकव्याज ', 52, N'Assets', 1, NULL, N'14.3', N' Fatigue to come', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (56, N'इतर येणे ', 52, N'Assets', 1, NULL, N'14.4', N'other coming', 6);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (57, N'येणे देणे शाखा खाते ', NULL, N'Assets', 1, NULL, N'15', N' Accounts Receivable and Payable Branch', 15);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (58, N'तोटा खाते ', NULL, N'Assets', 1, NULL, N'16', N' loss account', 7);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (59, N'शिल्लक तोटा ', 58, N'Assets', 1, NULL, N'16.1', N' loss (in Stock)', 7);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (60, N'चालू तोटा ', 58, N'Assets', 1, NULL, N'16.2', N' loss(in running)', 7);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (61, N'मिळालेले कर्जावरील  व्याज ', NULL, N'Income', 1, NULL, N'17', N'Loan Interest received', 17);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (62, N'गुंतवणूकवरील मिळालेले व्याज ', NULL, N'Income', 1, NULL, N'18', N'Investement Interest received', 3);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (63, N'प्रवेश फी ', NULL, N'Income', 1, NULL, N'19', N'entry fee', 19);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (64, N'इतर कमिशन जमा ', NULL, N'Income', 1, NULL, N'20', N' Other commission accrual', 20);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (65, N'इतर उत्पन्न ', NULL, N'Income', 1, NULL, N'21', N' other income', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (66, N'देलेले  व्याज ', NULL, N'Expenses', 1, NULL, N'22', N'Paid  Interest', 22);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (67, N'मुदत ठेव दिलेले व्याज ', 66, N'Expenses', 1, NULL, N'22.1', N'Interest paid on fixed deposit', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (68, N'आवर्ती ठेव दिलेले व्याज ', 66, N'Expenses', 1, NULL, N'22.2', N' Interest paid on recurring deposits', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (69, N'बचत ठेव दिलेले  व्याज ', 66, N'Expenses', 1, NULL, N'22.3', N' Interest paid on savings deposits', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (70, N'इतर ठेव दिलेले व्याज ', 66, N'Expenses', 1, NULL, N'22.4', N'Interest paid on Other deposits', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (71, N'पगार  व भत्ते ', NULL, N'Expenses', 1, NULL, N'23', N' Salary and allowances', 23);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (72, N'कर्मचारी वेतन व मानधन ', 71, N'Expenses', 1, NULL, N'23.1', N' Employee salaries and honorarium', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (73, N'संचालक मंडळ भत्ते ', 71, N'Expenses', 1, NULL, N'23.2', N'Board of Directors allowances', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (74, N'इतर भत्ते ', 71, N'Expenses', 1, NULL, N'23.3', N'Other allowances', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (75, N'प्रिंटिंग व स्टेशनरी ', NULL, N'Expenses', 1, NULL, N'24', N' printing and stationery', 24);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (76, N'व्यवस्थापण खर्च ', NULL, N'Expenses', 1, NULL, N'25', N'Management expenses', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (77, N'प्रवास खर्च ', 76, N'Expenses', 1, NULL, N'25.1', N'travel expenses', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (78, N'प्रशिक्षण खर्च ', 76, N'Expenses', 1, NULL, N'25.2', N'training expenses', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (79, N'सभासमारंभ खर्च ', 76, N'Expenses', 1, NULL, N'25.3', N' opening expenses', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (80, N'झिज व घसारा ', NULL, N'Expenses', 1, NULL, N'26', N' Wear and tear', 26);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (81, N'तरतुदी ', NULL, N'Expenses', 1, NULL, N'27', N' Provisions', 27);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (82, N'ऑडीट फी तरतूद ', 81, N'Expenses', 1, NULL, N'27.1', N' Audit fee provision', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (83, N'एन पी ए तरतूद ', 81, N'Expenses', 1, NULL, N'27.2', N' NPA provision', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (84, N'इतर खर्च तरतूद ', 81, N'Expenses', 1, NULL, N'27.3', N' Provision of other expenses', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (85, N'इतर किरकोळ  खर्च ', NULL, N'Expenses', 1, NULL, N'28', N' Other minor expenses', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (86, N'इमारत दुरुस्ती अन्य खर्च ', 85, N'Expenses', 1, NULL, N'28.1', N' Building repairs Other expenses', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (87, N'बँक कमिशन चार्जेस ', 85, N'Expenses', 1, NULL, N'28.2', N' Bank commission charges', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (88, N'संगणक देखभाल खर्च ', 85, N'Expenses', 1, NULL, N'28.3', N' Computer maintenance costs', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (89, N'इतर किरकोळ खर्च ', 85, N'Expenses', 1, NULL, N'28.4', N'Other minor expenses', 1);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (90, N'बँक कर्जावरील  दिलेले व्याज ', 66, N'Expenses', 1, NULL, N'22.5', N' Interest paid on bank loans', 0);
INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupName], [ParentGroupID], [NatureOfGroup], [IsActive], [LegacyGroupId], [GroupCode], [GroupNameEnglish], [DisplayOrder]) VALUES (91, N'अधिकृत भागभांडवल ', NULL, N'Liabilities', 1, NULL, N'29', N'', 1);
GO
SET IDENTITY_INSERT [dbo].[AccountGroups] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[Ledgers] (410 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[Ledgers] ON;
GO
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (1, N'सभासद भाग', 2, 1100.00, N'Cr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Member Shares', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (2, N'नाममात्र सभासद', 3, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Nominal Member', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (3, N'मयत सभासद', 3, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Deceased Member', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (4, N'राखीव निधी', 5, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Reserve Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (5, N'लाभांश समीकरण निधी', 6, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Dividend Equalization Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (6, N'इमारत निधी', 7, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Building Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (7, N'धर्मादाय निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Charity Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (8, N'उत्तम जिंदगी निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Goodwill Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (9, N'सभासद कल्याण निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Member Welfare Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (10, N'संशयित बुडीत निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Doubtful Debt Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (11, N'झिज घसारा निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Depreciation Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (12, N'थकव्याज कर्ज निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Overdue Interest Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (13, N'कामगार कल्याण निधी', 8, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Staff Welfare Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (14, N'अन्य  निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (15, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (16, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (17, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (18, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (19, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (20, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (21, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (22, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (23, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (24, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (25, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (26, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (27, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (28, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (29, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (30, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (31, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (32, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (33, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (34, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (35, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (36, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (37, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (38, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (39, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (40, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (41, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (42, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (43, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (44, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (45, N'अन्य निधी', 9, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (46, N'सेव्हिंग  ठेव', 11, 13000.00, N'Cr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Savings Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (47, N'पिग्मी (जोर्तलिंग )ठेव', 11, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Pigmy (Jortling) Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (48, N'मुदत बंद ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (49, N'रिकरींग ठेव', 13, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Recurring Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (50, N'दामदुप्पट ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Double-Your-Money Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (51, N'महालक्ष्मी ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Mahalakshmi Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (52, N'जोर्तलिंग ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Jortling Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (53, N'दत्त ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Datt  Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (54, N'महादेव ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Mahadev Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (55, N'धनलक्ष्मी ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dhanalakshmi Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (56, N'जनता ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Janata Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (57, N'पिग्मी एजंट ठेव', 11, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Pigmy Agent Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (58, N'महिला सन्मान ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Mahila Samman Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (59, N'राजारमाबापू ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Rajarambapu Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (60, N'विद्यासागर ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Vidyasagar Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (61, N'जनकल्याण ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Janakalyan Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (62, N'धनसंचय ठेव', 11, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dhansanchay Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (63, N'धनवर्धनी ठेव', 13, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dhanvardhini Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (64, N'लखपती ठेव', 13, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Lakhpati Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (65, N'दामदीडपट ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dam-Didpat Deposit (1.5x Return)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (66, N'दामतिप्पट ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dam-Tippat Deposit (3x Return)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (67, N'दामचौपट ठेव', 12, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Dam-Chaupat Deposit (4x Return)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (68, N'ब वर्ग ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'''B'' Class Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (69, N'संजीवनी ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Sanjeevani Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (70, N'कायम ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (71, N'कर्ज कपात ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Loan Deduction Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (72, N'बिनव्याजी ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest-free Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (73, N'अनामत ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Security Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (74, N'इतर ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Other Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (75, N'अन्य ठेव', 14, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Miscellaneous Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (76, N'बँक कर्ज जि. म.', 16, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Bank Loan (District Central)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (77, N'बँक कर्ज हुतात्मा', 17, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Bank Loan - Hutatma', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (78, N'बँक कर्ज अपणा बँक', 17, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Bank Loan - Apana Bank', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (79, N'बँक कर्जे इतर बँक', 17, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Bank Loans - Other Banks', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (80, N'बँक कर्जे अन्य बँक', 17, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Bank Loans - Other Banks', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (81, N'देणे सभासद लाभांश', 19, 0.00, N'Cr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Member Dividend', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (82, N'देणे ब वर्ग सभासद ठेव व्याज', 19, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: ''B'' Class Member Deposit Interest', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (83, N'देणे बिन व्याज ठेव व्याज', 19, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Non-interest Bearing Deposit Interest', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (84, N'देणे इतर ठेव व्याज', 19, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Other Deposit Interest', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (85, N'इतर देणे', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Payables', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (86, N'देणे अन्य देयता', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Other Liabilities', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (87, N'देणे इतर', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Payables', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (88, N'देणे इतर अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Miscellaneous Others', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (89, N'देणे अन्य देयता', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Other Liabilities', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (90, N'देणे अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Others', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (91, N'देणे इतर अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Miscellaneous Others', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (92, N'देणे किरकोळ अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Sundry Others', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (93, N'देणे अन्य इतर', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Miscellaneous Others', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (94, N'इतर अन्य देणे', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Miscellaneous Payables', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (95, N'इतर देणे येणे', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Payables/Receivables', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (96, N'देणे इतर', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Others', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (97, N'देणे येणे अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payables/Receivables - Others', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (98, N'देणे अन्य इतर', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Miscellaneous Others', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (99, N'देणे इतर देणे', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Other Dues', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (100, N'देणे अन्य', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Others', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (101, N'देणे मेन शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Main Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (102, N'देणे बांबवडे शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Bambavade Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (103, N'देणे गोटखिंडी शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Gotkhindi Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (104, N'देणे सोनवडे शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Sonavade Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (105, N'देणे शाहूवाडी शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Shahuwadi Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (106, N'देणे गोगवे शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Gogave Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (107, N'देणे ईश्वरपुर शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Ishwarpur Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (108, N'देणे सांगली शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Sangli Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (109, N'देणे पलूस शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Palus Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (110, N'देणे कराड शाखा', 21, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable: Karad Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (111, N'देणे रिकरींग ठेव व्याज तरतूद', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Recurring Deposit Interest Provision', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (112, N'देणे पिग्मी ठेव व्याज तरतूद', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Pigmy Deposit Interest Provision', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (113, N'देणे धनसंचय ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Dhansanchay Deposit Interest', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (114, N'देणे मुदत बंद ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: Fixed Deposit Interest', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (115, N'देणे दामदुप्पट ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Payable: ''Damduppat'' (Double-the-Amount) Deposit Interest', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (116, N'देणे जोतिबा ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Jyotiba Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (117, N'देणे दत्त ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Datta Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (118, N'देणे महादेव ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Mahadev Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (119, N'देणे महालक्ष्मी ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Mahalakshmi Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (120, N'देणे जनता ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Janata Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (121, N'देणे राजारामबापू ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Rajarambapu Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (122, N'देणे धनसंचय ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Dhansanchay Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (123, N'देणे संजीवनी ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Sanjeevani Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (124, N'देणे जनकल्याण ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Janakalyan Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (125, N'देणे धनवरधिनी ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Dhanvardhini Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (126, N'देणे दाम दीडपट व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: ''Dam-Deedpat'' (1.5x Return) Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (127, N'देणे दाम तिप्पट व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: ''Dam-Tippat'' (3x Return) Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (128, N'देणे दामचौपट व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: ''Dam-Chaupat'' (4x Return) Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (129, N'देणे लक्ष्यपती ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Lakshyapati Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (130, N'देणे अन्य ठेव व्याज', 24, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Interest Payable: Other Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (131, N'देणे जिल्हा मध्य. बँक व्याज', 23, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Interest Payable: District Central Bank', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (132, N'देणे अन्य बँक व्याज', 23, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Interest Payable: Other Bank', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (133, N'देणे इतर बँक व्याज', 23, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Interest Payable: Other Bank', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (134, N'देणे अन्य सहकारी बँक व्याज', 23, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Interest Payable: Other Cooperative Bank', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (135, N'थकीत कर्ज व्याज तरतूद', 25, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Interest on Overdue Loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (136, N'एन पी ए तरतूद', 25, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for NPA', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (137, N'अन्य थकव्याज तरतूद', 25, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Other Overdue Interest', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (138, N'देणे ऑडिट फी', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Audit Fees Payable', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (139, N'देणे नोकर बोनस', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Staff Bonus Payable', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (140, N'देणे निवडणूक खर्च निधी', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Election Expense Fund Payable', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (141, N'देणे सॉफ्टवेअर वार्षिक चार्जेस', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Software Annual Charges Payable', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (142, N'देणे सानुग्रह अनुदान', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Ex-gratia Payment Payable', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (143, N'देणे फर्निचर खाते', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Furniture Account Payable', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (144, N'देणे मानधन खाते', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Honorarium Account Payable', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (145, N'देणे कर्मचारी पगार', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Staff Salaries Payable', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (146, N'देणे कर्मचारी प्रॉ. फंड', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Staff Provident Fund Payable Funds', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (147, N'देणे विकास निधी तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Development Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (148, N'देणे सभासद बक्षीस खर्च तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Member Prize Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (149, N'देणे अन्य खर्च तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Other Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (150, N'देणे इतर खर्च तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Miscellaneous Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (151, N'देणे खर्च तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (152, N'देणे अन्य खर्च तरतूद', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Other Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (153, N'देणे खर्च अन्य तरतुदी', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Other Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (154, N'अन्य खर्च तरतुदी', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provisions for Other Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (155, N'देणे किरकोळ खर्च तरतुदी', 26, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Provision for Petty Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (156, N'संचित नफा खाते', 29, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Accumulated Profit Account', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (157, N'चालू नफा खाते', 30, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Current Profit Account', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (158, N'हाता. रोख शिल्लक मेन शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Cash Balance on Hand – Main Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (159, N'हाता. रोख शिल्लक बांबवडे शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Cash Balance on Hand – Bambavade Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (160, N'हात. शिल्लक गोगवे ब्रांच', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Cash on Hand Balance Gogwe Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (161, N'हात शिल्लक गोटखिंडी शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Gotakhindi Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (162, N'हात शिल्लक ईश्वरपुर शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Ishwarpur Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (163, N'हात शिल्लक पलूस शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Plus Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (164, N'हातशिल्लक कराड शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Karad Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (165, N'हातशिल्लक सांगली शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Sangali Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (166, N'हात शिल्लक सोनवडे शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Sonavade Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (167, N'हातशिल्लक बांबवडे शाखा', 31, 0.00, N'Dr', N'ताळेबंद', N'Cash In Hand', 0, 1, NULL, N'Hand Balance Bambavade Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (168, N'जिल्हा मध्यवर्ती चालू खाते', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'District Central Current Account', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (169, N'जिल्हा मध्यवर्ती बचत खाते', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'DCC Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (170, N'हुतातमा बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'hutatma Bank Current', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (171, N'हुतात्मा बँक बचत खाते', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Hutatma Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (172, N'अपना बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Apana Bank Current', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (173, N'कोटक बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Kotak Bank Current', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (174, N'कोटक बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'KOtak Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (175, N'आर बी एल बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'RBL Bank Current', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (176, N'आर बी एल बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'RBL Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (177, N'आय आय सी सी बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'ICICI Bank Current', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (178, N'आय आय सी सी बँक बचत खाते', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'ICICI Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (179, N'महालक्ष्मी बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Mahalaxmi Bank Current', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (180, N'महालक्ष्मी बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Mahalaxmi Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (181, N'आय डी बी आय बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'IDBI Bank Current', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (182, N'आय डी बी आय बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'IDBI Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (183, N'एस बी आय बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'SBI Bank Current', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (184, N'एस बी आय बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'SBI Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (185, N'फेडरल बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Fedaral Bank Current', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (186, N'फेडरल बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Fedaral Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (187, N'एच डी एफ सी बँक करंट', 33, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'HDFC Bank Current', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (188, N'एच डी एफ सी बँक बचत', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'HDFC Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (189, N'अपना बँक बचत खाते', 34, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Apana Bank Savhing', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (190, N'जिल्हा मध्यवर्ती बँक शेअर्स', 36, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'District Central Bank Shares', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (191, N'इतर बँक शेअर्स', 37, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Other Bank Shares', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (192, N'जिल्हा बँक मुदत ठेव', 38, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'District Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (193, N'जिल्हा बँक राखीव निधी', 39, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'District Bank Reserve Fund', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (194, N'जिल्हा बँक आय पी डी बॉण्ड', 38, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'District Bank IPD Bond', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (195, N'जिल्हा मध्यवर्ती बँक आवर्ती  ठेव', 38, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'District Central Bank Recurring Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (196, N'हुतात्मा  बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Hutatma Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (197, N'अपना बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Apna Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (198, N'कोटक  बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Kotak Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (199, N'आर बी एल बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'RBL Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (200, N'आय आय सी सी बँक मुदतठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'ICICI Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (201, N'महालक्ष्मी बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Mahalaxmi Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (202, N'आय डी बी आय बँक मुदतबंद ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'IDBI Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (203, N'एस बी आय बँक मुदतबंद ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'SBI Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (204, N'फेडरल बँक मुदत बंद ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Federal Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (205, N'एच डी एफ सी बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'HDFC Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (206, N'तासगाव अर्बन मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Tasgaon Urban Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (207, N'पारशनाथ बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Parshwanath Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (208, N'जनता बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Janata Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (209, N'सारस्वत बँक मुदत ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Saraswat Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (210, N'नांदणी बँक मुदतबंद ठेव', 40, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Nandani Bank Fixed Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (211, N'लॉकर डिपॉजिट', 41, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Locker Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (212, N'एम एस ई बी डिपॉजिट', 41, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'MSEB Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (213, N'नळपाणी डिपॉजिट', 41, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Water Connection Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (214, N'इमारत निधी गुंतवणूक', 41, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (215, N'इतर डिपॉजिट', 41, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Miscellaneous Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (216, N'मेंबर कर्जे', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Member Loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (217, N'मेंबर मध्यम मुदत कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Member Medium-Term Loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (218, N'मेंबर दीर्घ मुदत कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Member Long-Term Loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (219, N'मेंबर जामीनकी कर्जे', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Member Secured Loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (220, N'सोनेतारण कर्जे', 46, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Gold-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (221, N'स्थावर तारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Immovable property-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (222, N'पगारतारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Salary-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (223, N'मशीनरी तारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Machinery-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (224, N'घरतारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'House-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (225, N'जमीन तारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Land-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (226, N'वाहन तारण कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Vehicle-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (227, N'गाय-म्हैस खरेदी कर्जे', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Cattle (Cow/Buffalo) purchase loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (228, N'नवीन दुचाकी खरेदी कर्जे', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'New two-wheeler purchase loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (229, N'नवीन चारचाकी खरेदी', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'New four-wheeler purchase', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (230, N'नवीन ट्रॅक्टर खरेदी कर्जे', 44, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'New tractor purchase loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (231, N'नवीन जे सी बी खरेदी कर्जे', 43, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'New JCB purchase loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (232, N'मुदत ठेव तारण कर्जे', 45, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Fixed deposit-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (233, N'दामदुप्पट ठेव तारण कर्जे', 45, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'''Double-your-money'' deposit-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (234, N'रिकरींग तारण कर्जे', 45, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Recurring deposit-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (235, N'पिग्मी तारण कर्जे', 45, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Pigmy deposit-backed loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (236, N'इतर ब वर्ग तारण कर्जे', 45, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Other ''B'' class secured loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (237, N'जागा व इमारत', 48, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Land and building', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (238, N'फर्निचर व फिकचर', 49, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Furniture and fixtures', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (239, N'डेडस्टॉक', 49, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Deadstock', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (240, N'संगणक व प्रिंटर', 50, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Computers and printers', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (241, N'पिग्मी मशीन', 50, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Pigmy machines', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (242, N'मोटरसायकल', 51, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Motorcycles', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (243, N'सोलर सिस्टिम', 51, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Solar systems', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (244, N'अन्य डेडस्टोक', 51, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Other deadstock', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (245, N'इतर डेडस्टॉक', 51, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Miscellaneous deadstock', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (246, N'येणे व्याज कर्जावरील', 53, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Interest receivable on loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (247, N'येणे थकीत व्याज', 55, 0.00, N'Dr', N'ताळेबंद', N'Loan Account', 0, 1, NULL, N'Overdue interest receivable', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (248, N'येणे गुंतवणूकिवरील व्याज', 54, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, N'Interest receivable on investments', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (249, N'येणे टी. डी. एस कपात', 54, 0.00, N'Dr', N'ताळेबंद', N'Investment Account', 0, 1, NULL, N'T.D. receivable S-Deduction', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (250, N'येणे संगणक एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Computer Advance', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (251, N'इतर येणे', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Others', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (252, N'येणे अन्य खाते', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Other Accounts', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (253, N'येणे बांधकाम एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Construction Advance', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (254, N'येणे नोकर पगार एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Receivable: Staff Salary Advance', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (255, N'येणे मानधन एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Honorarium Advance', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (256, N'येणे इतर संस्था एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Advance to Other Institutions', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (257, N'येणे जागा खरेदी एडव्हान्स', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Land Purchase Advance', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (258, N'येणे निवडणूक डिपॉझिट', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Election Deposit', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (259, N'येणे अनामत खाते', 56, 0.00, N'Dr', N'ताळेबंद', N'Personal Account', 0, 1, NULL, N'Receivable: Deposit Account', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (260, N'येणे इतर खाते', 56, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Other Accounts', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (261, N'येणे मेन शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Main Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (262, N'येणे बांबवडे शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Bambavade Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (263, N'येणे गोटखिंडी शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Gotkhindi Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (264, N'येणे सोनवडे शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Sonavade Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (265, N'येणे शाहूवाडी शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Shahuwadi Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (266, N'येणे गोगवे शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Gogave Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (267, N'येणे ईश्वरपुर शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Ishwarpur Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (268, N'येणे सांगली शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Sangli Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (269, N'येणे पलूस शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Palus Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (270, N'येणे कराड शाखा', 57, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Receivable: Karad Branch', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (271, N'संचित तोटा', 59, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Accumulated Loss', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (272, N'चालू तोटा', 60, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Current Year Loss', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (273, N'मेंबर कर्जावरील व्याज', 61, 0.00, N'Dr', N'ताळेबंद', N'Income', 0, 1, NULL, N'Interest on Member Loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (274, N'मेंबर म. मू. कर्ज व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on Member Medium-Term Loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (275, N'मेंबर दि . मू. कर्जे व्याज', 61, 0.00, N'Dr', N'ताळेबंद', N'Income', 0, 1, NULL, N'Interest on Member Long-Term Loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (276, N'मेंबर जे. सी. बी. व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Member JCB Interest', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (277, N'मेंबर स्थावरतारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against immovable property (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (278, N'मेंबर पगार तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on salary-backed loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (279, N'मेंबर मशीनरी तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on machinery-backed loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (280, N'मेंबर घरतारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on housing loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (281, N'मेंबर जामीनकि व्याज', 61, 0.00, N'Dr', N'ताळेबंद', N'Income', 0, 1, NULL, N'Interest on surety-backed loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (282, N'मेंबर वाहन तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on vehicle-backed loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (283, N'मेंबर गाय-म्हैस खरेदी व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on cattle purchase loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (284, N'मेंबर दुचाकी व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on two-wheeler loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (285, N'मेंबर चारचाकी व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on four-wheeler loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (286, N'मेंबर ट्रक्टर व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on tractor loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (287, N'मेंबर मुदतठेव तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against fixed deposits (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (288, N'मेंबर दामदुपट तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against ''Damdupat'' deposits (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (289, N'मेंबर रिकरींग तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against recurring deposits (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (290, N'मेंबर पिग्मी तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against Pigmy deposits (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (291, N'मेंबर ब वर्ग तारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on loans against ''B'' Class deposits (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (292, N'मेंबर सोनेतारण व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on gold-backed loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (293, N'मेंबर इतर कर्जे व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Interest on other loans (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (294, N'मेंबर जादा व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Excess interest (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (295, N'मेंबर दंड व्याज', 61, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Penal interest (Members)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (296, N'बँक शेयर्स लाभांश (जि .म.)', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank share dividend (District Bank)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (297, N'बँक लाभांश इतर बँक', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Dividend from other banks', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (298, N'बँक व्याज मिळालेले (जि.म.)', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (District Bank)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (299, N'बँक व्याज मिळालेले राखीव निधी', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (Reserve Fund)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (300, N'बँक व्याज मिळालेले(हुतात्मा)', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (Hutatma Bank)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (301, N'बँक व्याज मिळालेले(अपना )', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (Apna Bank)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (302, N'बँक व्याज मिळालेले(कोटक)', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (Kotak Bank)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (303, N'बँक व्याज मिळालेले(आरबीएल )', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (RBL Bank)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (304, N'बँक व्याज मिळालेले(आय. सी. आय )', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest received (ICI Bank)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (305, N'बँक व्याज महालक्ष्मी बँक', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest (Mahalaxmi Bank)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (306, N'बँक व्याज आयडीबीआय', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest (IDBI Bank)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (307, N'बँक व्याज एसबीआय', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank interest (SBI)', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (308, N'बँक व्याज फेडरल', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Federal', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (309, N'बँक व्याज एच डी एफ सी', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - HDFC', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (310, N'बँक व्याज तासगाव अर्बन', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Tasgaon Urban', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (311, N'बँक व्याज पारशवनाथ', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Parshwanath', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (312, N'बँक व्याज जनता बँक', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Janata Bank', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (313, N'बँक व्याज सारस्वत', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Saraswat', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (314, N'बँक व्याज नांदणी', 62, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Bank Interest - Nandni', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (315, N'प्रवेश फी', 63, 0.00, N'Dr', N'नफातोटा पत्रक', N'Personal Account', 0, 1, NULL, N'Admission Fee', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (316, N'नाममात्र फी', 63, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Nominal Fee', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (317, N'पिग्मी कमिशन जमा', 64, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Pigmy Commission Received', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (318, N'शेअर्स ट्रान्सफर फी', 64, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Commission on Loans', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (319, N'ठेवीवरील कमिशन', 64, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Commission on Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (320, N'स्टेशनरी कपात उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Stationery Deduction Income', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (321, N'वसूली खर्च जमा', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Recovery Charges Received', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (322, N'प्रोसेसिंग फी', 63, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Processing Fee', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (323, N'नोटिस फी', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Notice Fee', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (324, N'इतर उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Other Income', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (325, N'अन्य उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Miscellaneous Income', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (326, N'रद्दी विक्री', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Sale of Scrap', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (327, N'अन्य इतर उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Other Miscellaneous Income', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (328, N'इतर किरकोळ उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Other Sundry Income', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (329, N'अन्य इतर उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Other Miscellaneous Income', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (330, N'इतर असलेले उत्पन्न', 65, 0.00, N'Dr', N'नफातोटा पत्रक', N'Income', 0, 1, NULL, N'Other Income', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (331, N'सेव्हिंग ठेवीवरील व्याज', 69, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Savings Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (332, N'पिग्मी ठेवीवरील व्याज', 69, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Pigmy Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (333, N'मुदतठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Term Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (334, N'दामदुप्पट ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Double-Value Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (335, N'दामदिड पट ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on 1.5x Value Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (336, N'दाम तिप्पट ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Triple-Value Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (337, N'दत्त ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Datta Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (338, N'महालक्ष्मी ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Mahalaxmi Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (339, N'जनकल्याण ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Janakalyan Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (340, N'राजाराम ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Rajaram Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (341, N'जनकल्याण ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Janakalyan Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (342, N'जोतिबा ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Jotiba Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (343, N'रिकरींग ठेवीवरील व्याज', 68, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Recurring Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (344, N'धनवर्धणी ठेवीवरील व्याज', 68, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Dhanvardhini Deposits Interest', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (345, N'जनता ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Public Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (346, N'महादेव ठेवीवरील व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Mahadev Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (347, N'महिलासन्मान ठेव व्याज', 67, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Mahila Samman Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (348, N'ब वर्ग ठेवीवरील व्याज', 70, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on ''B'' Class Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (349, N'कायम ठेव व्याज', 70, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Fixed Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (350, N'संजीवनी ठेव व्याज', 70, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Interest on Sanjeevani Deposits', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (351, N'नोकर पगार', 72, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Staff Salaries', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (352, N'कर्मचारी मानधन', 72, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Staff Honorarium', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (353, N'संचालक मानधन', 73, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Director Honorarium', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (354, N'सचिव भत्ता', 74, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Secretary Allowance', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (355, N'सेवक इतर भत्ते', 74, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Other Staff Allowances', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (356, N'प्रिंटिंग व स्टेशनरी खर्च', 75, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Printing and Stationery Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (357, N'झेरॉक्स खर्च', 75, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Xerox Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (358, N'टायपिंग खर्च', 75, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Typing Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (359, N'अहवाल छपाई खर्च', 75, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Report Printing Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (360, N'सादिलवार खर्च', 75, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Contingent Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (361, N'व्यवस्थापन खर्च', 76, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Management Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (362, N'प्रवास खर्च', 77, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Travel Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (363, N'संचालक व नोकर प्रशिक्षण खर्च', 78, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Director and Staff Training Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (364, N'वार्षिक सर्वसाधारण सभा खर्च', 79, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Annual General Meeting Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (365, N'सभासमारंभ खर्च', 74, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Function/Ceremony Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (366, N'सभासद प्रशिक्षण खर्च', 78, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Member Training Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (367, N'देणगी व वर्गणी', 79, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Donations and Subscriptions', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (368, N'इमारत झिज', 80, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Building Depreciation', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (369, N'डेडस्टॉक झिज', 80, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Deadstock Depreciation', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (370, N'संगणक व प्रिंटर झिज', 80, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Computer and Printer Depreciation', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (371, N'सोलर सिस्टिम झिज', 80, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Solar System Depreciation', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (372, N'इतर झिज व घसारा', 80, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Other Depreciation and Write-offs', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (373, N'ऑडिट फी', 82, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Audit Fees', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (374, N'नोकर बोनस', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Staff Bonus', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (375, N'सॉफटवेअर ए. एम सी चार्जेस', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Software Expenses MC Charges', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (376, N'एन पी ए खर्च', 83, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'NPA Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (377, N'सभासद कल्याण निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Member Welfare Fund Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (378, N'लाभांश समीकरण निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Dividend Equalization Fund Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (379, N'धर्मदाय निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Charity Fund Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (380, N'संशयित बुडीत निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Bad and Doubtful Debts Fund Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (381, N'उत्तम जिंदगी निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Good Assets Fund Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (382, N'थकाव्याज कर्ज निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Overdue Interest Fund Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (383, N'इमारत निधी  खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Building Fund Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (384, N'झिज घासारा निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Depreciation Fund Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (385, N'निवडणूक निधी खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Election Fund Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (386, N'सभासद बक्षीस खर्च', 84, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Member Prize Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (387, N'बँक व्याज दिलेले', 90, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Bank Interest Paid', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (388, N'दिवाबती व जागा भाडे', 76, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Lighting and Premises Rent', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (389, N'विमा  खाते', 76, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Insurance Account', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (390, N'बँक चार्जेस', 87, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Bank Charges', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (391, N'लाईट बिल खर्च', 76, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Electricity Bill Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (392, N'संगणक खर्च', 88, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Computer Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (393, N'पिग्मी एजंट कमिशन', 72, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Pigmy Agent Commission', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (394, N'ऑफिस खर्च', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Office Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (395, N'किरकोळ खर्च', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Miscellaneous Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (396, N'पोसटेज खर्च', 87, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Postage Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (397, N'टॅक्स रिटर्न फी', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Tax Return Fees', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (398, N'लॉकर भाडे', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Locker Rent', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (399, N'प्रवेश फी नवे', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'New Admission Fees', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (400, N'सानुग्रह अनुदान खर्च', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Ex-gratia Payment Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (401, N'प्राथमिक खर्च', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Preliminary Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (402, N'फर्निचर रिपेयर  खर्च', 86, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Furniture Repair Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (403, N'इमारत दुरुस्ती व रंगकाम खर्च', 86, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Building Repair and Painting Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (404, N'इतर किरकोळ खर्च', 89, 0.00, N'Dr', N'नफातोटा पत्रक', N'Expenses', 0, 1, NULL, N'Other Miscellaneous Expenses', 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (405, N'थकीत व्याज येणे खाते', 52, 0.00, N'Dr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (406, N'थकीत व्याज तरतूद खाते', 18, 0.00, N'Cr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (407, N'थकीत वसुली खर्च येणे खाते', 52, 0.00, N'Dr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (408, N'थकीत वसुली खर्च तरतूद खाते', 18, 0.00, N'Cr', NULL, NULL, 1, 1, NULL, NULL, 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (409, N'१३३ कर्ज व्याज सूट', 26, 0.00, N'Dr', NULL, N'Expense', 0, 1, NULL, NULL, 0, NULL);
INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive], [LegacyLedgerId], [LedgerNameEnglish], [DisplayOrder], [LedgerCode]) VALUES (410, N'देणे सरचार्ज', 20, 0.00, N'Dr', N'ताळेबंद', N'GL', 0, 1, NULL, N'Payable Surcharge', 0, NULL);
GO
SET IDENTITY_INSERT [dbo].[Ledgers] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[ShareSchemes] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[ShareSchemes] ON;
GO
INSERT INTO [dbo].[ShareSchemes] ([ShareSchemeId], [BranchID], [SchemeCode], [SchemeName], [MemberType], [ShareFaceValue], [MinSharesCount], [MaxSharesCount], [EntranceFee], [BuildingFund], [ShareTransferFee], [DividendRate], [HasVotingRights], [IsAadhaarCompulsory], [IsPanCompulsory], [LoanEligibilityMultiplier], [EffectiveDate], [IsActive], [ShareCapitalLedgerID], [EntranceFeeLedgerID], [ShareTransferFeeLedgerID], [BuildingFundLedgerID], [DividendPayableLedgerID], [IsMobileCompulsory]) VALUES (1, 1, N'SHR-REG-01', N'नियमित सभासद शेअर योजना', N'Regular', 100.00, 1, 1000, 10.00, 0.00, 25.00, 10.00, 1, 0, 0, 10, '2026-08-25 00.00.00.000', 1, 1, 315, 318, 6, 81, 0);
GO
SET IDENTITY_INSERT [dbo].[ShareSchemes] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[FdSchemes] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[FdSchemes] ON;
GO
INSERT INTO [dbo].[FdSchemes] ([FdSchemeID], [InstitutionID], [BranchID], [SchemeCode], [SchemeName], [DurationMonths], [InterestRate], [SeniorCitizenInterestRate], [InterestType], [InterestPostingMethod], [InterestCompoundingFrequency], [MinimumAmount], [MaximumAmount], [PrematureInterestRate], [EffectiveDate], [IsActive], [CreatedBy], [CreatedDate], [ModifiedBy], [ModifiedDate], [FdLiabilityLedgerID], [InterestExpenseLedgerID], [InterestPayableLedgerID], [PrematurePenaltyLedgerID]) VALUES (1, 1, 1, N'FD-HO-01', N'मुदतबंद ठेव ', 13, 9.00, 9.00, N'Simple', N'On Principal', N'N/A', 1000.00, 1000000.00, 7.00, '2026-08-26 00.00.00.000', 1, 1, '2026-08-26 17.45.57.603', NULL, NULL, 48, 333, 114, 48);
GO
SET IDENTITY_INSERT [dbo].[FdSchemes] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[RdSchemes] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[RdSchemes] ON;
GO
INSERT INTO [dbo].[RdSchemes] ([RdSchemeID], [InstitutionID], [BranchID], [SchemeCode], [SchemeName], [DurationMonths], [InstallmentAmount], [MinimumInstallment], [MaximumInstallment], [InterestRate], [InterestMethod], [PenaltyAmount], [EffectiveDate], [IsActive], [CreatedBy], [CreatedDate], [ModifiedBy], [ModifiedDate], [RdLiabilityLedgerID], [InterestExpenseLedgerID], [InterestPayableLedgerID], [PenaltyIncomeLedgerID], [PrematurePenaltyRate]) VALUES (1, 1, 1, N'RDS001', N'रिकारींग ठेव ', 60, 100.00, 100.00, 50000.00, 9.00, N'Quarterly', 2.00, '2018-12-17 00.00.00.000', 1, 1, '2026-08-27 11.15.24.005', NULL, NULL, 49, 343, 111, 319, 7.00);
GO
SET IDENTITY_INSERT [dbo].[RdSchemes] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[PigmySchemes] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[PigmySchemes] ON;
GO
INSERT INTO [dbo].[PigmySchemes] ([PigmySchemeID], [SchemeName], [InterestRate], [DurationMonths], [Status], [CreatedBy], [CreatedDate], [PigmyLiabilityLedgerID], [CommissionExpenseLedgerID], [InterestExpenseLedgerID], [InterestPayableLedgerID], [SchemeCode]) VALUES (1, N'पिग्मी (जोर्तलिंग )ठेव', 3.00, 12, N'Active', 1, '2026-08-27 11.18.02.445', 47, 47, 332, 112, N'PGS001');
GO
SET IDENTITY_INSERT [dbo].[PigmySchemes] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[SavingInterestSettings] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[SavingInterestSettings] ON;
GO
INSERT INTO [dbo].[SavingInterestSettings] ([SettingID], [InterestRate], [CalculationMethod], [PostingFrequency], [EffectiveDate], [LedgerID], [CreatedBy], [CreatedOn], [SchemeName], [SavingLiabilityLedgerID], [InterestExpenseLedgerID], [InterestPayableLedgerID], [SchemeCode]) VALUES (1, 3.00, N'Minimum Balance (10th to Month-end)', N'Half Yearly', '2018-12-17 00.00.00.000', 46, 1, '2026-08-27 12.09.32.516', N'सेव्हिंग ठेव', 46, 331, 46, N'SAV001');
GO
SET IDENTITY_INSERT [dbo].[SavingInterestSettings] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[LoanRates] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[LoanRates] ON;
GO
INSERT INTO [dbo].[LoanRates] ([LoanRateID], [LoanType], [LoanCode], [LoanLedgerID], [InterestLedgerID], [OverdueInterestLedgerID], [ReceivableInterestLedgerID], [SurchargeLedgerID], [RecoveryFeeLedgerID], [ProcessingFeeLedgerID], [InterestRate], [OverdueInterestRate], [InterestPostingType], [InterestCalculationMethod], [ShortName], [DurationMonths], [InstallmentType], [InstallmentCount], [LoanInstallmentType], [SecurityType], [IsCcOrOd], [IsActive], [InterestPostingFrequency]) VALUES (1, N'वैयक्तिक कर्ज', N'LN01', 216, 273, 295, 246, 410, 407, 322, 12.00, 2.00, N'Monthly', N'Daily Reducing (दैनिक घटती)', N'Personal Loan', 12, N'Monthly', 12, N'EMI', N'Unsecured', 0, 1, N'त्रैमासिक (Quarterly)');
GO
SET IDENTITY_INSERT [dbo].[LoanRates] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[NpaConfigs] (1 rows)
-- -------------------------------------------------------------
INSERT INTO [dbo].[NpaConfigs] ([FinancialYear], [ConcessionPeriodDays]) VALUES (N'2026-27', 180);
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[NpaProvisionSlabs] (9 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[NpaProvisionSlabs] ON;
GO
INSERT INTO [dbo].[NpaProvisionSlabs] ([NpaProvisionSlabID], [FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES (10, N'2026-27', N'Standard', N'Both', 0.00, 6.00, 0.00, 0.00, 0.25);
INSERT INTO [dbo].[NpaProvisionSlabs] ([NpaProvisionSlabID], [FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES (11, N'2026-27', N'Sub-Standard', N'Both', 6.00, 18.00, 0.00, 12.00, 8.00);
INSERT INTO [dbo].[NpaProvisionSlabs] ([NpaProvisionSlabID], [FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES (12, N'2026-27', N'Doubtful-1', N'Secured', 18.00, 42.00, 12.00, 36.00, 25.00);
INSERT INTO [dbo].[NpaProvisionSlabs] ([NpaProvisionSlabID], [FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES (13, N'2026-27', N'Doubtful-1', N'Unsecured', 18.00, 42.00, 12.00, 36.00, 80.00);
INSERT INTO [dbo].[NpaProvisionSlabs] ([NpaProvisionSlabID], [FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES (14, N'2026-27', N'Doubtful-2', N'Secured', 42.00, 54.00, 36.00, 48.00, 30.00);
INSERT INTO [dbo].[NpaProvisionSlabs] ([NpaProvisionSlabID], [FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES (15, N'2026-27', N'Doubtful-2', N'Unsecured', 42.00, 54.00, 36.00, 48.00, 90.00);
INSERT INTO [dbo].[NpaProvisionSlabs] ([NpaProvisionSlabID], [FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES (16, N'2026-27', N'Doubtful-3', N'Secured', 54.00, 999.00, 48.00, 999.00, 40.00);
INSERT INTO [dbo].[NpaProvisionSlabs] ([NpaProvisionSlabID], [FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES (17, N'2026-27', N'Doubtful-3', N'Unsecured', 54.00, 999.00, 48.00, 999.00, 100.00);
INSERT INTO [dbo].[NpaProvisionSlabs] ([NpaProvisionSlabID], [FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES (18, N'2026-27', N'Loss', N'Both', 0.00, 999.00, 0.00, 0.00, 100.00);
GO
SET IDENTITY_INSERT [dbo].[NpaProvisionSlabs] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[CifSequences] (1 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[CifSequences] ON;
GO
INSERT INTO [dbo].[CifSequences] ([SequenceID], [SequenceCode], [Prefix], [CurrentValue], [PaddingLength], [LastUpdated]) VALUES (1, N'CORE_CIF_SEQ', N'CIF', 0, 6, '2026-09-09 11.02.07.096');
GO
SET IDENTITY_INSERT [dbo].[CifSequences] OFF;
GO
-- -------------------------------------------------------------
-- Master Data: [dbo].[SystemVersionHistories] (2 rows)
-- -------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[SystemVersionHistories] ON;
GO
INSERT INTO [dbo].[SystemVersionHistories] ([Id], [Version], [ReleaseDate], [Changelog], [InstalledOn], [IsActive], [VersionNumber], [AppliedOn], [PatchName], [Status], [Remarks], [AppliedBy]) VALUES (1, NULL, N'2026-09-07', NULL, '2026-09-09 05.28.21.730', 1, N'2.4.2', '2026-09-09 05.28.21.730', N'SmartBanking VPS All-in-One Master Patch v2.4.2', N'SUCCESS', N'Full schema sync applied successfully with 0 data loss. Aligned Members schema to 13 canonical columns, added Customer-First Loan linkage, and universal CIF architecture.', N'VPS Administrator');
INSERT INTO [dbo].[SystemVersionHistories] ([Id], [Version], [ReleaseDate], [Changelog], [InstalledOn], [IsActive], [VersionNumber], [AppliedOn], [PatchName], [Status], [Remarks], [AppliedBy]) VALUES (2, NULL, N'2026-09-08', NULL, '2026-09-09 05.28.27.013', 1, N'2.4.5', '2026-09-09 05.28.27.013', N'SmartBanking VPS Multi-App Master Patch v2.4.5', N'SUCCESS', N'Transitioned Fixed Deposit (FD) and Recurring Deposit (RD) to 100% Pure CustomerID-First (CIF) architecture with zero data loss. Dropped MemberID from FdAccounts and RdAccounts, balanced all accounting vouchers with sub-ledger CustomerID tagging.', N'VPS Administrator');
GO
SET IDENTITY_INSERT [dbo].[SystemVersionHistories] OFF;
GO
ALTER TABLE [dbo].[AgentCustomerRequests]  WITH CHECK ADD  CONSTRAINT [FK_AgentCustomerRequests_Customers_CreatedCustomerID] FOREIGN KEY([CreatedCustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[AgentCustomerRequests] CHECK CONSTRAINT [FK_AgentCustomerRequests_Customers_CreatedCustomerID]
GO
ALTER TABLE [dbo].[Members]  WITH CHECK ADD  CONSTRAINT [FK_Members_Customers_CustomerID] FOREIGN KEY([CustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[Members] CHECK CONSTRAINT [FK_Members_Customers_CustomerID]
GO
ALTER TABLE [dbo].[PigmyAccounts]  WITH CHECK ADD  CONSTRAINT [FK_PigmyAccounts_Customers_CustomerID] FOREIGN KEY([CustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[PigmyAccounts] CHECK CONSTRAINT [FK_PigmyAccounts_Customers_CustomerID]
GO
ALTER TABLE [dbo].[RdAccounts]  WITH CHECK ADD  CONSTRAINT [FK_RdAccounts_Customers_CustomerID] FOREIGN KEY([CustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[RdAccounts] CHECK CONSTRAINT [FK_RdAccounts_Customers_CustomerID]
GO
ALTER TABLE [dbo].[RdAccounts]  WITH CHECK ADD  CONSTRAINT [FK_RdAccounts_Customers_JointCustomerID] FOREIGN KEY([JointCustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[RdAccounts] CHECK CONSTRAINT [FK_RdAccounts_Customers_JointCustomerID]
GO
ALTER TABLE [dbo].[VoucherDetails]  WITH CHECK ADD  CONSTRAINT [FK_VoucherDetails_Customers_CustomerID] FOREIGN KEY([CustomerID])
REFERENCES [dbo].[Customers] ([CustomerID])
GO
ALTER TABLE [dbo].[VoucherDetails] CHECK CONSTRAINT [FK_VoucherDetails_Customers_CustomerID]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   VIEW [dbo].[vw_Members]
    AS
    SELECT 
        m.MemberID,
        m.CustomerID,
        m.BranchID,
        m.MemberCode,
        m.LegacyMemberNo,
        m.MembershipType,
        m.JoiningDate,
        m.Status,
        m.IsDeleted,
        m.CreatedBy,
        m.CreatedOn,
        m.UpdatedBy,
        m.UpdatedOn,
        c.CIFNo,
        c.FirstName,
        c.MiddleName,
        c.LastName,
        c.NickName,
        c.FirstNameEng,
        c.MiddleNameEng,
        c.LastNameEng,
        c.Address,
        c.AddressEng,
        c.Village,
        c.Taluka,
        c.District,
        c.MobileNo,
        c.AadhaarNo,
        c.PANNo,
        c.PhotoPath,
        c.SignaturePath,
        c.AadhaarDocPath,
        c.PanDocPath,
        c.Gender,
        c.BirthDate,
        c.Occupation,
        c.CasteCategory,
        c.Caste,
        c.Email,
        c.EmployerId,
        c.IsMinor,
        c.GuardianName,
        c.GuardianNameEng,
        c.GuardianRelation,
        c.GuardianAadhaarNo,
        c.GuardianMobileNo,
        c.GuardianAddress,
        c.NomineeName,
        c.NomineeNameEng,
        c.NomineeRelation,
        c.NomineeAddress,
        c.NomineeBirthDate,
        c.NomineeIsMinor,
        c.NomineeGuardianName
    FROM [dbo].[Members] m
    INNER JOIN [dbo].[Customers] c ON m.CustomerID = c.CustomerID;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE   PROCEDURE [dbo].[sp_SyncDatabaseIdentities]
AS
BEGIN
    SET NOCOUNT ON;
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;

    DECLARE @tbl NVARCHAR(256), @col NVARCHAR(256);
    DECLARE @sql NVARCHAR(MAX);
    DECLARE @reseededCount INT = 0;
    DECLARE @triggerCount INT = 0;

    -- Cursor across all user tables that contain an identity column
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
        -- A. Create / Alter AFTER DELETE self-healing trigger
        SET @sql = '
        CREATE OR ALTER TRIGGER [dbo].[trg_AutoReseed_' + REPLACE(@tbl, ' ', '_') + ']
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
                    IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(''[dbo].[' + @tbl + ']'') AND last_value IS NOT NULL)
                    BEGIN
                        DBCC CHECKIDENT (''[dbo].[' + @tbl + ']'', RESEED, 0) WITH NO_INFOMSGS;
                    END
                    ELSE
                    BEGIN
                        DBCC CHECKIDENT (''[dbo].[' + @tbl + ']'', RESEED, 1) WITH NO_INFOMSGS;
                    END
                END
            END TRY
            BEGIN CATCH
                -- Prevent blocking application deletes
            END CATCH
        END;';

        BEGIN TRY
            EXEC sp_executesql @sql;
            SET @triggerCount = @triggerCount + 1;
        END TRY
        BEGIN CATCH
            PRINT 'Failed creating trigger for ' + @tbl + ': ' + ERROR_MESSAGE();
        END CATCH

        -- B. Check if table is currently desynchronized (IDENT_CURRENT > MAX)
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
                    PRINT 'Reseeded ' + @tbl + ' from ' + CAST(@currentIdent AS NVARCHAR) + ' to ' + CAST(@actualMax AS NVARCHAR);
                    SET @reseededCount = @reseededCount + 1;
                END
            END
            ELSE
            BEGIN
                -- Table is empty. If last_value is null, reseed to 1; if already inserted then reseed to 0
                IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(@tbl) AND last_value IS NOT NULL)
                BEGIN
                    DBCC CHECKIDENT (@tbl, RESEED, 0) WITH NO_INFOMSGS;
                    PRINT 'Reseeded empty table ' + @tbl + ' to 0';
                    SET @reseededCount = @reseededCount + 1;
                END
                ELSE
                BEGIN
                    DBCC CHECKIDENT (@tbl, RESEED, 1) WITH NO_INFOMSGS;
                    PRINT 'Reseeded fresh empty table ' + @tbl + ' to 1';
                    SET @reseededCount = @reseededCount + 1;
                END
            END
        END TRY
        BEGIN CATCH
            PRINT 'Failed checking ident for ' + @tbl + ': ' + ERROR_MESSAGE();
        END CATCH

        FETCH NEXT FROM cur INTO @tbl, @col;
    END

    CLOSE cur;
    DEALLOCATE cur;

    PRINT 'Completed self-healing setup: ' + CAST(@triggerCount AS NVARCHAR) + ' triggers ensured, ' + CAST(@reseededCount AS NVARCHAR) + ' tables reseeded.';
END;

GO
-- =============================================================
-- Identity Reseed & CIF Sequence Initialization
-- =============================================================
UPDATE [dbo].[CifSequences] SET [CurrentValue] = 0, [LastUpdated] = GETDATE();
GO
DECLARE @reseedSql NVARCHAR(MAX) = N'';
SELECT @reseedSql += N'
IF OBJECT_ID(''' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ''', ''U'') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ')
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(''' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ''') AND last_value IS NOT NULL)
        BEGIN
            DBCC CHECKIDENT (''' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ''', RESEED, 0) WITH NO_INFOMSGS;
        END
    END
END;'
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.identity_columns c ON t.object_id = c.object_id
WHERE t.is_ms_shipped = 0;

EXEC sp_executesql @reseedSql;
GO
PRINT '===========================================================================';
PRINT '  SmartBanking_Template DATABASE READY FOR PRODUCTION CBS SYSTEM!          ';
PRINT '===========================================================================';
GO
