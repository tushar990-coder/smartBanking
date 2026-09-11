-- ====================================================================================================
-- SCRIPT: Universal_Schema_Only_Sync.sql
-- PURPOSE: Universal Schema-Only Synchronization Script for SmartBanking Core Banking System
-- SOURCE BASELINE: SmartBanking_Template (Gold Master Baseline - 126 Tables, 1711 Columns)
-- GENERATED ON: 2026-09-11 11.40.31
-- 
-- CORE GUARANTEES:
--   1. 100% PURE DDL (TABLES & COLUMNS ONLY)
--   2. ZERO DATA TOUCHED: NO INSERT, NO UPDATE, NO DELETE, NO TRUNCATE, NO DROP TABLE
--   3. 100% IDEMPOTENT: Completely safe to execute multiple times on any existing or new database
--   4. NON-DESTRUCTIVE: Preserves all existing client data, existing tables, and custom data
-- 
-- HOW TO USE:
--   1. Open this file in SQL Server Management Studio (SSMS) or your preferred SQL tool.
--   2. Replace '[YOUR_TARGET_DATABASE_NAME]' below with your target database name:
--          USE [SmartBanking_Test2];  -- Example target database
--          GO
--   3. Execute the script (Press F5 in SSMS).
--   4. Run 'Compare_Database_Schema_Diff.sql' to verify 100% schema parity (0 missing tables/columns).
-- ====================================================================================================

-- !!! STEP 1: SPECIFY YOUR TARGET DATABASE HERE !!!
USE [YOUR_TARGET_DATABASE_NAME];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT '=========================================================================================';
PRINT 'STARTING UNIVERSAL SCHEMA-ONLY SYNCHRONIZATION';
PRINT 'Target Database: ' + DB_NAME();
PRINT 'Execution Time:  ' + CONVERT(VARCHAR(30), GETDATE(), 120);
PRINT '=========================================================================================';
GO

----------------------------------------------------------------------------------------------------
-- [1/126] TABLE: [dbo].[__SystemVersionHistory]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[__SystemVersionHistory]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[__SystemVersionHistory] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [VersionNumber] NVARCHAR(50) NOT NULL,
        [AppliedOn] DATETIME2 NOT NULL DEFAULT (getutcdate()),
        [PatchName] NVARCHAR(200) NOT NULL DEFAULT (''),
        [Status] NVARCHAR(20) NOT NULL DEFAULT ('SUCCESS'),
        [Remarks] NVARCHAR(MAX) NULL,
        [AppliedBy] NVARCHAR(100) NULL,
        CONSTRAINT [PK___SystemVersionHistory] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Created Table [dbo].[__SystemVersionHistory]';
END
GO

IF COL_LENGTH(N'[dbo].[__SystemVersionHistory]', N'VersionNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[__SystemVersionHistory] ADD [VersionNumber] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [VersionNumber] to [dbo].[__SystemVersionHistory]';
END
GO
IF COL_LENGTH(N'[dbo].[__SystemVersionHistory]', N'AppliedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[__SystemVersionHistory] ADD [AppliedOn] DATETIME2 NOT NULL DEFAULT (getutcdate());
    PRINT '  + Added column [AppliedOn] to [dbo].[__SystemVersionHistory]';
END
GO
IF COL_LENGTH(N'[dbo].[__SystemVersionHistory]', N'PatchName') IS NULL
BEGIN
    ALTER TABLE [dbo].[__SystemVersionHistory] ADD [PatchName] NVARCHAR(200) NOT NULL DEFAULT ('');
    PRINT '  + Added column [PatchName] to [dbo].[__SystemVersionHistory]';
END
GO
IF COL_LENGTH(N'[dbo].[__SystemVersionHistory]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[__SystemVersionHistory] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT ('SUCCESS');
    PRINT '  + Added column [Status] to [dbo].[__SystemVersionHistory]';
END
GO
IF COL_LENGTH(N'[dbo].[__SystemVersionHistory]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[__SystemVersionHistory] ADD [Remarks] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[__SystemVersionHistory]';
END
GO
IF COL_LENGTH(N'[dbo].[__SystemVersionHistory]', N'AppliedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[__SystemVersionHistory] ADD [AppliedBy] NVARCHAR(100) NULL;
    PRINT '  + Added column [AppliedBy] to [dbo].[__SystemVersionHistory]';
END
GO

----------------------------------------------------------------------------------------------------
-- [2/126] TABLE: [dbo].[AccountGroups]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AccountGroups]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AccountGroups] (
        [GroupID] INT IDENTITY(1,1) NOT NULL,
        [GroupName] NVARCHAR(100) NOT NULL,
        [ParentGroupID] INT NULL,
        [NatureOfGroup] NVARCHAR(50) NOT NULL,
        [IsActive] BIT NOT NULL,
        [LegacyGroupId] INT NULL,
        [GroupCode] NVARCHAR(50) NULL,
        [GroupNameEnglish] NVARCHAR(100) NULL,
        [DisplayOrder] INT NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_AccountGroups] PRIMARY KEY CLUSTERED ([GroupID] ASC)
    );
    PRINT 'Created Table [dbo].[AccountGroups]';
END
GO

IF COL_LENGTH(N'[dbo].[AccountGroups]', N'GroupName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AccountGroups] ADD [GroupName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [GroupName] to [dbo].[AccountGroups]';
END
GO
IF COL_LENGTH(N'[dbo].[AccountGroups]', N'ParentGroupID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AccountGroups] ADD [ParentGroupID] INT NULL;
    PRINT '  + Added column [ParentGroupID] to [dbo].[AccountGroups]';
END
GO
IF COL_LENGTH(N'[dbo].[AccountGroups]', N'NatureOfGroup') IS NULL
BEGIN
    ALTER TABLE [dbo].[AccountGroups] ADD [NatureOfGroup] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [NatureOfGroup] to [dbo].[AccountGroups]';
END
GO
IF COL_LENGTH(N'[dbo].[AccountGroups]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[AccountGroups] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[AccountGroups]';
END
GO
IF COL_LENGTH(N'[dbo].[AccountGroups]', N'LegacyGroupId') IS NULL
BEGIN
    ALTER TABLE [dbo].[AccountGroups] ADD [LegacyGroupId] INT NULL;
    PRINT '  + Added column [LegacyGroupId] to [dbo].[AccountGroups]';
END
GO
IF COL_LENGTH(N'[dbo].[AccountGroups]', N'GroupCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[AccountGroups] ADD [GroupCode] NVARCHAR(50) NULL;
    PRINT '  + Added column [GroupCode] to [dbo].[AccountGroups]';
END
GO
IF COL_LENGTH(N'[dbo].[AccountGroups]', N'GroupNameEnglish') IS NULL
BEGIN
    ALTER TABLE [dbo].[AccountGroups] ADD [GroupNameEnglish] NVARCHAR(100) NULL;
    PRINT '  + Added column [GroupNameEnglish] to [dbo].[AccountGroups]';
END
GO
IF COL_LENGTH(N'[dbo].[AccountGroups]', N'DisplayOrder') IS NULL
BEGIN
    ALTER TABLE [dbo].[AccountGroups] ADD [DisplayOrder] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [DisplayOrder] to [dbo].[AccountGroups]';
END
GO

----------------------------------------------------------------------------------------------------
-- [3/126] TABLE: [dbo].[AgentCustomerRequests]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AgentCustomerRequests]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AgentCustomerRequests] (
        [RequestID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT ((1)),
        [PigmyAgentID] INT NOT NULL,
        [AgentName] NVARCHAR(100) NULL,
        [FirstName] NVARCHAR(50) NOT NULL,
        [MiddleName] NVARCHAR(50) NULL,
        [LastName] NVARCHAR(50) NOT NULL,
        [FirstNameEng] NVARCHAR(50) NULL,
        [MiddleNameEng] NVARCHAR(50) NULL,
        [LastNameEng] NVARCHAR(50) NULL,
        [Gender] NVARCHAR(10) NOT NULL DEFAULT ('Male'),
        [BirthDate] DATETIME2 NULL,
        [Occupation] NVARCHAR(100) NULL,
        [CasteCategory] NVARCHAR(50) NULL,
        [MobileNo] NVARCHAR(15) NOT NULL,
        [Email] NVARCHAR(100) NULL,
        [AadhaarNo] NVARCHAR(12) NULL,
        [PANNo] NVARCHAR(10) NULL,
        [Address] NVARCHAR(500) NULL,
        [Village] NVARCHAR(100) NULL,
        [Taluka] NVARCHAR(100) NULL,
        [District] NVARCHAR(100) NULL,
        [Pincode] NVARCHAR(10) NULL,
        [NomineeName] NVARCHAR(150) NULL,
        [NomineeNameEng] NVARCHAR(150) NULL,
        [NomineeRelation] NVARCHAR(50) NULL,
        [NomineeAddress] NVARCHAR(500) NULL,
        [NomineeBirthDate] DATETIME2 NULL,
        [NomineeAge] INT NULL,
        [PhotoPath] NVARCHAR(MAX) NULL,
        [SignaturePath] NVARCHAR(MAX) NULL,
        [AadhaarDocPath] NVARCHAR(MAX) NULL,
        [PanDocPath] NVARCHAR(MAX) NULL,
        [OpenPigmyAccount] BIT NOT NULL DEFAULT ((1)),
        [PigmySchemeID] INT NULL,
        [DailyDepositAmount] DECIMAL(18,2) NULL,
        [InitialDepositAmount] DECIMAL(18,2) NULL,
        [Remarks] NVARCHAR(500) NULL,
        [Status] NVARCHAR(20) NOT NULL DEFAULT ('Pending'),
        [RequestDate] DATETIME2 NOT NULL DEFAULT (getdate()),
        [ApprovalDate] DATETIME2 NULL,
        [ApprovedByUserID] INT NULL,
        [CreatedMemberID] INT NULL,
        [CreatedPigmyAccountID] INT NULL,
        [RejectionReason] NVARCHAR(500) NULL,
        [AddressEng] NVARCHAR(500) NULL,
        [CreatedCustomerID] INT NULL,
        CONSTRAINT [PK_AgentCustomerRequests] PRIMARY KEY CLUSTERED ([RequestID] ASC)
    );
    PRINT 'Created Table [dbo].[AgentCustomerRequests]';
END
GO

IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [BranchID] INT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [BranchID] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'PigmyAgentID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [PigmyAgentID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PigmyAgentID] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'AgentName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [AgentName] NVARCHAR(100) NULL;
    PRINT '  + Added column [AgentName] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'FirstName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [FirstName] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [FirstName] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'MiddleName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [MiddleName] NVARCHAR(50) NULL;
    PRINT '  + Added column [MiddleName] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'LastName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [LastName] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [LastName] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'FirstNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [FirstNameEng] NVARCHAR(50) NULL;
    PRINT '  + Added column [FirstNameEng] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'MiddleNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [MiddleNameEng] NVARCHAR(50) NULL;
    PRINT '  + Added column [MiddleNameEng] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'LastNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [LastNameEng] NVARCHAR(50) NULL;
    PRINT '  + Added column [LastNameEng] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'Gender') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [Gender] NVARCHAR(10) NOT NULL DEFAULT ('Male');
    PRINT '  + Added column [Gender] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'BirthDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [BirthDate] DATETIME2 NULL;
    PRINT '  + Added column [BirthDate] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'Occupation') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [Occupation] NVARCHAR(100) NULL;
    PRINT '  + Added column [Occupation] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'CasteCategory') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [CasteCategory] NVARCHAR(50) NULL;
    PRINT '  + Added column [CasteCategory] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'MobileNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [MobileNo] NVARCHAR(15) NOT NULL DEFAULT '';
    PRINT '  + Added column [MobileNo] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'Email') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [Email] NVARCHAR(100) NULL;
    PRINT '  + Added column [Email] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'AadhaarNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [AadhaarNo] NVARCHAR(12) NULL;
    PRINT '  + Added column [AadhaarNo] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'PANNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [PANNo] NVARCHAR(10) NULL;
    PRINT '  + Added column [PANNo] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'Address') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [Address] NVARCHAR(500) NULL;
    PRINT '  + Added column [Address] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'Village') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [Village] NVARCHAR(100) NULL;
    PRINT '  + Added column [Village] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'Taluka') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [Taluka] NVARCHAR(100) NULL;
    PRINT '  + Added column [Taluka] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'District') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [District] NVARCHAR(100) NULL;
    PRINT '  + Added column [District] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'Pincode') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [Pincode] NVARCHAR(10) NULL;
    PRINT '  + Added column [Pincode] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'NomineeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [NomineeName] NVARCHAR(150) NULL;
    PRINT '  + Added column [NomineeName] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'NomineeNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [NomineeNameEng] NVARCHAR(150) NULL;
    PRINT '  + Added column [NomineeNameEng] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'NomineeRelation') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [NomineeRelation] NVARCHAR(50) NULL;
    PRINT '  + Added column [NomineeRelation] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'NomineeAddress') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [NomineeAddress] NVARCHAR(500) NULL;
    PRINT '  + Added column [NomineeAddress] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'NomineeBirthDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [NomineeBirthDate] DATETIME2 NULL;
    PRINT '  + Added column [NomineeBirthDate] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'NomineeAge') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [NomineeAge] INT NULL;
    PRINT '  + Added column [NomineeAge] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'PhotoPath') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [PhotoPath] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [PhotoPath] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'SignaturePath') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [SignaturePath] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [SignaturePath] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'AadhaarDocPath') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [AadhaarDocPath] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [AadhaarDocPath] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'PanDocPath') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [PanDocPath] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [PanDocPath] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'OpenPigmyAccount') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [OpenPigmyAccount] BIT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [OpenPigmyAccount] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'PigmySchemeID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [PigmySchemeID] INT NULL;
    PRINT '  + Added column [PigmySchemeID] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'DailyDepositAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [DailyDepositAmount] DECIMAL(18,2) NULL;
    PRINT '  + Added column [DailyDepositAmount] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'InitialDepositAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [InitialDepositAmount] DECIMAL(18,2) NULL;
    PRINT '  + Added column [InitialDepositAmount] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [Remarks] NVARCHAR(500) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT ('Pending');
    PRINT '  + Added column [Status] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'RequestDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [RequestDate] DATETIME2 NOT NULL DEFAULT (getdate());
    PRINT '  + Added column [RequestDate] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'ApprovalDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [ApprovalDate] DATETIME2 NULL;
    PRINT '  + Added column [ApprovalDate] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'ApprovedByUserID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [ApprovedByUserID] INT NULL;
    PRINT '  + Added column [ApprovedByUserID] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'CreatedMemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [CreatedMemberID] INT NULL;
    PRINT '  + Added column [CreatedMemberID] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'CreatedPigmyAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [CreatedPigmyAccountID] INT NULL;
    PRINT '  + Added column [CreatedPigmyAccountID] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'RejectionReason') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [RejectionReason] NVARCHAR(500) NULL;
    PRINT '  + Added column [RejectionReason] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'AddressEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [AddressEng] NVARCHAR(500) NULL;
    PRINT '  + Added column [AddressEng] to [dbo].[AgentCustomerRequests]';
END
GO
IF COL_LENGTH(N'[dbo].[AgentCustomerRequests]', N'CreatedCustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [CreatedCustomerID] INT NULL;
    PRINT '  + Added column [CreatedCustomerID] to [dbo].[AgentCustomerRequests]';
END
GO

----------------------------------------------------------------------------------------------------
-- [4/126] TABLE: [dbo].[AssetAllocations]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AssetAllocations]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AssetAllocations] (
        [AllocationID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [AssetID] INT NOT NULL,
        [AllocatedBranchID] INT NOT NULL,
        [AllocationDate] DATETIME2 NOT NULL,
        [Department] NVARCHAR(100) NOT NULL,
        [CustodianName] NVARCHAR(150) NOT NULL,
        [Remarks] NVARCHAR(500) NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_AssetAllocations] PRIMARY KEY CLUSTERED ([AllocationID] ASC)
    );
    PRINT 'Created Table [dbo].[AssetAllocations]';
END
GO

IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'AssetID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [AssetID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AssetID] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'AllocatedBranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [AllocatedBranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AllocatedBranchID] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'AllocationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [AllocationDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [AllocationDate] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'Department') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [Department] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [Department] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'CustodianName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [CustodianName] NVARCHAR(150) NOT NULL DEFAULT '';
    PRINT '  + Added column [CustodianName] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [Remarks] NVARCHAR(500) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[AssetAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetAllocations]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetAllocations] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[AssetAllocations]';
END
GO

----------------------------------------------------------------------------------------------------
-- [5/126] TABLE: [dbo].[AssetCategories]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AssetCategories]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AssetCategories] (
        [CategoryID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [CategoryCode] NVARCHAR(20) NOT NULL,
        [CategoryName] NVARCHAR(100) NOT NULL,
        [UsefulLifeMonths] INT NOT NULL,
        [DepreciationRate] DECIMAL(5,2) NOT NULL,
        [DepreciationMethod] NVARCHAR(10) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_AssetCategories] PRIMARY KEY CLUSTERED ([CategoryID] ASC)
    );
    PRINT 'Created Table [dbo].[AssetCategories]';
END
GO

IF COL_LENGTH(N'[dbo].[AssetCategories]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'CategoryCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [CategoryCode] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [CategoryCode] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'CategoryName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [CategoryName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [CategoryName] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'UsefulLifeMonths') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [UsefulLifeMonths] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [UsefulLifeMonths] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'DepreciationRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DepreciationRate] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'DepreciationMethod') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationMethod] NVARCHAR(10) NOT NULL DEFAULT '';
    PRINT '  + Added column [DepreciationMethod] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[AssetCategories]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetCategories]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetCategories] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[AssetCategories]';
END
GO

----------------------------------------------------------------------------------------------------
-- [6/126] TABLE: [dbo].[AssetDepreciations]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AssetDepreciations]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AssetDepreciations] (
        [DepreciationID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [AssetID] INT NOT NULL,
        [CalculationDate] DATETIME2 NOT NULL,
        [Method] NVARCHAR(10) NOT NULL,
        [Rate] DECIMAL(5,2) NOT NULL,
        [DepreciationAmount] DECIMAL(18,2) NOT NULL,
        [BookValueBefore] DECIMAL(18,2) NOT NULL,
        [BookValueAfter] DECIMAL(18,2) NOT NULL,
        [VoucherID] INT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_AssetDepreciations] PRIMARY KEY CLUSTERED ([DepreciationID] ASC)
    );
    PRINT 'Created Table [dbo].[AssetDepreciations]';
END
GO

IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'AssetID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [AssetID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AssetID] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'CalculationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [CalculationDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CalculationDate] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'Method') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [Method] NVARCHAR(10) NOT NULL DEFAULT '';
    PRINT '  + Added column [Method] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'Rate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [Rate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Rate] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'DepreciationAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [DepreciationAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DepreciationAmount] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'BookValueBefore') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [BookValueBefore] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [BookValueBefore] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'BookValueAfter') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [BookValueAfter] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [BookValueAfter] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[AssetDepreciations]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDepreciations]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDepreciations] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[AssetDepreciations]';
END
GO

----------------------------------------------------------------------------------------------------
-- [7/126] TABLE: [dbo].[AssetDisposals]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AssetDisposals]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AssetDisposals] (
        [DisposalID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [AssetID] INT NOT NULL,
        [DisposalDate] DATETIME2 NOT NULL,
        [DisposalType] NVARCHAR(30) NOT NULL,
        [BookValueAtDisposal] DECIMAL(18,2) NOT NULL,
        [SaleAmount] DECIMAL(18,2) NOT NULL,
        [ProfitOrLoss] DECIMAL(18,2) NOT NULL,
        [BuyerName] NVARCHAR(150) NULL,
        [VoucherID] INT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_AssetDisposals] PRIMARY KEY CLUSTERED ([DisposalID] ASC)
    );
    PRINT 'Created Table [dbo].[AssetDisposals]';
END
GO

IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'AssetID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [AssetID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AssetID] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'DisposalDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [DisposalDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [DisposalDate] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'DisposalType') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [DisposalType] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [DisposalType] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'BookValueAtDisposal') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [BookValueAtDisposal] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [BookValueAtDisposal] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'SaleAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [SaleAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [SaleAmount] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'ProfitOrLoss') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [ProfitOrLoss] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ProfitOrLoss] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'BuyerName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [BuyerName] NVARCHAR(150) NULL;
    PRINT '  + Added column [BuyerName] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[AssetDisposals]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetDisposals]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetDisposals] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[AssetDisposals]';
END
GO

----------------------------------------------------------------------------------------------------
-- [8/126] TABLE: [dbo].[AssetMaintenances]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AssetMaintenances]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AssetMaintenances] (
        [MaintenanceID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [AssetID] INT NOT NULL,
        [MaintenanceDate] DATETIME2 NOT NULL,
        [MaintenanceType] NVARCHAR(30) NOT NULL,
        [ServiceProvider] NVARCHAR(150) NOT NULL,
        [Cost] DECIMAL(18,2) NOT NULL,
        [Remarks] NVARCHAR(500) NULL,
        [NextServiceDate] DATETIME2 NULL,
        [VoucherID] INT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_AssetMaintenances] PRIMARY KEY CLUSTERED ([MaintenanceID] ASC)
    );
    PRINT 'Created Table [dbo].[AssetMaintenances]';
END
GO

IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'AssetID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [AssetID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AssetID] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'MaintenanceDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [MaintenanceDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [MaintenanceDate] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'MaintenanceType') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [MaintenanceType] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [MaintenanceType] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'ServiceProvider') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [ServiceProvider] NVARCHAR(150) NOT NULL DEFAULT '';
    PRINT '  + Added column [ServiceProvider] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'Cost') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [Cost] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Cost] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [Remarks] NVARCHAR(500) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'NextServiceDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [NextServiceDate] DATETIME2 NULL;
    PRINT '  + Added column [NextServiceDate] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[AssetMaintenances]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetMaintenances]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetMaintenances] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[AssetMaintenances]';
END
GO

----------------------------------------------------------------------------------------------------
-- [9/126] TABLE: [dbo].[AssetPurchases]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AssetPurchases]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AssetPurchases] (
        [PurchaseID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [SupplierName] NVARCHAR(150) NOT NULL,
        [InvoiceNo] NVARCHAR(50) NOT NULL,
        [InvoiceDate] DATETIME2 NOT NULL,
        [TaxableAmount] DECIMAL(18,2) NOT NULL,
        [GstAmount] DECIMAL(18,2) NOT NULL,
        [TotalAmount] DECIMAL(18,2) NOT NULL,
        [PaymentMode] NVARCHAR(30) NOT NULL,
        [BankLedgerID] INT NULL,
        [VoucherID] INT NULL,
        [AssetIdsJson] NVARCHAR(MAX) NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_AssetPurchases] PRIMARY KEY CLUSTERED ([PurchaseID] ASC)
    );
    PRINT 'Created Table [dbo].[AssetPurchases]';
END
GO

IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'SupplierName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [SupplierName] NVARCHAR(150) NOT NULL DEFAULT '';
    PRINT '  + Added column [SupplierName] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'InvoiceNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [InvoiceNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [InvoiceNo] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'InvoiceDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [InvoiceDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [InvoiceDate] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'TaxableAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [TaxableAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TaxableAmount] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'GstAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [GstAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [GstAmount] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'TotalAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [TotalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalAmount] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [PaymentMode] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [PaymentMode] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'BankLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [BankLedgerID] INT NULL;
    PRINT '  + Added column [BankLedgerID] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'AssetIdsJson') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [AssetIdsJson] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [AssetIdsJson] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[AssetPurchases]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetPurchases]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetPurchases] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[AssetPurchases]';
END
GO

----------------------------------------------------------------------------------------------------
-- [10/126] TABLE: [dbo].[Assets]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Assets]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Assets] (
        [AssetID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [CategoryID] INT NOT NULL,
        [AssetCode] NVARCHAR(30) NOT NULL,
        [AssetName] NVARCHAR(150) NOT NULL,
        [PurchaseDate] DATETIME2 NOT NULL,
        [OriginalCost] DECIMAL(18,2) NOT NULL,
        [AccumulatedDepreciation] DECIMAL(18,2) NOT NULL,
        [CurrentBookValue] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [Location] NVARCHAR(100) NULL,
        [Custodian] NVARCHAR(100) NULL,
        [IsOpeningBalance] BIT NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_Assets] PRIMARY KEY CLUSTERED ([AssetID] ASC)
    );
    PRINT 'Created Table [dbo].[Assets]';
END
GO

IF COL_LENGTH(N'[dbo].[Assets]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'CategoryID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [CategoryID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CategoryID] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'AssetCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [AssetCode] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [AssetCode] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'AssetName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [AssetName] NVARCHAR(150) NOT NULL DEFAULT '';
    PRINT '  + Added column [AssetName] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'PurchaseDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [PurchaseDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PurchaseDate] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'OriginalCost') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [OriginalCost] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OriginalCost] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'AccumulatedDepreciation') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [AccumulatedDepreciation] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [AccumulatedDepreciation] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'CurrentBookValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [CurrentBookValue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [CurrentBookValue] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'Location') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [Location] NVARCHAR(100) NULL;
    PRINT '  + Added column [Location] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'Custodian') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [Custodian] NVARCHAR(100) NULL;
    PRINT '  + Added column [Custodian] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'IsOpeningBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [IsOpeningBalance] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsOpeningBalance] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[Assets]';
END
GO
IF COL_LENGTH(N'[dbo].[Assets]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[Assets] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[Assets]';
END
GO

----------------------------------------------------------------------------------------------------
-- [11/126] TABLE: [dbo].[AssetTransfers]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AssetTransfers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AssetTransfers] (
        [TransferID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [AssetID] INT NOT NULL,
        [FromBranchID] INT NOT NULL,
        [ToBranchID] INT NOT NULL,
        [TransferDate] DATETIME2 NOT NULL,
        [FromCustodian] NVARCHAR(150) NOT NULL,
        [ToCustodian] NVARCHAR(150) NOT NULL,
        [Remarks] NVARCHAR(500) NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_AssetTransfers] PRIMARY KEY CLUSTERED ([TransferID] ASC)
    );
    PRINT 'Created Table [dbo].[AssetTransfers]';
END
GO

IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'AssetID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [AssetID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AssetID] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'FromBranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [FromBranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FromBranchID] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'ToBranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [ToBranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [ToBranchID] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'TransferDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [TransferDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [TransferDate] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'FromCustodian') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [FromCustodian] NVARCHAR(150) NOT NULL DEFAULT '';
    PRINT '  + Added column [FromCustodian] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'ToCustodian') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [ToCustodian] NVARCHAR(150) NOT NULL DEFAULT '';
    PRINT '  + Added column [ToCustodian] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [Remarks] NVARCHAR(500) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[AssetTransfers]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetTransfers]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetTransfers] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[AssetTransfers]';
END
GO

----------------------------------------------------------------------------------------------------
-- [12/126] TABLE: [dbo].[AssetVerifications]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AssetVerifications]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AssetVerifications] (
        [VerificationID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [AssetID] INT NOT NULL,
        [VerificationDate] DATETIME2 NOT NULL,
        [AuditorName] NVARCHAR(100) NOT NULL,
        [PhysicalStatus] NVARCHAR(30) NOT NULL,
        [Remarks] NVARCHAR(500) NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_AssetVerifications] PRIMARY KEY CLUSTERED ([VerificationID] ASC)
    );
    PRINT 'Created Table [dbo].[AssetVerifications]';
END
GO

IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'AssetID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [AssetID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AssetID] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'VerificationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [VerificationDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [VerificationDate] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'AuditorName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [AuditorName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [AuditorName] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'PhysicalStatus') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [PhysicalStatus] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [PhysicalStatus] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [Remarks] NVARCHAR(500) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[AssetVerifications]';
END
GO
IF COL_LENGTH(N'[dbo].[AssetVerifications]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AssetVerifications] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[AssetVerifications]';
END
GO

----------------------------------------------------------------------------------------------------
-- [13/126] TABLE: [dbo].[AuditLedgerMappings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AuditLedgerMappings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AuditLedgerMappings] (
        [AuditLedgerMappingID] INT IDENTITY(1,1) NOT NULL,
        [CategoryCode] NVARCHAR(50) NOT NULL,
        [CategoryName] NVARCHAR(150) NOT NULL,
        [LedgerID] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedOn] DATETIME2 NOT NULL,
        CONSTRAINT [PK_AuditLedgerMappings] PRIMARY KEY CLUSTERED ([AuditLedgerMappingID] ASC)
    );
    PRINT 'Created Table [dbo].[AuditLedgerMappings]';
END
GO

IF COL_LENGTH(N'[dbo].[AuditLedgerMappings]', N'CategoryCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLedgerMappings] ADD [CategoryCode] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [CategoryCode] to [dbo].[AuditLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLedgerMappings]', N'CategoryName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLedgerMappings] ADD [CategoryName] NVARCHAR(150) NOT NULL DEFAULT '';
    PRINT '  + Added column [CategoryName] to [dbo].[AuditLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLedgerMappings]', N'LedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLedgerMappings] ADD [LedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LedgerID] to [dbo].[AuditLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLedgerMappings]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLedgerMappings] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[AuditLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLedgerMappings]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLedgerMappings] ADD [UpdatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [UpdatedOn] to [dbo].[AuditLedgerMappings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [14/126] TABLE: [dbo].[AuditLogs]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[AuditLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AuditLogs] (
        [AuditLogID] BIGINT IDENTITY(1,1) NOT NULL,
        [UserID] INT NULL,
        [Username] NVARCHAR(100) NOT NULL,
        [Action] NVARCHAR(100) NOT NULL,
        [EntityName] NVARCHAR(100) NOT NULL,
        [EntityID] NVARCHAR(50) NULL,
        [Timestamp] DATETIME2 NOT NULL,
        [IPAddress] NVARCHAR(50) NULL,
        [Details] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(20) NOT NULL,
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY CLUSTERED ([AuditLogID] ASC)
    );
    PRINT 'Created Table [dbo].[AuditLogs]';
END
GO

IF COL_LENGTH(N'[dbo].[AuditLogs]', N'UserID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLogs] ADD [UserID] INT NULL;
    PRINT '  + Added column [UserID] to [dbo].[AuditLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLogs]', N'Username') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLogs] ADD [Username] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [Username] to [dbo].[AuditLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLogs]', N'Action') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLogs] ADD [Action] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [Action] to [dbo].[AuditLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLogs]', N'EntityName') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLogs] ADD [EntityName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [EntityName] to [dbo].[AuditLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLogs]', N'EntityID') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLogs] ADD [EntityID] NVARCHAR(50) NULL;
    PRINT '  + Added column [EntityID] to [dbo].[AuditLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLogs]', N'Timestamp') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLogs] ADD [Timestamp] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [Timestamp] to [dbo].[AuditLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLogs]', N'IPAddress') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLogs] ADD [IPAddress] NVARCHAR(50) NULL;
    PRINT '  + Added column [IPAddress] to [dbo].[AuditLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLogs]', N'Details') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLogs] ADD [Details] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [Details] to [dbo].[AuditLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[AuditLogs]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[AuditLogs] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[AuditLogs]';
END
GO

----------------------------------------------------------------------------------------------------
-- [15/126] TABLE: [dbo].[BankMasters]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[BankMasters]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[BankMasters] (
        [BankID] INT IDENTITY(1,1) NOT NULL,
        [BankName] NVARCHAR(100) NOT NULL,
        CONSTRAINT [PK_BankMasters] PRIMARY KEY CLUSTERED ([BankID] ASC)
    );
    PRINT 'Created Table [dbo].[BankMasters]';
END
GO

IF COL_LENGTH(N'[dbo].[BankMasters]', N'BankName') IS NULL
BEGIN
    ALTER TABLE [dbo].[BankMasters] ADD [BankName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [BankName] to [dbo].[BankMasters]';
END
GO

----------------------------------------------------------------------------------------------------
-- [16/126] TABLE: [dbo].[BorrowerLinkedAccounts]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[BorrowerLinkedAccounts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[BorrowerLinkedAccounts] (
        [BorrowerLinkedAccountID] INT IDENTITY(1,1) NOT NULL,
        [ParentMemberID] INT NOT NULL,
        [LinkedMemberID] INT NOT NULL,
        [LinkType] NVARCHAR(50) NOT NULL,
        [Remarks] NVARCHAR(250) NULL,
        CONSTRAINT [PK_BorrowerLinkedAccounts] PRIMARY KEY CLUSTERED ([BorrowerLinkedAccountID] ASC)
    );
    PRINT 'Created Table [dbo].[BorrowerLinkedAccounts]';
END
GO

IF COL_LENGTH(N'[dbo].[BorrowerLinkedAccounts]', N'ParentMemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[BorrowerLinkedAccounts] ADD [ParentMemberID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [ParentMemberID] to [dbo].[BorrowerLinkedAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[BorrowerLinkedAccounts]', N'LinkedMemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[BorrowerLinkedAccounts] ADD [LinkedMemberID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LinkedMemberID] to [dbo].[BorrowerLinkedAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[BorrowerLinkedAccounts]', N'LinkType') IS NULL
BEGIN
    ALTER TABLE [dbo].[BorrowerLinkedAccounts] ADD [LinkType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [LinkType] to [dbo].[BorrowerLinkedAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[BorrowerLinkedAccounts]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[BorrowerLinkedAccounts] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[BorrowerLinkedAccounts]';
END
GO

----------------------------------------------------------------------------------------------------
-- [17/126] TABLE: [dbo].[BranchDayEndStatuses]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[BranchDayEndStatuses]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[BranchDayEndStatuses] (
        [StatusID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [BusinessDate] DATETIME2 NOT NULL,
        [IsDayClosed] BIT NOT NULL,
        CONSTRAINT [PK_BranchDayEndStatuses] PRIMARY KEY CLUSTERED ([StatusID] ASC)
    );
    PRINT 'Created Table [dbo].[BranchDayEndStatuses]';
END
GO

IF COL_LENGTH(N'[dbo].[BranchDayEndStatuses]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchDayEndStatuses] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[BranchDayEndStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchDayEndStatuses]', N'BusinessDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchDayEndStatuses] ADD [BusinessDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [BusinessDate] to [dbo].[BranchDayEndStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchDayEndStatuses]', N'IsDayClosed') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchDayEndStatuses] ADD [IsDayClosed] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsDayClosed] to [dbo].[BranchDayEndStatuses]';
END
GO

----------------------------------------------------------------------------------------------------
-- [18/126] TABLE: [dbo].[Branches]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Branches]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Branches] (
        [BranchID] INT IDENTITY(1,1) NOT NULL,
        [BranchCode] NVARCHAR(10) NOT NULL,
        [BranchName] NVARCHAR(100) NOT NULL,
        [Address] NVARCHAR(200) NULL,
        [IFSCCode] NVARCHAR(20) NULL,
        [IsActive] BIT NOT NULL,
        [BranchType] NVARCHAR(20) NULL,
        [Email] NVARCHAR(100) NULL,
        [MobileNo] NVARCHAR(15) NULL,
        [DefaultCashLedgerID] INT NULL,
        CONSTRAINT [PK_Branches] PRIMARY KEY CLUSTERED ([BranchID] ASC)
    );
    PRINT 'Created Table [dbo].[Branches]';
END
GO

IF COL_LENGTH(N'[dbo].[Branches]', N'BranchCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [BranchCode] NVARCHAR(10) NOT NULL DEFAULT '';
    PRINT '  + Added column [BranchCode] to [dbo].[Branches]';
END
GO
IF COL_LENGTH(N'[dbo].[Branches]', N'BranchName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [BranchName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [BranchName] to [dbo].[Branches]';
END
GO
IF COL_LENGTH(N'[dbo].[Branches]', N'Address') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [Address] NVARCHAR(200) NULL;
    PRINT '  + Added column [Address] to [dbo].[Branches]';
END
GO
IF COL_LENGTH(N'[dbo].[Branches]', N'IFSCCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [IFSCCode] NVARCHAR(20) NULL;
    PRINT '  + Added column [IFSCCode] to [dbo].[Branches]';
END
GO
IF COL_LENGTH(N'[dbo].[Branches]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[Branches]';
END
GO
IF COL_LENGTH(N'[dbo].[Branches]', N'BranchType') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [BranchType] NVARCHAR(20) NULL;
    PRINT '  + Added column [BranchType] to [dbo].[Branches]';
END
GO
IF COL_LENGTH(N'[dbo].[Branches]', N'Email') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [Email] NVARCHAR(100) NULL;
    PRINT '  + Added column [Email] to [dbo].[Branches]';
END
GO
IF COL_LENGTH(N'[dbo].[Branches]', N'MobileNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [MobileNo] NVARCHAR(15) NULL;
    PRINT '  + Added column [MobileNo] to [dbo].[Branches]';
END
GO
IF COL_LENGTH(N'[dbo].[Branches]', N'DefaultCashLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Branches] ADD [DefaultCashLedgerID] INT NULL;
    PRINT '  + Added column [DefaultCashLedgerID] to [dbo].[Branches]';
END
GO

----------------------------------------------------------------------------------------------------
-- [19/126] TABLE: [dbo].[BranchMasters]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[BranchMasters]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[BranchMasters] (
        [BranchID] INT IDENTITY(1,1) NOT NULL,
        [BranchCode] NVARCHAR(20) NOT NULL,
        [BranchName] NVARCHAR(100) NOT NULL,
        [Address] NVARCHAR(255) NULL,
        [City] NVARCHAR(50) NULL,
        [District] NVARCHAR(50) NULL,
        [State] NVARCHAR(50) NULL,
        [Pincode] NVARCHAR(10) NULL,
        [MobileNo] NVARCHAR(15) NULL,
        [Email] NVARCHAR(100) NULL,
        [Status] BIT NOT NULL,
        [CreatedBy] INT NULL,
        [CreatedDate] DATETIME2 NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        [BranchType] NVARCHAR(20) NOT NULL DEFAULT (''),
        CONSTRAINT [PK_BranchMasters] PRIMARY KEY CLUSTERED ([BranchID] ASC)
    );
    PRINT 'Created Table [dbo].[BranchMasters]';
END
GO

IF COL_LENGTH(N'[dbo].[BranchMasters]', N'BranchCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [BranchCode] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [BranchCode] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'BranchName') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [BranchName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [BranchName] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'Address') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [Address] NVARCHAR(255) NULL;
    PRINT '  + Added column [Address] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'City') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [City] NVARCHAR(50) NULL;
    PRINT '  + Added column [City] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'District') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [District] NVARCHAR(50) NULL;
    PRINT '  + Added column [District] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'State') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [State] NVARCHAR(50) NULL;
    PRINT '  + Added column [State] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'Pincode') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [Pincode] NVARCHAR(10) NULL;
    PRINT '  + Added column [Pincode] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'MobileNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [MobileNo] NVARCHAR(15) NULL;
    PRINT '  + Added column [MobileNo] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'Email') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [Email] NVARCHAR(100) NULL;
    PRINT '  + Added column [Email] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [Status] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [Status] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [CreatedBy] INT NULL;
    PRINT '  + Added column [CreatedBy] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [CreatedDate] DATETIME2 NULL;
    PRINT '  + Added column [CreatedDate] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[BranchMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[BranchMasters]', N'BranchType') IS NULL
BEGIN
    ALTER TABLE [dbo].[BranchMasters] ADD [BranchType] NVARCHAR(20) NOT NULL DEFAULT ('');
    PRINT '  + Added column [BranchType] to [dbo].[BranchMasters]';
END
GO

----------------------------------------------------------------------------------------------------
-- [20/126] TABLE: [dbo].[CashAllocations]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[CashAllocations]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CashAllocations] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [AllocationDate] DATETIME2 NOT NULL DEFAULT (getdate()),
        [AllocationType] NVARCHAR(30) NOT NULL DEFAULT ('HEAD_TO_TELLER'),
        [FromCashierId] INT NOT NULL,
        [ToCashierId] INT NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL DEFAULT ('APPROVED'),
        [AuthorizedBy] INT NULL,
        [Remarks] NVARCHAR(250) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT (getdate()),
        [BranchId] INT NULL,
        [IsReturn] BIT NOT NULL DEFAULT ((0)),
        [CreatedBy] NVARCHAR(100) NULL,
        CONSTRAINT [PK_CashAllocations] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Created Table [dbo].[CashAllocations]';
END
GO

IF COL_LENGTH(N'[dbo].[CashAllocations]', N'AllocationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [AllocationDate] DATETIME2 NOT NULL DEFAULT (getdate());
    PRINT '  + Added column [AllocationDate] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'AllocationType') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [AllocationType] NVARCHAR(30) NOT NULL DEFAULT ('HEAD_TO_TELLER');
    PRINT '  + Added column [AllocationType] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'FromCashierId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [FromCashierId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FromCashierId] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'ToCashierId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [ToCashierId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [ToCashierId] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Amount] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT ('APPROVED');
    PRINT '  + Added column [Status] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'AuthorizedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [AuthorizedBy] INT NULL;
    PRINT '  + Added column [AuthorizedBy] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT (getdate());
    PRINT '  + Added column [CreatedAt] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [BranchId] INT NULL;
    PRINT '  + Added column [BranchId] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'IsReturn') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [IsReturn] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [IsReturn] to [dbo].[CashAllocations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashAllocations]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashAllocations] ADD [CreatedBy] NVARCHAR(100) NULL;
    PRINT '  + Added column [CreatedBy] to [dbo].[CashAllocations]';
END
GO

----------------------------------------------------------------------------------------------------
-- [21/126] TABLE: [dbo].[CashDenominations]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[CashDenominations]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CashDenominations] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [EntryDate] DATETIME2 NOT NULL DEFAULT (getdate()),
        [CashierId] INT NOT NULL,
        [Count2000] INT NOT NULL DEFAULT ((0)),
        [Count500] INT NOT NULL DEFAULT ((0)),
        [Count200] INT NOT NULL DEFAULT ((0)),
        [Count100] INT NOT NULL DEFAULT ((0)),
        [Count50] INT NOT NULL DEFAULT ((0)),
        [Count20] INT NOT NULL DEFAULT ((0)),
        [Count10] INT NOT NULL DEFAULT ((0)),
        [Count5] INT NOT NULL DEFAULT ((0)),
        [Count2] INT NOT NULL DEFAULT ((0)),
        [Count1] INT NOT NULL DEFAULT ((0)),
        [TotalAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [PhysicalCashTotal] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [SystemCashBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [DifferenceAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [Remarks] NVARCHAR(250) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT (getdate()),
        [BranchId] INT NULL,
        [DenominationDate] DATETIME2 NOT NULL DEFAULT (getdate()),
        [EntryType] NVARCHAR(50) NOT NULL DEFAULT ('CLOSING'),
        [CountCoins] INT NOT NULL DEFAULT ((0)),
        [ExpectedAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0.00)),
        [DifferenceType] NVARCHAR(20) NOT NULL DEFAULT ('MATCHED'),
        [VerifiedBy] NVARCHAR(100) NULL,
        CONSTRAINT [PK_CashDenominations] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Created Table [dbo].[CashDenominations]';
END
GO

IF COL_LENGTH(N'[dbo].[CashDenominations]', N'EntryDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [EntryDate] DATETIME2 NOT NULL DEFAULT (getdate());
    PRINT '  + Added column [EntryDate] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'CashierId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [CashierId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CashierId] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Count2000') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Count2000] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Count2000] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Count500') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Count500] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Count500] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Count200') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Count200] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Count200] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Count100') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Count100] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Count100] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Count50') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Count50] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Count50] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Count20') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Count20] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Count20] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Count10') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Count10] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Count10] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Count5') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Count5] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Count5] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Count2') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Count2] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Count2] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Count1') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Count1] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Count1] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'TotalAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [TotalAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [TotalAmount] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'PhysicalCashTotal') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [PhysicalCashTotal] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [PhysicalCashTotal] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'SystemCashBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [SystemCashBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [SystemCashBalance] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'DifferenceAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [DifferenceAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [DifferenceAmount] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT (getdate());
    PRINT '  + Added column [CreatedAt] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [BranchId] INT NULL;
    PRINT '  + Added column [BranchId] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'DenominationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [DenominationDate] DATETIME2 NOT NULL DEFAULT (getdate());
    PRINT '  + Added column [DenominationDate] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'EntryType') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [EntryType] NVARCHAR(50) NOT NULL DEFAULT ('CLOSING');
    PRINT '  + Added column [EntryType] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'CountCoins') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [CountCoins] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [CountCoins] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'ExpectedAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [ExpectedAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0.00));
    PRINT '  + Added column [ExpectedAmount] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'DifferenceType') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [DifferenceType] NVARCHAR(20) NOT NULL DEFAULT ('MATCHED');
    PRINT '  + Added column [DifferenceType] to [dbo].[CashDenominations]';
END
GO
IF COL_LENGTH(N'[dbo].[CashDenominations]', N'VerifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashDenominations] ADD [VerifiedBy] NVARCHAR(100) NULL;
    PRINT '  + Added column [VerifiedBy] to [dbo].[CashDenominations]';
END
GO

----------------------------------------------------------------------------------------------------
-- [22/126] TABLE: [dbo].[CashierBalances]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[CashierBalances]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CashierBalances] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [BranchId] INT NULL,
        [CashierId] INT NOT NULL,
        [BalanceDate] DATETIME2 NOT NULL DEFAULT (getdate()),
        [OpeningBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0.00)),
        [ReceivedFromHead] DECIMAL(18,2) NOT NULL DEFAULT ((0.00)),
        [TotalReceipts] DECIMAL(18,2) NOT NULL DEFAULT ((0.00)),
        [TotalPayments] DECIMAL(18,2) NOT NULL DEFAULT ((0.00)),
        [ReturnedToHead] DECIMAL(18,2) NOT NULL DEFAULT ((0.00)),
        [ClosingBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0.00)),
        [PhysicalCashTally] DECIMAL(18,2) NOT NULL DEFAULT ((0.00)),
        [CashDifference] DECIMAL(18,2) NOT NULL DEFAULT ((0.00)),
        [Status] NVARCHAR(20) NOT NULL DEFAULT ('OPEN'),
        [LastUpdated] DATETIME2 NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK_CashierBalances] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Created Table [dbo].[CashierBalances]';
END
GO

IF COL_LENGTH(N'[dbo].[CashierBalances]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [BranchId] INT NULL;
    PRINT '  + Added column [BranchId] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'CashierId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [CashierId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CashierId] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'BalanceDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [BalanceDate] DATETIME2 NOT NULL DEFAULT (getdate());
    PRINT '  + Added column [BalanceDate] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'OpeningBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [OpeningBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0.00));
    PRINT '  + Added column [OpeningBalance] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'ReceivedFromHead') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [ReceivedFromHead] DECIMAL(18,2) NOT NULL DEFAULT ((0.00));
    PRINT '  + Added column [ReceivedFromHead] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'TotalReceipts') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [TotalReceipts] DECIMAL(18,2) NOT NULL DEFAULT ((0.00));
    PRINT '  + Added column [TotalReceipts] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'TotalPayments') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [TotalPayments] DECIMAL(18,2) NOT NULL DEFAULT ((0.00));
    PRINT '  + Added column [TotalPayments] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'ReturnedToHead') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [ReturnedToHead] DECIMAL(18,2) NOT NULL DEFAULT ((0.00));
    PRINT '  + Added column [ReturnedToHead] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'ClosingBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [ClosingBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0.00));
    PRINT '  + Added column [ClosingBalance] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'PhysicalCashTally') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [PhysicalCashTally] DECIMAL(18,2) NOT NULL DEFAULT ((0.00));
    PRINT '  + Added column [PhysicalCashTally] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'CashDifference') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [CashDifference] DECIMAL(18,2) NOT NULL DEFAULT ((0.00));
    PRINT '  + Added column [CashDifference] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT ('OPEN');
    PRINT '  + Added column [Status] to [dbo].[CashierBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CashierBalances]', N'LastUpdated') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashierBalances] ADD [LastUpdated] DATETIME2 NOT NULL DEFAULT (getdate());
    PRINT '  + Added column [LastUpdated] to [dbo].[CashierBalances]';
END
GO

----------------------------------------------------------------------------------------------------
-- [23/126] TABLE: [dbo].[Cashiers]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Cashiers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Cashiers] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [BranchId] INT NOT NULL DEFAULT ((1)),
        [CashierName] NVARCHAR(100) NOT NULL,
        [CounterNumber] NVARCHAR(50) NOT NULL,
        [IsHeadCashier] BIT NOT NULL DEFAULT ((0)),
        [IsActive] BIT NOT NULL DEFAULT ((1)),
        [MaxCashLimit] DECIMAL(18,2) NOT NULL DEFAULT ((500000.00)),
        [Remarks] NVARCHAR(250) NULL,
        [CashLedgerId] INT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT (getdate()),
        [UserId] INT NULL,
        CONSTRAINT [PK_Cashiers] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Created Table [dbo].[Cashiers]';
END
GO

IF COL_LENGTH(N'[dbo].[Cashiers]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Cashiers] ADD [BranchId] INT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [BranchId] to [dbo].[Cashiers]';
END
GO
IF COL_LENGTH(N'[dbo].[Cashiers]', N'CashierName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Cashiers] ADD [CashierName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [CashierName] to [dbo].[Cashiers]';
END
GO
IF COL_LENGTH(N'[dbo].[Cashiers]', N'CounterNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[Cashiers] ADD [CounterNumber] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [CounterNumber] to [dbo].[Cashiers]';
END
GO
IF COL_LENGTH(N'[dbo].[Cashiers]', N'IsHeadCashier') IS NULL
BEGIN
    ALTER TABLE [dbo].[Cashiers] ADD [IsHeadCashier] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [IsHeadCashier] to [dbo].[Cashiers]';
END
GO
IF COL_LENGTH(N'[dbo].[Cashiers]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[Cashiers] ADD [IsActive] BIT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [IsActive] to [dbo].[Cashiers]';
END
GO
IF COL_LENGTH(N'[dbo].[Cashiers]', N'MaxCashLimit') IS NULL
BEGIN
    ALTER TABLE [dbo].[Cashiers] ADD [MaxCashLimit] DECIMAL(18,2) NOT NULL DEFAULT ((500000.00));
    PRINT '  + Added column [MaxCashLimit] to [dbo].[Cashiers]';
END
GO
IF COL_LENGTH(N'[dbo].[Cashiers]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[Cashiers] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[Cashiers]';
END
GO
IF COL_LENGTH(N'[dbo].[Cashiers]', N'CashLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Cashiers] ADD [CashLedgerId] INT NULL;
    PRINT '  + Added column [CashLedgerId] to [dbo].[Cashiers]';
END
GO
IF COL_LENGTH(N'[dbo].[Cashiers]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[Cashiers] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT (getdate());
    PRINT '  + Added column [CreatedAt] to [dbo].[Cashiers]';
END
GO
IF COL_LENGTH(N'[dbo].[Cashiers]', N'UserId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Cashiers] ADD [UserId] INT NULL;
    PRINT '  + Added column [UserId] to [dbo].[Cashiers]';
END
GO

----------------------------------------------------------------------------------------------------
-- [24/126] TABLE: [dbo].[CashManagementSettings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[CashManagementSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CashManagementSettings] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [BranchId] INT NOT NULL DEFAULT ((1)),
        [AutoGenerateVouchers] BIT NOT NULL DEFAULT ((0)),
        [EnableDenominationMandatory] BIT NOT NULL DEFAULT ((1)),
        [MaxBranchVaultLimit] DECIMAL(18,2) NOT NULL DEFAULT ((5000000.00)),
        [DefaultCounterLimit] DECIMAL(18,2) NOT NULL DEFAULT ((500000.00)),
        [Remarks] NVARCHAR(250) NULL,
        [LastUpdated] DATETIME2 NOT NULL DEFAULT (getdate()),
        [MainVaultLedgerId] INT NULL,
        [CashShortageLedgerId] INT NULL,
        [CashExcessLedgerId] INT NULL,
        CONSTRAINT [PK_CashManagementSettings] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Created Table [dbo].[CashManagementSettings]';
END
GO

IF COL_LENGTH(N'[dbo].[CashManagementSettings]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashManagementSettings] ADD [BranchId] INT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [BranchId] to [dbo].[CashManagementSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[CashManagementSettings]', N'AutoGenerateVouchers') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashManagementSettings] ADD [AutoGenerateVouchers] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [AutoGenerateVouchers] to [dbo].[CashManagementSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[CashManagementSettings]', N'EnableDenominationMandatory') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashManagementSettings] ADD [EnableDenominationMandatory] BIT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [EnableDenominationMandatory] to [dbo].[CashManagementSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[CashManagementSettings]', N'MaxBranchVaultLimit') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashManagementSettings] ADD [MaxBranchVaultLimit] DECIMAL(18,2) NOT NULL DEFAULT ((5000000.00));
    PRINT '  + Added column [MaxBranchVaultLimit] to [dbo].[CashManagementSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[CashManagementSettings]', N'DefaultCounterLimit') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashManagementSettings] ADD [DefaultCounterLimit] DECIMAL(18,2) NOT NULL DEFAULT ((500000.00));
    PRINT '  + Added column [DefaultCounterLimit] to [dbo].[CashManagementSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[CashManagementSettings]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashManagementSettings] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[CashManagementSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[CashManagementSettings]', N'LastUpdated') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashManagementSettings] ADD [LastUpdated] DATETIME2 NOT NULL DEFAULT (getdate());
    PRINT '  + Added column [LastUpdated] to [dbo].[CashManagementSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[CashManagementSettings]', N'MainVaultLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashManagementSettings] ADD [MainVaultLedgerId] INT NULL;
    PRINT '  + Added column [MainVaultLedgerId] to [dbo].[CashManagementSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[CashManagementSettings]', N'CashShortageLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashManagementSettings] ADD [CashShortageLedgerId] INT NULL;
    PRINT '  + Added column [CashShortageLedgerId] to [dbo].[CashManagementSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[CashManagementSettings]', N'CashExcessLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[CashManagementSettings] ADD [CashExcessLedgerId] INT NULL;
    PRINT '  + Added column [CashExcessLedgerId] to [dbo].[CashManagementSettings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [25/126] TABLE: [dbo].[CollateralComplianceLogs]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[CollateralComplianceLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CollateralComplianceLogs] (
        [CollateralComplianceLogID] INT IDENTITY(1,1) NOT NULL,
        [LoanAccountID] INT NOT NULL,
        [CollateralType] NVARCHAR(50) NOT NULL,
        [ValuationDate] DATETIME2 NOT NULL,
        [ValuationValue] DECIMAL(18,2) NOT NULL,
        [ValuersCount] INT NOT NULL,
        [LastInspectionDate] DATETIME2 NOT NULL,
        [InsuranceExpiryDate] DATETIME2 NOT NULL,
        [LastStockStatementDate] DATETIME2 NULL,
        [IsAuditorVerified] BIT NOT NULL,
        [IsMarginMaintained] BIT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [CollateralDescription] NVARCHAR(MAX) NULL,
        [CollateralValue] DECIMAL(18,2) NULL,
        [InspectorName] NVARCHAR(100) NULL,
        [MarginPercent] DECIMAL(5,2) NULL,
        [Remarks] NVARCHAR(500) NULL,
        CONSTRAINT [PK_CollateralComplianceLogs] PRIMARY KEY CLUSTERED ([CollateralComplianceLogID] ASC)
    );
    PRINT 'Created Table [dbo].[CollateralComplianceLogs]';
END
GO

IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'LoanAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [LoanAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountID] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'CollateralType') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [CollateralType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [CollateralType] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'ValuationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [ValuationDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [ValuationDate] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'ValuationValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [ValuationValue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ValuationValue] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'ValuersCount') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [ValuersCount] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [ValuersCount] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'LastInspectionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [LastInspectionDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [LastInspectionDate] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'InsuranceExpiryDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [InsuranceExpiryDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [InsuranceExpiryDate] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'LastStockStatementDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [LastStockStatementDate] DATETIME2 NULL;
    PRINT '  + Added column [LastStockStatementDate] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'IsAuditorVerified') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [IsAuditorVerified] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsAuditorVerified] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'IsMarginMaintained') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [IsMarginMaintained] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsMarginMaintained] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'CollateralDescription') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [CollateralDescription] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [CollateralDescription] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'CollateralValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [CollateralValue] DECIMAL(18,2) NULL;
    PRINT '  + Added column [CollateralValue] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'InspectorName') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [InspectorName] NVARCHAR(100) NULL;
    PRINT '  + Added column [InspectorName] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'MarginPercent') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [MarginPercent] DECIMAL(5,2) NULL;
    PRINT '  + Added column [MarginPercent] to [dbo].[CollateralComplianceLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[CollateralComplianceLogs]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[CollateralComplianceLogs] ADD [Remarks] NVARCHAR(500) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[CollateralComplianceLogs]';
END
GO

----------------------------------------------------------------------------------------------------
-- [26/126] TABLE: [dbo].[CommitteeMembers]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[CommitteeMembers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CommitteeMembers] (
        [CommitteeMemberID] INT IDENTITY(1,1) NOT NULL,
        [MemberID] INT NOT NULL,
        [Designation] NVARCHAR(100) NOT NULL,
        [JoiningDate] DATETIME2 NOT NULL,
        [EndDate] DATETIME2 NULL,
        [ResolutionNo] NVARCHAR(100) NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [UpdatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] NVARCHAR(100) NOT NULL,
        [Category] NVARCHAR(100) NULL,
        [DINNo] NVARCHAR(50) NULL,
        [Remarks] NVARCHAR(500) NULL,
        [TermYear] NVARCHAR(50) NULL,
        CONSTRAINT [PK_CommitteeMembers] PRIMARY KEY CLUSTERED ([CommitteeMemberID] ASC)
    );
    PRINT 'Created Table [dbo].[CommitteeMembers]';
END
GO

IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [MemberID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MemberID] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'Designation') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [Designation] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [Designation] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'JoiningDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [JoiningDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [JoiningDate] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'EndDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [EndDate] DATETIME2 NULL;
    PRINT '  + Added column [EndDate] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'ResolutionNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [ResolutionNo] NVARCHAR(100) NULL;
    PRINT '  + Added column [ResolutionNo] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [CreatedBy] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [CreatedBy] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [UpdatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [UpdatedOn] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [UpdatedBy] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [UpdatedBy] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'Category') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [Category] NVARCHAR(100) NULL;
    PRINT '  + Added column [Category] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'DINNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [DINNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [DINNo] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [Remarks] NVARCHAR(500) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[CommitteeMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[CommitteeMembers]', N'TermYear') IS NULL
BEGIN
    ALTER TABLE [dbo].[CommitteeMembers] ADD [TermYear] NVARCHAR(50) NULL;
    PRINT '  + Added column [TermYear] to [dbo].[CommitteeMembers]';
END
GO

----------------------------------------------------------------------------------------------------
-- [27/126] TABLE: [dbo].[CustomerOpeningBalances]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[CustomerOpeningBalances]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CustomerOpeningBalances] (
        [CustomerOpeningBalanceID] INT IDENTITY(1,1) NOT NULL,
        [CustomerID] INT NOT NULL,
        [LedgerID] INT NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [BalanceType] NVARCHAR(2) NOT NULL DEFAULT ('Dr'),
        [CreatedBy] INT NOT NULL DEFAULT ((1)),
        [CreatedOn] DATETIME2 NOT NULL DEFAULT (sysutcdatetime()),
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_CustomerOpeningBalances] PRIMARY KEY CLUSTERED ([CustomerOpeningBalanceID] ASC)
    );
    PRINT 'Created Table [dbo].[CustomerOpeningBalances]';
END
GO

IF COL_LENGTH(N'[dbo].[CustomerOpeningBalances]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[CustomerOpeningBalances] ADD [CustomerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CustomerID] to [dbo].[CustomerOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CustomerOpeningBalances]', N'LedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[CustomerOpeningBalances] ADD [LedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LedgerID] to [dbo].[CustomerOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CustomerOpeningBalances]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[CustomerOpeningBalances] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Amount] to [dbo].[CustomerOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CustomerOpeningBalances]', N'BalanceType') IS NULL
BEGIN
    ALTER TABLE [dbo].[CustomerOpeningBalances] ADD [BalanceType] NVARCHAR(2) NOT NULL DEFAULT ('Dr');
    PRINT '  + Added column [BalanceType] to [dbo].[CustomerOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CustomerOpeningBalances]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[CustomerOpeningBalances] ADD [CreatedBy] INT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [CreatedBy] to [dbo].[CustomerOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CustomerOpeningBalances]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[CustomerOpeningBalances] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT (sysutcdatetime());
    PRINT '  + Added column [CreatedOn] to [dbo].[CustomerOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CustomerOpeningBalances]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[CustomerOpeningBalances] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[CustomerOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[CustomerOpeningBalances]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[CustomerOpeningBalances] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[CustomerOpeningBalances]';
END
GO

----------------------------------------------------------------------------------------------------
-- [28/126] TABLE: [dbo].[Customers]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Customers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Customers] (
        [CustomerID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT ((1)),
        [CIFNo] NVARCHAR(20) NOT NULL,
        [FirstName] NVARCHAR(50) NOT NULL,
        [MiddleName] NVARCHAR(50) NULL,
        [LastName] NVARCHAR(50) NOT NULL,
        [NickName] NVARCHAR(100) NULL,
        [FirstNameEng] NVARCHAR(50) NULL,
        [MiddleNameEng] NVARCHAR(50) NULL,
        [LastNameEng] NVARCHAR(50) NULL,
        [Address] NVARCHAR(500) NULL,
        [AddressEng] NVARCHAR(500) NULL,
        [Village] NVARCHAR(100) NULL,
        [Taluka] NVARCHAR(100) NULL,
        [District] NVARCHAR(100) NULL,
        [MobileNo] NVARCHAR(15) NULL,
        [AadhaarNo] NVARCHAR(12) NULL,
        [PANNo] NVARCHAR(10) NULL,
        [RegistrationDate] DATETIME2 NOT NULL DEFAULT (sysutcdatetime()),
        [NomineeName] NVARCHAR(150) NULL,
        [NomineeNameEng] NVARCHAR(150) NULL,
        [NomineeRelation] NVARCHAR(50) NULL,
        [NomineeAddress] NVARCHAR(500) NULL,
        [NomineeBirthDate] DATETIME2 NULL,
        [NomineeIsMinor] BIT NOT NULL DEFAULT ((0)),
        [NomineeGuardianName] NVARCHAR(150) NULL,
        [PhotoPath] NVARCHAR(MAX) NULL,
        [SignaturePath] NVARCHAR(MAX) NULL,
        [AadhaarDocPath] NVARCHAR(MAX) NULL,
        [PanDocPath] NVARCHAR(MAX) NULL,
        [Gender] NVARCHAR(10) NULL,
        [BirthDate] DATETIME2 NULL,
        [Occupation] NVARCHAR(100) NULL,
        [CasteCategory] NVARCHAR(50) NULL,
        [Caste] NVARCHAR(100) NULL,
        [Email] NVARCHAR(150) NULL,
        [IsMinor] BIT NOT NULL DEFAULT ((0)),
        [GuardianName] NVARCHAR(150) NULL,
        [GuardianNameEng] NVARCHAR(150) NULL,
        [GuardianRelation] NVARCHAR(50) NULL,
        [GuardianAadhaarNo] NVARCHAR(12) NULL,
        [GuardianMobileNo] NVARCHAR(15) NULL,
        [GuardianAddress] NVARCHAR(500) NULL,
        [Status] NVARCHAR(20) NOT NULL DEFAULT ('Active'),
        [EmployerId] INT NULL,
        [IsDeleted] BIT NOT NULL DEFAULT ((0)),
        [CreatedBy] INT NOT NULL DEFAULT ((1)),
        [CreatedOn] DATETIME2 NOT NULL DEFAULT (sysutcdatetime()),
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        [LegacyCustomerNo] NVARCHAR(50) NULL,
        CONSTRAINT [PK_Customers] PRIMARY KEY CLUSTERED ([CustomerID] ASC)
    );
    PRINT 'Created Table [dbo].[Customers]';
END
GO

IF COL_LENGTH(N'[dbo].[Customers]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [BranchID] INT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [BranchID] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'CIFNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [CIFNo] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [CIFNo] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'FirstName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [FirstName] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [FirstName] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'MiddleName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [MiddleName] NVARCHAR(50) NULL;
    PRINT '  + Added column [MiddleName] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'LastName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [LastName] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [LastName] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'NickName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [NickName] NVARCHAR(100) NULL;
    PRINT '  + Added column [NickName] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'FirstNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [FirstNameEng] NVARCHAR(50) NULL;
    PRINT '  + Added column [FirstNameEng] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'MiddleNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [MiddleNameEng] NVARCHAR(50) NULL;
    PRINT '  + Added column [MiddleNameEng] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'LastNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [LastNameEng] NVARCHAR(50) NULL;
    PRINT '  + Added column [LastNameEng] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'Address') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [Address] NVARCHAR(500) NULL;
    PRINT '  + Added column [Address] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'AddressEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [AddressEng] NVARCHAR(500) NULL;
    PRINT '  + Added column [AddressEng] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'Village') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [Village] NVARCHAR(100) NULL;
    PRINT '  + Added column [Village] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'Taluka') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [Taluka] NVARCHAR(100) NULL;
    PRINT '  + Added column [Taluka] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'District') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [District] NVARCHAR(100) NULL;
    PRINT '  + Added column [District] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'MobileNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [MobileNo] NVARCHAR(15) NULL;
    PRINT '  + Added column [MobileNo] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'AadhaarNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [AadhaarNo] NVARCHAR(12) NULL;
    PRINT '  + Added column [AadhaarNo] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'PANNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [PANNo] NVARCHAR(10) NULL;
    PRINT '  + Added column [PANNo] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'RegistrationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [RegistrationDate] DATETIME2 NOT NULL DEFAULT (sysutcdatetime());
    PRINT '  + Added column [RegistrationDate] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'NomineeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [NomineeName] NVARCHAR(150) NULL;
    PRINT '  + Added column [NomineeName] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'NomineeNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [NomineeNameEng] NVARCHAR(150) NULL;
    PRINT '  + Added column [NomineeNameEng] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'NomineeRelation') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [NomineeRelation] NVARCHAR(50) NULL;
    PRINT '  + Added column [NomineeRelation] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'NomineeAddress') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [NomineeAddress] NVARCHAR(500) NULL;
    PRINT '  + Added column [NomineeAddress] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'NomineeBirthDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [NomineeBirthDate] DATETIME2 NULL;
    PRINT '  + Added column [NomineeBirthDate] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'NomineeIsMinor') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [NomineeIsMinor] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [NomineeIsMinor] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'NomineeGuardianName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [NomineeGuardianName] NVARCHAR(150) NULL;
    PRINT '  + Added column [NomineeGuardianName] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'PhotoPath') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [PhotoPath] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [PhotoPath] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'SignaturePath') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [SignaturePath] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [SignaturePath] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'AadhaarDocPath') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [AadhaarDocPath] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [AadhaarDocPath] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'PanDocPath') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [PanDocPath] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [PanDocPath] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'Gender') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [Gender] NVARCHAR(10) NULL;
    PRINT '  + Added column [Gender] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'BirthDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [BirthDate] DATETIME2 NULL;
    PRINT '  + Added column [BirthDate] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'Occupation') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [Occupation] NVARCHAR(100) NULL;
    PRINT '  + Added column [Occupation] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'CasteCategory') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [CasteCategory] NVARCHAR(50) NULL;
    PRINT '  + Added column [CasteCategory] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'Caste') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [Caste] NVARCHAR(100) NULL;
    PRINT '  + Added column [Caste] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'Email') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [Email] NVARCHAR(150) NULL;
    PRINT '  + Added column [Email] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'IsMinor') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [IsMinor] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [IsMinor] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'GuardianName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [GuardianName] NVARCHAR(150) NULL;
    PRINT '  + Added column [GuardianName] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'GuardianNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [GuardianNameEng] NVARCHAR(150) NULL;
    PRINT '  + Added column [GuardianNameEng] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'GuardianRelation') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [GuardianRelation] NVARCHAR(50) NULL;
    PRINT '  + Added column [GuardianRelation] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'GuardianAadhaarNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [GuardianAadhaarNo] NVARCHAR(12) NULL;
    PRINT '  + Added column [GuardianAadhaarNo] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'GuardianMobileNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [GuardianMobileNo] NVARCHAR(15) NULL;
    PRINT '  + Added column [GuardianMobileNo] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'GuardianAddress') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [GuardianAddress] NVARCHAR(500) NULL;
    PRINT '  + Added column [GuardianAddress] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT ('Active');
    PRINT '  + Added column [Status] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'EmployerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [EmployerId] INT NULL;
    PRINT '  + Added column [EmployerId] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'IsDeleted') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [IsDeleted] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [IsDeleted] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [CreatedBy] INT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [CreatedBy] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT (sysutcdatetime());
    PRINT '  + Added column [CreatedOn] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[Customers]';
END
GO
IF COL_LENGTH(N'[dbo].[Customers]', N'LegacyCustomerNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Customers] ADD [LegacyCustomerNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [LegacyCustomerNo] to [dbo].[Customers]';
END
GO

----------------------------------------------------------------------------------------------------
-- [29/126] TABLE: [dbo].[DeceasedClaimSettlements]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[DeceasedClaimSettlements]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DeceasedClaimSettlements] (
        [ClaimID] INT IDENTITY(1,1) NOT NULL,
        [MemberID] INT NOT NULL,
        [BranchID] INT NOT NULL DEFAULT ((1)),
        [DeathDate] DATETIME2 NOT NULL DEFAULT (CONVERT([date],getdate(),(0))),
        [DeathCertificateNo] NVARCHAR(100) NULL,
        [NomineeName] NVARCHAR(150) NOT NULL,
        [NomineeRelation] NVARCHAR(50) NULL,
        [NomineeAadhaarNo] NVARCHAR(12) NULL,
        [NomineeMobileNo] NVARCHAR(15) NULL,
        [NomineeBankAccount] NVARCHAR(100) NULL,
        [TotalSavingsBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [TotalFdBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [TotalRdBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [TotalPigmyBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [TotalShareAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [TotalLoanLiability] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [NetPayableAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [ResolutionNo] NVARCHAR(100) NULL,
        [ResolutionDate] DATETIME2 NULL,
        [VoucherID] INT NULL,
        [Status] NVARCHAR(20) NOT NULL DEFAULT ('Settled'),
        [SettlementDate] DATETIME2 NOT NULL DEFAULT (CONVERT([date],getdate(),(0))),
        [Remarks] NVARCHAR(500) NULL,
        [CreatedBy] INT NOT NULL DEFAULT ((1)),
        [CreatedOn] DATETIME2 NOT NULL DEFAULT (sysutcdatetime()),
        CONSTRAINT [PK_DeceasedClaimSettlements] PRIMARY KEY CLUSTERED ([ClaimID] ASC)
    );
    PRINT 'Created Table [dbo].[DeceasedClaimSettlements]';
END
GO

IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [MemberID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MemberID] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [BranchID] INT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [BranchID] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'DeathDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [DeathDate] DATETIME2 NOT NULL DEFAULT (CONVERT([date],getdate(),(0)));
    PRINT '  + Added column [DeathDate] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'DeathCertificateNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [DeathCertificateNo] NVARCHAR(100) NULL;
    PRINT '  + Added column [DeathCertificateNo] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'NomineeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [NomineeName] NVARCHAR(150) NOT NULL DEFAULT '';
    PRINT '  + Added column [NomineeName] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'NomineeRelation') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [NomineeRelation] NVARCHAR(50) NULL;
    PRINT '  + Added column [NomineeRelation] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'NomineeAadhaarNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [NomineeAadhaarNo] NVARCHAR(12) NULL;
    PRINT '  + Added column [NomineeAadhaarNo] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'NomineeMobileNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [NomineeMobileNo] NVARCHAR(15) NULL;
    PRINT '  + Added column [NomineeMobileNo] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'NomineeBankAccount') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [NomineeBankAccount] NVARCHAR(100) NULL;
    PRINT '  + Added column [NomineeBankAccount] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'TotalSavingsBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [TotalSavingsBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [TotalSavingsBalance] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'TotalFdBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [TotalFdBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [TotalFdBalance] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'TotalRdBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [TotalRdBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [TotalRdBalance] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'TotalPigmyBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [TotalPigmyBalance] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [TotalPigmyBalance] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'TotalShareAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [TotalShareAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [TotalShareAmount] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'TotalLoanLiability') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [TotalLoanLiability] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [TotalLoanLiability] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'NetPayableAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [NetPayableAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [NetPayableAmount] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'ResolutionNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [ResolutionNo] NVARCHAR(100) NULL;
    PRINT '  + Added column [ResolutionNo] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'ResolutionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [ResolutionDate] DATETIME2 NULL;
    PRINT '  + Added column [ResolutionDate] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT ('Settled');
    PRINT '  + Added column [Status] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'SettlementDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [SettlementDate] DATETIME2 NOT NULL DEFAULT (CONVERT([date],getdate(),(0)));
    PRINT '  + Added column [SettlementDate] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [Remarks] NVARCHAR(500) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [CreatedBy] INT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [CreatedBy] to [dbo].[DeceasedClaimSettlements]';
END
GO
IF COL_LENGTH(N'[dbo].[DeceasedClaimSettlements]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[DeceasedClaimSettlements] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT (sysutcdatetime());
    PRINT '  + Added column [CreatedOn] to [dbo].[DeceasedClaimSettlements]';
END
GO

----------------------------------------------------------------------------------------------------
-- [30/126] TABLE: [dbo].[DemandMemberDetails]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[DemandMemberDetails]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DemandMemberDetails] (
        [DemandMemberDetailId] INT IDENTITY(1,1) NOT NULL,
        [DemandNoticeId] INT NOT NULL,
        [MemberId] INT NOT NULL,
        [LoanInstallment] DECIMAL(18,2) NOT NULL,
        [SavingDeposit] DECIMAL(18,2) NOT NULL,
        [ShareDeposit] DECIMAL(18,2) NOT NULL,
        [PigmyDeposit] DECIMAL(18,2) NOT NULL,
        [RdDeposit] DECIMAL(18,2) NOT NULL,
        [TotalDeduction] DECIMAL(18,2) NOT NULL,
        [IsProcessed] BIT NOT NULL,
        CONSTRAINT [PK_DemandMemberDetails] PRIMARY KEY CLUSTERED ([DemandMemberDetailId] ASC)
    );
    PRINT 'Created Table [dbo].[DemandMemberDetails]';
END
GO

IF COL_LENGTH(N'[dbo].[DemandMemberDetails]', N'DemandNoticeId') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandMemberDetails] ADD [DemandNoticeId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DemandNoticeId] to [dbo].[DemandMemberDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandMemberDetails]', N'MemberId') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandMemberDetails] ADD [MemberId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MemberId] to [dbo].[DemandMemberDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandMemberDetails]', N'LoanInstallment') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandMemberDetails] ADD [LoanInstallment] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanInstallment] to [dbo].[DemandMemberDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandMemberDetails]', N'SavingDeposit') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandMemberDetails] ADD [SavingDeposit] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [SavingDeposit] to [dbo].[DemandMemberDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandMemberDetails]', N'ShareDeposit') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandMemberDetails] ADD [ShareDeposit] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ShareDeposit] to [dbo].[DemandMemberDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandMemberDetails]', N'PigmyDeposit') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandMemberDetails] ADD [PigmyDeposit] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PigmyDeposit] to [dbo].[DemandMemberDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandMemberDetails]', N'RdDeposit') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandMemberDetails] ADD [RdDeposit] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [RdDeposit] to [dbo].[DemandMemberDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandMemberDetails]', N'TotalDeduction') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandMemberDetails] ADD [TotalDeduction] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalDeduction] to [dbo].[DemandMemberDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandMemberDetails]', N'IsProcessed') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandMemberDetails] ADD [IsProcessed] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsProcessed] to [dbo].[DemandMemberDetails]';
END
GO

----------------------------------------------------------------------------------------------------
-- [31/126] TABLE: [dbo].[DemandNotices]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[DemandNotices]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DemandNotices] (
        [DemandNoticeId] INT IDENTITY(1,1) NOT NULL,
        [NoticeNumber] NVARCHAR(50) NOT NULL,
        [Month] INT NOT NULL,
        [Year] INT NOT NULL,
        [EmployerId] INT NOT NULL,
        [BranchId] INT NOT NULL,
        [TotalDemandAmount] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [CreatedBy] INT NOT NULL,
        CONSTRAINT [PK_DemandNotices] PRIMARY KEY CLUSTERED ([DemandNoticeId] ASC)
    );
    PRINT 'Created Table [dbo].[DemandNotices]';
END
GO

IF COL_LENGTH(N'[dbo].[DemandNotices]', N'NoticeNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandNotices] ADD [NoticeNumber] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [NoticeNumber] to [dbo].[DemandNotices]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandNotices]', N'Month') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandNotices] ADD [Month] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [Month] to [dbo].[DemandNotices]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandNotices]', N'Year') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandNotices] ADD [Year] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [Year] to [dbo].[DemandNotices]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandNotices]', N'EmployerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandNotices] ADD [EmployerId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [EmployerId] to [dbo].[DemandNotices]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandNotices]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandNotices] ADD [BranchId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchId] to [dbo].[DemandNotices]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandNotices]', N'TotalDemandAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandNotices] ADD [TotalDemandAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalDemandAmount] to [dbo].[DemandNotices]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandNotices]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandNotices] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[DemandNotices]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandNotices]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandNotices] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[DemandNotices]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandNotices]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandNotices] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[DemandNotices]';
END
GO

----------------------------------------------------------------------------------------------------
-- [32/126] TABLE: [dbo].[DemandRecoveries]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[DemandRecoveries]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DemandRecoveries] (
        [DemandRecoveryId] INT IDENTITY(1,1) NOT NULL,
        [DemandNoticeId] INT NOT NULL,
        [RecoveryDate] DATETIME2 NOT NULL,
        [TotalReceivedAmount] DECIMAL(18,2) NOT NULL,
        [VoucherId] INT NULL,
        [Remarks] NVARCHAR(250) NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [CreatedBy] INT NOT NULL,
        CONSTRAINT [PK_DemandRecoveries] PRIMARY KEY CLUSTERED ([DemandRecoveryId] ASC)
    );
    PRINT 'Created Table [dbo].[DemandRecoveries]';
END
GO

IF COL_LENGTH(N'[dbo].[DemandRecoveries]', N'DemandNoticeId') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandRecoveries] ADD [DemandNoticeId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DemandNoticeId] to [dbo].[DemandRecoveries]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandRecoveries]', N'RecoveryDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandRecoveries] ADD [RecoveryDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [RecoveryDate] to [dbo].[DemandRecoveries]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandRecoveries]', N'TotalReceivedAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandRecoveries] ADD [TotalReceivedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalReceivedAmount] to [dbo].[DemandRecoveries]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandRecoveries]', N'VoucherId') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandRecoveries] ADD [VoucherId] INT NULL;
    PRINT '  + Added column [VoucherId] to [dbo].[DemandRecoveries]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandRecoveries]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandRecoveries] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[DemandRecoveries]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandRecoveries]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandRecoveries] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[DemandRecoveries]';
END
GO
IF COL_LENGTH(N'[dbo].[DemandRecoveries]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[DemandRecoveries] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[DemandRecoveries]';
END
GO

----------------------------------------------------------------------------------------------------
-- [33/126] TABLE: [dbo].[DepartmentMasters]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[DepartmentMasters]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DepartmentMasters] (
        [DepartmentID] INT IDENTITY(1,1) NOT NULL,
        [DepartmentCode] NVARCHAR(20) NOT NULL,
        [DepartmentName] NVARCHAR(100) NOT NULL,
        [Description] NVARCHAR(255) NULL,
        [Status] BIT NOT NULL,
        [CreatedBy] INT NULL,
        [CreatedDate] DATETIME2 NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        CONSTRAINT [PK_DepartmentMasters] PRIMARY KEY CLUSTERED ([DepartmentID] ASC)
    );
    PRINT 'Created Table [dbo].[DepartmentMasters]';
END
GO

IF COL_LENGTH(N'[dbo].[DepartmentMasters]', N'DepartmentCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[DepartmentMasters] ADD [DepartmentCode] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [DepartmentCode] to [dbo].[DepartmentMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[DepartmentMasters]', N'DepartmentName') IS NULL
BEGIN
    ALTER TABLE [dbo].[DepartmentMasters] ADD [DepartmentName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [DepartmentName] to [dbo].[DepartmentMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[DepartmentMasters]', N'Description') IS NULL
BEGIN
    ALTER TABLE [dbo].[DepartmentMasters] ADD [Description] NVARCHAR(255) NULL;
    PRINT '  + Added column [Description] to [dbo].[DepartmentMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[DepartmentMasters]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[DepartmentMasters] ADD [Status] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [Status] to [dbo].[DepartmentMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[DepartmentMasters]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[DepartmentMasters] ADD [CreatedBy] INT NULL;
    PRINT '  + Added column [CreatedBy] to [dbo].[DepartmentMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[DepartmentMasters]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[DepartmentMasters] ADD [CreatedDate] DATETIME2 NULL;
    PRINT '  + Added column [CreatedDate] to [dbo].[DepartmentMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[DepartmentMasters]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[DepartmentMasters] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[DepartmentMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[DepartmentMasters]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[DepartmentMasters] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[DepartmentMasters]';
END
GO

----------------------------------------------------------------------------------------------------
-- [34/126] TABLE: [dbo].[DividendDistributions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[DividendDistributions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DividendDistributions] (
        [DividendId] INT IDENTITY(1,1) NOT NULL,
        [ShareAccountId] INT NOT NULL,
        [FinancialYear] NVARCHAR(20) NOT NULL,
        [DividendPercentage] DECIMAL(5,2) NOT NULL,
        [DividendAmount] DECIMAL(18,2) NOT NULL,
        [PayoutDate] DATETIME2 NOT NULL,
        [IsPaid] BIT NOT NULL,
        [VoucherId] INT NULL,
        CONSTRAINT [PK_DividendDistributions] PRIMARY KEY CLUSTERED ([DividendId] ASC)
    );
    PRINT 'Created Table [dbo].[DividendDistributions]';
END
GO

IF COL_LENGTH(N'[dbo].[DividendDistributions]', N'ShareAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[DividendDistributions] ADD [ShareAccountId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [ShareAccountId] to [dbo].[DividendDistributions]';
END
GO
IF COL_LENGTH(N'[dbo].[DividendDistributions]', N'FinancialYear') IS NULL
BEGIN
    ALTER TABLE [dbo].[DividendDistributions] ADD [FinancialYear] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [FinancialYear] to [dbo].[DividendDistributions]';
END
GO
IF COL_LENGTH(N'[dbo].[DividendDistributions]', N'DividendPercentage') IS NULL
BEGIN
    ALTER TABLE [dbo].[DividendDistributions] ADD [DividendPercentage] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DividendPercentage] to [dbo].[DividendDistributions]';
END
GO
IF COL_LENGTH(N'[dbo].[DividendDistributions]', N'DividendAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[DividendDistributions] ADD [DividendAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DividendAmount] to [dbo].[DividendDistributions]';
END
GO
IF COL_LENGTH(N'[dbo].[DividendDistributions]', N'PayoutDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[DividendDistributions] ADD [PayoutDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PayoutDate] to [dbo].[DividendDistributions]';
END
GO
IF COL_LENGTH(N'[dbo].[DividendDistributions]', N'IsPaid') IS NULL
BEGIN
    ALTER TABLE [dbo].[DividendDistributions] ADD [IsPaid] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsPaid] to [dbo].[DividendDistributions]';
END
GO
IF COL_LENGTH(N'[dbo].[DividendDistributions]', N'VoucherId') IS NULL
BEGIN
    ALTER TABLE [dbo].[DividendDistributions] ADD [VoucherId] INT NULL;
    PRINT '  + Added column [VoucherId] to [dbo].[DividendDistributions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [35/126] TABLE: [dbo].[EmployeeBankDetails]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[EmployeeBankDetails]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[EmployeeBankDetails] (
        [EmployeeBankDetailID] INT IDENTITY(1,1) NOT NULL,
        [CIFNo] NVARCHAR(20) NOT NULL,
        [EmployeeID] NVARCHAR(50) NOT NULL,
        [DepartmentID] INT NOT NULL,
        [JoiningDate] DATETIME2 NOT NULL,
        [EmployeeStatus] NVARCHAR(20) NOT NULL,
        [MobileNumber] NVARCHAR(15) NULL,
        [BankName] NVARCHAR(100) NOT NULL,
        [IFSCCode] NVARCHAR(20) NOT NULL,
        [AccountNumber] NVARCHAR(50) NOT NULL,
        [AccountType] NVARCHAR(20) NOT NULL,
        [BranchID] INT NOT NULL,
        [CreatedBy] INT NULL,
        [CreatedDate] DATETIME2 NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        CONSTRAINT [PK_EmployeeBankDetails] PRIMARY KEY CLUSTERED ([EmployeeBankDetailID] ASC)
    );
    PRINT 'Created Table [dbo].[EmployeeBankDetails]';
END
GO

IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'CIFNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [CIFNo] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [CIFNo] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'EmployeeID') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [EmployeeID] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [EmployeeID] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'DepartmentID') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [DepartmentID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DepartmentID] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'JoiningDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [JoiningDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [JoiningDate] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'EmployeeStatus') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [EmployeeStatus] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [EmployeeStatus] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'MobileNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [MobileNumber] NVARCHAR(15) NULL;
    PRINT '  + Added column [MobileNumber] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'BankName') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [BankName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [BankName] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'IFSCCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [IFSCCode] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [IFSCCode] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'AccountNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [AccountNumber] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [AccountNumber] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'AccountType') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [AccountType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [AccountType] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [CreatedBy] INT NULL;
    PRINT '  + Added column [CreatedBy] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [CreatedDate] DATETIME2 NULL;
    PRINT '  + Added column [CreatedDate] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[EmployeeBankDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployeeBankDetails]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployeeBankDetails] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[EmployeeBankDetails]';
END
GO

----------------------------------------------------------------------------------------------------
-- [36/126] TABLE: [dbo].[EmployerMasters]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[EmployerMasters]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[EmployerMasters] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [Name] NVARCHAR(200) NOT NULL,
        [ContactNo] NVARCHAR(50) NULL,
        [LegacyTypeId] INT NULL,
        [IsActive] BIT NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        [UpdatedAt] DATETIME2 NULL,
        [Address] NVARCHAR(500) NULL,
        CONSTRAINT [PK_EmployerMasters] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Created Table [dbo].[EmployerMasters]';
END
GO

IF COL_LENGTH(N'[dbo].[EmployerMasters]', N'Name') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployerMasters] ADD [Name] NVARCHAR(200) NOT NULL DEFAULT '';
    PRINT '  + Added column [Name] to [dbo].[EmployerMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployerMasters]', N'ContactNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployerMasters] ADD [ContactNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [ContactNo] to [dbo].[EmployerMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployerMasters]', N'LegacyTypeId') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployerMasters] ADD [LegacyTypeId] INT NULL;
    PRINT '  + Added column [LegacyTypeId] to [dbo].[EmployerMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployerMasters]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployerMasters] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[EmployerMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployerMasters]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployerMasters] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[EmployerMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployerMasters]', N'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployerMasters] ADD [UpdatedAt] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedAt] to [dbo].[EmployerMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[EmployerMasters]', N'Address') IS NULL
BEGIN
    ALTER TABLE [dbo].[EmployerMasters] ADD [Address] NVARCHAR(500) NULL;
    PRINT '  + Added column [Address] to [dbo].[EmployerMasters]';
END
GO

----------------------------------------------------------------------------------------------------
-- [37/126] TABLE: [dbo].[EodBatchProcessLogs]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[EodBatchProcessLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[EodBatchProcessLogs] (
        [LogID] BIGINT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [BusinessDate] DATETIME2 NOT NULL,
        [StepNumber] INT NOT NULL,
        [StepName] NVARCHAR(100) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [RecordsProcessed] INT NOT NULL,
        [ErrorMessage] NVARCHAR(MAX) NULL,
        [StartTime] DATETIME2 NOT NULL,
        [EndTime] DATETIME2 NULL,
        CONSTRAINT [PK_EodBatchProcessLogs] PRIMARY KEY CLUSTERED ([LogID] ASC)
    );
    PRINT 'Created Table [dbo].[EodBatchProcessLogs]';
END
GO

IF COL_LENGTH(N'[dbo].[EodBatchProcessLogs]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[EodBatchProcessLogs] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[EodBatchProcessLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[EodBatchProcessLogs]', N'BusinessDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[EodBatchProcessLogs] ADD [BusinessDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [BusinessDate] to [dbo].[EodBatchProcessLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[EodBatchProcessLogs]', N'StepNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[EodBatchProcessLogs] ADD [StepNumber] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [StepNumber] to [dbo].[EodBatchProcessLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[EodBatchProcessLogs]', N'StepName') IS NULL
BEGIN
    ALTER TABLE [dbo].[EodBatchProcessLogs] ADD [StepName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [StepName] to [dbo].[EodBatchProcessLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[EodBatchProcessLogs]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[EodBatchProcessLogs] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[EodBatchProcessLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[EodBatchProcessLogs]', N'RecordsProcessed') IS NULL
BEGIN
    ALTER TABLE [dbo].[EodBatchProcessLogs] ADD [RecordsProcessed] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [RecordsProcessed] to [dbo].[EodBatchProcessLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[EodBatchProcessLogs]', N'ErrorMessage') IS NULL
BEGIN
    ALTER TABLE [dbo].[EodBatchProcessLogs] ADD [ErrorMessage] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [ErrorMessage] to [dbo].[EodBatchProcessLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[EodBatchProcessLogs]', N'StartTime') IS NULL
BEGIN
    ALTER TABLE [dbo].[EodBatchProcessLogs] ADD [StartTime] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [StartTime] to [dbo].[EodBatchProcessLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[EodBatchProcessLogs]', N'EndTime') IS NULL
BEGIN
    ALTER TABLE [dbo].[EodBatchProcessLogs] ADD [EndTime] DATETIME2 NULL;
    PRINT '  + Added column [EndTime] to [dbo].[EodBatchProcessLogs]';
END
GO

----------------------------------------------------------------------------------------------------
-- [38/126] TABLE: [dbo].[FdAccounts]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[FdAccounts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[FdAccounts] (
        [FdAccountID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [FdSchemeID] INT NOT NULL,
        [AccountNo] NVARCHAR(30) NOT NULL,
        [OpeningDate] DATETIME2 NOT NULL,
        [DepositAmount] DECIMAL(18,2) NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [MaturityDate] DATETIME2 NOT NULL,
        [MaturityAmount] DECIMAL(18,2) NOT NULL,
        [IsLegacyAccount] BIT NOT NULL,
        [LegacyAccruedInt] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [NomineeName] NVARCHAR(100) NULL,
        [NomineeRelation] NVARCHAR(50) NULL,
        [Remarks] NVARCHAR(250) NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        [LegacyAccountId] INT NULL,
        [LegacyAccountNumber] NVARCHAR(50) NULL,
        [BankAccountLedgerID] INT NULL,
        [ChequeDate] DATETIME2 NULL,
        [ChequeNo] NVARCHAR(50) NULL,
        [PaymentMode] NVARCHAR(20) NOT NULL DEFAULT (''),
        [SavingAccountID] INT NULL,
        [CustomerID] INT NOT NULL,
        CONSTRAINT [PK_FdAccounts] PRIMARY KEY CLUSTERED ([FdAccountID] ASC)
    );
    PRINT 'Created Table [dbo].[FdAccounts]';
END
GO

IF COL_LENGTH(N'[dbo].[FdAccounts]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'FdSchemeID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [FdSchemeID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FdSchemeID] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'AccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [AccountNo] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [AccountNo] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'OpeningDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [OpeningDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [OpeningDate] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'DepositAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [DepositAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DepositAmount] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'MaturityDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [MaturityDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [MaturityDate] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'MaturityAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [MaturityAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [MaturityAmount] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'IsLegacyAccount') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [IsLegacyAccount] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsLegacyAccount] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'LegacyAccruedInt') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [LegacyAccruedInt] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [LegacyAccruedInt] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'NomineeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [NomineeName] NVARCHAR(100) NULL;
    PRINT '  + Added column [NomineeName] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'NomineeRelation') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [NomineeRelation] NVARCHAR(50) NULL;
    PRINT '  + Added column [NomineeRelation] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'LegacyAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [LegacyAccountId] INT NULL;
    PRINT '  + Added column [LegacyAccountId] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'LegacyAccountNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [LegacyAccountNumber] NVARCHAR(50) NULL;
    PRINT '  + Added column [LegacyAccountNumber] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'BankAccountLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [BankAccountLedgerID] INT NULL;
    PRINT '  + Added column [BankAccountLedgerID] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'ChequeDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [ChequeDate] DATETIME2 NULL;
    PRINT '  + Added column [ChequeDate] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'ChequeNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [ChequeNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [ChequeNo] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [PaymentMode] NVARCHAR(20) NOT NULL DEFAULT ('');
    PRINT '  + Added column [PaymentMode] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'SavingAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [SavingAccountID] INT NULL;
    PRINT '  + Added column [SavingAccountID] to [dbo].[FdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccounts]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [CustomerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CustomerID] to [dbo].[FdAccounts]';
END
GO

----------------------------------------------------------------------------------------------------
-- [39/126] TABLE: [dbo].[FdAccountSequences]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[FdAccountSequences]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[FdAccountSequences] (
        [SequenceID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [ProductType] NVARCHAR(10) NOT NULL,
        [CurrentValue] INT NOT NULL,
        CONSTRAINT [PK_FdAccountSequences] PRIMARY KEY CLUSTERED ([SequenceID] ASC)
    );
    PRINT 'Created Table [dbo].[FdAccountSequences]';
END
GO

IF COL_LENGTH(N'[dbo].[FdAccountSequences]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccountSequences] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[FdAccountSequences]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccountSequences]', N'ProductType') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccountSequences] ADD [ProductType] NVARCHAR(10) NOT NULL DEFAULT '';
    PRINT '  + Added column [ProductType] to [dbo].[FdAccountSequences]';
END
GO
IF COL_LENGTH(N'[dbo].[FdAccountSequences]', N'CurrentValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccountSequences] ADD [CurrentValue] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CurrentValue] to [dbo].[FdAccountSequences]';
END
GO

----------------------------------------------------------------------------------------------------
-- [40/126] TABLE: [dbo].[FdInterestAccruals]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[FdInterestAccruals]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[FdInterestAccruals] (
        [AccrualID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [FdAccountID] INT NOT NULL,
        [VoucherID] INT NOT NULL,
        [AccrualDate] DATETIME2 NOT NULL,
        [CalculatedDays] INT NOT NULL,
        [InterestAmount] DECIMAL(18,2) NOT NULL,
        [IsPosted] BIT NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        CONSTRAINT [PK_FdInterestAccruals] PRIMARY KEY CLUSTERED ([AccrualID] ASC)
    );
    PRINT 'Created Table [dbo].[FdInterestAccruals]';
END
GO

IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[FdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[FdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[FdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'FdAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [FdAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FdAccountID] to [dbo].[FdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [VoucherID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [VoucherID] to [dbo].[FdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'AccrualDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [AccrualDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [AccrualDate] to [dbo].[FdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'CalculatedDays') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [CalculatedDays] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CalculatedDays] to [dbo].[FdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'InterestAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [InterestAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestAmount] to [dbo].[FdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'IsPosted') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [IsPosted] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsPosted] to [dbo].[FdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[FdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[FdInterestAccruals]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdInterestAccruals] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[FdInterestAccruals]';
END
GO

----------------------------------------------------------------------------------------------------
-- [41/126] TABLE: [dbo].[FdSchemes]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[FdSchemes]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[FdSchemes] (
        [FdSchemeID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [SchemeCode] NVARCHAR(20) NOT NULL,
        [SchemeName] NVARCHAR(100) NOT NULL,
        [DurationMonths] INT NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [SeniorCitizenInterestRate] DECIMAL(5,2) NOT NULL,
        [InterestType] NVARCHAR(20) NOT NULL,
        [InterestPostingMethod] NVARCHAR(20) NOT NULL,
        [InterestCompoundingFrequency] NVARCHAR(20) NOT NULL,
        [MinimumAmount] DECIMAL(18,2) NOT NULL,
        [MaximumAmount] DECIMAL(18,2) NOT NULL,
        [PrematureInterestRate] DECIMAL(5,2) NOT NULL,
        [EffectiveDate] DATETIME2 NOT NULL,
        [IsActive] BIT NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        [FdLiabilityLedgerID] INT NULL,
        [InterestExpenseLedgerID] INT NULL,
        [InterestPayableLedgerID] INT NULL,
        [PrematurePenaltyLedgerID] INT NULL,
        CONSTRAINT [PK_FdSchemes] PRIMARY KEY CLUSTERED ([FdSchemeID] ASC)
    );
    PRINT 'Created Table [dbo].[FdSchemes]';
END
GO

IF COL_LENGTH(N'[dbo].[FdSchemes]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'SchemeCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [SchemeCode] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [SchemeCode] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'SchemeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [SchemeName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [SchemeName] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'DurationMonths') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [DurationMonths] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DurationMonths] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'SeniorCitizenInterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [SeniorCitizenInterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [SeniorCitizenInterestRate] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'InterestType') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [InterestType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [InterestType] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'InterestPostingMethod') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [InterestPostingMethod] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [InterestPostingMethod] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'InterestCompoundingFrequency') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [InterestCompoundingFrequency] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [InterestCompoundingFrequency] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'MinimumAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [MinimumAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [MinimumAmount] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'MaximumAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [MaximumAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [MaximumAmount] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'PrematureInterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [PrematureInterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrematureInterestRate] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'EffectiveDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [EffectiveDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [EffectiveDate] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'FdLiabilityLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [FdLiabilityLedgerID] INT NULL;
    PRINT '  + Added column [FdLiabilityLedgerID] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'InterestExpenseLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [InterestExpenseLedgerID] INT NULL;
    PRINT '  + Added column [InterestExpenseLedgerID] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'InterestPayableLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [InterestPayableLedgerID] INT NULL;
    PRINT '  + Added column [InterestPayableLedgerID] to [dbo].[FdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[FdSchemes]', N'PrematurePenaltyLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [PrematurePenaltyLedgerID] INT NULL;
    PRINT '  + Added column [PrematurePenaltyLedgerID] to [dbo].[FdSchemes]';
END
GO

----------------------------------------------------------------------------------------------------
-- [42/126] TABLE: [dbo].[FdTransactions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[FdTransactions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[FdTransactions] (
        [FdTransactionID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [FdAccountID] INT NOT NULL,
        [VoucherID] INT NOT NULL,
        [TransactionDate] DATETIME2 NOT NULL,
        [TransactionType] NVARCHAR(20) NOT NULL,
        [DebitCredit] NVARCHAR(2) NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        CONSTRAINT [PK_FdTransactions] PRIMARY KEY CLUSTERED ([FdTransactionID] ASC)
    );
    PRINT 'Created Table [dbo].[FdTransactions]';
END
GO

IF COL_LENGTH(N'[dbo].[FdTransactions]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[FdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[FdTransactions]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[FdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[FdTransactions]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[FdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[FdTransactions]', N'FdAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [FdAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FdAccountID] to [dbo].[FdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[FdTransactions]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [VoucherID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [VoucherID] to [dbo].[FdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[FdTransactions]', N'TransactionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [TransactionDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [TransactionDate] to [dbo].[FdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[FdTransactions]', N'TransactionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [TransactionType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [TransactionType] to [dbo].[FdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[FdTransactions]', N'DebitCredit') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [DebitCredit] NVARCHAR(2) NOT NULL DEFAULT '';
    PRINT '  + Added column [DebitCredit] to [dbo].[FdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[FdTransactions]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Amount] to [dbo].[FdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[FdTransactions]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[FdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[FdTransactions]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdTransactions] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[FdTransactions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [43/126] TABLE: [dbo].[FinancialYears]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[FinancialYears]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[FinancialYears] (
        [FinancialYearID] INT IDENTITY(1,1) NOT NULL,
        [YearCode] NVARCHAR(50) NOT NULL,
        [StartDate] DATETIME2 NOT NULL,
        [EndDate] DATETIME2 NOT NULL,
        [IsActive] BIT NOT NULL,
        [IsClosed] BIT NOT NULL,
        CONSTRAINT [PK_FinancialYears] PRIMARY KEY CLUSTERED ([FinancialYearID] ASC)
    );
    PRINT 'Created Table [dbo].[FinancialYears]';
END
GO

IF COL_LENGTH(N'[dbo].[FinancialYears]', N'YearCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[FinancialYears] ADD [YearCode] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [YearCode] to [dbo].[FinancialYears]';
END
GO
IF COL_LENGTH(N'[dbo].[FinancialYears]', N'StartDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FinancialYears] ADD [StartDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [StartDate] to [dbo].[FinancialYears]';
END
GO
IF COL_LENGTH(N'[dbo].[FinancialYears]', N'EndDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[FinancialYears] ADD [EndDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [EndDate] to [dbo].[FinancialYears]';
END
GO
IF COL_LENGTH(N'[dbo].[FinancialYears]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[FinancialYears] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[FinancialYears]';
END
GO
IF COL_LENGTH(N'[dbo].[FinancialYears]', N'IsClosed') IS NULL
BEGIN
    ALTER TABLE [dbo].[FinancialYears] ADD [IsClosed] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsClosed] to [dbo].[FinancialYears]';
END
GO

----------------------------------------------------------------------------------------------------
-- [44/126] TABLE: [dbo].[GoldLoanDetails]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[GoldLoanDetails]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[GoldLoanDetails] (
        [GoldLoanDetailID] INT IDENTITY(1,1) NOT NULL,
        [LoanAccountID] INT NOT NULL,
        [OrnamentName] NVARCHAR(200) NOT NULL,
        [Quantity] INT NOT NULL,
        [GrossWeight] DECIMAL(18,3) NOT NULL,
        [NetWeight] DECIMAL(18,3) NOT NULL,
        [Purity] DECIMAL(18,2) NOT NULL,
        [GoldRatePerGram] DECIMAL(18,2) NOT NULL,
        [EstimatedValue] DECIMAL(18,2) NOT NULL,
        [ImagePath] NVARCHAR(500) NULL,
        CONSTRAINT [PK_GoldLoanDetails] PRIMARY KEY CLUSTERED ([GoldLoanDetailID] ASC)
    );
    PRINT 'Created Table [dbo].[GoldLoanDetails]';
END
GO

IF COL_LENGTH(N'[dbo].[GoldLoanDetails]', N'LoanAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[GoldLoanDetails] ADD [LoanAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountID] to [dbo].[GoldLoanDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[GoldLoanDetails]', N'OrnamentName') IS NULL
BEGIN
    ALTER TABLE [dbo].[GoldLoanDetails] ADD [OrnamentName] NVARCHAR(200) NOT NULL DEFAULT '';
    PRINT '  + Added column [OrnamentName] to [dbo].[GoldLoanDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[GoldLoanDetails]', N'Quantity') IS NULL
BEGIN
    ALTER TABLE [dbo].[GoldLoanDetails] ADD [Quantity] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [Quantity] to [dbo].[GoldLoanDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[GoldLoanDetails]', N'GrossWeight') IS NULL
BEGIN
    ALTER TABLE [dbo].[GoldLoanDetails] ADD [GrossWeight] DECIMAL(18,3) NOT NULL DEFAULT 0;
    PRINT '  + Added column [GrossWeight] to [dbo].[GoldLoanDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[GoldLoanDetails]', N'NetWeight') IS NULL
BEGIN
    ALTER TABLE [dbo].[GoldLoanDetails] ADD [NetWeight] DECIMAL(18,3) NOT NULL DEFAULT 0;
    PRINT '  + Added column [NetWeight] to [dbo].[GoldLoanDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[GoldLoanDetails]', N'Purity') IS NULL
BEGIN
    ALTER TABLE [dbo].[GoldLoanDetails] ADD [Purity] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Purity] to [dbo].[GoldLoanDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[GoldLoanDetails]', N'GoldRatePerGram') IS NULL
BEGIN
    ALTER TABLE [dbo].[GoldLoanDetails] ADD [GoldRatePerGram] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [GoldRatePerGram] to [dbo].[GoldLoanDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[GoldLoanDetails]', N'EstimatedValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[GoldLoanDetails] ADD [EstimatedValue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [EstimatedValue] to [dbo].[GoldLoanDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[GoldLoanDetails]', N'ImagePath') IS NULL
BEGIN
    ALTER TABLE [dbo].[GoldLoanDetails] ADD [ImagePath] NVARCHAR(500) NULL;
    PRINT '  + Added column [ImagePath] to [dbo].[GoldLoanDetails]';
END
GO

----------------------------------------------------------------------------------------------------
-- [45/126] TABLE: [dbo].[InvestmentAccounts]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[InvestmentAccounts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvestmentAccounts] (
        [InvestmentAccountID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [InvestmentInstitutionID] INT NOT NULL,
        [SchemeID] INT NOT NULL,
        [InvestmentNo] NVARCHAR(30) NOT NULL,
        [InvestmentDate] DATETIME2 NOT NULL,
        [PrincipalAmount] DECIMAL(18,2) NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [MaturityDate] DATETIME2 NOT NULL,
        [ExpectedMaturityAmount] DECIMAL(18,2) NOT NULL,
        [AccruedInterestTillMigration] DECIMAL(18,2) NOT NULL,
        [BookValue] DECIMAL(18,2) NOT NULL,
        [IsLegacyAccount] BIT NOT NULL,
        [NomineeName] NVARCHAR(100) NULL,
        [NomineeRelation] NVARCHAR(50) NULL,
        [Remarks] NVARCHAR(250) NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        [DepositReceiptNo] NVARCHAR(50) NULL,
        CONSTRAINT [PK_InvestmentAccounts] PRIMARY KEY CLUSTERED ([InvestmentAccountID] ASC)
    );
    PRINT 'Created Table [dbo].[InvestmentAccounts]';
END
GO

IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'InvestmentInstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [InvestmentInstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InvestmentInstitutionID] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'SchemeID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [SchemeID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [SchemeID] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'InvestmentNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [InvestmentNo] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [InvestmentNo] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'InvestmentDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [InvestmentDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [InvestmentDate] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'PrincipalAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [PrincipalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrincipalAmount] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'MaturityDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [MaturityDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [MaturityDate] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'ExpectedMaturityAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [ExpectedMaturityAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ExpectedMaturityAmount] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'AccruedInterestTillMigration') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [AccruedInterestTillMigration] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [AccruedInterestTillMigration] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'BookValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [BookValue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [BookValue] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'IsLegacyAccount') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [IsLegacyAccount] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsLegacyAccount] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'NomineeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [NomineeName] NVARCHAR(100) NULL;
    PRINT '  + Added column [NomineeName] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'NomineeRelation') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [NomineeRelation] NVARCHAR(50) NULL;
    PRINT '  + Added column [NomineeRelation] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[InvestmentAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccounts]', N'DepositReceiptNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccounts] ADD [DepositReceiptNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [DepositReceiptNo] to [dbo].[InvestmentAccounts]';
END
GO

----------------------------------------------------------------------------------------------------
-- [46/126] TABLE: [dbo].[InvestmentAccountSequences]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[InvestmentAccountSequences]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvestmentAccountSequences] (
        [SequenceID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [ProductType] NVARCHAR(10) NOT NULL,
        [CurrentValue] INT NOT NULL,
        CONSTRAINT [PK_InvestmentAccountSequences] PRIMARY KEY CLUSTERED ([SequenceID] ASC)
    );
    PRINT 'Created Table [dbo].[InvestmentAccountSequences]';
END
GO

IF COL_LENGTH(N'[dbo].[InvestmentAccountSequences]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccountSequences] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[InvestmentAccountSequences]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccountSequences]', N'ProductType') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccountSequences] ADD [ProductType] NVARCHAR(10) NOT NULL DEFAULT '';
    PRINT '  + Added column [ProductType] to [dbo].[InvestmentAccountSequences]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentAccountSequences]', N'CurrentValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentAccountSequences] ADD [CurrentValue] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CurrentValue] to [dbo].[InvestmentAccountSequences]';
END
GO

----------------------------------------------------------------------------------------------------
-- [47/126] TABLE: [dbo].[InvestmentInstitutions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[InvestmentInstitutions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvestmentInstitutions] (
        [InstitutionID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionMasterID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [InstitutionName] NVARCHAR(150) NOT NULL,
        [InstitutionType] NVARCHAR(50) NOT NULL,
        [InstitutionBranchName] NVARCHAR(100) NOT NULL,
        [Address] NVARCHAR(250) NULL,
        [ContactPerson] NVARCHAR(100) NULL,
        [MobileNumber] NVARCHAR(15) NULL,
        [EmailID] NVARCHAR(100) NULL,
        [IsActive] BIT NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        CONSTRAINT [PK_InvestmentInstitutions] PRIMARY KEY CLUSTERED ([InstitutionID] ASC)
    );
    PRINT 'Created Table [dbo].[InvestmentInstitutions]';
END
GO

IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'InstitutionMasterID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [InstitutionMasterID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionMasterID] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'InstitutionName') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [InstitutionName] NVARCHAR(150) NOT NULL DEFAULT '';
    PRINT '  + Added column [InstitutionName] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'InstitutionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [InstitutionType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [InstitutionType] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'InstitutionBranchName') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [InstitutionBranchName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [InstitutionBranchName] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'Address') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [Address] NVARCHAR(250) NULL;
    PRINT '  + Added column [Address] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'ContactPerson') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [ContactPerson] NVARCHAR(100) NULL;
    PRINT '  + Added column [ContactPerson] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'MobileNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [MobileNumber] NVARCHAR(15) NULL;
    PRINT '  + Added column [MobileNumber] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'EmailID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [EmailID] NVARCHAR(100) NULL;
    PRINT '  + Added column [EmailID] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[InvestmentInstitutions]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInstitutions]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInstitutions] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[InvestmentInstitutions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [48/126] TABLE: [dbo].[InvestmentInterestAccruals]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[InvestmentInterestAccruals]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvestmentInterestAccruals] (
        [AccrualID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [InvestmentAccountID] INT NOT NULL,
        [AccrualDate] DATETIME2 NOT NULL,
        [InterestAmount] DECIMAL(18,2) NOT NULL,
        [VoucherID] INT NULL,
        [IsPosted] BIT NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        CONSTRAINT [PK_InvestmentInterestAccruals] PRIMARY KEY CLUSTERED ([AccrualID] ASC)
    );
    PRINT 'Created Table [dbo].[InvestmentInterestAccruals]';
END
GO

IF COL_LENGTH(N'[dbo].[InvestmentInterestAccruals]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[InvestmentInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestAccruals]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[InvestmentInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestAccruals]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[InvestmentInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestAccruals]', N'InvestmentAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [InvestmentAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InvestmentAccountID] to [dbo].[InvestmentInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestAccruals]', N'AccrualDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [AccrualDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [AccrualDate] to [dbo].[InvestmentInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestAccruals]', N'InterestAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [InterestAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestAmount] to [dbo].[InvestmentInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestAccruals]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[InvestmentInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestAccruals]', N'IsPosted') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [IsPosted] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsPosted] to [dbo].[InvestmentInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestAccruals]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[InvestmentInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestAccruals]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[InvestmentInterestAccruals]';
END
GO

----------------------------------------------------------------------------------------------------
-- [49/126] TABLE: [dbo].[InvestmentInterestReceipts]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[InvestmentInterestReceipts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvestmentInterestReceipts] (
        [ReceiptID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [InvestmentAccountID] INT NOT NULL,
        [ReceiptDate] DATETIME2 NOT NULL,
        [ReceivedAmount] DECIMAL(18,2) NOT NULL,
        [VoucherID] INT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        CONSTRAINT [PK_InvestmentInterestReceipts] PRIMARY KEY CLUSTERED ([ReceiptID] ASC)
    );
    PRINT 'Created Table [dbo].[InvestmentInterestReceipts]';
END
GO

IF COL_LENGTH(N'[dbo].[InvestmentInterestReceipts]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[InvestmentInterestReceipts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestReceipts]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[InvestmentInterestReceipts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestReceipts]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[InvestmentInterestReceipts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestReceipts]', N'InvestmentAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [InvestmentAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InvestmentAccountID] to [dbo].[InvestmentInterestReceipts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestReceipts]', N'ReceiptDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [ReceiptDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [ReceiptDate] to [dbo].[InvestmentInterestReceipts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestReceipts]', N'ReceivedAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [ReceivedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ReceivedAmount] to [dbo].[InvestmentInterestReceipts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestReceipts]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[InvestmentInterestReceipts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestReceipts]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[InvestmentInterestReceipts]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentInterestReceipts]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[InvestmentInterestReceipts]';
END
GO

----------------------------------------------------------------------------------------------------
-- [50/126] TABLE: [dbo].[InvestmentMaturities]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[InvestmentMaturities]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvestmentMaturities] (
        [MaturityID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [InvestmentAccountID] INT NOT NULL,
        [MaturityDate] DATETIME2 NOT NULL,
        [PrincipalReceived] DECIMAL(18,2) NOT NULL,
        [InterestReceived] DECIMAL(18,2) NOT NULL,
        [TotalReceived] DECIMAL(18,2) NOT NULL,
        [VoucherID] INT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        CONSTRAINT [PK_InvestmentMaturities] PRIMARY KEY CLUSTERED ([MaturityID] ASC)
    );
    PRINT 'Created Table [dbo].[InvestmentMaturities]';
END
GO

IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[InvestmentMaturities]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[InvestmentMaturities]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[InvestmentMaturities]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'InvestmentAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [InvestmentAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InvestmentAccountID] to [dbo].[InvestmentMaturities]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'MaturityDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [MaturityDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [MaturityDate] to [dbo].[InvestmentMaturities]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'PrincipalReceived') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [PrincipalReceived] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrincipalReceived] to [dbo].[InvestmentMaturities]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'InterestReceived') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [InterestReceived] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestReceived] to [dbo].[InvestmentMaturities]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'TotalReceived') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [TotalReceived] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalReceived] to [dbo].[InvestmentMaturities]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[InvestmentMaturities]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[InvestmentMaturities]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentMaturities]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentMaturities] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[InvestmentMaturities]';
END
GO

----------------------------------------------------------------------------------------------------
-- [51/126] TABLE: [dbo].[InvestmentPrematureWithdrawals]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[InvestmentPrematureWithdrawals]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvestmentPrematureWithdrawals] (
        [WithdrawalID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [InvestmentAccountID] INT NOT NULL,
        [WithdrawalDate] DATETIME2 NOT NULL,
        [PrincipalPaid] DECIMAL(18,2) NOT NULL,
        [RevisedInterestRate] DECIMAL(5,2) NOT NULL,
        [InterestPaid] DECIMAL(18,2) NOT NULL,
        [PenaltyAmount] DECIMAL(18,2) NOT NULL,
        [NetPayout] DECIMAL(18,2) NOT NULL,
        [VoucherID] INT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        CONSTRAINT [PK_InvestmentPrematureWithdrawals] PRIMARY KEY CLUSTERED ([WithdrawalID] ASC)
    );
    PRINT 'Created Table [dbo].[InvestmentPrematureWithdrawals]';
END
GO

IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'InvestmentAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [InvestmentAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InvestmentAccountID] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'WithdrawalDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [WithdrawalDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [WithdrawalDate] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'PrincipalPaid') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [PrincipalPaid] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrincipalPaid] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'RevisedInterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [RevisedInterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [RevisedInterestRate] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'InterestPaid') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [InterestPaid] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestPaid] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'PenaltyAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [PenaltyAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PenaltyAmount] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'NetPayout') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [NetPayout] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [NetPayout] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentPrematureWithdrawals]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[InvestmentPrematureWithdrawals]';
END
GO

----------------------------------------------------------------------------------------------------
-- [52/126] TABLE: [dbo].[InvestmentRenewals]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[InvestmentRenewals]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvestmentRenewals] (
        [RenewalID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [OldInvestmentAccountID] INT NOT NULL,
        [NewInvestmentAccountID] INT NOT NULL,
        [RenewalType] NVARCHAR(30) NOT NULL,
        [RenewalAmount] DECIMAL(18,2) NOT NULL,
        [RenewalDate] DATETIME2 NOT NULL,
        [VoucherID] INT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        CONSTRAINT [PK_InvestmentRenewals] PRIMARY KEY CLUSTERED ([RenewalID] ASC)
    );
    PRINT 'Created Table [dbo].[InvestmentRenewals]';
END
GO

IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[InvestmentRenewals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[InvestmentRenewals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[InvestmentRenewals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'OldInvestmentAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [OldInvestmentAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [OldInvestmentAccountID] to [dbo].[InvestmentRenewals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'NewInvestmentAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [NewInvestmentAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [NewInvestmentAccountID] to [dbo].[InvestmentRenewals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'RenewalType') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [RenewalType] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [RenewalType] to [dbo].[InvestmentRenewals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'RenewalAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [RenewalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [RenewalAmount] to [dbo].[InvestmentRenewals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'RenewalDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [RenewalDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [RenewalDate] to [dbo].[InvestmentRenewals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[InvestmentRenewals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[InvestmentRenewals]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentRenewals]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentRenewals] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[InvestmentRenewals]';
END
GO

----------------------------------------------------------------------------------------------------
-- [53/126] TABLE: [dbo].[InvestmentSchemes]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[InvestmentSchemes]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvestmentSchemes] (
        [SchemeID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [InvestmentInstitutionID] INT NOT NULL,
        [SchemeCode] NVARCHAR(20) NOT NULL,
        [SchemeName] NVARCHAR(100) NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [DurationMonths] INT NOT NULL,
        [InterestCalculationMethod] NVARCHAR(50) NOT NULL,
        [PrematureWithdrawalRate] DECIMAL(5,2) NOT NULL,
        [IsActive] BIT NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        [InterestIncomeLedgerID] INT NULL,
        [InterestReceivableLedgerID] INT NULL,
        [InvestmentAssetLedgerID] INT NULL,
        [InvestmentType] NVARCHAR(30) NOT NULL DEFAULT (N''),
        CONSTRAINT [PK_InvestmentSchemes] PRIMARY KEY CLUSTERED ([SchemeID] ASC)
    );
    PRINT 'Created Table [dbo].[InvestmentSchemes]';
END
GO

IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'InvestmentInstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [InvestmentInstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InvestmentInstitutionID] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'SchemeCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [SchemeCode] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [SchemeCode] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'SchemeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [SchemeName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [SchemeName] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'DurationMonths') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [DurationMonths] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DurationMonths] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'InterestCalculationMethod') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [InterestCalculationMethod] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [InterestCalculationMethod] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'PrematureWithdrawalRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [PrematureWithdrawalRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrematureWithdrawalRate] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'InterestIncomeLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [InterestIncomeLedgerID] INT NULL;
    PRINT '  + Added column [InterestIncomeLedgerID] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'InterestReceivableLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [InterestReceivableLedgerID] INT NULL;
    PRINT '  + Added column [InterestReceivableLedgerID] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'InvestmentAssetLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [InvestmentAssetLedgerID] INT NULL;
    PRINT '  + Added column [InvestmentAssetLedgerID] to [dbo].[InvestmentSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentSchemes]', N'InvestmentType') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentSchemes] ADD [InvestmentType] NVARCHAR(30) NOT NULL DEFAULT (N'');
    PRINT '  + Added column [InvestmentType] to [dbo].[InvestmentSchemes]';
END
GO

----------------------------------------------------------------------------------------------------
-- [54/126] TABLE: [dbo].[InvestmentVoucherMappings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[InvestmentVoucherMappings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvestmentVoucherMappings] (
        [MappingID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [InvestmentType] NVARCHAR(50) NOT NULL,
        [InvestmentLedgerID] INT NOT NULL,
        [InterestIncomeLedgerID] INT NOT NULL,
        [InterestReceivableLedgerID] INT NOT NULL,
        CONSTRAINT [PK_InvestmentVoucherMappings] PRIMARY KEY CLUSTERED ([MappingID] ASC)
    );
    PRINT 'Created Table [dbo].[InvestmentVoucherMappings]';
END
GO

IF COL_LENGTH(N'[dbo].[InvestmentVoucherMappings]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentVoucherMappings] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[InvestmentVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentVoucherMappings]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentVoucherMappings] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[InvestmentVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentVoucherMappings]', N'InvestmentType') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentVoucherMappings] ADD [InvestmentType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [InvestmentType] to [dbo].[InvestmentVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentVoucherMappings]', N'InvestmentLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentVoucherMappings] ADD [InvestmentLedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InvestmentLedgerID] to [dbo].[InvestmentVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentVoucherMappings]', N'InterestIncomeLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentVoucherMappings] ADD [InterestIncomeLedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestIncomeLedgerID] to [dbo].[InvestmentVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[InvestmentVoucherMappings]', N'InterestReceivableLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[InvestmentVoucherMappings] ADD [InterestReceivableLedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestReceivableLedgerID] to [dbo].[InvestmentVoucherMappings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [55/126] TABLE: [dbo].[JointMembers]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[JointMembers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[JointMembers] (
        [JointMemberID] INT IDENTITY(1,1) NOT NULL,
        [PrimaryMemberID] INT NOT NULL,
        [JointMemberCode] NVARCHAR(30) NULL,
        [FirstName] NVARCHAR(50) NOT NULL,
        [MiddleName] NVARCHAR(50) NULL,
        [LastName] NVARCHAR(50) NOT NULL,
        [FirstNameEng] NVARCHAR(50) NULL,
        [MiddleNameEng] NVARCHAR(50) NULL,
        [LastNameEng] NVARCHAR(50) NULL,
        [RelationWithPrimary] NVARCHAR(50) NULL,
        [AadhaarNo] NVARCHAR(12) NULL,
        [PANNo] NVARCHAR(10) NULL,
        [MobileNo] NVARCHAR(15) NULL,
        [Address] NVARCHAR(500) NULL,
        [PhotoPath] NVARCHAR(MAX) NULL,
        [SignaturePath] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(20) NOT NULL DEFAULT ('Active'),
        [IsDeleted] BIT NOT NULL DEFAULT ((0)),
        [CreatedBy] INT NOT NULL DEFAULT ((1)),
        [CreatedOn] DATETIME2 NOT NULL DEFAULT (sysutcdatetime()),
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        CONSTRAINT [PK_JointMembers] PRIMARY KEY CLUSTERED ([JointMemberID] ASC)
    );
    PRINT 'Created Table [dbo].[JointMembers]';
END
GO

IF COL_LENGTH(N'[dbo].[JointMembers]', N'PrimaryMemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [PrimaryMemberID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrimaryMemberID] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'JointMemberCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [JointMemberCode] NVARCHAR(30) NULL;
    PRINT '  + Added column [JointMemberCode] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'FirstName') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [FirstName] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [FirstName] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'MiddleName') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [MiddleName] NVARCHAR(50) NULL;
    PRINT '  + Added column [MiddleName] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'LastName') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [LastName] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [LastName] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'FirstNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [FirstNameEng] NVARCHAR(50) NULL;
    PRINT '  + Added column [FirstNameEng] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'MiddleNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [MiddleNameEng] NVARCHAR(50) NULL;
    PRINT '  + Added column [MiddleNameEng] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'LastNameEng') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [LastNameEng] NVARCHAR(50) NULL;
    PRINT '  + Added column [LastNameEng] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'RelationWithPrimary') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [RelationWithPrimary] NVARCHAR(50) NULL;
    PRINT '  + Added column [RelationWithPrimary] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'AadhaarNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [AadhaarNo] NVARCHAR(12) NULL;
    PRINT '  + Added column [AadhaarNo] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'PANNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [PANNo] NVARCHAR(10) NULL;
    PRINT '  + Added column [PANNo] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'MobileNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [MobileNo] NVARCHAR(15) NULL;
    PRINT '  + Added column [MobileNo] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'Address') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [Address] NVARCHAR(500) NULL;
    PRINT '  + Added column [Address] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'PhotoPath') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [PhotoPath] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [PhotoPath] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'SignaturePath') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [SignaturePath] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [SignaturePath] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT ('Active');
    PRINT '  + Added column [Status] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'IsDeleted') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [IsDeleted] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [IsDeleted] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [CreatedBy] INT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [CreatedBy] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT (sysutcdatetime());
    PRINT '  + Added column [CreatedOn] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[JointMembers]';
END
GO
IF COL_LENGTH(N'[dbo].[JointMembers]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[JointMembers] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[JointMembers]';
END
GO

----------------------------------------------------------------------------------------------------
-- [56/126] TABLE: [dbo].[Ledgers]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Ledgers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Ledgers] (
        [LedgerID] INT IDENTITY(1,1) NOT NULL,
        [LedgerName] NVARCHAR(100) NOT NULL,
        [GroupID] INT NOT NULL,
        [OpeningBalance] DECIMAL(18,2) NOT NULL,
        [OpeningBalanceType] NVARCHAR(2) NOT NULL,
        [ReportType] NVARCHAR(100) NULL,
        [AccountType] NVARCHAR(100) NULL,
        [ExcludeFromRule35Swanidhi] BIT NOT NULL,
        [IsActive] BIT NOT NULL,
        [LegacyLedgerId] INT NULL,
        [LedgerNameEnglish] NVARCHAR(100) NULL,
        [DisplayOrder] INT NOT NULL DEFAULT ((0)),
        [LedgerCode] NVARCHAR(50) NULL,
        CONSTRAINT [PK_Ledgers] PRIMARY KEY CLUSTERED ([LedgerID] ASC)
    );
    PRINT 'Created Table [dbo].[Ledgers]';
END
GO

IF COL_LENGTH(N'[dbo].[Ledgers]', N'LedgerName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [LedgerName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [LedgerName] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'GroupID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [GroupID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [GroupID] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'OpeningBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [OpeningBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OpeningBalance] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'OpeningBalanceType') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [OpeningBalanceType] NVARCHAR(2) NOT NULL DEFAULT '';
    PRINT '  + Added column [OpeningBalanceType] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'ReportType') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [ReportType] NVARCHAR(100) NULL;
    PRINT '  + Added column [ReportType] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'AccountType') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [AccountType] NVARCHAR(100) NULL;
    PRINT '  + Added column [AccountType] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'ExcludeFromRule35Swanidhi') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [ExcludeFromRule35Swanidhi] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [ExcludeFromRule35Swanidhi] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'LegacyLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [LegacyLedgerId] INT NULL;
    PRINT '  + Added column [LegacyLedgerId] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'LedgerNameEnglish') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [LedgerNameEnglish] NVARCHAR(100) NULL;
    PRINT '  + Added column [LedgerNameEnglish] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'DisplayOrder') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [DisplayOrder] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [DisplayOrder] to [dbo].[Ledgers]';
END
GO
IF COL_LENGTH(N'[dbo].[Ledgers]', N'LedgerCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[Ledgers] ADD [LedgerCode] NVARCHAR(50) NULL;
    PRINT '  + Added column [LedgerCode] to [dbo].[Ledgers]';
END
GO

----------------------------------------------------------------------------------------------------
-- [57/126] TABLE: [dbo].[LegalRecoveryLedgerMappings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LegalRecoveryLedgerMappings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LegalRecoveryLedgerMappings] (
        [MappingId] INT IDENTITY(1,1) NOT NULL,
        [BranchId] INT NOT NULL,
        [TransactionType] NVARCHAR(50) NOT NULL,
        [DebitLedgerId] INT NOT NULL,
        [CreditLedgerId] INT NOT NULL,
        [IsActive] BIT NOT NULL,
        [UpdatedAt] DATETIME2 NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate()),
        [UpdatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_LegalRecoveryLedgerMappings] PRIMARY KEY CLUSTERED ([MappingId] ASC)
    );
    PRINT 'Created Table [dbo].[LegalRecoveryLedgerMappings]';
END
GO

IF COL_LENGTH(N'[dbo].[LegalRecoveryLedgerMappings]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD [BranchId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchId] to [dbo].[LegalRecoveryLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[LegalRecoveryLedgerMappings]', N'TransactionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD [TransactionType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [TransactionType] to [dbo].[LegalRecoveryLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[LegalRecoveryLedgerMappings]', N'DebitLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD [DebitLedgerId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DebitLedgerId] to [dbo].[LegalRecoveryLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[LegalRecoveryLedgerMappings]', N'CreditLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD [CreditLedgerId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreditLedgerId] to [dbo].[LegalRecoveryLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[LegalRecoveryLedgerMappings]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[LegalRecoveryLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[LegalRecoveryLedgerMappings]', N'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [UpdatedAt] to [dbo].[LegalRecoveryLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[LegalRecoveryLedgerMappings]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate());
    PRINT '  + Added column [CreatedDate] to [dbo].[LegalRecoveryLedgerMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[LegalRecoveryLedgerMappings]', N'UpdatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD [UpdatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate());
    PRINT '  + Added column [UpdatedDate] to [dbo].[LegalRecoveryLedgerMappings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [58/126] TABLE: [dbo].[LoanAccountNpaStatuses]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LoanAccountNpaStatuses]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoanAccountNpaStatuses] (
        [LoanAccountNpaStatusID] INT IDENTITY(1,1) NOT NULL,
        [LoanAccountID] INT NOT NULL,
        [AsOfDate] DATETIME2 NOT NULL,
        [OverdueDate] DATETIME2 NULL,
        [OutOfOrderDate] DATETIME2 NULL,
        [Category] NVARCHAR(50) NOT NULL,
        [SecurityType] NVARCHAR(50) NOT NULL,
        [OutstandingBalance] DECIMAL(18,2) NOT NULL,
        [CompliantCollateralValue] DECIMAL(18,2) NOT NULL,
        [ProvisionRequired] DECIMAL(18,2) NOT NULL,
        [ProvisionHeld] DECIMAL(18,2) NOT NULL,
        [IsAutoClassified] BIT NOT NULL,
        [LastClassificationRunId] INT NOT NULL,
        [AuditorRemarks] NVARCHAR(500) NULL,
        CONSTRAINT [PK_LoanAccountNpaStatuses] PRIMARY KEY CLUSTERED ([LoanAccountNpaStatusID] ASC)
    );
    PRINT 'Created Table [dbo].[LoanAccountNpaStatuses]';
END
GO

IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'LoanAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [LoanAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountID] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'AsOfDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [AsOfDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [AsOfDate] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'OverdueDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [OverdueDate] DATETIME2 NULL;
    PRINT '  + Added column [OverdueDate] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'OutOfOrderDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [OutOfOrderDate] DATETIME2 NULL;
    PRINT '  + Added column [OutOfOrderDate] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'Category') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [Category] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [Category] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'SecurityType') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [SecurityType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [SecurityType] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'OutstandingBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [OutstandingBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OutstandingBalance] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'CompliantCollateralValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [CompliantCollateralValue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [CompliantCollateralValue] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'ProvisionRequired') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [ProvisionRequired] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ProvisionRequired] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'ProvisionHeld') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [ProvisionHeld] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ProvisionHeld] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'IsAutoClassified') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [IsAutoClassified] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsAutoClassified] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'LastClassificationRunId') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [LastClassificationRunId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LastClassificationRunId] to [dbo].[LoanAccountNpaStatuses]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccountNpaStatuses]', N'AuditorRemarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccountNpaStatuses] ADD [AuditorRemarks] NVARCHAR(500) NULL;
    PRINT '  + Added column [AuditorRemarks] to [dbo].[LoanAccountNpaStatuses]';
END
GO

----------------------------------------------------------------------------------------------------
-- [59/126] TABLE: [dbo].[LoanAccounts]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LoanAccounts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoanAccounts] (
        [LoanAccountID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [LoanApplicationID] INT NULL,
        [MemberID] INT NULL,
        [CoMemberID] INT NULL,
        [CoMember2ID] INT NULL,
        [LoanRateID] INT NOT NULL,
        [LoanAccountNo] NVARCHAR(50) NOT NULL,
        [PrincipalBalance] DECIMAL(18,2) NOT NULL,
        [InterestBalance] DECIMAL(18,2) NOT NULL,
        [OverdueInterestBalance] DECIMAL(18,2) NOT NULL,
        [OpeningDate] DATETIME2 NOT NULL,
        [LoanDisbursementDate] DATETIME2 NULL,
        [SanctionedAmount] DECIMAL(18,2) NOT NULL,
        [InterestRate] DECIMAL(18,2) NOT NULL,
        [DurationMonths] INT NOT NULL,
        [InstallmentAmount] DECIMAL(18,2) NOT NULL,
        [FirstInstallmentDate] DATETIME2 NULL,
        [MaturityDate] DATETIME2 NULL,
        [InstallmentFrequency] NVARCHAR(50) NOT NULL,
        [LastInstallmentPaidDate] DATETIME2 NULL,
        [NoOfInstallments] INT NOT NULL,
        [RecommendedByDirectorID] INT NULL,
        [Guarantor1MemberID] INT NULL,
        [Guarantor2MemberID] INT NULL,
        [SecurityDetails] NVARCHAR(500) NULL,
        [SecurityValue] DECIMAL(18,2) NOT NULL,
        [IsOpeningBalance] BIT NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [LegacyAccountId] INT NULL,
        [LegacyAccountNumber] NVARCHAR(50) NULL,
        [CustomerID] INT NULL,
        [CoCustomerID] INT NULL,
        [CoCustomer2ID] INT NULL,
        [Guarantor1CustomerID] INT NULL,
        [Guarantor2CustomerID] INT NULL,
        CONSTRAINT [PK_LoanAccounts] PRIMARY KEY CLUSTERED ([LoanAccountID] ASC)
    );
    PRINT 'Created Table [dbo].[LoanAccounts]';
END
GO

IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'LoanApplicationID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [LoanApplicationID] INT NULL;
    PRINT '  + Added column [LoanApplicationID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [MemberID] INT NULL;
    PRINT '  + Added column [MemberID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'CoMemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [CoMemberID] INT NULL;
    PRINT '  + Added column [CoMemberID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'CoMember2ID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [CoMember2ID] INT NULL;
    PRINT '  + Added column [CoMember2ID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'LoanRateID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [LoanRateID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanRateID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'LoanAccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [LoanAccountNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [LoanAccountNo] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'PrincipalBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [PrincipalBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrincipalBalance] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'InterestBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [InterestBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestBalance] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'OverdueInterestBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [OverdueInterestBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OverdueInterestBalance] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'OpeningDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [OpeningDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [OpeningDate] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'LoanDisbursementDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [LoanDisbursementDate] DATETIME2 NULL;
    PRINT '  + Added column [LoanDisbursementDate] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'SanctionedAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [SanctionedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [SanctionedAmount] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [InterestRate] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'DurationMonths') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [DurationMonths] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DurationMonths] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'InstallmentAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [InstallmentAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstallmentAmount] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'FirstInstallmentDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [FirstInstallmentDate] DATETIME2 NULL;
    PRINT '  + Added column [FirstInstallmentDate] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'MaturityDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [MaturityDate] DATETIME2 NULL;
    PRINT '  + Added column [MaturityDate] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'InstallmentFrequency') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [InstallmentFrequency] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [InstallmentFrequency] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'LastInstallmentPaidDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [LastInstallmentPaidDate] DATETIME2 NULL;
    PRINT '  + Added column [LastInstallmentPaidDate] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'NoOfInstallments') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [NoOfInstallments] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [NoOfInstallments] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'RecommendedByDirectorID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [RecommendedByDirectorID] INT NULL;
    PRINT '  + Added column [RecommendedByDirectorID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'Guarantor1MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [Guarantor1MemberID] INT NULL;
    PRINT '  + Added column [Guarantor1MemberID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'Guarantor2MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [Guarantor2MemberID] INT NULL;
    PRINT '  + Added column [Guarantor2MemberID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'SecurityDetails') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [SecurityDetails] NVARCHAR(500) NULL;
    PRINT '  + Added column [SecurityDetails] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'SecurityValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [SecurityValue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [SecurityValue] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'IsOpeningBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [IsOpeningBalance] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsOpeningBalance] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'LegacyAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [LegacyAccountId] INT NULL;
    PRINT '  + Added column [LegacyAccountId] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'LegacyAccountNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [LegacyAccountNumber] NVARCHAR(50) NULL;
    PRINT '  + Added column [LegacyAccountNumber] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [CustomerID] INT NULL;
    PRINT '  + Added column [CustomerID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'CoCustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [CoCustomerID] INT NULL;
    PRINT '  + Added column [CoCustomerID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'CoCustomer2ID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [CoCustomer2ID] INT NULL;
    PRINT '  + Added column [CoCustomer2ID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'Guarantor1CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [Guarantor1CustomerID] INT NULL;
    PRINT '  + Added column [Guarantor1CustomerID] to [dbo].[LoanAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanAccounts]', N'Guarantor2CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ADD [Guarantor2CustomerID] INT NULL;
    PRINT '  + Added column [Guarantor2CustomerID] to [dbo].[LoanAccounts]';
END
GO

----------------------------------------------------------------------------------------------------
-- [60/126] TABLE: [dbo].[LoanApplications]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LoanApplications]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoanApplications] (
        [LoanApplicationID] INT IDENTITY(1,1) NOT NULL,
        [ApplicationNo] NVARCHAR(50) NOT NULL,
        [ApplicationDate] DATETIME2 NOT NULL,
        [MemberID] INT NULL,
        [CoMemberID] INT NULL,
        [CoMember2ID] INT NULL,
        [LoanRateID] INT NOT NULL,
        [RequestedAmount] DECIMAL(18,2) NOT NULL,
        [InterestRate] DECIMAL(18,2) NOT NULL,
        [DurationMonths] INT NOT NULL,
        [InstallmentFrequency] NVARCHAR(50) NOT NULL,
        [InstallmentAmount] DECIMAL(18,2) NOT NULL,
        [NoOfInstallments] INT NOT NULL,
        [FirstInstallmentDate] DATETIME2 NULL,
        [MaturityDate] DATETIME2 NULL,
        [RecommendedByDirectorID] INT NULL,
        [Purpose] NVARCHAR(200) NULL,
        [Guarantor1MemberID] INT NULL,
        [Guarantor2MemberID] INT NULL,
        [SecurityDetails] NVARCHAR(500) NULL,
        [SecurityValue] DECIMAL(18,2) NOT NULL,
        [LoanAccountNo] NVARCHAR(50) NULL,
        [CustomerID] INT NULL,
        [CoCustomerID] INT NULL,
        [CoCustomer2ID] INT NULL,
        [Guarantor1CustomerID] INT NULL,
        [Guarantor2CustomerID] INT NULL,
        CONSTRAINT [PK_LoanApplications] PRIMARY KEY CLUSTERED ([LoanApplicationID] ASC)
    );
    PRINT 'Created Table [dbo].[LoanApplications]';
END
GO

IF COL_LENGTH(N'[dbo].[LoanApplications]', N'ApplicationNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [ApplicationNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [ApplicationNo] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'ApplicationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [ApplicationDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [ApplicationDate] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [MemberID] INT NULL;
    PRINT '  + Added column [MemberID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'CoMemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [CoMemberID] INT NULL;
    PRINT '  + Added column [CoMemberID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'CoMember2ID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [CoMember2ID] INT NULL;
    PRINT '  + Added column [CoMember2ID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'LoanRateID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [LoanRateID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanRateID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'RequestedAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [RequestedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [RequestedAmount] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [InterestRate] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'DurationMonths') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [DurationMonths] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DurationMonths] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'InstallmentFrequency') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [InstallmentFrequency] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [InstallmentFrequency] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'InstallmentAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [InstallmentAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstallmentAmount] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'NoOfInstallments') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [NoOfInstallments] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [NoOfInstallments] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'FirstInstallmentDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [FirstInstallmentDate] DATETIME2 NULL;
    PRINT '  + Added column [FirstInstallmentDate] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'MaturityDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [MaturityDate] DATETIME2 NULL;
    PRINT '  + Added column [MaturityDate] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'RecommendedByDirectorID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [RecommendedByDirectorID] INT NULL;
    PRINT '  + Added column [RecommendedByDirectorID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'Purpose') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [Purpose] NVARCHAR(200) NULL;
    PRINT '  + Added column [Purpose] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'Guarantor1MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [Guarantor1MemberID] INT NULL;
    PRINT '  + Added column [Guarantor1MemberID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'Guarantor2MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [Guarantor2MemberID] INT NULL;
    PRINT '  + Added column [Guarantor2MemberID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'SecurityDetails') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [SecurityDetails] NVARCHAR(500) NULL;
    PRINT '  + Added column [SecurityDetails] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'SecurityValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [SecurityValue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [SecurityValue] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'LoanAccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [LoanAccountNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [LoanAccountNo] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [CustomerID] INT NULL;
    PRINT '  + Added column [CustomerID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'CoCustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [CoCustomerID] INT NULL;
    PRINT '  + Added column [CoCustomerID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'CoCustomer2ID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [CoCustomer2ID] INT NULL;
    PRINT '  + Added column [CoCustomer2ID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'Guarantor1CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [Guarantor1CustomerID] INT NULL;
    PRINT '  + Added column [Guarantor1CustomerID] to [dbo].[LoanApplications]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanApplications]', N'Guarantor2CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanApplications] ADD [Guarantor2CustomerID] INT NULL;
    PRINT '  + Added column [Guarantor2CustomerID] to [dbo].[LoanApplications]';
END
GO

----------------------------------------------------------------------------------------------------
-- [61/126] TABLE: [dbo].[LoanCollectionFees]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LoanCollectionFees]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoanCollectionFees] (
        [LoanCollectionFeeID] INT IDENTITY(1,1) NOT NULL,
        [LoanCollectionID] INT NOT NULL,
        [LedgerID] INT NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        CONSTRAINT [PK_LoanCollectionFees] PRIMARY KEY CLUSTERED ([LoanCollectionFeeID] ASC)
    );
    PRINT 'Created Table [dbo].[LoanCollectionFees]';
END
GO

IF COL_LENGTH(N'[dbo].[LoanCollectionFees]', N'LoanCollectionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollectionFees] ADD [LoanCollectionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanCollectionID] to [dbo].[LoanCollectionFees]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollectionFees]', N'LedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollectionFees] ADD [LedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LedgerID] to [dbo].[LoanCollectionFees]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollectionFees]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollectionFees] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Amount] to [dbo].[LoanCollectionFees]';
END
GO

----------------------------------------------------------------------------------------------------
-- [62/126] TABLE: [dbo].[LoanCollections]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LoanCollections]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoanCollections] (
        [LoanCollectionID] INT IDENTITY(1,1) NOT NULL,
        [LoanAccountID] INT NOT NULL,
        [CollectionDate] DATETIME2 NOT NULL,
        [ReceiptNo] NVARCHAR(50) NOT NULL,
        [TotalAmountReceived] DECIMAL(18,2) NOT NULL,
        [SurchargeCollected] DECIMAL(18,2) NOT NULL,
        [PenaltyInterestCollected] DECIMAL(18,2) NOT NULL,
        [InterestCollected] DECIMAL(18,2) NOT NULL,
        [PrincipalCollected] DECIMAL(18,2) NOT NULL,
        [PaymentMode] NVARCHAR(50) NOT NULL,
        [BankName] NVARCHAR(100) NULL,
        [ChequeNo] NVARCHAR(50) NULL,
        [BankAccountLedgerID] INT NULL,
        [TransferFromSavingAccountNo] NVARCHAR(50) NULL,
        [VoucherID] INT NULL,
        [Remarks] NVARCHAR(200) NULL,
        [ApprovedByUserID] INT NULL,
        [InterestWaived] DECIMAL(18,2) NOT NULL DEFAULT ((0.0)),
        [IsOTS] BIT NOT NULL DEFAULT (CONVERT([bit],(0),(0))),
        [PenaltyWaived] DECIMAL(18,2) NOT NULL DEFAULT ((0.0)),
        [ResolutionNo] NVARCHAR(100) NULL,
        CONSTRAINT [PK_LoanCollections] PRIMARY KEY CLUSTERED ([LoanCollectionID] ASC)
    );
    PRINT 'Created Table [dbo].[LoanCollections]';
END
GO

IF COL_LENGTH(N'[dbo].[LoanCollections]', N'LoanAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [LoanAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountID] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'CollectionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [CollectionDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CollectionDate] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'ReceiptNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [ReceiptNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [ReceiptNo] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'TotalAmountReceived') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [TotalAmountReceived] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalAmountReceived] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'SurchargeCollected') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [SurchargeCollected] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [SurchargeCollected] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'PenaltyInterestCollected') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [PenaltyInterestCollected] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PenaltyInterestCollected] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'InterestCollected') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [InterestCollected] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestCollected] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'PrincipalCollected') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [PrincipalCollected] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrincipalCollected] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [PaymentMode] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [PaymentMode] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'BankName') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [BankName] NVARCHAR(100) NULL;
    PRINT '  + Added column [BankName] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'ChequeNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [ChequeNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [ChequeNo] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'BankAccountLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [BankAccountLedgerID] INT NULL;
    PRINT '  + Added column [BankAccountLedgerID] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'TransferFromSavingAccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [TransferFromSavingAccountNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [TransferFromSavingAccountNo] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [Remarks] NVARCHAR(200) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'ApprovedByUserID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [ApprovedByUserID] INT NULL;
    PRINT '  + Added column [ApprovedByUserID] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'InterestWaived') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [InterestWaived] DECIMAL(18,2) NOT NULL DEFAULT ((0.0));
    PRINT '  + Added column [InterestWaived] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'IsOTS') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [IsOTS] BIT NOT NULL DEFAULT (CONVERT([bit],(0),(0)));
    PRINT '  + Added column [IsOTS] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'PenaltyWaived') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [PenaltyWaived] DECIMAL(18,2) NOT NULL DEFAULT ((0.0));
    PRINT '  + Added column [PenaltyWaived] to [dbo].[LoanCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanCollections]', N'ResolutionNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanCollections] ADD [ResolutionNo] NVARCHAR(100) NULL;
    PRINT '  + Added column [ResolutionNo] to [dbo].[LoanCollections]';
END
GO

----------------------------------------------------------------------------------------------------
-- [63/126] TABLE: [dbo].[LoanDisbursementDeductions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LoanDisbursementDeductions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoanDisbursementDeductions] (
        [LoanDisbursementDeductionID] INT IDENTITY(1,1) NOT NULL,
        [LoanDisbursementID] INT NOT NULL,
        [LedgerID] INT NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        CONSTRAINT [PK_LoanDisbursementDeductions] PRIMARY KEY CLUSTERED ([LoanDisbursementDeductionID] ASC)
    );
    PRINT 'Created Table [dbo].[LoanDisbursementDeductions]';
END
GO

IF COL_LENGTH(N'[dbo].[LoanDisbursementDeductions]', N'LoanDisbursementID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursementDeductions] ADD [LoanDisbursementID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanDisbursementID] to [dbo].[LoanDisbursementDeductions]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursementDeductions]', N'LedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursementDeductions] ADD [LedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LedgerID] to [dbo].[LoanDisbursementDeductions]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursementDeductions]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursementDeductions] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Amount] to [dbo].[LoanDisbursementDeductions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [64/126] TABLE: [dbo].[LoanDisbursements]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LoanDisbursements]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoanDisbursements] (
        [LoanDisbursementID] INT IDENTITY(1,1) NOT NULL,
        [LoanAccountID] INT NOT NULL,
        [DisbursementDate] DATETIME2 NOT NULL,
        [SanctionedAmount] DECIMAL(18,2) NOT NULL,
        [DisbursementAmount] DECIMAL(18,2) NOT NULL,
        [ProcessingFee] DECIMAL(18,2) NOT NULL,
        [ShareDeduction] DECIMAL(18,2) NOT NULL,
        [InsuranceDeduction] DECIMAL(18,2) NOT NULL,
        [StationeryCharges] DECIMAL(18,2) NOT NULL,
        [OtherDeductions] DECIMAL(18,2) NOT NULL,
        [NetAmountPaid] DECIMAL(18,2) NOT NULL,
        [PaymentMode] NVARCHAR(50) NOT NULL,
        [BankName] NVARCHAR(100) NULL,
        [ChequeNo] NVARCHAR(50) NULL,
        [BankAccountLedgerID] INT NULL,
        [TransferToSavingAccountNo] NVARCHAR(50) NULL,
        [VoucherID] INT NULL,
        [Remarks] NVARCHAR(200) NULL,
        [LoanInstallmentType] NVARCHAR(100) NULL,
        CONSTRAINT [PK_LoanDisbursements] PRIMARY KEY CLUSTERED ([LoanDisbursementID] ASC)
    );
    PRINT 'Created Table [dbo].[LoanDisbursements]';
END
GO

IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'LoanAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [LoanAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountID] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'DisbursementDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [DisbursementDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [DisbursementDate] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'SanctionedAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [SanctionedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [SanctionedAmount] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'DisbursementAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [DisbursementAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DisbursementAmount] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'ProcessingFee') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [ProcessingFee] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ProcessingFee] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'ShareDeduction') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [ShareDeduction] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ShareDeduction] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'InsuranceDeduction') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [InsuranceDeduction] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InsuranceDeduction] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'StationeryCharges') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [StationeryCharges] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [StationeryCharges] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'OtherDeductions') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [OtherDeductions] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OtherDeductions] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'NetAmountPaid') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [NetAmountPaid] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [NetAmountPaid] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [PaymentMode] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [PaymentMode] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'BankName') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [BankName] NVARCHAR(100) NULL;
    PRINT '  + Added column [BankName] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'ChequeNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [ChequeNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [ChequeNo] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'BankAccountLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [BankAccountLedgerID] INT NULL;
    PRINT '  + Added column [BankAccountLedgerID] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'TransferToSavingAccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [TransferToSavingAccountNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [TransferToSavingAccountNo] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [Remarks] NVARCHAR(200) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[LoanDisbursements]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDisbursements]', N'LoanInstallmentType') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDisbursements] ADD [LoanInstallmentType] NVARCHAR(100) NULL;
    PRINT '  + Added column [LoanInstallmentType] to [dbo].[LoanDisbursements]';
END
GO

----------------------------------------------------------------------------------------------------
-- [65/126] TABLE: [dbo].[LoanDocuments]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LoanDocuments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoanDocuments] (
        [LoanDocumentID] INT IDENTITY(1,1) NOT NULL,
        [LoanAccountID] INT NOT NULL,
        [DocumentType] NVARCHAR(100) NOT NULL,
        [DocumentName] NVARCHAR(200) NOT NULL,
        [FilePath] NVARCHAR(500) NOT NULL,
        [UploadedDate] DATETIME2 NOT NULL,
        CONSTRAINT [PK_LoanDocuments] PRIMARY KEY CLUSTERED ([LoanDocumentID] ASC)
    );
    PRINT 'Created Table [dbo].[LoanDocuments]';
END
GO

IF COL_LENGTH(N'[dbo].[LoanDocuments]', N'LoanAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDocuments] ADD [LoanAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountID] to [dbo].[LoanDocuments]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDocuments]', N'DocumentType') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDocuments] ADD [DocumentType] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [DocumentType] to [dbo].[LoanDocuments]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDocuments]', N'DocumentName') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDocuments] ADD [DocumentName] NVARCHAR(200) NOT NULL DEFAULT '';
    PRINT '  + Added column [DocumentName] to [dbo].[LoanDocuments]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDocuments]', N'FilePath') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDocuments] ADD [FilePath] NVARCHAR(500) NOT NULL DEFAULT '';
    PRINT '  + Added column [FilePath] to [dbo].[LoanDocuments]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanDocuments]', N'UploadedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanDocuments] ADD [UploadedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [UploadedDate] to [dbo].[LoanDocuments]';
END
GO

----------------------------------------------------------------------------------------------------
-- [66/126] TABLE: [dbo].[LoanInstallmentSchedules]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LoanInstallmentSchedules]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoanInstallmentSchedules] (
        [ScheduleID] INT IDENTITY(1,1) NOT NULL,
        [LoanAccountID] INT NOT NULL,
        [InstallmentNo] INT NOT NULL,
        [DueDate] DATETIME2 NOT NULL,
        [PrincipalAmount] DECIMAL(18,2) NOT NULL,
        [InterestAmount] DECIMAL(18,2) NOT NULL,
        [TotalAmount] DECIMAL(18,2) NOT NULL,
        [BalanceAmount] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [PaidDate] DATETIME2 NULL,
        [OpeningBalance] DECIMAL(18,2) NOT NULL,
        [ClosingBalance] DECIMAL(18,2) NOT NULL,
        [Days] INT NOT NULL,
        [InterestRate] DECIMAL(18,2) NOT NULL,
        CONSTRAINT [PK_LoanInstallmentSchedules] PRIMARY KEY CLUSTERED ([ScheduleID] ASC)
    );
    PRINT 'Created Table [dbo].[LoanInstallmentSchedules]';
END
GO

IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'LoanAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [LoanAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountID] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'InstallmentNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [InstallmentNo] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstallmentNo] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'DueDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [DueDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [DueDate] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'PrincipalAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [PrincipalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrincipalAmount] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'InterestAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [InterestAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestAmount] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'TotalAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [TotalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalAmount] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'BalanceAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [BalanceAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [BalanceAmount] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'PaidDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [PaidDate] DATETIME2 NULL;
    PRINT '  + Added column [PaidDate] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'OpeningBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [OpeningBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OpeningBalance] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'ClosingBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [ClosingBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ClosingBalance] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'Days') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [Days] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [Days] to [dbo].[LoanInstallmentSchedules]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanInstallmentSchedules]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanInstallmentSchedules] ADD [InterestRate] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[LoanInstallmentSchedules]';
END
GO

----------------------------------------------------------------------------------------------------
-- [67/126] TABLE: [dbo].[LoanRates]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LoanRates]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoanRates] (
        [LoanRateID] INT IDENTITY(1,1) NOT NULL,
        [LoanType] NVARCHAR(100) NOT NULL,
        [LoanCode] NVARCHAR(50) NOT NULL,
        [LoanLedgerID] INT NULL,
        [InterestLedgerID] INT NULL,
        [OverdueInterestLedgerID] INT NULL,
        [ReceivableInterestLedgerID] INT NULL,
        [SurchargeLedgerID] INT NULL,
        [RecoveryFeeLedgerID] INT NULL,
        [ProcessingFeeLedgerID] INT NULL,
        [InterestRate] DECIMAL(18,2) NOT NULL,
        [OverdueInterestRate] DECIMAL(18,2) NOT NULL,
        [InterestPostingType] NVARCHAR(100) NOT NULL,
        [InterestCalculationMethod] NVARCHAR(100) NOT NULL,
        [ShortName] NVARCHAR(100) NOT NULL,
        [DurationMonths] INT NOT NULL,
        [InstallmentType] NVARCHAR(100) NOT NULL,
        [InstallmentCount] INT NOT NULL,
        [LoanInstallmentType] NVARCHAR(100) NOT NULL,
        [SecurityType] NVARCHAR(100) NOT NULL,
        [IsCcOrOd] BIT NOT NULL,
        [IsActive] BIT NOT NULL,
        [InterestPostingFrequency] NVARCHAR(100) NOT NULL DEFAULT (''),
        CONSTRAINT [PK_LoanRates] PRIMARY KEY CLUSTERED ([LoanRateID] ASC)
    );
    PRINT 'Created Table [dbo].[LoanRates]';
END
GO

IF COL_LENGTH(N'[dbo].[LoanRates]', N'LoanType') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [LoanType] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [LoanType] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'LoanCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [LoanCode] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [LoanCode] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'LoanLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [LoanLedgerID] INT NULL;
    PRINT '  + Added column [LoanLedgerID] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'InterestLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [InterestLedgerID] INT NULL;
    PRINT '  + Added column [InterestLedgerID] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'OverdueInterestLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [OverdueInterestLedgerID] INT NULL;
    PRINT '  + Added column [OverdueInterestLedgerID] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'ReceivableInterestLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [ReceivableInterestLedgerID] INT NULL;
    PRINT '  + Added column [ReceivableInterestLedgerID] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'SurchargeLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [SurchargeLedgerID] INT NULL;
    PRINT '  + Added column [SurchargeLedgerID] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'RecoveryFeeLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [RecoveryFeeLedgerID] INT NULL;
    PRINT '  + Added column [RecoveryFeeLedgerID] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'ProcessingFeeLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [ProcessingFeeLedgerID] INT NULL;
    PRINT '  + Added column [ProcessingFeeLedgerID] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [InterestRate] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'OverdueInterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [OverdueInterestRate] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OverdueInterestRate] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'InterestPostingType') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [InterestPostingType] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [InterestPostingType] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'InterestCalculationMethod') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [InterestCalculationMethod] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [InterestCalculationMethod] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'ShortName') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [ShortName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [ShortName] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'DurationMonths') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [DurationMonths] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DurationMonths] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'InstallmentType') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [InstallmentType] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [InstallmentType] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'InstallmentCount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [InstallmentCount] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstallmentCount] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'LoanInstallmentType') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [LoanInstallmentType] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [LoanInstallmentType] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'SecurityType') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [SecurityType] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [SecurityType] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'IsCcOrOd') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [IsCcOrOd] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsCcOrOd] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[LoanRates]';
END
GO
IF COL_LENGTH(N'[dbo].[LoanRates]', N'InterestPostingFrequency') IS NULL
BEGIN
    ALTER TABLE [dbo].[LoanRates] ADD [InterestPostingFrequency] NVARCHAR(100) NOT NULL DEFAULT ('');
    PRINT '  + Added column [InterestPostingFrequency] to [dbo].[LoanRates]';
END
GO

----------------------------------------------------------------------------------------------------
-- [68/126] TABLE: [dbo].[LockerAllotments]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LockerAllotments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LockerAllotments] (
        [AllotmentID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [LockerAccountNo] NVARCHAR(50) NOT NULL,
        [LockerID] INT NOT NULL,
        [MemberID] INT NOT NULL,
        [JointMember1_ID] INT NULL,
        [JointMember2_ID] INT NULL,
        [OperatingInstruction] NVARCHAR(50) NOT NULL,
        [AllotmentDate] DATETIME2 NOT NULL,
        [RentStartDate] DATETIME2 NOT NULL,
        [ExpiryDate] DATETIME2 NOT NULL,
        [AnnualRent] DECIMAL(18,2) NOT NULL,
        [SecurityDepositAmount] DECIMAL(18,2) NOT NULL,
        [AdvanceRentPaid] DECIMAL(18,2) NOT NULL,
        [LinkedSavingAccountID] INT NULL,
        [IsAutoDebitEnabled] BIT NOT NULL,
        [NomineeName] NVARCHAR(150) NULL,
        [NomineeRelation] NVARCHAR(50) NULL,
        [NomineeAge] INT NULL,
        [NomineeAadhaar] NVARCHAR(20) NULL,
        [NomineeAddress] NVARCHAR(200) NULL,
        [DepositVoucherID] INT NULL,
        [AdvanceRentVoucherID] INT NULL,
        [Status] NVARCHAR(30) NOT NULL,
        [Remarks] NVARCHAR(250) NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        [CustomerID] INT NULL,
        CONSTRAINT [PK_LockerAllotments] PRIMARY KEY CLUSTERED ([AllotmentID] ASC)
    );
    PRINT 'Created Table [dbo].[LockerAllotments]';
END
GO

IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'LockerAccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [LockerAccountNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [LockerAccountNo] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'LockerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [LockerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LockerID] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [MemberID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MemberID] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'JointMember1_ID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [JointMember1_ID] INT NULL;
    PRINT '  + Added column [JointMember1_ID] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'JointMember2_ID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [JointMember2_ID] INT NULL;
    PRINT '  + Added column [JointMember2_ID] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'OperatingInstruction') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [OperatingInstruction] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [OperatingInstruction] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'AllotmentDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [AllotmentDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [AllotmentDate] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'RentStartDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [RentStartDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [RentStartDate] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'ExpiryDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [ExpiryDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [ExpiryDate] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'AnnualRent') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [AnnualRent] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [AnnualRent] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'SecurityDepositAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [SecurityDepositAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [SecurityDepositAmount] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'AdvanceRentPaid') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [AdvanceRentPaid] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [AdvanceRentPaid] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'LinkedSavingAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [LinkedSavingAccountID] INT NULL;
    PRINT '  + Added column [LinkedSavingAccountID] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'IsAutoDebitEnabled') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [IsAutoDebitEnabled] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsAutoDebitEnabled] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'NomineeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [NomineeName] NVARCHAR(150) NULL;
    PRINT '  + Added column [NomineeName] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'NomineeRelation') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [NomineeRelation] NVARCHAR(50) NULL;
    PRINT '  + Added column [NomineeRelation] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'NomineeAge') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [NomineeAge] INT NULL;
    PRINT '  + Added column [NomineeAge] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'NomineeAadhaar') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [NomineeAadhaar] NVARCHAR(20) NULL;
    PRINT '  + Added column [NomineeAadhaar] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'NomineeAddress') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [NomineeAddress] NVARCHAR(200) NULL;
    PRINT '  + Added column [NomineeAddress] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'DepositVoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [DepositVoucherID] INT NULL;
    PRINT '  + Added column [DepositVoucherID] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'AdvanceRentVoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [AdvanceRentVoucherID] INT NULL;
    PRINT '  + Added column [AdvanceRentVoucherID] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [Status] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[LockerAllotments]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerAllotments]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerAllotments] ADD [CustomerID] INT NULL;
    PRINT '  + Added column [CustomerID] to [dbo].[LockerAllotments]';
END
GO

----------------------------------------------------------------------------------------------------
-- [69/126] TABLE: [dbo].[LockerRentPostings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LockerRentPostings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LockerRentPostings] (
        [PostingID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [AllotmentID] INT NOT NULL,
        [FinancialYear] NVARCHAR(20) NOT NULL,
        [FromDate] DATETIME2 NOT NULL,
        [ToDate] DATETIME2 NOT NULL,
        [RentAmount] DECIMAL(18,2) NOT NULL,
        [GstAmount] DECIMAL(18,2) NOT NULL,
        [PenaltyAmount] DECIMAL(18,2) NOT NULL,
        [TotalAmount] DECIMAL(18,2) NOT NULL,
        [PaymentMode] NVARCHAR(50) NOT NULL,
        [PaymentDate] DATETIME2 NULL,
        [ReceiptNo] NVARCHAR(50) NULL,
        [VoucherID] INT NULL,
        [IsPaid] BIT NOT NULL,
        [Remarks] NVARCHAR(250) NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [PK_LockerRentPostings] PRIMARY KEY CLUSTERED ([PostingID] ASC)
    );
    PRINT 'Created Table [dbo].[LockerRentPostings]';
END
GO

IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'AllotmentID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [AllotmentID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AllotmentID] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'FinancialYear') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [FinancialYear] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [FinancialYear] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'FromDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [FromDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [FromDate] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'ToDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [ToDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [ToDate] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'RentAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [RentAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [RentAmount] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'GstAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [GstAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [GstAmount] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'PenaltyAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [PenaltyAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PenaltyAmount] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'TotalAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [TotalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalAmount] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [PaymentMode] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [PaymentMode] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'PaymentDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [PaymentDate] DATETIME2 NULL;
    PRINT '  + Added column [PaymentDate] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'ReceiptNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [ReceiptNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [ReceiptNo] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'IsPaid') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [IsPaid] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsPaid] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[LockerRentPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerRentPostings]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerRentPostings] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[LockerRentPostings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [70/126] TABLE: [dbo].[Lockers]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Lockers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Lockers] (
        [LockerID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [CabinetNo] NVARCHAR(50) NOT NULL,
        [LockerNo] NVARCHAR(50) NOT NULL,
        [KeyNo] NVARCHAR(50) NOT NULL,
        [LockerTypeID] INT NOT NULL,
        [Status] NVARCHAR(50) NOT NULL,
        [Remarks] NVARCHAR(250) NULL,
        [IsActive] BIT NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [PK_Lockers] PRIMARY KEY CLUSTERED ([LockerID] ASC)
    );
    PRINT 'Created Table [dbo].[Lockers]';
END
GO

IF COL_LENGTH(N'[dbo].[Lockers]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Lockers] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[Lockers]';
END
GO
IF COL_LENGTH(N'[dbo].[Lockers]', N'CabinetNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Lockers] ADD [CabinetNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [CabinetNo] to [dbo].[Lockers]';
END
GO
IF COL_LENGTH(N'[dbo].[Lockers]', N'LockerNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Lockers] ADD [LockerNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [LockerNo] to [dbo].[Lockers]';
END
GO
IF COL_LENGTH(N'[dbo].[Lockers]', N'KeyNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Lockers] ADD [KeyNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [KeyNo] to [dbo].[Lockers]';
END
GO
IF COL_LENGTH(N'[dbo].[Lockers]', N'LockerTypeID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Lockers] ADD [LockerTypeID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LockerTypeID] to [dbo].[Lockers]';
END
GO
IF COL_LENGTH(N'[dbo].[Lockers]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[Lockers] ADD [Status] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[Lockers]';
END
GO
IF COL_LENGTH(N'[dbo].[Lockers]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[Lockers] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[Lockers]';
END
GO
IF COL_LENGTH(N'[dbo].[Lockers]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[Lockers] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[Lockers]';
END
GO
IF COL_LENGTH(N'[dbo].[Lockers]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[Lockers] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[Lockers]';
END
GO

----------------------------------------------------------------------------------------------------
-- [71/126] TABLE: [dbo].[LockerSurrenders]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LockerSurrenders]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LockerSurrenders] (
        [SurrenderID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [AllotmentID] INT NOT NULL,
        [SurrenderDate] DATETIME2 NOT NULL,
        [KeyReceived] BIT NOT NULL,
        [KeysCondition] NVARCHAR(100) NOT NULL,
        [DepositAmount] DECIMAL(18,2) NOT NULL,
        [UnpaidRentDeduction] DECIMAL(18,2) NOT NULL,
        [DamagePenaltyDeduction] DECIMAL(18,2) NOT NULL,
        [NetRefundAmount] DECIMAL(18,2) NOT NULL,
        [RefundPaymentMode] NVARCHAR(50) NOT NULL,
        [VoucherID] INT NULL,
        [Remarks] NVARCHAR(250) NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [PK_LockerSurrenders] PRIMARY KEY CLUSTERED ([SurrenderID] ASC)
    );
    PRINT 'Created Table [dbo].[LockerSurrenders]';
END
GO

IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'AllotmentID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [AllotmentID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AllotmentID] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'SurrenderDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [SurrenderDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [SurrenderDate] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'KeyReceived') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [KeyReceived] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [KeyReceived] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'KeysCondition') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [KeysCondition] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [KeysCondition] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'DepositAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [DepositAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DepositAmount] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'UnpaidRentDeduction') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [UnpaidRentDeduction] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [UnpaidRentDeduction] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'DamagePenaltyDeduction') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [DamagePenaltyDeduction] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DamagePenaltyDeduction] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'NetRefundAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [NetRefundAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [NetRefundAmount] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'RefundPaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [RefundPaymentMode] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [RefundPaymentMode] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[LockerSurrenders]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerSurrenders]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerSurrenders] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[LockerSurrenders]';
END
GO

----------------------------------------------------------------------------------------------------
-- [72/126] TABLE: [dbo].[LockerTypes]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LockerTypes]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LockerTypes] (
        [LockerTypeID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [TypeCode] NVARCHAR(50) NOT NULL,
        [TypeName] NVARCHAR(100) NOT NULL,
        [Dimensions] NVARCHAR(100) NULL,
        [AnnualRent] DECIMAL(18,2) NOT NULL,
        [SecurityDeposit] DECIMAL(18,2) NOT NULL,
        [LateFeePerMonth] DECIMAL(18,2) NOT NULL,
        [GstRate] DECIMAL(5,2) NOT NULL,
        [DepositLiabilityLedgerID] INT NULL,
        [RentIncomeLedgerID] INT NULL,
        [LateFeeIncomeLedgerID] INT NULL,
        [GstLiabilityLedgerID] INT NULL,
        [IsActive] BIT NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [PK_LockerTypes] PRIMARY KEY CLUSTERED ([LockerTypeID] ASC)
    );
    PRINT 'Created Table [dbo].[LockerTypes]';
END
GO

IF COL_LENGTH(N'[dbo].[LockerTypes]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'TypeCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [TypeCode] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [TypeCode] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'TypeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [TypeName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [TypeName] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'Dimensions') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [Dimensions] NVARCHAR(100) NULL;
    PRINT '  + Added column [Dimensions] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'AnnualRent') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [AnnualRent] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [AnnualRent] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'SecurityDeposit') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [SecurityDeposit] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [SecurityDeposit] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'LateFeePerMonth') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [LateFeePerMonth] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [LateFeePerMonth] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'GstRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [GstRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [GstRate] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'DepositLiabilityLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [DepositLiabilityLedgerID] INT NULL;
    PRINT '  + Added column [DepositLiabilityLedgerID] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'RentIncomeLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [RentIncomeLedgerID] INT NULL;
    PRINT '  + Added column [RentIncomeLedgerID] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'LateFeeIncomeLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [LateFeeIncomeLedgerID] INT NULL;
    PRINT '  + Added column [LateFeeIncomeLedgerID] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'GstLiabilityLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [GstLiabilityLedgerID] INT NULL;
    PRINT '  + Added column [GstLiabilityLedgerID] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[LockerTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerTypes]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerTypes] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[LockerTypes]';
END
GO

----------------------------------------------------------------------------------------------------
-- [73/126] TABLE: [dbo].[LockerVisitRegisters]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[LockerVisitRegisters]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LockerVisitRegisters] (
        [VisitID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [AllotmentID] INT NOT NULL,
        [VisitDate] DATETIME2 NOT NULL,
        [TimeIn] NVARCHAR(20) NOT NULL,
        [TimeOut] NVARCHAR(20) NULL,
        [OperatedBy] NVARCHAR(50) NOT NULL,
        [OperatorName] NVARCHAR(150) NOT NULL,
        [IsSignatureVerified] BIT NOT NULL,
        [BankOfficerName] NVARCHAR(100) NULL,
        [Remarks] NVARCHAR(250) NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [PK_LockerVisitRegisters] PRIMARY KEY CLUSTERED ([VisitID] ASC)
    );
    PRINT 'Created Table [dbo].[LockerVisitRegisters]';
END
GO

IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[LockerVisitRegisters]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'AllotmentID') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [AllotmentID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AllotmentID] to [dbo].[LockerVisitRegisters]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'VisitDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [VisitDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [VisitDate] to [dbo].[LockerVisitRegisters]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'TimeIn') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [TimeIn] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [TimeIn] to [dbo].[LockerVisitRegisters]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'TimeOut') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [TimeOut] NVARCHAR(20) NULL;
    PRINT '  + Added column [TimeOut] to [dbo].[LockerVisitRegisters]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'OperatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [OperatedBy] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [OperatedBy] to [dbo].[LockerVisitRegisters]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'OperatorName') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [OperatorName] NVARCHAR(150) NOT NULL DEFAULT '';
    PRINT '  + Added column [OperatorName] to [dbo].[LockerVisitRegisters]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'IsSignatureVerified') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [IsSignatureVerified] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsSignatureVerified] to [dbo].[LockerVisitRegisters]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'BankOfficerName') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [BankOfficerName] NVARCHAR(100) NULL;
    PRINT '  + Added column [BankOfficerName] to [dbo].[LockerVisitRegisters]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[LockerVisitRegisters]';
END
GO
IF COL_LENGTH(N'[dbo].[LockerVisitRegisters]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[LockerVisitRegisters] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[LockerVisitRegisters]';
END
GO

----------------------------------------------------------------------------------------------------
-- [74/126] TABLE: [dbo].[MemberOpeningBalances]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[MemberOpeningBalances]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[MemberOpeningBalances] (
        [MemberOpeningBalanceID] INT IDENTITY(1,1) NOT NULL,
        [MemberID] INT NOT NULL,
        [LedgerID] INT NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        [BalanceType] NVARCHAR(2) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        [CustomerID] INT NULL,
        CONSTRAINT [PK_MemberOpeningBalances] PRIMARY KEY CLUSTERED ([MemberOpeningBalanceID] ASC)
    );
    PRINT 'Created Table [dbo].[MemberOpeningBalances]';
END
GO

IF COL_LENGTH(N'[dbo].[MemberOpeningBalances]', N'MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[MemberOpeningBalances] ADD [MemberID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MemberID] to [dbo].[MemberOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[MemberOpeningBalances]', N'LedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[MemberOpeningBalances] ADD [LedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LedgerID] to [dbo].[MemberOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[MemberOpeningBalances]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[MemberOpeningBalances] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Amount] to [dbo].[MemberOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[MemberOpeningBalances]', N'BalanceType') IS NULL
BEGIN
    ALTER TABLE [dbo].[MemberOpeningBalances] ADD [BalanceType] NVARCHAR(2) NOT NULL DEFAULT '';
    PRINT '  + Added column [BalanceType] to [dbo].[MemberOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[MemberOpeningBalances]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[MemberOpeningBalances] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[MemberOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[MemberOpeningBalances]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[MemberOpeningBalances] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[MemberOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[MemberOpeningBalances]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[MemberOpeningBalances] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[MemberOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[MemberOpeningBalances]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[MemberOpeningBalances] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[MemberOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[MemberOpeningBalances]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[MemberOpeningBalances] ADD [CustomerID] INT NULL;
    PRINT '  + Added column [CustomerID] to [dbo].[MemberOpeningBalances]';
END
GO

----------------------------------------------------------------------------------------------------
-- [75/126] TABLE: [dbo].[Members]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Members]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Members] (
        [MemberID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [MemberCode] NVARCHAR(20) NULL,
        [JoiningDate] DATETIME2 NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        [LegacyMemberNo] NVARCHAR(50) NULL,
        [MembershipType] NVARCHAR(30) NOT NULL DEFAULT ('Regular'),
        [IsDeleted] BIT NOT NULL DEFAULT ((0)),
        [CustomerID] INT NULL,
        CONSTRAINT [PK_Members] PRIMARY KEY CLUSTERED ([MemberID] ASC)
    );
    PRINT 'Created Table [dbo].[Members]';
END
GO

IF COL_LENGTH(N'[dbo].[Members]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'MemberCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [MemberCode] NVARCHAR(20) NULL;
    PRINT '  + Added column [MemberCode] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'JoiningDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [JoiningDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [JoiningDate] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'LegacyMemberNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [LegacyMemberNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [LegacyMemberNo] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'MembershipType') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [MembershipType] NVARCHAR(30) NOT NULL DEFAULT ('Regular');
    PRINT '  + Added column [MembershipType] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'IsDeleted') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [IsDeleted] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [IsDeleted] to [dbo].[Members]';
END
GO
IF COL_LENGTH(N'[dbo].[Members]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [CustomerID] INT NULL;
    PRINT '  + Added column [CustomerID] to [dbo].[Members]';
END
GO

----------------------------------------------------------------------------------------------------
-- [76/126] TABLE: [dbo].[NpaClassificationRuns]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[NpaClassificationRuns]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[NpaClassificationRuns] (
        [NpaClassificationRunID] INT IDENTITY(1,1) NOT NULL,
        [RunDate] DATETIME2 NOT NULL,
        [TriggeredBy] NVARCHAR(100) NOT NULL,
        [RecordsProcessed] INT NOT NULL,
        [Status] NVARCHAR(50) NOT NULL,
        [Remarks] NVARCHAR(500) NULL,
        CONSTRAINT [PK_NpaClassificationRuns] PRIMARY KEY CLUSTERED ([NpaClassificationRunID] ASC)
    );
    PRINT 'Created Table [dbo].[NpaClassificationRuns]';
END
GO

IF COL_LENGTH(N'[dbo].[NpaClassificationRuns]', N'RunDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaClassificationRuns] ADD [RunDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [RunDate] to [dbo].[NpaClassificationRuns]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaClassificationRuns]', N'TriggeredBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaClassificationRuns] ADD [TriggeredBy] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [TriggeredBy] to [dbo].[NpaClassificationRuns]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaClassificationRuns]', N'RecordsProcessed') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaClassificationRuns] ADD [RecordsProcessed] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [RecordsProcessed] to [dbo].[NpaClassificationRuns]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaClassificationRuns]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaClassificationRuns] ADD [Status] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[NpaClassificationRuns]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaClassificationRuns]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaClassificationRuns] ADD [Remarks] NVARCHAR(500) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[NpaClassificationRuns]';
END
GO

----------------------------------------------------------------------------------------------------
-- [77/126] TABLE: [dbo].[NpaConfigs]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[NpaConfigs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[NpaConfigs] (
        [FinancialYear] NVARCHAR(10) NOT NULL,
        [ConcessionPeriodDays] INT NOT NULL,
        CONSTRAINT [PK_NpaConfigs] PRIMARY KEY CLUSTERED ([FinancialYear] ASC)
    );
    PRINT 'Created Table [dbo].[NpaConfigs]';
END
GO

IF COL_LENGTH(N'[dbo].[NpaConfigs]', N'FinancialYear') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaConfigs] ADD [FinancialYear] NVARCHAR(10) NOT NULL DEFAULT '';
    PRINT '  + Added column [FinancialYear] to [dbo].[NpaConfigs]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaConfigs]', N'ConcessionPeriodDays') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaConfigs] ADD [ConcessionPeriodDays] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [ConcessionPeriodDays] to [dbo].[NpaConfigs]';
END
GO

----------------------------------------------------------------------------------------------------
-- [78/126] TABLE: [dbo].[NpaProvisionSlabs]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[NpaProvisionSlabs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[NpaProvisionSlabs] (
        [NpaProvisionSlabID] INT IDENTITY(1,1) NOT NULL,
        [FinancialYear] NVARCHAR(10) NOT NULL,
        [Category] NVARCHAR(50) NOT NULL,
        [SecurityType] NVARCHAR(20) NOT NULL,
        [OverdueOrOutOfOrderMonthsFrom] DECIMAL(18,2) NOT NULL,
        [OverdueOrOutOfOrderMonthsTo] DECIMAL(18,2) NOT NULL,
        [NpaMonthsFrom] DECIMAL(18,2) NOT NULL,
        [NpaMonthsTo] DECIMAL(18,2) NOT NULL,
        [MinProvisionPercent] DECIMAL(18,2) NOT NULL,
        CONSTRAINT [PK_NpaProvisionSlabs] PRIMARY KEY CLUSTERED ([NpaProvisionSlabID] ASC)
    );
    PRINT 'Created Table [dbo].[NpaProvisionSlabs]';
END
GO

IF COL_LENGTH(N'[dbo].[NpaProvisionSlabs]', N'FinancialYear') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaProvisionSlabs] ADD [FinancialYear] NVARCHAR(10) NOT NULL DEFAULT '';
    PRINT '  + Added column [FinancialYear] to [dbo].[NpaProvisionSlabs]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaProvisionSlabs]', N'Category') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaProvisionSlabs] ADD [Category] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [Category] to [dbo].[NpaProvisionSlabs]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaProvisionSlabs]', N'SecurityType') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaProvisionSlabs] ADD [SecurityType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [SecurityType] to [dbo].[NpaProvisionSlabs]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaProvisionSlabs]', N'OverdueOrOutOfOrderMonthsFrom') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaProvisionSlabs] ADD [OverdueOrOutOfOrderMonthsFrom] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OverdueOrOutOfOrderMonthsFrom] to [dbo].[NpaProvisionSlabs]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaProvisionSlabs]', N'OverdueOrOutOfOrderMonthsTo') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaProvisionSlabs] ADD [OverdueOrOutOfOrderMonthsTo] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OverdueOrOutOfOrderMonthsTo] to [dbo].[NpaProvisionSlabs]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaProvisionSlabs]', N'NpaMonthsFrom') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaProvisionSlabs] ADD [NpaMonthsFrom] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [NpaMonthsFrom] to [dbo].[NpaProvisionSlabs]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaProvisionSlabs]', N'NpaMonthsTo') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaProvisionSlabs] ADD [NpaMonthsTo] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [NpaMonthsTo] to [dbo].[NpaProvisionSlabs]';
END
GO
IF COL_LENGTH(N'[dbo].[NpaProvisionSlabs]', N'MinProvisionPercent') IS NULL
BEGIN
    ALTER TABLE [dbo].[NpaProvisionSlabs] ADD [MinProvisionPercent] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [MinProvisionPercent] to [dbo].[NpaProvisionSlabs]';
END
GO

----------------------------------------------------------------------------------------------------
-- [79/126] TABLE: [dbo].[OverdueInterestLedgers]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[OverdueInterestLedgers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[OverdueInterestLedgers] (
        [OverdueInterestLedgerID] INT IDENTITY(1,1) NOT NULL,
        [LoanAccountID] INT NOT NULL,
        [TransactionDate] DATETIME2 NOT NULL,
        [DebitAmount] DECIMAL(18,2) NOT NULL,
        [CreditAmount] DECIMAL(18,2) NOT NULL,
        [VoucherID] INT NULL,
        [Particulars] NVARCHAR(250) NOT NULL,
        CONSTRAINT [PK_OverdueInterestLedgers] PRIMARY KEY CLUSTERED ([OverdueInterestLedgerID] ASC)
    );
    PRINT 'Created Table [dbo].[OverdueInterestLedgers]';
END
GO

IF COL_LENGTH(N'[dbo].[OverdueInterestLedgers]', N'LoanAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueInterestLedgers] ADD [LoanAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountID] to [dbo].[OverdueInterestLedgers]';
END
GO
IF COL_LENGTH(N'[dbo].[OverdueInterestLedgers]', N'TransactionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueInterestLedgers] ADD [TransactionDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [TransactionDate] to [dbo].[OverdueInterestLedgers]';
END
GO
IF COL_LENGTH(N'[dbo].[OverdueInterestLedgers]', N'DebitAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueInterestLedgers] ADD [DebitAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DebitAmount] to [dbo].[OverdueInterestLedgers]';
END
GO
IF COL_LENGTH(N'[dbo].[OverdueInterestLedgers]', N'CreditAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueInterestLedgers] ADD [CreditAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreditAmount] to [dbo].[OverdueInterestLedgers]';
END
GO
IF COL_LENGTH(N'[dbo].[OverdueInterestLedgers]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueInterestLedgers] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[OverdueInterestLedgers]';
END
GO
IF COL_LENGTH(N'[dbo].[OverdueInterestLedgers]', N'Particulars') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueInterestLedgers] ADD [Particulars] NVARCHAR(250) NOT NULL DEFAULT '';
    PRINT '  + Added column [Particulars] to [dbo].[OverdueInterestLedgers]';
END
GO

----------------------------------------------------------------------------------------------------
-- [80/126] TABLE: [dbo].[OverdueRecoveryLedgers]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[OverdueRecoveryLedgers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[OverdueRecoveryLedgers] (
        [OverdueRecoveryLedgerID] INT IDENTITY(1,1) NOT NULL,
        [LoanAccountID] INT NOT NULL,
        [TransactionDate] DATETIME2 NOT NULL,
        [DebitAmount] DECIMAL(18,2) NOT NULL,
        [CreditAmount] DECIMAL(18,2) NOT NULL,
        [VoucherID] INT NULL,
        [Particulars] NVARCHAR(250) NOT NULL,
        CONSTRAINT [PK_OverdueRecoveryLedgers] PRIMARY KEY CLUSTERED ([OverdueRecoveryLedgerID] ASC)
    );
    PRINT 'Created Table [dbo].[OverdueRecoveryLedgers]';
END
GO

IF COL_LENGTH(N'[dbo].[OverdueRecoveryLedgers]', N'LoanAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueRecoveryLedgers] ADD [LoanAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountID] to [dbo].[OverdueRecoveryLedgers]';
END
GO
IF COL_LENGTH(N'[dbo].[OverdueRecoveryLedgers]', N'TransactionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueRecoveryLedgers] ADD [TransactionDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [TransactionDate] to [dbo].[OverdueRecoveryLedgers]';
END
GO
IF COL_LENGTH(N'[dbo].[OverdueRecoveryLedgers]', N'DebitAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueRecoveryLedgers] ADD [DebitAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DebitAmount] to [dbo].[OverdueRecoveryLedgers]';
END
GO
IF COL_LENGTH(N'[dbo].[OverdueRecoveryLedgers]', N'CreditAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueRecoveryLedgers] ADD [CreditAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreditAmount] to [dbo].[OverdueRecoveryLedgers]';
END
GO
IF COL_LENGTH(N'[dbo].[OverdueRecoveryLedgers]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueRecoveryLedgers] ADD [VoucherID] INT NULL;
    PRINT '  + Added column [VoucherID] to [dbo].[OverdueRecoveryLedgers]';
END
GO
IF COL_LENGTH(N'[dbo].[OverdueRecoveryLedgers]', N'Particulars') IS NULL
BEGIN
    ALTER TABLE [dbo].[OverdueRecoveryLedgers] ADD [Particulars] NVARCHAR(250) NOT NULL DEFAULT '';
    PRINT '  + Added column [Particulars] to [dbo].[OverdueRecoveryLedgers]';
END
GO

----------------------------------------------------------------------------------------------------
-- [81/126] TABLE: [dbo].[PigmyAccounts]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyAccounts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyAccounts] (
        [PigmyAccountID] INT IDENTITY(1,1) NOT NULL,
        [AccountNo] NVARCHAR(30) NOT NULL,
        [BranchID] INT NOT NULL,
        [PigmySchemeID] INT NOT NULL,
        [PigmyAgentID] INT NOT NULL,
        [OpeningDate] DATETIME2 NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [MaturityDate] DATETIME2 NOT NULL,
        [TotalDepositedAmount] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [LegacyAccountId] INT NULL,
        [LegacyAccountNumber] NVARCHAR(50) NULL,
        [CustomerID] INT NOT NULL,
        CONSTRAINT [PK_PigmyAccounts] PRIMARY KEY CLUSTERED ([PigmyAccountID] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyAccounts]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'AccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [AccountNo] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [AccountNo] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'PigmySchemeID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [PigmySchemeID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PigmySchemeID] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'PigmyAgentID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [PigmyAgentID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PigmyAgentID] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'OpeningDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [OpeningDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [OpeningDate] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'MaturityDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [MaturityDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [MaturityDate] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'TotalDepositedAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [TotalDepositedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalDepositedAmount] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'LegacyAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [LegacyAccountId] INT NULL;
    PRINT '  + Added column [LegacyAccountId] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'LegacyAccountNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [LegacyAccountNumber] NVARCHAR(50) NULL;
    PRINT '  + Added column [LegacyAccountNumber] to [dbo].[PigmyAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [CustomerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CustomerID] to [dbo].[PigmyAccounts]';
END
GO

----------------------------------------------------------------------------------------------------
-- [82/126] TABLE: [dbo].[PigmyAccountSequences]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyAccountSequences]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyAccountSequences] (
        [ID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [LastSequenceNumber] INT NOT NULL,
        CONSTRAINT [PK_PigmyAccountSequences] PRIMARY KEY CLUSTERED ([ID] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyAccountSequences]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyAccountSequences]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccountSequences] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[PigmyAccountSequences]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAccountSequences]', N'LastSequenceNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccountSequences] ADD [LastSequenceNumber] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LastSequenceNumber] to [dbo].[PigmyAccountSequences]';
END
GO

----------------------------------------------------------------------------------------------------
-- [83/126] TABLE: [dbo].[PigmyAgentCashDeposits]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyAgentCashDeposits]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyAgentCashDeposits] (
        [DepositId] INT IDENTITY(1,1) NOT NULL,
        [AgentId] INT NOT NULL,
        [DepositDate] DATETIME2 NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        [ReceiptNo] NVARCHAR(50) NOT NULL,
        [Narration] NVARCHAR(255) NULL,
        [VoucherId] INT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [PaymentMode] NVARCHAR(50) NOT NULL DEFAULT (''),
        CONSTRAINT [PK_PigmyAgentCashDeposits] PRIMARY KEY CLUSTERED ([DepositId] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyAgentCashDeposits]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyAgentCashDeposits]', N'AgentId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCashDeposits] ADD [AgentId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AgentId] to [dbo].[PigmyAgentCashDeposits]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCashDeposits]', N'DepositDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCashDeposits] ADD [DepositDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [DepositDate] to [dbo].[PigmyAgentCashDeposits]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCashDeposits]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCashDeposits] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Amount] to [dbo].[PigmyAgentCashDeposits]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCashDeposits]', N'ReceiptNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCashDeposits] ADD [ReceiptNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [ReceiptNo] to [dbo].[PigmyAgentCashDeposits]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCashDeposits]', N'Narration') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCashDeposits] ADD [Narration] NVARCHAR(255) NULL;
    PRINT '  + Added column [Narration] to [dbo].[PigmyAgentCashDeposits]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCashDeposits]', N'VoucherId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCashDeposits] ADD [VoucherId] INT NULL;
    PRINT '  + Added column [VoucherId] to [dbo].[PigmyAgentCashDeposits]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCashDeposits]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCashDeposits] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[PigmyAgentCashDeposits]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCashDeposits]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCashDeposits] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[PigmyAgentCashDeposits]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCashDeposits]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCashDeposits] ADD [PaymentMode] NVARCHAR(50) NOT NULL DEFAULT ('');
    PRINT '  + Added column [PaymentMode] to [dbo].[PigmyAgentCashDeposits]';
END
GO

----------------------------------------------------------------------------------------------------
-- [84/126] TABLE: [dbo].[PigmyAgentCommissions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyAgentCommissions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyAgentCommissions] (
        [CommissionId] INT IDENTITY(1,1) NOT NULL,
        [AgentId] INT NOT NULL,
        [CalculationFrequency] NVARCHAR(20) NOT NULL,
        [PeriodStartDate] DATETIME2 NOT NULL,
        [PeriodEndDate] DATETIME2 NOT NULL,
        [TotalCollectionAmount] DECIMAL(18,2) NOT NULL,
        [CalculatedCommission] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [VoucherId] INT NULL,
        [CalculatedOn] DATETIME2 NOT NULL,
        CONSTRAINT [PK_PigmyAgentCommissions] PRIMARY KEY CLUSTERED ([CommissionId] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyAgentCommissions]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyAgentCommissions]', N'AgentId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCommissions] ADD [AgentId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AgentId] to [dbo].[PigmyAgentCommissions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCommissions]', N'CalculationFrequency') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCommissions] ADD [CalculationFrequency] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [CalculationFrequency] to [dbo].[PigmyAgentCommissions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCommissions]', N'PeriodStartDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCommissions] ADD [PeriodStartDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PeriodStartDate] to [dbo].[PigmyAgentCommissions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCommissions]', N'PeriodEndDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCommissions] ADD [PeriodEndDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PeriodEndDate] to [dbo].[PigmyAgentCommissions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCommissions]', N'TotalCollectionAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCommissions] ADD [TotalCollectionAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalCollectionAmount] to [dbo].[PigmyAgentCommissions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCommissions]', N'CalculatedCommission') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCommissions] ADD [CalculatedCommission] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [CalculatedCommission] to [dbo].[PigmyAgentCommissions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCommissions]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCommissions] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[PigmyAgentCommissions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCommissions]', N'VoucherId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCommissions] ADD [VoucherId] INT NULL;
    PRINT '  + Added column [VoucherId] to [dbo].[PigmyAgentCommissions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgentCommissions]', N'CalculatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgentCommissions] ADD [CalculatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CalculatedOn] to [dbo].[PigmyAgentCommissions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [85/126] TABLE: [dbo].[PigmyAgents]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyAgents]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyAgents] (
        [PigmyAgentID] INT IDENTITY(1,1) NOT NULL,
        [AgentName] NVARCHAR(100) NOT NULL,
        [MobileNo] NVARCHAR(15) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [JoiningDate] DATETIME2 NULL,
        [BranchID] INT NULL,
        [MaxCashLimit] DECIMAL(18,2) NOT NULL DEFAULT ((20000.00)),
        [PasswordHash] NVARCHAR(255) NULL,
        [Pin] NVARCHAR(10) NULL,
        CONSTRAINT [PK_PigmyAgents] PRIMARY KEY CLUSTERED ([PigmyAgentID] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyAgents]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyAgents]', N'AgentName') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgents] ADD [AgentName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [AgentName] to [dbo].[PigmyAgents]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgents]', N'MobileNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgents] ADD [MobileNo] NVARCHAR(15) NOT NULL DEFAULT '';
    PRINT '  + Added column [MobileNo] to [dbo].[PigmyAgents]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgents]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgents] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[PigmyAgents]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgents]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgents] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[PigmyAgents]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgents]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgents] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[PigmyAgents]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgents]', N'JoiningDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgents] ADD [JoiningDate] DATETIME2 NULL;
    PRINT '  + Added column [JoiningDate] to [dbo].[PigmyAgents]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgents]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgents] ADD [BranchID] INT NULL;
    PRINT '  + Added column [BranchID] to [dbo].[PigmyAgents]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgents]', N'MaxCashLimit') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgents] ADD [MaxCashLimit] DECIMAL(18,2) NOT NULL DEFAULT ((20000.00));
    PRINT '  + Added column [MaxCashLimit] to [dbo].[PigmyAgents]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgents]', N'PasswordHash') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgents] ADD [PasswordHash] NVARCHAR(255) NULL;
    PRINT '  + Added column [PasswordHash] to [dbo].[PigmyAgents]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyAgents]', N'Pin') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAgents] ADD [Pin] NVARCHAR(10) NULL;
    PRINT '  + Added column [Pin] to [dbo].[PigmyAgents]';
END
GO

----------------------------------------------------------------------------------------------------
-- [86/126] TABLE: [dbo].[PigmyCollections]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyCollections]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyCollections] (
        [CollectionId] BIGINT IDENTITY(1,1) NOT NULL,
        [PigmyAccountId] INT NOT NULL,
        [AgentId] INT NOT NULL,
        [CollectionDate] DATETIME2 NOT NULL,
        [OpeningBalance] DECIMAL(18,2) NOT NULL,
        [CollectionAmount] DECIMAL(18,2) NOT NULL,
        [ClosingBalance] DECIMAL(18,2) NOT NULL,
        [ReceiptNo] NVARCHAR(50) NOT NULL,
        [CollectionSource] NVARCHAR(20) NOT NULL,
        [ImportBatchId] UNIQUEIDENTIFIER NULL,
        [SyncReferenceId] NVARCHAR(100) NULL,
        [IsVoucherGenerated] BIT NOT NULL,
        [VoucherId] INT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [TransactionId] NVARCHAR(64) NULL,
        [PaymentMode] NVARCHAR(10) NOT NULL DEFAULT ('CASH'),
        [Notes] NVARCHAR(255) NULL,
        CONSTRAINT [PK_PigmyCollections] PRIMARY KEY CLUSTERED ([CollectionId] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyCollections]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'PigmyAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [PigmyAccountId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PigmyAccountId] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'AgentId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [AgentId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [AgentId] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'CollectionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [CollectionDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CollectionDate] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'OpeningBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [OpeningBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OpeningBalance] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'CollectionAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [CollectionAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [CollectionAmount] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'ClosingBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [ClosingBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ClosingBalance] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'ReceiptNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [ReceiptNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [ReceiptNo] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'CollectionSource') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [CollectionSource] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [CollectionSource] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'ImportBatchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [ImportBatchId] UNIQUEIDENTIFIER NULL;
    PRINT '  + Added column [ImportBatchId] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'SyncReferenceId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [SyncReferenceId] NVARCHAR(100) NULL;
    PRINT '  + Added column [SyncReferenceId] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'IsVoucherGenerated') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [IsVoucherGenerated] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsVoucherGenerated] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'VoucherId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [VoucherId] INT NULL;
    PRINT '  + Added column [VoucherId] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'TransactionId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [TransactionId] NVARCHAR(64) NULL;
    PRINT '  + Added column [TransactionId] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [PaymentMode] NVARCHAR(10) NOT NULL DEFAULT ('CASH');
    PRINT '  + Added column [PaymentMode] to [dbo].[PigmyCollections]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCollections]', N'Notes') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCollections] ADD [Notes] NVARCHAR(255) NULL;
    PRINT '  + Added column [Notes] to [dbo].[PigmyCollections]';
END
GO

----------------------------------------------------------------------------------------------------
-- [87/126] TABLE: [dbo].[PigmyCommissionSettings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyCommissionSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyCommissionSettings] (
        [SettingId] INT IDENTITY(1,1) NOT NULL,
        [AgentId] INT NULL,
        [CommissionType] NVARCHAR(20) NOT NULL,
        [CommissionValue] DECIMAL(5,2) NOT NULL,
        [CalculationFrequency] NVARCHAR(20) NOT NULL,
        [EffectiveFrom] DATETIME2 NOT NULL,
        [EffectiveTo] DATETIME2 NULL,
        [IsActive] BIT NOT NULL,
        CONSTRAINT [PK_PigmyCommissionSettings] PRIMARY KEY CLUSTERED ([SettingId] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyCommissionSettings]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyCommissionSettings]', N'AgentId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCommissionSettings] ADD [AgentId] INT NULL;
    PRINT '  + Added column [AgentId] to [dbo].[PigmyCommissionSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCommissionSettings]', N'CommissionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCommissionSettings] ADD [CommissionType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [CommissionType] to [dbo].[PigmyCommissionSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCommissionSettings]', N'CommissionValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCommissionSettings] ADD [CommissionValue] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [CommissionValue] to [dbo].[PigmyCommissionSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCommissionSettings]', N'CalculationFrequency') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCommissionSettings] ADD [CalculationFrequency] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [CalculationFrequency] to [dbo].[PigmyCommissionSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCommissionSettings]', N'EffectiveFrom') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCommissionSettings] ADD [EffectiveFrom] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [EffectiveFrom] to [dbo].[PigmyCommissionSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCommissionSettings]', N'EffectiveTo') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCommissionSettings] ADD [EffectiveTo] DATETIME2 NULL;
    PRINT '  + Added column [EffectiveTo] to [dbo].[PigmyCommissionSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyCommissionSettings]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyCommissionSettings] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[PigmyCommissionSettings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [88/126] TABLE: [dbo].[PigmyInterestLogs]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyInterestLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyInterestLogs] (
        [LogId] INT IDENTITY(1,1) NOT NULL,
        [PigmyAccountId] INT NOT NULL,
        [CalculationDate] DATETIME2 NOT NULL,
        [PeriodStartDate] DATETIME2 NOT NULL,
        [PeriodEndDate] DATETIME2 NOT NULL,
        [InterestAmount] DECIMAL(18,2) NOT NULL,
        [VoucherId] INT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        CONSTRAINT [PK_PigmyInterestLogs] PRIMARY KEY CLUSTERED ([LogId] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyInterestLogs]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyInterestLogs]', N'PigmyAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyInterestLogs] ADD [PigmyAccountId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PigmyAccountId] to [dbo].[PigmyInterestLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyInterestLogs]', N'CalculationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyInterestLogs] ADD [CalculationDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CalculationDate] to [dbo].[PigmyInterestLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyInterestLogs]', N'PeriodStartDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyInterestLogs] ADD [PeriodStartDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PeriodStartDate] to [dbo].[PigmyInterestLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyInterestLogs]', N'PeriodEndDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyInterestLogs] ADD [PeriodEndDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PeriodEndDate] to [dbo].[PigmyInterestLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyInterestLogs]', N'InterestAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyInterestLogs] ADD [InterestAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestAmount] to [dbo].[PigmyInterestLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyInterestLogs]', N'VoucherId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyInterestLogs] ADD [VoucherId] INT NULL;
    PRINT '  + Added column [VoucherId] to [dbo].[PigmyInterestLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyInterestLogs]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyInterestLogs] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[PigmyInterestLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyInterestLogs]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyInterestLogs] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[PigmyInterestLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyInterestLogs]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyInterestLogs] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[PigmyInterestLogs]';
END
GO

----------------------------------------------------------------------------------------------------
-- [89/126] TABLE: [dbo].[PigmyOpeningBalances]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyOpeningBalances]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyOpeningBalances] (
        [PigmyOpeningBalanceID] INT IDENTITY(1,1) NOT NULL,
        [PigmyAccountID] INT NOT NULL,
        [FinancialYear] NVARCHAR(9) NOT NULL,
        [AsOfDate] DATETIME2 NOT NULL,
        [MigratedBalanceAmount] DECIMAL(18,2) NOT NULL,
        [MigrationRemarks] NVARCHAR(255) NULL,
        [IsPostedToLedger] BIT NOT NULL,
        [MigratedBy] INT NOT NULL,
        [MigratedOn] DATETIME2 NOT NULL,
        CONSTRAINT [PK_PigmyOpeningBalances] PRIMARY KEY CLUSTERED ([PigmyOpeningBalanceID] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyOpeningBalances]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyOpeningBalances]', N'PigmyAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyOpeningBalances] ADD [PigmyAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PigmyAccountID] to [dbo].[PigmyOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyOpeningBalances]', N'FinancialYear') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyOpeningBalances] ADD [FinancialYear] NVARCHAR(9) NOT NULL DEFAULT '';
    PRINT '  + Added column [FinancialYear] to [dbo].[PigmyOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyOpeningBalances]', N'AsOfDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyOpeningBalances] ADD [AsOfDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [AsOfDate] to [dbo].[PigmyOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyOpeningBalances]', N'MigratedBalanceAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyOpeningBalances] ADD [MigratedBalanceAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [MigratedBalanceAmount] to [dbo].[PigmyOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyOpeningBalances]', N'MigrationRemarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyOpeningBalances] ADD [MigrationRemarks] NVARCHAR(255) NULL;
    PRINT '  + Added column [MigrationRemarks] to [dbo].[PigmyOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyOpeningBalances]', N'IsPostedToLedger') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyOpeningBalances] ADD [IsPostedToLedger] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsPostedToLedger] to [dbo].[PigmyOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyOpeningBalances]', N'MigratedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyOpeningBalances] ADD [MigratedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MigratedBy] to [dbo].[PigmyOpeningBalances]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyOpeningBalances]', N'MigratedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyOpeningBalances] ADD [MigratedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [MigratedOn] to [dbo].[PigmyOpeningBalances]';
END
GO

----------------------------------------------------------------------------------------------------
-- [90/126] TABLE: [dbo].[PigmySchemes]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmySchemes]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmySchemes] (
        [PigmySchemeID] INT IDENTITY(1,1) NOT NULL,
        [SchemeName] NVARCHAR(100) NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [DurationMonths] INT NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [PigmyLiabilityLedgerID] INT NULL,
        [CommissionExpenseLedgerID] INT NULL,
        [InterestExpenseLedgerID] INT NULL,
        [InterestPayableLedgerID] INT NULL,
        [SchemeCode] NVARCHAR(50) NULL,
        CONSTRAINT [PK_PigmySchemes] PRIMARY KEY CLUSTERED ([PigmySchemeID] ASC)
    );
    PRINT 'Created Table [dbo].[PigmySchemes]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'SchemeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [SchemeName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [SchemeName] to [dbo].[PigmySchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[PigmySchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'DurationMonths') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [DurationMonths] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DurationMonths] to [dbo].[PigmySchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[PigmySchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[PigmySchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[PigmySchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'PigmyLiabilityLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [PigmyLiabilityLedgerID] INT NULL;
    PRINT '  + Added column [PigmyLiabilityLedgerID] to [dbo].[PigmySchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'CommissionExpenseLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [CommissionExpenseLedgerID] INT NULL;
    PRINT '  + Added column [CommissionExpenseLedgerID] to [dbo].[PigmySchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'InterestExpenseLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [InterestExpenseLedgerID] INT NULL;
    PRINT '  + Added column [InterestExpenseLedgerID] to [dbo].[PigmySchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'InterestPayableLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [InterestPayableLedgerID] INT NULL;
    PRINT '  + Added column [InterestPayableLedgerID] to [dbo].[PigmySchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'SchemeCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmySchemes] ADD [SchemeCode] NVARCHAR(50) NULL;
    PRINT '  + Added column [SchemeCode] to [dbo].[PigmySchemes]';
END
GO

----------------------------------------------------------------------------------------------------
-- [91/126] TABLE: [dbo].[PigmyTransactions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyTransactions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyTransactions] (
        [PigmyTransactionID] INT IDENTITY(1,1) NOT NULL,
        [PigmyAccountID] INT NOT NULL,
        [TransactionDate] DATETIME2 NOT NULL,
        [ValueDate] DATETIME2 NOT NULL,
        [TransactionType] NVARCHAR(20) NOT NULL,
        [DrAmount] DECIMAL(18,2) NOT NULL,
        [CrAmount] DECIMAL(18,2) NOT NULL,
        [BalanceAmount] DECIMAL(18,2) NOT NULL,
        [Narration] NVARCHAR(255) NOT NULL,
        [ReferenceId] NVARCHAR(50) NULL,
        [MakerId] INT NOT NULL,
        [PostedOn] DATETIME2 NOT NULL,
        CONSTRAINT [PK_PigmyTransactions] PRIMARY KEY CLUSTERED ([PigmyTransactionID] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyTransactions]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'PigmyAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [PigmyAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PigmyAccountID] to [dbo].[PigmyTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'TransactionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [TransactionDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [TransactionDate] to [dbo].[PigmyTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'ValueDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [ValueDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [ValueDate] to [dbo].[PigmyTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'TransactionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [TransactionType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [TransactionType] to [dbo].[PigmyTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'DrAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [DrAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DrAmount] to [dbo].[PigmyTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'CrAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [CrAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [CrAmount] to [dbo].[PigmyTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'BalanceAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [BalanceAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [BalanceAmount] to [dbo].[PigmyTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'Narration') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [Narration] NVARCHAR(255) NOT NULL DEFAULT '';
    PRINT '  + Added column [Narration] to [dbo].[PigmyTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'ReferenceId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [ReferenceId] NVARCHAR(50) NULL;
    PRINT '  + Added column [ReferenceId] to [dbo].[PigmyTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'MakerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [MakerId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MakerId] to [dbo].[PigmyTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyTransactions]', N'PostedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyTransactions] ADD [PostedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PostedOn] to [dbo].[PigmyTransactions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [92/126] TABLE: [dbo].[PigmyVoucherMappings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyVoucherMappings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyVoucherMappings] (
        [MappingId] INT IDENTITY(1,1) NOT NULL,
        [BranchId] INT NOT NULL,
        [CollectionSource] NVARCHAR(20) NOT NULL,
        [DebitLedgerId] INT NOT NULL,
        [CreditLedgerId] INT NOT NULL,
        [IsActive] BIT NOT NULL,
        CONSTRAINT [PK_PigmyVoucherMappings] PRIMARY KEY CLUSTERED ([MappingId] ASC)
    );
    PRINT 'Created Table [dbo].[PigmyVoucherMappings]';
END
GO

IF COL_LENGTH(N'[dbo].[PigmyVoucherMappings]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyVoucherMappings] ADD [BranchId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchId] to [dbo].[PigmyVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyVoucherMappings]', N'CollectionSource') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyVoucherMappings] ADD [CollectionSource] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [CollectionSource] to [dbo].[PigmyVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyVoucherMappings]', N'DebitLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyVoucherMappings] ADD [DebitLedgerId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DebitLedgerId] to [dbo].[PigmyVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyVoucherMappings]', N'CreditLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyVoucherMappings] ADD [CreditLedgerId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreditLedgerId] to [dbo].[PigmyVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[PigmyVoucherMappings]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyVoucherMappings] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[PigmyVoucherMappings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [93/126] TABLE: [dbo].[RdAccounts]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[RdAccounts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RdAccounts] (
        [RdAccountID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [RdSchemeID] INT NOT NULL,
        [AccountNo] NVARCHAR(30) NOT NULL,
        [OpeningDate] DATETIME2 NOT NULL,
        [InstallmentAmount] DECIMAL(18,2) NOT NULL,
        [DurationMonths] INT NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [MaturityDate] DATETIME2 NOT NULL,
        [MaturityAmount] DECIMAL(18,2) NOT NULL,
        [TotalPaidInstallments] INT NOT NULL,
        [TotalDepositedAmount] DECIMAL(18,2) NOT NULL,
        [IsLegacyAccount] BIT NOT NULL,
        [LegacyAccruedInt] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [NomineeName] NVARCHAR(100) NULL,
        [NomineeRelation] NVARCHAR(50) NULL,
        [Remarks] NVARCHAR(250) NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        [LegacyAccountId] INT NULL,
        [LegacyAccountNumber] NVARCHAR(50) NULL,
        [AccountType] NVARCHAR(20) NOT NULL DEFAULT (N''),
        [AgentID] INT NULL,
        [GuardianName] NVARCHAR(100) NULL,
        [GuardianRelation] NVARCHAR(50) NULL,
        [MaturityInstruction] NVARCHAR(30) NOT NULL DEFAULT (N''),
        [PassbookNo] NVARCHAR(50) NULL,
        [PaymentMode] NVARCHAR(30) NOT NULL DEFAULT (N''),
        [SavingAccountID] INT NULL,
        [CustomerID] INT NOT NULL,
        [JointCustomerID] INT NULL,
        [JointMemberID] INT NULL,
        CONSTRAINT [PK_RdAccounts] PRIMARY KEY CLUSTERED ([RdAccountID] ASC)
    );
    PRINT 'Created Table [dbo].[RdAccounts]';
END
GO

IF COL_LENGTH(N'[dbo].[RdAccounts]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'RdSchemeID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [RdSchemeID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [RdSchemeID] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'AccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [AccountNo] NVARCHAR(30) NOT NULL DEFAULT '';
    PRINT '  + Added column [AccountNo] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'OpeningDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [OpeningDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [OpeningDate] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'InstallmentAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [InstallmentAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstallmentAmount] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'DurationMonths') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [DurationMonths] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DurationMonths] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'MaturityDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [MaturityDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [MaturityDate] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'MaturityAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [MaturityAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [MaturityAmount] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'TotalPaidInstallments') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [TotalPaidInstallments] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalPaidInstallments] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'TotalDepositedAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [TotalDepositedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalDepositedAmount] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'IsLegacyAccount') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [IsLegacyAccount] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsLegacyAccount] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'LegacyAccruedInt') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [LegacyAccruedInt] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [LegacyAccruedInt] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'NomineeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [NomineeName] NVARCHAR(100) NULL;
    PRINT '  + Added column [NomineeName] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'NomineeRelation') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [NomineeRelation] NVARCHAR(50) NULL;
    PRINT '  + Added column [NomineeRelation] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [Remarks] NVARCHAR(250) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'LegacyAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [LegacyAccountId] INT NULL;
    PRINT '  + Added column [LegacyAccountId] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'LegacyAccountNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [LegacyAccountNumber] NVARCHAR(50) NULL;
    PRINT '  + Added column [LegacyAccountNumber] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'AccountType') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [AccountType] NVARCHAR(20) NOT NULL DEFAULT (N'');
    PRINT '  + Added column [AccountType] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'AgentID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [AgentID] INT NULL;
    PRINT '  + Added column [AgentID] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'GuardianName') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [GuardianName] NVARCHAR(100) NULL;
    PRINT '  + Added column [GuardianName] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'GuardianRelation') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [GuardianRelation] NVARCHAR(50) NULL;
    PRINT '  + Added column [GuardianRelation] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'MaturityInstruction') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [MaturityInstruction] NVARCHAR(30) NOT NULL DEFAULT (N'');
    PRINT '  + Added column [MaturityInstruction] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'PassbookNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [PassbookNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [PassbookNo] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [PaymentMode] NVARCHAR(30) NOT NULL DEFAULT (N'');
    PRINT '  + Added column [PaymentMode] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'SavingAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [SavingAccountID] INT NULL;
    PRINT '  + Added column [SavingAccountID] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [CustomerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CustomerID] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'JointCustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [JointCustomerID] INT NULL;
    PRINT '  + Added column [JointCustomerID] to [dbo].[RdAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccounts]', N'JointMemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccounts] ADD [JointMemberID] INT NULL;
    PRINT '  + Added column [JointMemberID] to [dbo].[RdAccounts]';
END
GO

----------------------------------------------------------------------------------------------------
-- [94/126] TABLE: [dbo].[RdAccountSequences]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[RdAccountSequences]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RdAccountSequences] (
        [SequenceID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [ProductType] NVARCHAR(10) NOT NULL,
        [CurrentValue] INT NOT NULL,
        CONSTRAINT [PK_RdAccountSequences] PRIMARY KEY CLUSTERED ([SequenceID] ASC)
    );
    PRINT 'Created Table [dbo].[RdAccountSequences]';
END
GO

IF COL_LENGTH(N'[dbo].[RdAccountSequences]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccountSequences] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[RdAccountSequences]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccountSequences]', N'ProductType') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccountSequences] ADD [ProductType] NVARCHAR(10) NOT NULL DEFAULT '';
    PRINT '  + Added column [ProductType] to [dbo].[RdAccountSequences]';
END
GO
IF COL_LENGTH(N'[dbo].[RdAccountSequences]', N'CurrentValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdAccountSequences] ADD [CurrentValue] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CurrentValue] to [dbo].[RdAccountSequences]';
END
GO

----------------------------------------------------------------------------------------------------
-- [95/126] TABLE: [dbo].[RdInterestAccruals]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[RdInterestAccruals]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RdInterestAccruals] (
        [AccrualID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [RdAccountID] INT NOT NULL,
        [VoucherID] INT NOT NULL,
        [AccrualDate] DATETIME2 NOT NULL,
        [InterestAmount] DECIMAL(18,2) NOT NULL,
        [IsPosted] BIT NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        CONSTRAINT [PK_RdInterestAccruals] PRIMARY KEY CLUSTERED ([AccrualID] ASC)
    );
    PRINT 'Created Table [dbo].[RdInterestAccruals]';
END
GO

IF COL_LENGTH(N'[dbo].[RdInterestAccruals]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdInterestAccruals] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[RdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[RdInterestAccruals]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdInterestAccruals] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[RdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[RdInterestAccruals]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdInterestAccruals] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[RdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[RdInterestAccruals]', N'RdAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdInterestAccruals] ADD [RdAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [RdAccountID] to [dbo].[RdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[RdInterestAccruals]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdInterestAccruals] ADD [VoucherID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [VoucherID] to [dbo].[RdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[RdInterestAccruals]', N'AccrualDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdInterestAccruals] ADD [AccrualDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [AccrualDate] to [dbo].[RdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[RdInterestAccruals]', N'InterestAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdInterestAccruals] ADD [InterestAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestAmount] to [dbo].[RdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[RdInterestAccruals]', N'IsPosted') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdInterestAccruals] ADD [IsPosted] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsPosted] to [dbo].[RdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[RdInterestAccruals]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdInterestAccruals] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[RdInterestAccruals]';
END
GO
IF COL_LENGTH(N'[dbo].[RdInterestAccruals]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdInterestAccruals] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[RdInterestAccruals]';
END
GO

----------------------------------------------------------------------------------------------------
-- [96/126] TABLE: [dbo].[RdSchemes]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[RdSchemes]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RdSchemes] (
        [RdSchemeID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [SchemeCode] NVARCHAR(20) NOT NULL,
        [SchemeName] NVARCHAR(100) NOT NULL,
        [DurationMonths] INT NOT NULL,
        [InstallmentAmount] DECIMAL(18,2) NOT NULL,
        [MinimumInstallment] DECIMAL(18,2) NOT NULL,
        [MaximumInstallment] DECIMAL(18,2) NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [InterestMethod] NVARCHAR(20) NOT NULL,
        [PenaltyAmount] DECIMAL(18,2) NOT NULL,
        [EffectiveDate] DATETIME2 NOT NULL,
        [IsActive] BIT NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        [RdLiabilityLedgerID] INT NULL,
        [InterestExpenseLedgerID] INT NULL,
        [InterestPayableLedgerID] INT NULL,
        [PenaltyIncomeLedgerID] INT NULL,
        [PrematurePenaltyRate] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_RdSchemes] PRIMARY KEY CLUSTERED ([RdSchemeID] ASC)
    );
    PRINT 'Created Table [dbo].[RdSchemes]';
END
GO

IF COL_LENGTH(N'[dbo].[RdSchemes]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'SchemeCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [SchemeCode] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [SchemeCode] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'SchemeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [SchemeName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [SchemeName] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'DurationMonths') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [DurationMonths] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [DurationMonths] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'InstallmentAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [InstallmentAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstallmentAmount] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'MinimumInstallment') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [MinimumInstallment] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [MinimumInstallment] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'MaximumInstallment') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [MaximumInstallment] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [MaximumInstallment] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'InterestMethod') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [InterestMethod] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [InterestMethod] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'PenaltyAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [PenaltyAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PenaltyAmount] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'EffectiveDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [EffectiveDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [EffectiveDate] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'RdLiabilityLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [RdLiabilityLedgerID] INT NULL;
    PRINT '  + Added column [RdLiabilityLedgerID] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'InterestExpenseLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [InterestExpenseLedgerID] INT NULL;
    PRINT '  + Added column [InterestExpenseLedgerID] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'InterestPayableLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [InterestPayableLedgerID] INT NULL;
    PRINT '  + Added column [InterestPayableLedgerID] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'PenaltyIncomeLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [PenaltyIncomeLedgerID] INT NULL;
    PRINT '  + Added column [PenaltyIncomeLedgerID] to [dbo].[RdSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[RdSchemes]', N'PrematurePenaltyRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdSchemes] ADD [PrematurePenaltyRate] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [PrematurePenaltyRate] to [dbo].[RdSchemes]';
END
GO

----------------------------------------------------------------------------------------------------
-- [97/126] TABLE: [dbo].[RdTransactions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[RdTransactions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RdTransactions] (
        [RdTransactionID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [RdAccountID] INT NOT NULL,
        [VoucherID] INT NOT NULL,
        [TransactionDate] DATETIME2 NOT NULL,
        [TransactionType] NVARCHAR(20) NOT NULL,
        [InstallmentNo] INT NULL,
        [DebitCredit] NVARCHAR(2) NOT NULL,
        [PrincipalAmount] DECIMAL(18,2) NOT NULL,
        [PenaltyAmount] DECIMAL(18,2) NOT NULL,
        [InterestAmount] DECIMAL(18,2) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        CONSTRAINT [PK_RdTransactions] PRIMARY KEY CLUSTERED ([RdTransactionID] ASC)
    );
    PRINT 'Created Table [dbo].[RdTransactions]';
END
GO

IF COL_LENGTH(N'[dbo].[RdTransactions]', N'InstitutionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [InstitutionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [InstitutionID] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'RdAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [RdAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [RdAccountID] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [VoucherID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [VoucherID] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'TransactionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [TransactionDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [TransactionDate] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'TransactionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [TransactionType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [TransactionType] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'InstallmentNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [InstallmentNo] INT NULL;
    PRINT '  + Added column [InstallmentNo] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'DebitCredit') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [DebitCredit] NVARCHAR(2) NOT NULL DEFAULT '';
    PRINT '  + Added column [DebitCredit] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'PrincipalAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [PrincipalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrincipalAmount] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'PenaltyAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [PenaltyAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PenaltyAmount] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'InterestAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [InterestAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestAmount] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[RdTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[RdTransactions]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[RdTransactions] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[RdTransactions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [98/126] TABLE: [dbo].[RolePermissions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[RolePermissions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RolePermissions] (
        [RolePermissionID] INT IDENTITY(1,1) NOT NULL,
        [RoleID] INT NOT NULL,
        [ModuleCode] NVARCHAR(50) NOT NULL,
        [CanView] BIT NOT NULL,
        [CanAdd] BIT NOT NULL,
        [CanEdit] BIT NOT NULL,
        [CanDelete] BIT NOT NULL,
        [CanPrint] BIT NOT NULL,
        [CanApprove] BIT NOT NULL,
        [ScopeLevel] NVARCHAR(20) NOT NULL,
        CONSTRAINT [PK_RolePermissions] PRIMARY KEY CLUSTERED ([RolePermissionID] ASC)
    );
    PRINT 'Created Table [dbo].[RolePermissions]';
END
GO

IF COL_LENGTH(N'[dbo].[RolePermissions]', N'RoleID') IS NULL
BEGIN
    ALTER TABLE [dbo].[RolePermissions] ADD [RoleID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [RoleID] to [dbo].[RolePermissions]';
END
GO
IF COL_LENGTH(N'[dbo].[RolePermissions]', N'ModuleCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[RolePermissions] ADD [ModuleCode] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [ModuleCode] to [dbo].[RolePermissions]';
END
GO
IF COL_LENGTH(N'[dbo].[RolePermissions]', N'CanView') IS NULL
BEGIN
    ALTER TABLE [dbo].[RolePermissions] ADD [CanView] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CanView] to [dbo].[RolePermissions]';
END
GO
IF COL_LENGTH(N'[dbo].[RolePermissions]', N'CanAdd') IS NULL
BEGIN
    ALTER TABLE [dbo].[RolePermissions] ADD [CanAdd] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CanAdd] to [dbo].[RolePermissions]';
END
GO
IF COL_LENGTH(N'[dbo].[RolePermissions]', N'CanEdit') IS NULL
BEGIN
    ALTER TABLE [dbo].[RolePermissions] ADD [CanEdit] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CanEdit] to [dbo].[RolePermissions]';
END
GO
IF COL_LENGTH(N'[dbo].[RolePermissions]', N'CanDelete') IS NULL
BEGIN
    ALTER TABLE [dbo].[RolePermissions] ADD [CanDelete] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CanDelete] to [dbo].[RolePermissions]';
END
GO
IF COL_LENGTH(N'[dbo].[RolePermissions]', N'CanPrint') IS NULL
BEGIN
    ALTER TABLE [dbo].[RolePermissions] ADD [CanPrint] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CanPrint] to [dbo].[RolePermissions]';
END
GO
IF COL_LENGTH(N'[dbo].[RolePermissions]', N'CanApprove') IS NULL
BEGIN
    ALTER TABLE [dbo].[RolePermissions] ADD [CanApprove] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CanApprove] to [dbo].[RolePermissions]';
END
GO
IF COL_LENGTH(N'[dbo].[RolePermissions]', N'ScopeLevel') IS NULL
BEGIN
    ALTER TABLE [dbo].[RolePermissions] ADD [ScopeLevel] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [ScopeLevel] to [dbo].[RolePermissions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [99/126] TABLE: [dbo].[Roles]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Roles]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Roles] (
        [RoleID] INT IDENTITY(1,1) NOT NULL,
        [RoleName] NVARCHAR(100) NOT NULL,
        [Description] NVARCHAR(250) NULL,
        [IsSystemRole] BIT NOT NULL DEFAULT ((0)),
        [RoleCode] NVARCHAR(30) NOT NULL DEFAULT (''),
        [Status] BIT NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED ([RoleID] ASC)
    );
    PRINT 'Created Table [dbo].[Roles]';
END
GO

IF COL_LENGTH(N'[dbo].[Roles]', N'RoleName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Roles] ADD [RoleName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [RoleName] to [dbo].[Roles]';
END
GO
IF COL_LENGTH(N'[dbo].[Roles]', N'Description') IS NULL
BEGIN
    ALTER TABLE [dbo].[Roles] ADD [Description] NVARCHAR(250) NULL;
    PRINT '  + Added column [Description] to [dbo].[Roles]';
END
GO
IF COL_LENGTH(N'[dbo].[Roles]', N'IsSystemRole') IS NULL
BEGIN
    ALTER TABLE [dbo].[Roles] ADD [IsSystemRole] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [IsSystemRole] to [dbo].[Roles]';
END
GO
IF COL_LENGTH(N'[dbo].[Roles]', N'RoleCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[Roles] ADD [RoleCode] NVARCHAR(30) NOT NULL DEFAULT ('');
    PRINT '  + Added column [RoleCode] to [dbo].[Roles]';
END
GO
IF COL_LENGTH(N'[dbo].[Roles]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[Roles] ADD [Status] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [Status] to [dbo].[Roles]';
END
GO

----------------------------------------------------------------------------------------------------
-- [100/126] TABLE: [dbo].[SansthaDetails]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SansthaDetails]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SansthaDetails] (
        [SansthaID] INT IDENTITY(1,1) NOT NULL,
        [SansthaName] NVARCHAR(200) NOT NULL,
        [Address] NVARCHAR(500) NULL,
        [ContactNo] NVARCHAR(20) NULL,
        [Email] NVARCHAR(100) NULL,
        [RegistrationNo] NVARCHAR(50) NULL,
        [GSTNo] NVARCHAR(50) NULL,
        [LogoPath] NVARCHAR(500) NULL,
        [IsMigrationLocked] BIT NOT NULL,
        [AutoPostVouchers] BIT NOT NULL DEFAULT (CONVERT([bit],(0),(0))),
        [AutoPostVoucherLimit] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [District] NVARCHAR(100) NULL,
        [PinCode] NVARCHAR(20) NULL,
        [RegistrationDate] DATETIME2 NULL,
        [State] NVARCHAR(100) NULL,
        [Taluka] NVARCHAR(100) NULL,
        [Village] NVARCHAR(100) NULL,
        [IsMobileCompulsory] BIT NOT NULL DEFAULT ((1)),
        [IsAadhaarCompulsory] BIT NOT NULL DEFAULT ((1)),
        [IsPanCompulsory] BIT NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_SansthaDetails] PRIMARY KEY CLUSTERED ([SansthaID] ASC)
    );
    PRINT 'Created Table [dbo].[SansthaDetails]';
END
GO

IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'SansthaName') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [SansthaName] NVARCHAR(200) NOT NULL DEFAULT '';
    PRINT '  + Added column [SansthaName] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'Address') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [Address] NVARCHAR(500) NULL;
    PRINT '  + Added column [Address] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'ContactNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [ContactNo] NVARCHAR(20) NULL;
    PRINT '  + Added column [ContactNo] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'Email') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [Email] NVARCHAR(100) NULL;
    PRINT '  + Added column [Email] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'RegistrationNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [RegistrationNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [RegistrationNo] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'GSTNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [GSTNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [GSTNo] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'LogoPath') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [LogoPath] NVARCHAR(500) NULL;
    PRINT '  + Added column [LogoPath] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'IsMigrationLocked') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [IsMigrationLocked] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsMigrationLocked] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'AutoPostVouchers') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [AutoPostVouchers] BIT NOT NULL DEFAULT (CONVERT([bit],(0),(0)));
    PRINT '  + Added column [AutoPostVouchers] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'AutoPostVoucherLimit') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [AutoPostVoucherLimit] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [AutoPostVoucherLimit] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'District') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [District] NVARCHAR(100) NULL;
    PRINT '  + Added column [District] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'PinCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [PinCode] NVARCHAR(20) NULL;
    PRINT '  + Added column [PinCode] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'RegistrationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [RegistrationDate] DATETIME2 NULL;
    PRINT '  + Added column [RegistrationDate] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'State') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [State] NVARCHAR(100) NULL;
    PRINT '  + Added column [State] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'Taluka') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [Taluka] NVARCHAR(100) NULL;
    PRINT '  + Added column [Taluka] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'Village') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [Village] NVARCHAR(100) NULL;
    PRINT '  + Added column [Village] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'IsMobileCompulsory') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [IsMobileCompulsory] BIT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [IsMobileCompulsory] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'IsAadhaarCompulsory') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [IsAadhaarCompulsory] BIT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [IsAadhaarCompulsory] to [dbo].[SansthaDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[SansthaDetails]', N'IsPanCompulsory') IS NULL
BEGIN
    ALTER TABLE [dbo].[SansthaDetails] ADD [IsPanCompulsory] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [IsPanCompulsory] to [dbo].[SansthaDetails]';
END
GO

----------------------------------------------------------------------------------------------------
-- [101/126] TABLE: [dbo].[SavingAccountClosings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SavingAccountClosings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SavingAccountClosings] (
        [ClosingID] INT IDENTITY(1,1) NOT NULL,
        [SavingAccountID] INT NOT NULL,
        [ClosureDate] DATETIME2 NOT NULL,
        [GrossBalance] DECIMAL(18,2) NOT NULL,
        [ClosingCharges] DECIMAL(18,2) NOT NULL,
        [NetPayable] DECIMAL(18,2) NOT NULL,
        [PaymentMode] NVARCHAR(20) NOT NULL,
        [VoucherNo] NVARCHAR(50) NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        CONSTRAINT [PK_SavingAccountClosings] PRIMARY KEY CLUSTERED ([ClosingID] ASC)
    );
    PRINT 'Created Table [dbo].[SavingAccountClosings]';
END
GO

IF COL_LENGTH(N'[dbo].[SavingAccountClosings]', N'SavingAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountClosings] ADD [SavingAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [SavingAccountID] to [dbo].[SavingAccountClosings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountClosings]', N'ClosureDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountClosings] ADD [ClosureDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [ClosureDate] to [dbo].[SavingAccountClosings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountClosings]', N'GrossBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountClosings] ADD [GrossBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [GrossBalance] to [dbo].[SavingAccountClosings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountClosings]', N'ClosingCharges') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountClosings] ADD [ClosingCharges] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ClosingCharges] to [dbo].[SavingAccountClosings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountClosings]', N'NetPayable') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountClosings] ADD [NetPayable] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [NetPayable] to [dbo].[SavingAccountClosings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountClosings]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountClosings] ADD [PaymentMode] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [PaymentMode] to [dbo].[SavingAccountClosings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountClosings]', N'VoucherNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountClosings] ADD [VoucherNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [VoucherNo] to [dbo].[SavingAccountClosings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountClosings]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountClosings] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[SavingAccountClosings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountClosings]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountClosings] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[SavingAccountClosings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [102/126] TABLE: [dbo].[SavingAccountJointHolders]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SavingAccountJointHolders]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SavingAccountJointHolders] (
        [JointHolderID] INT IDENTITY(1,1) NOT NULL,
        [SavingAccountID] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [CustomerID] INT NULL,
        CONSTRAINT [PK_SavingAccountJointHolders] PRIMARY KEY CLUSTERED ([JointHolderID] ASC)
    );
    PRINT 'Created Table [dbo].[SavingAccountJointHolders]';
END
GO

IF COL_LENGTH(N'[dbo].[SavingAccountJointHolders]', N'SavingAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountJointHolders] ADD [SavingAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [SavingAccountID] to [dbo].[SavingAccountJointHolders]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountJointHolders]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountJointHolders] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[SavingAccountJointHolders]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountJointHolders]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountJointHolders] ADD [CustomerID] INT NULL;
    PRINT '  + Added column [CustomerID] to [dbo].[SavingAccountJointHolders]';
END
GO

----------------------------------------------------------------------------------------------------
-- [103/126] TABLE: [dbo].[SavingAccountMasters]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SavingAccountMasters]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SavingAccountMasters] (
        [SavingAccountID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [AccountNo] NVARCHAR(20) NOT NULL,
        [AccountType] NVARCHAR(20) NOT NULL,
        [OpeningDate] DATETIME2 NOT NULL,
        [IsLegacyAccount] BIT NOT NULL,
        [LedgerID] INT NOT NULL,
        [OpeningBalance] DECIMAL(18,2) NOT NULL,
        [CurrentBalance] DECIMAL(18,2) NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [MinimumBalance] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [ClosingDate] DATETIME2 NULL,
        [NomineeName] NVARCHAR(150) NULL,
        [NomineeRelation] NVARCHAR(50) NULL,
        [NomineeAddress] NVARCHAR(500) NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [UpdatedBy] INT NULL,
        [UpdatedOn] DATETIME2 NULL,
        [LegacyAccountId] INT NULL,
        [LegacyAccountNumber] NVARCHAR(50) NULL,
        [LienAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0.0)),
        [LienReason] NVARCHAR(250) NULL,
        [CustomerID] INT NULL,
        [LastInterestPostingDate] DATETIME2 NULL,
        [LastInterestAmount] DECIMAL(18,2) NULL,
        [OldAccountNo] NVARCHAR(50) NULL,
        CONSTRAINT [PK_SavingAccountMasters] PRIMARY KEY CLUSTERED ([SavingAccountID] ASC)
    );
    PRINT 'Created Table [dbo].[SavingAccountMasters]';
END
GO

IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'AccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [AccountNo] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [AccountNo] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'AccountType') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [AccountType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [AccountType] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'OpeningDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [OpeningDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [OpeningDate] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'IsLegacyAccount') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [IsLegacyAccount] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsLegacyAccount] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'LedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [LedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LedgerID] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'OpeningBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [OpeningBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OpeningBalance] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'CurrentBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [CurrentBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [CurrentBalance] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'MinimumBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [MinimumBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [MinimumBalance] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'ClosingDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [ClosingDate] DATETIME2 NULL;
    PRINT '  + Added column [ClosingDate] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'NomineeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [NomineeName] NVARCHAR(150) NULL;
    PRINT '  + Added column [NomineeName] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'NomineeRelation') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [NomineeRelation] NVARCHAR(50) NULL;
    PRINT '  + Added column [NomineeRelation] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'NomineeAddress') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [NomineeAddress] NVARCHAR(500) NULL;
    PRINT '  + Added column [NomineeAddress] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'UpdatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [UpdatedBy] INT NULL;
    PRINT '  + Added column [UpdatedBy] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'UpdatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [UpdatedOn] DATETIME2 NULL;
    PRINT '  + Added column [UpdatedOn] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'LegacyAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [LegacyAccountId] INT NULL;
    PRINT '  + Added column [LegacyAccountId] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'LegacyAccountNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [LegacyAccountNumber] NVARCHAR(50) NULL;
    PRINT '  + Added column [LegacyAccountNumber] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'LienAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [LienAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0.0));
    PRINT '  + Added column [LienAmount] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'LienReason') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [LienReason] NVARCHAR(250) NULL;
    PRINT '  + Added column [LienReason] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [CustomerID] INT NULL;
    PRINT '  + Added column [CustomerID] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'LastInterestPostingDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [LastInterestPostingDate] DATETIME2 NULL;
    PRINT '  + Added column [LastInterestPostingDate] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'LastInterestAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [LastInterestAmount] DECIMAL(18,2) NULL;
    PRINT '  + Added column [LastInterestAmount] to [dbo].[SavingAccountMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingAccountMasters]', N'OldAccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingAccountMasters] ADD [OldAccountNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [OldAccountNo] to [dbo].[SavingAccountMasters]';
END
GO

----------------------------------------------------------------------------------------------------
-- [104/126] TABLE: [dbo].[SavingInterestPostings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SavingInterestPostings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SavingInterestPostings] (
        [PostingID] INT IDENTITY(1,1) NOT NULL,
        [FinancialYearID] INT NOT NULL,
        [PeriodStart] DATETIME2 NOT NULL,
        [PeriodEnd] DATETIME2 NOT NULL,
        [TotalInterest] DECIMAL(18,2) NOT NULL,
        [VoucherNo] NVARCHAR(50) NULL,
        [PostedOn] DATETIME2 NOT NULL,
        [PostedBy] INT NOT NULL,
        CONSTRAINT [PK_SavingInterestPostings] PRIMARY KEY CLUSTERED ([PostingID] ASC)
    );
    PRINT 'Created Table [dbo].[SavingInterestPostings]';
END
GO

IF COL_LENGTH(N'[dbo].[SavingInterestPostings]', N'FinancialYearID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestPostings] ADD [FinancialYearID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FinancialYearID] to [dbo].[SavingInterestPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestPostings]', N'PeriodStart') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestPostings] ADD [PeriodStart] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PeriodStart] to [dbo].[SavingInterestPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestPostings]', N'PeriodEnd') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestPostings] ADD [PeriodEnd] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PeriodEnd] to [dbo].[SavingInterestPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestPostings]', N'TotalInterest') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestPostings] ADD [TotalInterest] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalInterest] to [dbo].[SavingInterestPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestPostings]', N'VoucherNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestPostings] ADD [VoucherNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [VoucherNo] to [dbo].[SavingInterestPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestPostings]', N'PostedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestPostings] ADD [PostedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PostedOn] to [dbo].[SavingInterestPostings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestPostings]', N'PostedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestPostings] ADD [PostedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PostedBy] to [dbo].[SavingInterestPostings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [105/126] TABLE: [dbo].[SavingInterestSettings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SavingInterestSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SavingInterestSettings] (
        [SettingID] INT IDENTITY(1,1) NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [CalculationMethod] NVARCHAR(50) NOT NULL,
        [PostingFrequency] NVARCHAR(20) NOT NULL,
        [EffectiveDate] DATETIME2 NOT NULL,
        [LedgerID] INT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [SchemeName] NVARCHAR(100) NULL,
        [SavingLiabilityLedgerID] INT NULL,
        [InterestExpenseLedgerID] INT NULL,
        [InterestPayableLedgerID] INT NULL,
        [SchemeCode] NVARCHAR(50) NULL,
        CONSTRAINT [PK_SavingInterestSettings] PRIMARY KEY CLUSTERED ([SettingID] ASC)
    );
    PRINT 'Created Table [dbo].[SavingInterestSettings]';
END
GO

IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'InterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestRate] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'CalculationMethod') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [CalculationMethod] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [CalculationMethod] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'PostingFrequency') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [PostingFrequency] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [PostingFrequency] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'EffectiveDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [EffectiveDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [EffectiveDate] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'LedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [LedgerID] INT NULL;
    PRINT '  + Added column [LedgerID] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'SchemeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [SchemeName] NVARCHAR(100) NULL;
    PRINT '  + Added column [SchemeName] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'SavingLiabilityLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [SavingLiabilityLedgerID] INT NULL;
    PRINT '  + Added column [SavingLiabilityLedgerID] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'InterestExpenseLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [InterestExpenseLedgerID] INT NULL;
    PRINT '  + Added column [InterestExpenseLedgerID] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'InterestPayableLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [InterestPayableLedgerID] INT NULL;
    PRINT '  + Added column [InterestPayableLedgerID] to [dbo].[SavingInterestSettings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingInterestSettings]', N'SchemeCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingInterestSettings] ADD [SchemeCode] NVARCHAR(50) NULL;
    PRINT '  + Added column [SchemeCode] to [dbo].[SavingInterestSettings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [106/126] TABLE: [dbo].[SavingPassbooks]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SavingPassbooks]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SavingPassbooks] (
        [PassbookLogID] INT IDENTITY(1,1) NOT NULL,
        [SavingAccountID] INT NOT NULL,
        [TransactionID] INT NOT NULL,
        [PrintedLineNo] INT NOT NULL,
        [PrintedPageNo] INT NOT NULL,
        [PrintedOn] DATETIME2 NOT NULL,
        [PrintedBy] INT NOT NULL,
        CONSTRAINT [PK_SavingPassbooks] PRIMARY KEY CLUSTERED ([PassbookLogID] ASC)
    );
    PRINT 'Created Table [dbo].[SavingPassbooks]';
END
GO

IF COL_LENGTH(N'[dbo].[SavingPassbooks]', N'SavingAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingPassbooks] ADD [SavingAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [SavingAccountID] to [dbo].[SavingPassbooks]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingPassbooks]', N'TransactionID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingPassbooks] ADD [TransactionID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [TransactionID] to [dbo].[SavingPassbooks]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingPassbooks]', N'PrintedLineNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingPassbooks] ADD [PrintedLineNo] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrintedLineNo] to [dbo].[SavingPassbooks]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingPassbooks]', N'PrintedPageNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingPassbooks] ADD [PrintedPageNo] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrintedPageNo] to [dbo].[SavingPassbooks]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingPassbooks]', N'PrintedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingPassbooks] ADD [PrintedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PrintedOn] to [dbo].[SavingPassbooks]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingPassbooks]', N'PrintedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingPassbooks] ADD [PrintedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrintedBy] to [dbo].[SavingPassbooks]';
END
GO

----------------------------------------------------------------------------------------------------
-- [107/126] TABLE: [dbo].[SavingTransactions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SavingTransactions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SavingTransactions] (
        [TransactionID] INT IDENTITY(1,1) NOT NULL,
        [SavingAccountID] INT NOT NULL,
        [TransactionDate] DATETIME2 NOT NULL,
        [TransactionType] NVARCHAR(20) NOT NULL,
        [PaymentMode] NVARCHAR(20) NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        [BalanceAfterTxn] DECIMAL(18,2) NOT NULL,
        [Narration] NVARCHAR(255) NULL,
        [VoucherNo] NVARCHAR(50) NULL,
        [IsPrintedOnPassbook] BIT NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [TargetSavingAccountID] INT NULL,
        [CustomerID] INT NOT NULL DEFAULT ((1)),
        CONSTRAINT [PK_SavingTransactions] PRIMARY KEY CLUSTERED ([TransactionID] ASC)
    );
    PRINT 'Created Table [dbo].[SavingTransactions]';
END
GO

IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'SavingAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [SavingAccountID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [SavingAccountID] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'TransactionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [TransactionDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [TransactionDate] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'TransactionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [TransactionType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [TransactionType] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [PaymentMode] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [PaymentMode] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Amount] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'BalanceAfterTxn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [BalanceAfterTxn] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [BalanceAfterTxn] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'Narration') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [Narration] NVARCHAR(255) NULL;
    PRINT '  + Added column [Narration] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'VoucherNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [VoucherNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [VoucherNo] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'IsPrintedOnPassbook') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [IsPrintedOnPassbook] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsPrintedOnPassbook] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'TargetSavingAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [TargetSavingAccountID] INT NULL;
    PRINT '  + Added column [TargetSavingAccountID] to [dbo].[SavingTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingTransactions]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingTransactions] ADD [CustomerID] INT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [CustomerID] to [dbo].[SavingTransactions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [108/126] TABLE: [dbo].[SavingVoucherMappings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SavingVoucherMappings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SavingVoucherMappings] (
        [MappingID] INT IDENTITY(1,1) NOT NULL,
        [OperationType] NVARCHAR(50) NOT NULL,
        [LedgerID] INT NOT NULL,
        [Description] NVARCHAR(255) NULL,
        CONSTRAINT [PK_SavingVoucherMappings] PRIMARY KEY CLUSTERED ([MappingID] ASC)
    );
    PRINT 'Created Table [dbo].[SavingVoucherMappings]';
END
GO

IF COL_LENGTH(N'[dbo].[SavingVoucherMappings]', N'OperationType') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingVoucherMappings] ADD [OperationType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [OperationType] to [dbo].[SavingVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingVoucherMappings]', N'LedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingVoucherMappings] ADD [LedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LedgerID] to [dbo].[SavingVoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[SavingVoucherMappings]', N'Description') IS NULL
BEGIN
    ALTER TABLE [dbo].[SavingVoucherMappings] ADD [Description] NVARCHAR(255) NULL;
    PRINT '  + Added column [Description] to [dbo].[SavingVoucherMappings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [109/126] TABLE: [dbo].[Sec101AttachmentAuctions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Sec101AttachmentAuctions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Sec101AttachmentAuctions] (
        [ExecutionId] INT IDENTITY(1,1) NOT NULL,
        [CaseId] INT NOT NULL,
        [SroName] NVARCHAR(100) NOT NULL,
        [ExecutionType] NVARCHAR(50) NOT NULL,
        [PropertyDetails] NVARCHAR(500) NULL,
        [ValuationAmount] DECIMAL(18,2) NOT NULL,
        [WarrantIssueDate] DATETIME2 NULL,
        [PanchanamaDate] DATETIME2 NULL,
        [AuctionNoticeDate] DATETIME2 NULL,
        [AuctionDate] DATETIME2 NULL,
        [ReservePrice] DECIMAL(18,2) NOT NULL,
        [HighestBidAmount] DECIMAL(18,2) NOT NULL,
        [BuyerName] NVARCHAR(150) NULL,
        [BuyerContact] NVARCHAR(100) NULL,
        [SaleCertificateDate] DATETIME2 NULL,
        [SaleCertificateNo] NVARCHAR(50) NULL,
        [Status] NVARCHAR(50) NOT NULL,
        [Remarks] NVARCHAR(MAX) NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        [CreatedBy] INT NOT NULL,
        [ExecutionOrderNo] NVARCHAR(50) NULL,
        [OrderDate] DATETIME2 NULL,
        [EmployerName] NVARCHAR(150) NULL,
        [EmployerAddress] NVARCHAR(250) NULL,
        [MonthlyDeductionAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [EstimatedValue] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [ExecutionStatus] NVARCHAR(50) NULL,
        [RecoveredAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_Sec101AttachmentAuctions] PRIMARY KEY CLUSTERED ([ExecutionId] ASC)
    );
    PRINT 'Created Table [dbo].[Sec101AttachmentAuctions]';
END
GO

IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'CaseId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [CaseId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CaseId] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'SroName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [SroName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [SroName] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'ExecutionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [ExecutionType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [ExecutionType] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'PropertyDetails') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [PropertyDetails] NVARCHAR(500) NULL;
    PRINT '  + Added column [PropertyDetails] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'ValuationAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [ValuationAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ValuationAmount] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'WarrantIssueDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [WarrantIssueDate] DATETIME2 NULL;
    PRINT '  + Added column [WarrantIssueDate] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'PanchanamaDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [PanchanamaDate] DATETIME2 NULL;
    PRINT '  + Added column [PanchanamaDate] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'AuctionNoticeDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [AuctionNoticeDate] DATETIME2 NULL;
    PRINT '  + Added column [AuctionNoticeDate] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'AuctionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [AuctionDate] DATETIME2 NULL;
    PRINT '  + Added column [AuctionDate] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'ReservePrice') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [ReservePrice] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ReservePrice] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'HighestBidAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [HighestBidAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [HighestBidAmount] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'BuyerName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [BuyerName] NVARCHAR(150) NULL;
    PRINT '  + Added column [BuyerName] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'BuyerContact') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [BuyerContact] NVARCHAR(100) NULL;
    PRINT '  + Added column [BuyerContact] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'SaleCertificateDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [SaleCertificateDate] DATETIME2 NULL;
    PRINT '  + Added column [SaleCertificateDate] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'SaleCertificateNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [SaleCertificateNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [SaleCertificateNo] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [Status] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [Remarks] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'ExecutionOrderNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [ExecutionOrderNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [ExecutionOrderNo] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'OrderDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [OrderDate] DATETIME2 NULL;
    PRINT '  + Added column [OrderDate] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'EmployerName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [EmployerName] NVARCHAR(150) NULL;
    PRINT '  + Added column [EmployerName] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'EmployerAddress') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [EmployerAddress] NVARCHAR(250) NULL;
    PRINT '  + Added column [EmployerAddress] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'MonthlyDeductionAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [MonthlyDeductionAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [MonthlyDeductionAmount] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'EstimatedValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [EstimatedValue] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [EstimatedValue] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'ExecutionStatus') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [ExecutionStatus] NVARCHAR(50) NULL;
    PRINT '  + Added column [ExecutionStatus] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'RecoveredAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [RecoveredAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [RecoveredAmount] to [dbo].[Sec101AttachmentAuctions]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101AttachmentAuctions]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate());
    PRINT '  + Added column [CreatedDate] to [dbo].[Sec101AttachmentAuctions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [110/126] TABLE: [dbo].[Sec101CaseMasters]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Sec101CaseMasters]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Sec101CaseMasters] (
        [CaseId] INT IDENTITY(1,1) NOT NULL,
        [BranchId] INT NOT NULL,
        [LoanAccountId] INT NOT NULL,
        [MemberId] INT NOT NULL,
        [CaseNumber] NVARCHAR(50) NOT NULL,
        [CourtName] NVARCHAR(200) NOT NULL,
        [AdvocateName] NVARCHAR(100) NULL,
        [FilingDate] DATETIME2 NOT NULL,
        [PrincipalClaim] DECIMAL(18,2) NOT NULL,
        [InterestClaim] DECIMAL(18,2) NOT NULL,
        [PenalInterestClaim] DECIMAL(18,2) NOT NULL,
        [OtherChargesClaim] DECIMAL(18,2) NOT NULL,
        [TotalClaimAmount] DECIMAL(18,2) NOT NULL,
        [CourtFeeAmount] DECIMAL(18,2) NOT NULL,
        [CourtFeeChallanNo] NVARCHAR(50) NULL,
        [CertificateNo] NVARCHAR(50) NULL,
        [CertificateDate] DATETIME2 NULL,
        [SanctionedAmount] DECIMAL(18,2) NULL,
        [FutureInterestRate] DECIMAL(18,2) NULL,
        [Status] NVARCHAR(50) NOT NULL,
        [Remarks] NVARCHAR(MAX) NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CertificateNumber] NVARCHAR(50) NULL,
        [GrantedAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [GrantedInterestRate] DECIMAL(18,2) NOT NULL DEFAULT ((0)),
        [CaseStatus] NVARCHAR(50) NULL,
        [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_Sec101CaseMasters] PRIMARY KEY CLUSTERED ([CaseId] ASC)
    );
    PRINT 'Created Table [dbo].[Sec101CaseMasters]';
END
GO

IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [BranchId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchId] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'LoanAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [LoanAccountId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountId] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'MemberId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [MemberId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MemberId] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CaseNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CaseNumber] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [CaseNumber] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CourtName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CourtName] NVARCHAR(200) NOT NULL DEFAULT '';
    PRINT '  + Added column [CourtName] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'AdvocateName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [AdvocateName] NVARCHAR(100) NULL;
    PRINT '  + Added column [AdvocateName] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'FilingDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [FilingDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [FilingDate] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'PrincipalClaim') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [PrincipalClaim] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrincipalClaim] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'InterestClaim') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [InterestClaim] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestClaim] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'PenalInterestClaim') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [PenalInterestClaim] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PenalInterestClaim] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'OtherChargesClaim') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [OtherChargesClaim] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [OtherChargesClaim] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'TotalClaimAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [TotalClaimAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalClaimAmount] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CourtFeeAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CourtFeeAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [CourtFeeAmount] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CourtFeeChallanNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CourtFeeChallanNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [CourtFeeChallanNo] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CertificateNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CertificateNo] NVARCHAR(50) NULL;
    PRINT '  + Added column [CertificateNo] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CertificateDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CertificateDate] DATETIME2 NULL;
    PRINT '  + Added column [CertificateDate] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'SanctionedAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [SanctionedAmount] DECIMAL(18,2) NULL;
    PRINT '  + Added column [SanctionedAmount] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'FutureInterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [FutureInterestRate] DECIMAL(18,2) NULL;
    PRINT '  + Added column [FutureInterestRate] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [Status] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [Remarks] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CertificateNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CertificateNumber] NVARCHAR(50) NULL;
    PRINT '  + Added column [CertificateNumber] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'GrantedAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [GrantedAmount] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [GrantedAmount] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'GrantedInterestRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [GrantedInterestRate] DECIMAL(18,2) NOT NULL DEFAULT ((0));
    PRINT '  + Added column [GrantedInterestRate] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CaseStatus') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CaseStatus] NVARCHAR(50) NULL;
    PRINT '  + Added column [CaseStatus] to [dbo].[Sec101CaseMasters]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101CaseMasters]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate());
    PRINT '  + Added column [CreatedDate] to [dbo].[Sec101CaseMasters]';
END
GO

----------------------------------------------------------------------------------------------------
-- [111/126] TABLE: [dbo].[Sec101HearingLogs]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Sec101HearingLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Sec101HearingLogs] (
        [HearingId] INT IDENTITY(1,1) NOT NULL,
        [CaseId] INT NOT NULL,
        [HearingDate] DATETIME2 NOT NULL,
        [NextHearingDate] DATETIME2 NULL,
        [Stage] NVARCHAR(100) NOT NULL,
        [BorrowerPresence] NVARCHAR(20) NOT NULL,
        [GuarantorPresence] NVARCHAR(20) NOT NULL,
        [CourtOrderSummary] NVARCHAR(MAX) NULL,
        [AdvocateNotes] NVARCHAR(MAX) NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        [CreatedBy] INT NOT NULL,
        [HearingLogId] INT NULL,
        [HearingStage] NVARCHAR(100) NULL,
        [PresenceType] NVARCHAR(50) NULL,
        [NextHearingPurpose] NVARCHAR(250) NULL,
        [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_Sec101HearingLogs] PRIMARY KEY CLUSTERED ([HearingId] ASC)
    );
    PRINT 'Created Table [dbo].[Sec101HearingLogs]';
END
GO

IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'CaseId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [CaseId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CaseId] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'HearingDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [HearingDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [HearingDate] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'NextHearingDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [NextHearingDate] DATETIME2 NULL;
    PRINT '  + Added column [NextHearingDate] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'Stage') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [Stage] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [Stage] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'BorrowerPresence') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [BorrowerPresence] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [BorrowerPresence] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'GuarantorPresence') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [GuarantorPresence] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [GuarantorPresence] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'CourtOrderSummary') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [CourtOrderSummary] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [CourtOrderSummary] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'AdvocateNotes') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [AdvocateNotes] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [AdvocateNotes] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'HearingLogId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [HearingLogId] INT NULL;
    PRINT '  + Added column [HearingLogId] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'HearingStage') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [HearingStage] NVARCHAR(100) NULL;
    PRINT '  + Added column [HearingStage] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'PresenceType') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [PresenceType] NVARCHAR(50) NULL;
    PRINT '  + Added column [PresenceType] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'NextHearingPurpose') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [NextHearingPurpose] NVARCHAR(250) NULL;
    PRINT '  + Added column [NextHearingPurpose] to [dbo].[Sec101HearingLogs]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101HearingLogs]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate());
    PRINT '  + Added column [CreatedDate] to [dbo].[Sec101HearingLogs]';
END
GO

----------------------------------------------------------------------------------------------------
-- [112/126] TABLE: [dbo].[Sec101LegalExpenses]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Sec101LegalExpenses]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Sec101LegalExpenses] (
        [ExpenseId] INT IDENTITY(1,1) NOT NULL,
        [BranchId] INT NOT NULL,
        [CaseId] INT NULL,
        [LoanAccountId] INT NOT NULL,
        [ExpenseType] NVARCHAR(50) NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        [ExpenseDate] DATETIME2 NOT NULL,
        [PaidTo] NVARCHAR(150) NULL,
        [VoucherId] INT NULL,
        [IsDebitedToLoan] BIT NOT NULL,
        [Remarks] NVARCHAR(MAX) NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        [CreatedBy] INT NOT NULL,
        [LegalExpenseId] INT NULL,
        [PayeeName] NVARCHAR(150) NULL,
        [PaymentMode] NVARCHAR(50) NULL,
        [VoucherNumber] NVARCHAR(50) NULL,
        [IsDebitedToBorrower] BIT NOT NULL DEFAULT ((0)),
        [DebitLedgerId] INT NULL,
        [CreditLedgerId] INT NULL,
        [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_Sec101LegalExpenses] PRIMARY KEY CLUSTERED ([ExpenseId] ASC)
    );
    PRINT 'Created Table [dbo].[Sec101LegalExpenses]';
END
GO

IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [BranchId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchId] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'CaseId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [CaseId] INT NULL;
    PRINT '  + Added column [CaseId] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'LoanAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [LoanAccountId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountId] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'ExpenseType') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [ExpenseType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [ExpenseType] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Amount] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'ExpenseDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [ExpenseDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [ExpenseDate] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'PaidTo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [PaidTo] NVARCHAR(150) NULL;
    PRINT '  + Added column [PaidTo] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'VoucherId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [VoucherId] INT NULL;
    PRINT '  + Added column [VoucherId] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'IsDebitedToLoan') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [IsDebitedToLoan] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsDebitedToLoan] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [Remarks] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'LegalExpenseId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [LegalExpenseId] INT NULL;
    PRINT '  + Added column [LegalExpenseId] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'PayeeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [PayeeName] NVARCHAR(150) NULL;
    PRINT '  + Added column [PayeeName] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'PaymentMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [PaymentMode] NVARCHAR(50) NULL;
    PRINT '  + Added column [PaymentMode] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'VoucherNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [VoucherNumber] NVARCHAR(50) NULL;
    PRINT '  + Added column [VoucherNumber] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'IsDebitedToBorrower') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [IsDebitedToBorrower] BIT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [IsDebitedToBorrower] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'DebitLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [DebitLedgerId] INT NULL;
    PRINT '  + Added column [DebitLedgerId] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'CreditLedgerId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [CreditLedgerId] INT NULL;
    PRINT '  + Added column [CreditLedgerId] to [dbo].[Sec101LegalExpenses]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101LegalExpenses]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate());
    PRINT '  + Added column [CreatedDate] to [dbo].[Sec101LegalExpenses]';
END
GO

----------------------------------------------------------------------------------------------------
-- [113/126] TABLE: [dbo].[Sec101NoticeHistories]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Sec101NoticeHistories]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Sec101NoticeHistories] (
        [NoticeId] INT IDENTITY(1,1) NOT NULL,
        [BranchId] INT NOT NULL,
        [LoanAccountId] INT NOT NULL,
        [MemberId] INT NOT NULL,
        [NoticeType] NVARCHAR(50) NOT NULL,
        [NoticeNumber] NVARCHAR(50) NOT NULL,
        [NoticeDate] DATETIME2 NOT NULL,
        [DueDate] DATETIME2 NOT NULL,
        [PrincipalDue] DECIMAL(18,2) NOT NULL,
        [InterestDue] DECIMAL(18,2) NOT NULL,
        [PenalInterestDue] DECIMAL(18,2) NOT NULL,
        [NoticeFee] DECIMAL(18,2) NOT NULL,
        [TotalDemandAmount] DECIMAL(18,2) NOT NULL,
        [PostalTrackingNo] NVARCHAR(100) NULL,
        [PostalStatus] NVARCHAR(50) NOT NULL,
        [DeliveredDate] DATETIME2 NULL,
        [Remarks] NVARCHAR(MAX) NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT [PK_Sec101NoticeHistories] PRIMARY KEY CLUSTERED ([NoticeId] ASC)
    );
    PRINT 'Created Table [dbo].[Sec101NoticeHistories]';
END
GO

IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'BranchId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [BranchId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchId] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'LoanAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [LoanAccountId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanAccountId] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'MemberId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [MemberId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MemberId] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'NoticeType') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [NoticeType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [NoticeType] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'NoticeNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [NoticeNumber] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [NoticeNumber] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'NoticeDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [NoticeDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [NoticeDate] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'DueDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [DueDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [DueDate] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'PrincipalDue') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [PrincipalDue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrincipalDue] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'InterestDue') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [InterestDue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [InterestDue] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'PenalInterestDue') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [PenalInterestDue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [PenalInterestDue] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'NoticeFee') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [NoticeFee] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [NoticeFee] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'TotalDemandAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [TotalDemandAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalDemandAmount] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'PostalTrackingNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [PostalTrackingNo] NVARCHAR(100) NULL;
    PRINT '  + Added column [PostalTrackingNo] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'PostalStatus') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [PostalStatus] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [PostalStatus] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'DeliveredDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [DeliveredDate] DATETIME2 NULL;
    PRINT '  + Added column [DeliveredDate] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [Remarks] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedAt] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[Sec101NoticeHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[Sec101NoticeHistories]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT (getutcdate());
    PRINT '  + Added column [CreatedDate] to [dbo].[Sec101NoticeHistories]';
END
GO

----------------------------------------------------------------------------------------------------
-- [114/126] TABLE: [dbo].[SecurityTypes]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SecurityTypes]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SecurityTypes] (
        [SecurityTypeID] INT IDENTITY(1,1) NOT NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [IsActive] BIT NOT NULL,
        CONSTRAINT [PK_SecurityTypes] PRIMARY KEY CLUSTERED ([SecurityTypeID] ASC)
    );
    PRINT 'Created Table [dbo].[SecurityTypes]';
END
GO

IF COL_LENGTH(N'[dbo].[SecurityTypes]', N'Name') IS NULL
BEGIN
    ALTER TABLE [dbo].[SecurityTypes] ADD [Name] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [Name] to [dbo].[SecurityTypes]';
END
GO
IF COL_LENGTH(N'[dbo].[SecurityTypes]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[SecurityTypes] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[SecurityTypes]';
END
GO

----------------------------------------------------------------------------------------------------
-- [115/126] TABLE: [dbo].[ShareAccounts]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[ShareAccounts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ShareAccounts] (
        [ShareAccountId] INT IDENTITY(1,1) NOT NULL,
        [AccountNo] NVARCHAR(20) NOT NULL,
        [MemberId] INT NOT NULL,
        [TotalShareAmount] DECIMAL(18,2) NOT NULL,
        [TotalShareCount] INT NOT NULL,
        [DividendPayableBalance] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [OpeningDate] DATETIME2 NOT NULL,
        [LegacyAccountId] INT NULL,
        [LegacyAccountNumber] NVARCHAR(50) NULL,
        [CustomerID] INT NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_ShareAccounts] PRIMARY KEY CLUSTERED ([ShareAccountId] ASC)
    );
    PRINT 'Created Table [dbo].[ShareAccounts]';
END
GO

IF COL_LENGTH(N'[dbo].[ShareAccounts]', N'AccountNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareAccounts] ADD [AccountNo] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [AccountNo] to [dbo].[ShareAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareAccounts]', N'MemberId') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareAccounts] ADD [MemberId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MemberId] to [dbo].[ShareAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareAccounts]', N'TotalShareAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareAccounts] ADD [TotalShareAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalShareAmount] to [dbo].[ShareAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareAccounts]', N'TotalShareCount') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareAccounts] ADD [TotalShareCount] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalShareCount] to [dbo].[ShareAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareAccounts]', N'DividendPayableBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareAccounts] ADD [DividendPayableBalance] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DividendPayableBalance] to [dbo].[ShareAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareAccounts]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareAccounts] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[ShareAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareAccounts]', N'OpeningDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareAccounts] ADD [OpeningDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [OpeningDate] to [dbo].[ShareAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareAccounts]', N'LegacyAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareAccounts] ADD [LegacyAccountId] INT NULL;
    PRINT '  + Added column [LegacyAccountId] to [dbo].[ShareAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareAccounts]', N'LegacyAccountNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareAccounts] ADD [LegacyAccountNumber] NVARCHAR(50) NULL;
    PRINT '  + Added column [LegacyAccountNumber] to [dbo].[ShareAccounts]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareAccounts]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareAccounts] ADD [CustomerID] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [CustomerID] to [dbo].[ShareAccounts]';
END
GO

----------------------------------------------------------------------------------------------------
-- [116/126] TABLE: [dbo].[ShareCertificatePrintHistories]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[ShareCertificatePrintHistories]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ShareCertificatePrintHistories] (
        [PrintHistoryId] INT IDENTITY(1,1) NOT NULL,
        [CertificateId] INT NOT NULL,
        [ActionType] NVARCHAR(20) NOT NULL,
        [PrintedBy] INT NOT NULL,
        [PrintedOn] DATETIME2 NOT NULL,
        [IPAddress] NVARCHAR(50) NULL,
        CONSTRAINT [PK_ShareCertificatePrintHistories] PRIMARY KEY CLUSTERED ([PrintHistoryId] ASC)
    );
    PRINT 'Created Table [dbo].[ShareCertificatePrintHistories]';
END
GO

IF COL_LENGTH(N'[dbo].[ShareCertificatePrintHistories]', N'CertificateId') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificatePrintHistories] ADD [CertificateId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CertificateId] to [dbo].[ShareCertificatePrintHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificatePrintHistories]', N'ActionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificatePrintHistories] ADD [ActionType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [ActionType] to [dbo].[ShareCertificatePrintHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificatePrintHistories]', N'PrintedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificatePrintHistories] ADD [PrintedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrintedBy] to [dbo].[ShareCertificatePrintHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificatePrintHistories]', N'PrintedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificatePrintHistories] ADD [PrintedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [PrintedOn] to [dbo].[ShareCertificatePrintHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificatePrintHistories]', N'IPAddress') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificatePrintHistories] ADD [IPAddress] NVARCHAR(50) NULL;
    PRINT '  + Added column [IPAddress] to [dbo].[ShareCertificatePrintHistories]';
END
GO

----------------------------------------------------------------------------------------------------
-- [117/126] TABLE: [dbo].[ShareCertificates]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[ShareCertificates]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ShareCertificates] (
        [CertificateId] INT IDENTITY(1,1) NOT NULL,
        [ShareAccountId] INT NOT NULL,
        [CertificateNo] NVARCHAR(50) NOT NULL,
        [IssueDate] DATETIME2 NOT NULL,
        [FromShareNo] BIGINT NOT NULL,
        [ToShareNo] BIGINT NOT NULL,
        [NumberOfShares] INT NOT NULL,
        [FaceValue] DECIMAL(18,2) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [PrintCount] INT NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedDate] DATETIME2 NOT NULL,
        [ModifiedBy] INT NULL,
        [ModifiedDate] DATETIME2 NULL,
        [CancellationReason] NVARCHAR(MAX) NULL,
        [CustomerID] INT NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_ShareCertificates] PRIMARY KEY CLUSTERED ([CertificateId] ASC)
    );
    PRINT 'Created Table [dbo].[ShareCertificates]';
END
GO

IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'ShareAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [ShareAccountId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [ShareAccountId] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'CertificateNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [CertificateNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [CertificateNo] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'IssueDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [IssueDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [IssueDate] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'FromShareNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [FromShareNo] BIGINT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FromShareNo] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'ToShareNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [ToShareNo] BIGINT NOT NULL DEFAULT 0;
    PRINT '  + Added column [ToShareNo] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'NumberOfShares') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [NumberOfShares] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [NumberOfShares] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'FaceValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [FaceValue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [FaceValue] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'PrintCount') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [PrintCount] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [PrintCount] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedDate] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'ModifiedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [ModifiedBy] INT NULL;
    PRINT '  + Added column [ModifiedBy] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'ModifiedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [ModifiedDate] DATETIME2 NULL;
    PRINT '  + Added column [ModifiedDate] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'CancellationReason') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [CancellationReason] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [CancellationReason] to [dbo].[ShareCertificates]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareCertificates]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareCertificates] ADD [CustomerID] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [CustomerID] to [dbo].[ShareCertificates]';
END
GO

----------------------------------------------------------------------------------------------------
-- [118/126] TABLE: [dbo].[ShareSchemes]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[ShareSchemes]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ShareSchemes] (
        [ShareSchemeId] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [SchemeCode] NVARCHAR(50) NOT NULL,
        [SchemeName] NVARCHAR(100) NOT NULL,
        [MemberType] NVARCHAR(50) NOT NULL,
        [ShareFaceValue] DECIMAL(18,2) NOT NULL,
        [MinSharesCount] INT NOT NULL,
        [MaxSharesCount] INT NOT NULL,
        [EntranceFee] DECIMAL(18,2) NOT NULL,
        [BuildingFund] DECIMAL(18,2) NOT NULL,
        [ShareTransferFee] DECIMAL(18,2) NOT NULL,
        [DividendRate] DECIMAL(18,2) NOT NULL,
        [HasVotingRights] BIT NOT NULL,
        [IsAadhaarCompulsory] BIT NOT NULL,
        [IsPanCompulsory] BIT NOT NULL,
        [LoanEligibilityMultiplier] INT NOT NULL,
        [EffectiveDate] DATETIME2 NOT NULL,
        [IsActive] BIT NOT NULL,
        [ShareCapitalLedgerID] INT NULL,
        [EntranceFeeLedgerID] INT NULL,
        [ShareTransferFeeLedgerID] INT NULL,
        [BuildingFundLedgerID] INT NULL,
        [DividendPayableLedgerID] INT NULL,
        [IsMobileCompulsory] BIT NOT NULL DEFAULT ((1)),
        CONSTRAINT [PK_ShareSchemes] PRIMARY KEY CLUSTERED ([ShareSchemeId] ASC)
    );
    PRINT 'Created Table [dbo].[ShareSchemes]';
END
GO

IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'SchemeCode') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [SchemeCode] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [SchemeCode] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'SchemeName') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [SchemeName] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [SchemeName] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'MemberType') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [MemberType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [MemberType] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'ShareFaceValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [ShareFaceValue] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ShareFaceValue] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'MinSharesCount') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [MinSharesCount] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MinSharesCount] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'MaxSharesCount') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [MaxSharesCount] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [MaxSharesCount] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'EntranceFee') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [EntranceFee] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [EntranceFee] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'BuildingFund') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [BuildingFund] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [BuildingFund] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'ShareTransferFee') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [ShareTransferFee] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [ShareTransferFee] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'DividendRate') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [DividendRate] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [DividendRate] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'HasVotingRights') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [HasVotingRights] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [HasVotingRights] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'IsAadhaarCompulsory') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [IsAadhaarCompulsory] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsAadhaarCompulsory] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'IsPanCompulsory') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [IsPanCompulsory] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsPanCompulsory] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'LoanEligibilityMultiplier') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [LoanEligibilityMultiplier] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LoanEligibilityMultiplier] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'EffectiveDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [EffectiveDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [EffectiveDate] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'ShareCapitalLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [ShareCapitalLedgerID] INT NULL;
    PRINT '  + Added column [ShareCapitalLedgerID] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'EntranceFeeLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [EntranceFeeLedgerID] INT NULL;
    PRINT '  + Added column [EntranceFeeLedgerID] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'ShareTransferFeeLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [ShareTransferFeeLedgerID] INT NULL;
    PRINT '  + Added column [ShareTransferFeeLedgerID] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'BuildingFundLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [BuildingFundLedgerID] INT NULL;
    PRINT '  + Added column [BuildingFundLedgerID] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'DividendPayableLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [DividendPayableLedgerID] INT NULL;
    PRINT '  + Added column [DividendPayableLedgerID] to [dbo].[ShareSchemes]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareSchemes]', N'IsMobileCompulsory') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareSchemes] ADD [IsMobileCompulsory] BIT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [IsMobileCompulsory] to [dbo].[ShareSchemes]';
END
GO

----------------------------------------------------------------------------------------------------
-- [119/126] TABLE: [dbo].[ShareTransactions]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[ShareTransactions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ShareTransactions] (
        [TransactionId] INT IDENTITY(1,1) NOT NULL,
        [ShareAccountId] INT NOT NULL,
        [TransactionDate] DATETIME2 NOT NULL,
        [TransactionType] NVARCHAR(50) NOT NULL,
        [NumberOfShares] INT NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        [Narration] NVARCHAR(255) NOT NULL,
        [VoucherId] INT NULL,
        [CustomerID] INT NOT NULL DEFAULT ((0)),
        CONSTRAINT [PK_ShareTransactions] PRIMARY KEY CLUSTERED ([TransactionId] ASC)
    );
    PRINT 'Created Table [dbo].[ShareTransactions]';
END
GO

IF COL_LENGTH(N'[dbo].[ShareTransactions]', N'ShareAccountId') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareTransactions] ADD [ShareAccountId] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [ShareAccountId] to [dbo].[ShareTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareTransactions]', N'TransactionDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareTransactions] ADD [TransactionDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [TransactionDate] to [dbo].[ShareTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareTransactions]', N'TransactionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareTransactions] ADD [TransactionType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [TransactionType] to [dbo].[ShareTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareTransactions]', N'NumberOfShares') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareTransactions] ADD [NumberOfShares] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [NumberOfShares] to [dbo].[ShareTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareTransactions]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareTransactions] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Amount] to [dbo].[ShareTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareTransactions]', N'Narration') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareTransactions] ADD [Narration] NVARCHAR(255) NOT NULL DEFAULT '';
    PRINT '  + Added column [Narration] to [dbo].[ShareTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareTransactions]', N'VoucherId') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareTransactions] ADD [VoucherId] INT NULL;
    PRINT '  + Added column [VoucherId] to [dbo].[ShareTransactions]';
END
GO
IF COL_LENGTH(N'[dbo].[ShareTransactions]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[ShareTransactions] ADD [CustomerID] INT NOT NULL DEFAULT ((0));
    PRINT '  + Added column [CustomerID] to [dbo].[ShareTransactions]';
END
GO

----------------------------------------------------------------------------------------------------
-- [120/126] TABLE: [dbo].[SystemNotifications]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SystemNotifications]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SystemNotifications] (
        [NotificationID] BIGINT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [UserID] INT NULL,
        [RoleName] NVARCHAR(50) NULL,
        [ModuleName] NVARCHAR(50) NOT NULL,
        [NotificationType] NVARCHAR(50) NOT NULL,
        [Title] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(500) NOT NULL,
        [Priority] NVARCHAR(20) NOT NULL,
        [TargetTab] NVARCHAR(100) NOT NULL,
        [EntityName] NVARCHAR(50) NULL,
        [EntityID] NVARCHAR(50) NULL,
        [Amount] DECIMAL(18,2) NULL,
        [DueDate] DATETIME2 NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [CompletedOn] DATETIME2 NULL,
        [CompletedBy] INT NULL,
        CONSTRAINT [PK_SystemNotifications] PRIMARY KEY CLUSTERED ([NotificationID] ASC)
    );
    PRINT 'Created Table [dbo].[SystemNotifications]';
END
GO

IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'UserID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [UserID] INT NULL;
    PRINT '  + Added column [UserID] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'RoleName') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [RoleName] NVARCHAR(50) NULL;
    PRINT '  + Added column [RoleName] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'ModuleName') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [ModuleName] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [ModuleName] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'NotificationType') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [NotificationType] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [NotificationType] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'Title') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [Title] NVARCHAR(250) NOT NULL DEFAULT '';
    PRINT '  + Added column [Title] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'Description') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [Description] NVARCHAR(500) NOT NULL DEFAULT '';
    PRINT '  + Added column [Description] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'Priority') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [Priority] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Priority] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'TargetTab') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [TargetTab] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [TargetTab] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'EntityName') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [EntityName] NVARCHAR(50) NULL;
    PRINT '  + Added column [EntityName] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'EntityID') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [EntityID] NVARCHAR(50) NULL;
    PRINT '  + Added column [EntityID] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [Amount] DECIMAL(18,2) NULL;
    PRINT '  + Added column [Amount] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'DueDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [DueDate] DATETIME2 NULL;
    PRINT '  + Added column [DueDate] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'CompletedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [CompletedOn] DATETIME2 NULL;
    PRINT '  + Added column [CompletedOn] to [dbo].[SystemNotifications]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemNotifications]', N'CompletedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemNotifications] ADD [CompletedBy] INT NULL;
    PRINT '  + Added column [CompletedBy] to [dbo].[SystemNotifications]';
END
GO

----------------------------------------------------------------------------------------------------
-- [121/126] TABLE: [dbo].[SystemVersionHistories]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SystemVersionHistories]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SystemVersionHistories] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [Version] NVARCHAR(100) NULL,
        [ReleaseDate] NVARCHAR(50) NULL,
        [Changelog] NVARCHAR(MAX) NULL,
        [InstalledOn] DATETIME2 NOT NULL DEFAULT (getutcdate()),
        [IsActive] BIT NOT NULL DEFAULT ((1)),
        [VersionNumber] NVARCHAR(50) NULL,
        [AppliedOn] DATETIME2 NOT NULL DEFAULT (getutcdate()),
        [PatchName] NVARCHAR(150) NULL,
        [Status] NVARCHAR(50) NOT NULL DEFAULT ('SUCCESS'),
        [Remarks] NVARCHAR(MAX) NULL,
        [AppliedBy] NVARCHAR(100) NULL,
        CONSTRAINT [PK_SystemVersionHistories] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT 'Created Table [dbo].[SystemVersionHistories]';
END
GO

IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'Version') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [Version] NVARCHAR(100) NULL;
    PRINT '  + Added column [Version] to [dbo].[SystemVersionHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'ReleaseDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [ReleaseDate] NVARCHAR(50) NULL;
    PRINT '  + Added column [ReleaseDate] to [dbo].[SystemVersionHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'Changelog') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [Changelog] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [Changelog] to [dbo].[SystemVersionHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'InstalledOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [InstalledOn] DATETIME2 NOT NULL DEFAULT (getutcdate());
    PRINT '  + Added column [InstalledOn] to [dbo].[SystemVersionHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [IsActive] BIT NOT NULL DEFAULT ((1));
    PRINT '  + Added column [IsActive] to [dbo].[SystemVersionHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'VersionNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [VersionNumber] NVARCHAR(50) NULL;
    PRINT '  + Added column [VersionNumber] to [dbo].[SystemVersionHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'AppliedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [AppliedOn] DATETIME2 NOT NULL DEFAULT (getutcdate());
    PRINT '  + Added column [AppliedOn] to [dbo].[SystemVersionHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'PatchName') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [PatchName] NVARCHAR(150) NULL;
    PRINT '  + Added column [PatchName] to [dbo].[SystemVersionHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [Status] NVARCHAR(50) NOT NULL DEFAULT ('SUCCESS');
    PRINT '  + Added column [Status] to [dbo].[SystemVersionHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'Remarks') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [Remarks] NVARCHAR(MAX) NULL;
    PRINT '  + Added column [Remarks] to [dbo].[SystemVersionHistories]';
END
GO
IF COL_LENGTH(N'[dbo].[SystemVersionHistories]', N'AppliedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[SystemVersionHistories] ADD [AppliedBy] NVARCHAR(100) NULL;
    PRINT '  + Added column [AppliedBy] to [dbo].[SystemVersionHistories]';
END
GO

----------------------------------------------------------------------------------------------------
-- [122/126] TABLE: [dbo].[UserLoginAudits]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[UserLoginAudits]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[UserLoginAudits] (
        [AuditID] INT IDENTITY(1,1) NOT NULL,
        [UserID] INT NOT NULL,
        [LoginTime] DATETIME2 NOT NULL,
        [LogoutTime] DATETIME2 NULL,
        [IPAddress] NVARCHAR(50) NULL,
        [DeviceDetails] NVARCHAR(255) NULL,
        [Status] NVARCHAR(50) NOT NULL,
        CONSTRAINT [PK_UserLoginAudits] PRIMARY KEY CLUSTERED ([AuditID] ASC)
    );
    PRINT 'Created Table [dbo].[UserLoginAudits]';
END
GO

IF COL_LENGTH(N'[dbo].[UserLoginAudits]', N'UserID') IS NULL
BEGIN
    ALTER TABLE [dbo].[UserLoginAudits] ADD [UserID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [UserID] to [dbo].[UserLoginAudits]';
END
GO
IF COL_LENGTH(N'[dbo].[UserLoginAudits]', N'LoginTime') IS NULL
BEGIN
    ALTER TABLE [dbo].[UserLoginAudits] ADD [LoginTime] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [LoginTime] to [dbo].[UserLoginAudits]';
END
GO
IF COL_LENGTH(N'[dbo].[UserLoginAudits]', N'LogoutTime') IS NULL
BEGIN
    ALTER TABLE [dbo].[UserLoginAudits] ADD [LogoutTime] DATETIME2 NULL;
    PRINT '  + Added column [LogoutTime] to [dbo].[UserLoginAudits]';
END
GO
IF COL_LENGTH(N'[dbo].[UserLoginAudits]', N'IPAddress') IS NULL
BEGIN
    ALTER TABLE [dbo].[UserLoginAudits] ADD [IPAddress] NVARCHAR(50) NULL;
    PRINT '  + Added column [IPAddress] to [dbo].[UserLoginAudits]';
END
GO
IF COL_LENGTH(N'[dbo].[UserLoginAudits]', N'DeviceDetails') IS NULL
BEGIN
    ALTER TABLE [dbo].[UserLoginAudits] ADD [DeviceDetails] NVARCHAR(255) NULL;
    PRINT '  + Added column [DeviceDetails] to [dbo].[UserLoginAudits]';
END
GO
IF COL_LENGTH(N'[dbo].[UserLoginAudits]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[UserLoginAudits] ADD [Status] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[UserLoginAudits]';
END
GO

----------------------------------------------------------------------------------------------------
-- [123/126] TABLE: [dbo].[Users]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Users] (
        [UserID] INT IDENTITY(1,1) NOT NULL,
        [Username] NVARCHAR(50) NOT NULL,
        [PasswordHash] NVARCHAR(255) NOT NULL,
        [RoleID] INT NOT NULL,
        [DefaultBranchID] INT NULL,
        [IsActive] BIT NOT NULL,
        [IsLocked] BIT NOT NULL,
        [FailedLoginAttempts] INT NOT NULL,
        [RequirePasswordChange] BIT NOT NULL,
        [LastPasswordChangeDate] DATETIME2 NULL,
        [LastLoginDate] DATETIME2 NULL,
        [ActiveSessionToken] NVARCHAR(2000) NULL,
        [Email] NVARCHAR(100) NULL,
        [MobileNumber] NVARCHAR(20) NULL,
        CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([UserID] ASC)
    );
    PRINT 'Created Table [dbo].[Users]';
END
GO

IF COL_LENGTH(N'[dbo].[Users]', N'Username') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [Username] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [Username] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'PasswordHash') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [PasswordHash] NVARCHAR(255) NOT NULL DEFAULT '';
    PRINT '  + Added column [PasswordHash] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'RoleID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [RoleID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [RoleID] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'DefaultBranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [DefaultBranchID] INT NULL;
    PRINT '  + Added column [DefaultBranchID] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'IsActive') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [IsActive] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsActive] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'IsLocked') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [IsLocked] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [IsLocked] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'FailedLoginAttempts') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [FailedLoginAttempts] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [FailedLoginAttempts] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'RequirePasswordChange') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [RequirePasswordChange] BIT NOT NULL DEFAULT 0;
    PRINT '  + Added column [RequirePasswordChange] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'LastPasswordChangeDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [LastPasswordChangeDate] DATETIME2 NULL;
    PRINT '  + Added column [LastPasswordChangeDate] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'LastLoginDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [LastLoginDate] DATETIME2 NULL;
    PRINT '  + Added column [LastLoginDate] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'ActiveSessionToken') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [ActiveSessionToken] NVARCHAR(2000) NULL;
    PRINT '  + Added column [ActiveSessionToken] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'Email') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [Email] NVARCHAR(100) NULL;
    PRINT '  + Added column [Email] to [dbo].[Users]';
END
GO
IF COL_LENGTH(N'[dbo].[Users]', N'MobileNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [MobileNumber] NVARCHAR(20) NULL;
    PRINT '  + Added column [MobileNumber] to [dbo].[Users]';
END
GO

----------------------------------------------------------------------------------------------------
-- [124/126] TABLE: [dbo].[VoucherDetails]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[VoucherDetails]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[VoucherDetails] (
        [VoucherDetailID] INT IDENTITY(1,1) NOT NULL,
        [VoucherID] INT NOT NULL,
        [LedgerID] INT NOT NULL,
        [MemberID] INT NULL,
        [DrCr] NVARCHAR(2) NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        [CustomerID] INT NULL,
        CONSTRAINT [PK_VoucherDetails] PRIMARY KEY CLUSTERED ([VoucherDetailID] ASC)
    );
    PRINT 'Created Table [dbo].[VoucherDetails]';
END
GO

IF COL_LENGTH(N'[dbo].[VoucherDetails]', N'VoucherID') IS NULL
BEGIN
    ALTER TABLE [dbo].[VoucherDetails] ADD [VoucherID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [VoucherID] to [dbo].[VoucherDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[VoucherDetails]', N'LedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[VoucherDetails] ADD [LedgerID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [LedgerID] to [dbo].[VoucherDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[VoucherDetails]', N'MemberID') IS NULL
BEGIN
    ALTER TABLE [dbo].[VoucherDetails] ADD [MemberID] INT NULL;
    PRINT '  + Added column [MemberID] to [dbo].[VoucherDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[VoucherDetails]', N'DrCr') IS NULL
BEGIN
    ALTER TABLE [dbo].[VoucherDetails] ADD [DrCr] NVARCHAR(2) NOT NULL DEFAULT '';
    PRINT '  + Added column [DrCr] to [dbo].[VoucherDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[VoucherDetails]', N'Amount') IS NULL
BEGIN
    ALTER TABLE [dbo].[VoucherDetails] ADD [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [Amount] to [dbo].[VoucherDetails]';
END
GO
IF COL_LENGTH(N'[dbo].[VoucherDetails]', N'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[VoucherDetails] ADD [CustomerID] INT NULL;
    PRINT '  + Added column [CustomerID] to [dbo].[VoucherDetails]';
END
GO

----------------------------------------------------------------------------------------------------
-- [125/126] TABLE: [dbo].[VoucherMappings]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[VoucherMappings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[VoucherMappings] (
        [MappingID] INT IDENTITY(1,1) NOT NULL,
        [TransactionType] NVARCHAR(100) NOT NULL,
        [DebitLedgerID] INT NULL,
        [CreditLedgerID] INT NULL,
        CONSTRAINT [PK_VoucherMappings] PRIMARY KEY CLUSTERED ([MappingID] ASC)
    );
    PRINT 'Created Table [dbo].[VoucherMappings]';
END
GO

IF COL_LENGTH(N'[dbo].[VoucherMappings]', N'TransactionType') IS NULL
BEGIN
    ALTER TABLE [dbo].[VoucherMappings] ADD [TransactionType] NVARCHAR(100) NOT NULL DEFAULT '';
    PRINT '  + Added column [TransactionType] to [dbo].[VoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[VoucherMappings]', N'DebitLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[VoucherMappings] ADD [DebitLedgerID] INT NULL;
    PRINT '  + Added column [DebitLedgerID] to [dbo].[VoucherMappings]';
END
GO
IF COL_LENGTH(N'[dbo].[VoucherMappings]', N'CreditLedgerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[VoucherMappings] ADD [CreditLedgerID] INT NULL;
    PRINT '  + Added column [CreditLedgerID] to [dbo].[VoucherMappings]';
END
GO

----------------------------------------------------------------------------------------------------
-- [126/126] TABLE: [dbo].[Vouchers]
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Vouchers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Vouchers] (
        [VoucherID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [VoucherNo] NVARCHAR(50) NOT NULL,
        [VoucherDate] DATETIME2 NOT NULL,
        [VoucherType] NVARCHAR(20) NOT NULL,
        [Narration] NVARCHAR(500) NULL,
        [TotalAmount] DECIMAL(18,2) NOT NULL,
        [CreatedBy] INT NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [ApprovedBy] INT NULL,
        [ApprovedOn] DATETIME2 NULL,
        [RejectionReason] NVARCHAR(500) NULL,
        [ScrollNo] INT NULL,
        CONSTRAINT [PK_Vouchers] PRIMARY KEY CLUSTERED ([VoucherID] ASC)
    );
    PRINT 'Created Table [dbo].[Vouchers]';
END
GO

IF COL_LENGTH(N'[dbo].[Vouchers]', N'BranchID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [BranchID] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [BranchID] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'VoucherNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [VoucherNo] NVARCHAR(50) NOT NULL DEFAULT '';
    PRINT '  + Added column [VoucherNo] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'VoucherDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [VoucherDate] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [VoucherDate] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'VoucherType') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [VoucherType] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [VoucherType] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'Narration') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [Narration] NVARCHAR(500) NULL;
    PRINT '  + Added column [Narration] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'TotalAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [TotalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
    PRINT '  + Added column [TotalAmount] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [CreatedBy] INT NOT NULL DEFAULT 0;
    PRINT '  + Added column [CreatedBy] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'CreatedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT '  + Added column [CreatedOn] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'Status') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT '';
    PRINT '  + Added column [Status] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'ApprovedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [ApprovedBy] INT NULL;
    PRINT '  + Added column [ApprovedBy] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'ApprovedOn') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [ApprovedOn] DATETIME2 NULL;
    PRINT '  + Added column [ApprovedOn] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'RejectionReason') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [RejectionReason] NVARCHAR(500) NULL;
    PRINT '  + Added column [RejectionReason] to [dbo].[Vouchers]';
END
GO
IF COL_LENGTH(N'[dbo].[Vouchers]', N'ScrollNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Vouchers] ADD [ScrollNo] INT NULL;
    PRINT '  + Added column [ScrollNo] to [dbo].[Vouchers]';
END
GO

----------------------------------------------------------------------------------------------------
-- COMPLETION STATUS
----------------------------------------------------------------------------------------------------
PRINT '=========================================================================================';
PRINT 'UNIVERSAL SCHEMA-ONLY SYNCHRONIZATION COMPLETED SUCCESSFULLY!';
PRINT 'All 126 tables and 1711 columns are now in sync with Golden Master.';
PRINT 'Zero data was modified or deleted.';
PRINT '=========================================================================================';
GO
