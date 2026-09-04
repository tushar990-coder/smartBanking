CREATE TABLE [AccountGroups] (
    [GroupID] int NOT NULL IDENTITY,
    [GroupName] nvarchar(100) NOT NULL,
    [ParentGroupID] int NULL,
    [NatureOfGroup] nvarchar(50) NOT NULL,
    [IsActive] bit NOT NULL,
    [LegacyGroupId] int NULL,
    CONSTRAINT [PK_AccountGroups] PRIMARY KEY ([GroupID]),
    CONSTRAINT [FK_AccountGroups_AccountGroups_ParentGroupID] FOREIGN KEY ([ParentGroupID]) REFERENCES [AccountGroups] ([GroupID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [AuditLogs] (
    [AuditLogID] bigint NOT NULL IDENTITY,
    [UserID] int NULL,
    [Username] nvarchar(100) NOT NULL,
    [Action] nvarchar(100) NOT NULL,
    [EntityName] nvarchar(100) NOT NULL,
    [EntityID] nvarchar(50) NULL,
    [Timestamp] datetime2 NOT NULL,
    [IPAddress] nvarchar(50) NULL,
    [Details] nvarchar(max) NULL,
    [Status] nvarchar(20) NOT NULL,
    CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([AuditLogID])
);
GO


CREATE TABLE [Branches] (
    [BranchID] int NOT NULL IDENTITY,
    [BranchCode] nvarchar(10) NOT NULL,
    [BranchName] nvarchar(100) NOT NULL,
    [Address] nvarchar(200) NULL,
    [IFSCCode] nvarchar(20) NULL,
    [BranchType] nvarchar(20) NOT NULL,
    [MobileNo] nvarchar(15) NULL,
    [Email] nvarchar(100) NULL,
    [IsActive] bit NOT NULL,
    CONSTRAINT [PK_Branches] PRIMARY KEY ([BranchID])
);
GO


CREATE TABLE [BranchMasters] (
    [BranchID] int NOT NULL IDENTITY,
    [BranchCode] nvarchar(20) NOT NULL,
    [BranchName] nvarchar(100) NOT NULL,
    [BranchType] nvarchar(20) NOT NULL,
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
    CONSTRAINT [PK_BranchMasters] PRIMARY KEY ([BranchID])
);
GO


CREATE TABLE [DepartmentMasters] (
    [DepartmentID] int NOT NULL IDENTITY,
    [DepartmentCode] nvarchar(20) NOT NULL,
    [DepartmentName] nvarchar(100) NOT NULL,
    [Description] nvarchar(255) NULL,
    [Status] bit NOT NULL,
    [CreatedBy] int NULL,
    [CreatedDate] datetime2 NULL,
    [ModifiedBy] int NULL,
    [ModifiedDate] datetime2 NULL,
    CONSTRAINT [PK_DepartmentMasters] PRIMARY KEY ([DepartmentID])
);
GO


CREATE TABLE [EmployerMasters] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(200) NOT NULL,
    [ContactNo] nvarchar(50) NULL,
    [Address] nvarchar(500) NULL,
    [LegacyTypeId] int NULL,
    [IsActive] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_EmployerMasters] PRIMARY KEY ([Id])
);
GO


CREATE TABLE [FinancialYears] (
    [FinancialYearID] int NOT NULL IDENTITY,
    [YearCode] nvarchar(50) NOT NULL,
    [StartDate] datetime2 NOT NULL,
    [EndDate] datetime2 NOT NULL,
    [IsActive] bit NOT NULL,
    [IsClosed] bit NOT NULL,
    CONSTRAINT [PK_FinancialYears] PRIMARY KEY ([FinancialYearID])
);
GO


CREATE TABLE [LoanRates] (
    [LoanRateID] int NOT NULL IDENTITY,
    [LoanType] nvarchar(100) NOT NULL,
    [LoanCode] nvarchar(50) NOT NULL,
    [LoanLedgerID] int NULL,
    [InterestLedgerID] int NULL,
    [OverdueInterestLedgerID] int NULL,
    [ReceivableInterestLedgerID] int NULL,
    [SurchargeLedgerID] int NULL,
    [RecoveryFeeLedgerID] int NULL,
    [ProcessingFeeLedgerID] int NULL,
    [InterestRate] decimal(18,2) NOT NULL,
    [OverdueInterestRate] decimal(18,2) NOT NULL,
    [InterestPostingType] nvarchar(100) NOT NULL,
    [InterestPostingFrequency] nvarchar(100) NOT NULL,
    [InterestCalculationMethod] nvarchar(100) NOT NULL,
    [ShortName] nvarchar(100) NOT NULL,
    [DurationMonths] int NOT NULL,
    [InstallmentType] nvarchar(100) NOT NULL,
    [InstallmentCount] int NOT NULL,
    [LoanInstallmentType] nvarchar(100) NOT NULL,
    [SecurityType] nvarchar(100) NOT NULL,
    [IsCcOrOd] bit NOT NULL,
    [IsActive] bit NOT NULL,
    CONSTRAINT [PK_LoanRates] PRIMARY KEY ([LoanRateID])
);
GO


CREATE TABLE [NpaClassificationRuns] (
    [NpaClassificationRunID] int NOT NULL IDENTITY,
    [RunDate] datetime2 NOT NULL,
    [TriggeredBy] nvarchar(100) NOT NULL,
    [RecordsProcessed] int NOT NULL,
    [Status] nvarchar(50) NOT NULL,
    [Remarks] nvarchar(500) NULL,
    CONSTRAINT [PK_NpaClassificationRuns] PRIMARY KEY ([NpaClassificationRunID])
);
GO


CREATE TABLE [NpaConfigs] (
    [FinancialYear] nvarchar(10) NOT NULL,
    [ConcessionPeriodDays] int NOT NULL,
    CONSTRAINT [PK_NpaConfigs] PRIMARY KEY ([FinancialYear])
);
GO


CREATE TABLE [NpaProvisionSlabs] (
    [NpaProvisionSlabID] int NOT NULL IDENTITY,
    [FinancialYear] nvarchar(10) NOT NULL,
    [Category] nvarchar(50) NOT NULL,
    [SecurityType] nvarchar(20) NOT NULL,
    [OverdueOrOutOfOrderMonthsFrom] decimal(18,2) NOT NULL,
    [OverdueOrOutOfOrderMonthsTo] decimal(18,2) NOT NULL,
    [NpaMonthsFrom] decimal(18,2) NOT NULL,
    [NpaMonthsTo] decimal(18,2) NOT NULL,
    [MinProvisionPercent] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_NpaProvisionSlabs] PRIMARY KEY ([NpaProvisionSlabID])
);
GO


CREATE TABLE [PigmyAccountSequences] (
    [ID] int NOT NULL IDENTITY,
    [BranchID] int NOT NULL,
    [LastSequenceNumber] int NOT NULL,
    CONSTRAINT [PK_PigmyAccountSequences] PRIMARY KEY ([ID])
);
GO


CREATE TABLE [PigmyAgents] (
    [PigmyAgentID] int NOT NULL IDENTITY,
    [AgentName] nvarchar(100) NOT NULL,
    [MobileNo] nvarchar(15) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_PigmyAgents] PRIMARY KEY ([PigmyAgentID])
);
GO


CREATE TABLE [PigmySchemes] (
    [PigmySchemeID] int NOT NULL IDENTITY,
    [SchemeName] nvarchar(100) NOT NULL,
    [InterestRate] decimal(5,2) NOT NULL,
    [DurationMonths] int NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_PigmySchemes] PRIMARY KEY ([PigmySchemeID])
);
GO


CREATE TABLE [RolePermissions] (
    [RolePermissionID] int NOT NULL IDENTITY,
    [RoleID] int NOT NULL,
    [ModuleCode] nvarchar(50) NOT NULL,
    [CanView] bit NOT NULL,
    [CanAdd] bit NOT NULL,
    [CanEdit] bit NOT NULL,
    [CanDelete] bit NOT NULL,
    [CanPrint] bit NOT NULL,
    [CanApprove] bit NOT NULL,
    [ScopeLevel] nvarchar(20) NOT NULL,
    CONSTRAINT [PK_RolePermissions] PRIMARY KEY ([RolePermissionID])
);
GO


CREATE TABLE [Roles] (
    [RoleID] int NOT NULL IDENTITY,
    [RoleCode] nvarchar(30) NOT NULL,
    [RoleName] nvarchar(100) NOT NULL,
    [Description] nvarchar(250) NULL,
    [IsSystemRole] bit NOT NULL,
    [Status] bit NOT NULL,
    CONSTRAINT [PK_Roles] PRIMARY KEY ([RoleID])
);
GO


CREATE TABLE [SansthaDetails] (
    [SansthaID] int NOT NULL IDENTITY,
    [SansthaName] nvarchar(200) NOT NULL,
    [Address] nvarchar(500) NULL,
    [Village] nvarchar(100) NULL,
    [Taluka] nvarchar(100) NULL,
    [District] nvarchar(100) NULL,
    [State] nvarchar(100) NULL,
    [PinCode] nvarchar(20) NULL,
    [ContactNo] nvarchar(20) NULL,
    [Email] nvarchar(100) NULL,
    [RegistrationNo] nvarchar(50) NULL,
    [RegistrationDate] datetime2 NULL,
    [GSTNo] nvarchar(50) NULL,
    [LogoPath] nvarchar(500) NULL,
    [IsMigrationLocked] bit NOT NULL,
    [AutoPostVouchers] bit NOT NULL,
    [AutoPostVoucherLimit] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_SansthaDetails] PRIMARY KEY ([SansthaID])
);
GO


CREATE TABLE [SecurityTypes] (
    [SecurityTypeID] int NOT NULL IDENTITY,
    [Name] nvarchar(100) NOT NULL,
    [IsActive] bit NOT NULL,
    CONSTRAINT [PK_SecurityTypes] PRIMARY KEY ([SecurityTypeID])
);
GO


CREATE TABLE [Ledgers] (
    [LedgerID] int NOT NULL IDENTITY,
    [LedgerName] nvarchar(100) NOT NULL,
    [GroupID] int NOT NULL,
    [OpeningBalance] decimal(18,2) NOT NULL,
    [OpeningBalanceType] nvarchar(2) NOT NULL,
    [ReportType] nvarchar(100) NULL,
    [AccountType] nvarchar(100) NULL,
    [ExcludeFromRule35Swanidhi] bit NOT NULL,
    [IsActive] bit NOT NULL,
    [LegacyLedgerId] int NULL,
    CONSTRAINT [PK_Ledgers] PRIMARY KEY ([LedgerID]),
    CONSTRAINT [FK_Ledgers_AccountGroups_GroupID] FOREIGN KEY ([GroupID]) REFERENCES [AccountGroups] ([GroupID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [BranchDayEndStatuses] (
    [StatusID] int NOT NULL IDENTITY,
    [BranchID] int NOT NULL,
    [BusinessDate] datetime2 NOT NULL,
    [IsDayClosed] bit NOT NULL,
    CONSTRAINT [PK_BranchDayEndStatuses] PRIMARY KEY ([StatusID]),
    CONSTRAINT [FK_BranchDayEndStatuses_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [EodBatchProcessLogs] (
    [LogID] bigint NOT NULL IDENTITY,
    [BranchID] int NOT NULL,
    [BusinessDate] datetime2 NOT NULL,
    [StepNumber] int NOT NULL,
    [StepName] nvarchar(100) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [RecordsProcessed] int NOT NULL,
    [ErrorMessage] nvarchar(max) NULL,
    [StartTime] datetime2 NOT NULL,
    [EndTime] datetime2 NULL,
    CONSTRAINT [PK_EodBatchProcessLogs] PRIMARY KEY ([LogID]),
    CONSTRAINT [FK_EodBatchProcessLogs_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [FdAccountSequences] (
    [SequenceID] int NOT NULL IDENTITY,
    [BranchID] int NOT NULL,
    [ProductType] nvarchar(10) NOT NULL,
    [CurrentValue] int NOT NULL,
    CONSTRAINT [PK_FdAccountSequences] PRIMARY KEY ([SequenceID]),
    CONSTRAINT [FK_FdAccountSequences_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [FdSchemes] (
    [FdSchemeID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [SchemeCode] nvarchar(20) NOT NULL,
    [SchemeName] nvarchar(100) NOT NULL,
    [DurationMonths] int NOT NULL,
    [InterestRate] decimal(5,2) NOT NULL,
    [SeniorCitizenInterestRate] decimal(5,2) NOT NULL,
    [InterestType] nvarchar(20) NOT NULL,
    [InterestPostingMethod] nvarchar(20) NOT NULL,
    [InterestCompoundingFrequency] nvarchar(20) NOT NULL,
    [MinimumAmount] decimal(18,2) NOT NULL,
    [MaximumAmount] decimal(18,2) NOT NULL,
    [PrematureInterestRate] decimal(5,2) NOT NULL,
    [EffectiveDate] datetime2 NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    [ModifiedBy] int NULL,
    [ModifiedDate] datetime2 NULL,
    CONSTRAINT [PK_FdSchemes] PRIMARY KEY ([FdSchemeID]),
    CONSTRAINT [FK_FdSchemes_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [InvestmentAccountSequences] (
    [SequenceID] int NOT NULL IDENTITY,
    [BranchID] int NOT NULL,
    [ProductType] nvarchar(10) NOT NULL,
    [CurrentValue] int NOT NULL,
    CONSTRAINT [PK_InvestmentAccountSequences] PRIMARY KEY ([SequenceID]),
    CONSTRAINT [FK_InvestmentAccountSequences_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [InvestmentInstitutions] (
    [InstitutionID] int NOT NULL IDENTITY,
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
    CONSTRAINT [PK_InvestmentInstitutions] PRIMARY KEY ([InstitutionID]),
    CONSTRAINT [FK_InvestmentInstitutions_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [InvestmentVoucherMappings] (
    [MappingID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [InvestmentType] nvarchar(50) NOT NULL,
    [InvestmentLedgerID] int NOT NULL,
    [InterestIncomeLedgerID] int NOT NULL,
    [InterestReceivableLedgerID] int NOT NULL,
    CONSTRAINT [PK_InvestmentVoucherMappings] PRIMARY KEY ([MappingID]),
    CONSTRAINT [FK_InvestmentVoucherMappings_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [RdAccountSequences] (
    [SequenceID] int NOT NULL IDENTITY,
    [BranchID] int NOT NULL,
    [ProductType] nvarchar(10) NOT NULL,
    [CurrentValue] int NOT NULL,
    CONSTRAINT [PK_RdAccountSequences] PRIMARY KEY ([SequenceID]),
    CONSTRAINT [FK_RdAccountSequences_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [RdSchemes] (
    [RdSchemeID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [SchemeCode] nvarchar(20) NOT NULL,
    [SchemeName] nvarchar(100) NOT NULL,
    [DurationMonths] int NOT NULL,
    [InstallmentAmount] decimal(18,2) NOT NULL,
    [MinimumInstallment] decimal(18,2) NOT NULL,
    [MaximumInstallment] decimal(18,2) NOT NULL,
    [InterestRate] decimal(5,2) NOT NULL,
    [InterestMethod] nvarchar(20) NOT NULL,
    [PenaltyAmount] decimal(18,2) NOT NULL,
    [EffectiveDate] datetime2 NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    [ModifiedBy] int NULL,
    [ModifiedDate] datetime2 NULL,
    CONSTRAINT [PK_RdSchemes] PRIMARY KEY ([RdSchemeID]),
    CONSTRAINT [FK_RdSchemes_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Vouchers] (
    [VoucherID] int NOT NULL IDENTITY,
    [BranchID] int NOT NULL,
    [VoucherNo] nvarchar(50) NOT NULL,
    [VoucherDate] datetime2 NOT NULL,
    [VoucherType] nvarchar(20) NOT NULL,
    [Narration] nvarchar(500) NULL,
    [TotalAmount] decimal(18,2) NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [ApprovedBy] int NULL,
    [ApprovedOn] datetime2 NULL,
    [RejectionReason] nvarchar(500) NULL,
    CONSTRAINT [PK_Vouchers] PRIMARY KEY ([VoucherID]),
    CONSTRAINT [FK_Vouchers_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [EmployeeBankDetails] (
    [EmployeeBankDetailID] int NOT NULL IDENTITY,
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
    CONSTRAINT [PK_EmployeeBankDetails] PRIMARY KEY ([EmployeeBankDetailID]),
    CONSTRAINT [FK_EmployeeBankDetails_BranchMasters_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [BranchMasters] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_EmployeeBankDetails_DepartmentMasters_DepartmentID] FOREIGN KEY ([DepartmentID]) REFERENCES [DepartmentMasters] ([DepartmentID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [DemandNotices] (
    [DemandNoticeId] int NOT NULL IDENTITY,
    [NoticeNumber] nvarchar(50) NOT NULL,
    [Month] int NOT NULL,
    [Year] int NOT NULL,
    [EmployerId] int NOT NULL,
    [BranchId] int NOT NULL,
    [TotalDemandAmount] decimal(18,2) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    [CreatedBy] int NOT NULL,
    CONSTRAINT [PK_DemandNotices] PRIMARY KEY ([DemandNoticeId]),
    CONSTRAINT [FK_DemandNotices_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DemandNotices_EmployerMasters_EmployerId] FOREIGN KEY ([EmployerId]) REFERENCES [EmployerMasters] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Members] (
    [MemberID] int NOT NULL IDENTITY,
    [BranchID] int NOT NULL,
    [MemberCode] nvarchar(20) NULL,
    [OldMemberCode] nvarchar(20) NULL,
    [CIFNo] nvarchar(20) NULL,
    [FirstName] nvarchar(50) NOT NULL,
    [MiddleName] nvarchar(50) NULL,
    [LastName] nvarchar(50) NOT NULL,
    [FirstNameEng] nvarchar(50) NULL,
    [MiddleNameEng] nvarchar(50) NULL,
    [LastNameEng] nvarchar(50) NULL,
    [Address] nvarchar(500) NULL,
    [AddressEng] nvarchar(500) NULL,
    [Village] nvarchar(100) NULL,
    [Taluka] nvarchar(100) NULL,
    [District] nvarchar(100) NULL,
    [MobileNo] nvarchar(15) NOT NULL,
    [AadhaarNo] nvarchar(12) NOT NULL,
    [PANNo] nvarchar(10) NULL,
    [JoiningDate] datetime2 NOT NULL,
    [NomineeName] nvarchar(150) NULL,
    [NomineeNameEng] nvarchar(150) NULL,
    [NomineeRelation] nvarchar(50) NULL,
    [PhotoPath] nvarchar(max) NULL,
    [Gender] nvarchar(10) NULL,
    [BirthDate] datetime2 NULL,
    [Occupation] nvarchar(100) NULL,
    [CasteCategory] nvarchar(50) NULL,
    [Caste] nvarchar(100) NULL,
    [Email] nvarchar(150) NULL,
    [IsMinor] bit NOT NULL,
    [GuardianName] nvarchar(150) NULL,
    [GuardianNameEng] nvarchar(150) NULL,
    [GuardianRelation] nvarchar(50) NULL,
    [GuardianAadhaarNo] nvarchar(12) NULL,
    [GuardianMobileNo] nvarchar(15) NULL,
    [GuardianAddress] nvarchar(500) NULL,
    [SignaturePath] nvarchar(max) NULL,
    [Status] nvarchar(20) NOT NULL,
    [LegacyMemberId] int NULL,
    [LegacyMemberNo] nvarchar(50) NULL,
    [EmployerId] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [UpdatedBy] int NULL,
    [UpdatedOn] datetime2 NULL,
    CONSTRAINT [PK_Members] PRIMARY KEY ([MemberID]),
    CONSTRAINT [FK_Members_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Members_EmployerMasters_EmployerId] FOREIGN KEY ([EmployerId]) REFERENCES [EmployerMasters] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [AssetCategories] (
    [CategoryID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [CategoryCode] nvarchar(20) NOT NULL,
    [CategoryName] nvarchar(100) NOT NULL,
    [UsefulLifeMonths] int NOT NULL,
    [DepreciationRate] decimal(5,2) NOT NULL,
    [DepreciationMethod] nvarchar(10) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [UpdatedBy] int NULL,
    [UpdatedOn] datetime2 NULL,
    CONSTRAINT [PK_AssetCategories] PRIMARY KEY ([CategoryID]),
    CONSTRAINT [FK_AssetCategories_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetCategories_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SavingInterestPostings] (
    [PostingID] int NOT NULL IDENTITY,
    [FinancialYearID] int NOT NULL,
    [PeriodStart] datetime2 NOT NULL,
    [PeriodEnd] datetime2 NOT NULL,
    [TotalInterest] decimal(18,2) NOT NULL,
    [VoucherNo] nvarchar(50) NULL,
    [PostedOn] datetime2 NOT NULL,
    [PostedBy] int NOT NULL,
    CONSTRAINT [PK_SavingInterestPostings] PRIMARY KEY ([PostingID]),
    CONSTRAINT [FK_SavingInterestPostings_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PigmyCommissionSettings] (
    [SettingId] int NOT NULL IDENTITY,
    [AgentId] int NULL,
    [CommissionType] nvarchar(20) NOT NULL,
    [CommissionValue] decimal(5,2) NOT NULL,
    [CalculationFrequency] nvarchar(20) NOT NULL,
    [EffectiveFrom] datetime2 NOT NULL,
    [EffectiveTo] datetime2 NULL,
    [IsActive] bit NOT NULL,
    CONSTRAINT [PK_PigmyCommissionSettings] PRIMARY KEY ([SettingId]),
    CONSTRAINT [FK_PigmyCommissionSettings_PigmyAgents_AgentId] FOREIGN KEY ([AgentId]) REFERENCES [PigmyAgents] ([PigmyAgentID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Users] (
    [UserID] int NOT NULL IDENTITY,
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
    [ActiveSessionToken] nvarchar(255) NULL,
    [Email] nvarchar(100) NULL,
    [MobileNumber] nvarchar(20) NULL,
    CONSTRAINT [PK_Users] PRIMARY KEY ([UserID]),
    CONSTRAINT [FK_Users_Branches_DefaultBranchID] FOREIGN KEY ([DefaultBranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Users_Roles_RoleID] FOREIGN KEY ([RoleID]) REFERENCES [Roles] ([RoleID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PigmyVoucherMappings] (
    [MappingId] int NOT NULL IDENTITY,
    [BranchId] int NOT NULL,
    [CollectionSource] nvarchar(20) NOT NULL,
    [DebitLedgerId] int NOT NULL,
    [CreditLedgerId] int NOT NULL,
    [IsActive] bit NOT NULL,
    CONSTRAINT [PK_PigmyVoucherMappings] PRIMARY KEY ([MappingId]),
    CONSTRAINT [FK_PigmyVoucherMappings_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PigmyVoucherMappings_Ledgers_CreditLedgerId] FOREIGN KEY ([CreditLedgerId]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PigmyVoucherMappings_Ledgers_DebitLedgerId] FOREIGN KEY ([DebitLedgerId]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SavingInterestSettings] (
    [SettingID] int NOT NULL IDENTITY,
    [InterestRate] decimal(5,2) NOT NULL,
    [CalculationMethod] nvarchar(50) NOT NULL,
    [PostingFrequency] nvarchar(20) NOT NULL,
    [EffectiveDate] datetime2 NOT NULL,
    [LedgerID] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_SavingInterestSettings] PRIMARY KEY ([SettingID]),
    CONSTRAINT [FK_SavingInterestSettings_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SavingVoucherMappings] (
    [MappingID] int NOT NULL IDENTITY,
    [OperationType] nvarchar(50) NOT NULL,
    [LedgerID] int NOT NULL,
    [Description] nvarchar(255) NULL,
    CONSTRAINT [PK_SavingVoucherMappings] PRIMARY KEY ([MappingID]),
    CONSTRAINT [FK_SavingVoucherMappings_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [VoucherMappings] (
    [MappingID] int NOT NULL IDENTITY,
    [TransactionType] nvarchar(100) NOT NULL,
    [DebitLedgerID] int NULL,
    [CreditLedgerID] int NULL,
    CONSTRAINT [PK_VoucherMappings] PRIMARY KEY ([MappingID]),
    CONSTRAINT [FK_VoucherMappings_Ledgers_CreditLedgerID] FOREIGN KEY ([CreditLedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_VoucherMappings_Ledgers_DebitLedgerID] FOREIGN KEY ([DebitLedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [InvestmentSchemes] (
    [SchemeID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [InvestmentInstitutionID] int NOT NULL,
    [SchemeCode] nvarchar(20) NOT NULL,
    [SchemeName] nvarchar(100) NOT NULL,
    [InterestRate] decimal(5,2) NOT NULL,
    [DurationMonths] int NOT NULL,
    [InterestCalculationMethod] nvarchar(50) NOT NULL,
    [PrematureWithdrawalRate] decimal(5,2) NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    [ModifiedBy] int NULL,
    [ModifiedDate] datetime2 NULL,
    CONSTRAINT [PK_InvestmentSchemes] PRIMARY KEY ([SchemeID]),
    CONSTRAINT [FK_InvestmentSchemes_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentSchemes_InvestmentInstitutions_InvestmentInstitutionID] FOREIGN KEY ([InvestmentInstitutionID]) REFERENCES [InvestmentInstitutions] ([InstitutionID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [AssetPurchases] (
    [PurchaseID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [SupplierName] nvarchar(150) NOT NULL,
    [InvoiceNo] nvarchar(50) NOT NULL,
    [InvoiceDate] datetime2 NOT NULL,
    [TaxableAmount] decimal(18,2) NOT NULL,
    [GstAmount] decimal(18,2) NOT NULL,
    [TotalAmount] decimal(18,2) NOT NULL,
    [PaymentMode] nvarchar(30) NOT NULL,
    [BankLedgerID] int NULL,
    [VoucherID] int NULL,
    [AssetIdsJson] nvarchar(max) NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [UpdatedBy] int NULL,
    [UpdatedOn] datetime2 NULL,
    CONSTRAINT [PK_AssetPurchases] PRIMARY KEY ([PurchaseID]),
    CONSTRAINT [FK_AssetPurchases_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetPurchases_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetPurchases_Ledgers_BankLedgerID] FOREIGN KEY ([BankLedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetPurchases_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PigmyAgentCashDeposits] (
    [DepositId] int NOT NULL IDENTITY,
    [AgentId] int NOT NULL,
    [DepositDate] datetime2 NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    [ReceiptNo] nvarchar(50) NOT NULL,
    [Narration] nvarchar(255) NULL,
    [VoucherId] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_PigmyAgentCashDeposits] PRIMARY KEY ([DepositId]),
    CONSTRAINT [FK_PigmyAgentCashDeposits_PigmyAgents_AgentId] FOREIGN KEY ([AgentId]) REFERENCES [PigmyAgents] ([PigmyAgentID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PigmyAgentCashDeposits_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PigmyAgentCommissions] (
    [CommissionId] int NOT NULL IDENTITY,
    [AgentId] int NOT NULL,
    [CalculationFrequency] nvarchar(20) NOT NULL,
    [PeriodStartDate] datetime2 NOT NULL,
    [PeriodEndDate] datetime2 NOT NULL,
    [TotalCollectionAmount] decimal(18,2) NOT NULL,
    [CalculatedCommission] decimal(18,2) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [VoucherId] int NULL,
    [CalculatedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_PigmyAgentCommissions] PRIMARY KEY ([CommissionId]),
    CONSTRAINT [FK_PigmyAgentCommissions_PigmyAgents_AgentId] FOREIGN KEY ([AgentId]) REFERENCES [PigmyAgents] ([PigmyAgentID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PigmyAgentCommissions_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [DemandRecoveries] (
    [DemandRecoveryId] int NOT NULL IDENTITY,
    [DemandNoticeId] int NOT NULL,
    [RecoveryDate] datetime2 NOT NULL,
    [TotalReceivedAmount] decimal(18,2) NOT NULL,
    [VoucherId] int NULL,
    [Remarks] nvarchar(250) NULL,
    [CreatedDate] datetime2 NOT NULL,
    [CreatedBy] int NOT NULL,
    CONSTRAINT [PK_DemandRecoveries] PRIMARY KEY ([DemandRecoveryId]),
    CONSTRAINT [FK_DemandRecoveries_DemandNotices_DemandNoticeId] FOREIGN KEY ([DemandNoticeId]) REFERENCES [DemandNotices] ([DemandNoticeId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DemandRecoveries_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [BorrowerLinkedAccounts] (
    [BorrowerLinkedAccountID] int NOT NULL IDENTITY,
    [ParentMemberID] int NOT NULL,
    [LinkedMemberID] int NOT NULL,
    [LinkType] nvarchar(50) NOT NULL,
    [Remarks] nvarchar(250) NULL,
    CONSTRAINT [PK_BorrowerLinkedAccounts] PRIMARY KEY ([BorrowerLinkedAccountID]),
    CONSTRAINT [FK_BorrowerLinkedAccounts_Members_LinkedMemberID] FOREIGN KEY ([LinkedMemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_BorrowerLinkedAccounts_Members_ParentMemberID] FOREIGN KEY ([ParentMemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [CommitteeMembers] (
    [CommitteeMemberID] int NOT NULL IDENTITY,
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
    CONSTRAINT [PK_CommitteeMembers] PRIMARY KEY ([CommitteeMemberID]),
    CONSTRAINT [FK_CommitteeMembers_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [DemandMemberDetails] (
    [DemandMemberDetailId] int NOT NULL IDENTITY,
    [DemandNoticeId] int NOT NULL,
    [MemberId] int NOT NULL,
    [LoanInstallment] decimal(18,2) NOT NULL,
    [SavingDeposit] decimal(18,2) NOT NULL,
    [ShareDeposit] decimal(18,2) NOT NULL,
    [PigmyDeposit] decimal(18,2) NOT NULL,
    [RdDeposit] decimal(18,2) NOT NULL,
    [TotalDeduction] decimal(18,2) NOT NULL,
    [IsProcessed] bit NOT NULL,
    CONSTRAINT [PK_DemandMemberDetails] PRIMARY KEY ([DemandMemberDetailId]),
    CONSTRAINT [FK_DemandMemberDetails_DemandNotices_DemandNoticeId] FOREIGN KEY ([DemandNoticeId]) REFERENCES [DemandNotices] ([DemandNoticeId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DemandMemberDetails_Members_MemberId] FOREIGN KEY ([MemberId]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [FdAccounts] (
    [FdAccountID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [MemberID] int NOT NULL,
    [FdSchemeID] int NOT NULL,
    [AccountNo] nvarchar(30) NOT NULL,
    [OpeningDate] datetime2 NOT NULL,
    [DepositAmount] decimal(18,2) NOT NULL,
    [InterestRate] decimal(5,2) NOT NULL,
    [MaturityDate] datetime2 NOT NULL,
    [MaturityAmount] decimal(18,2) NOT NULL,
    [IsLegacyAccount] bit NOT NULL,
    [LegacyAccruedInt] decimal(18,2) NOT NULL,
    [LegacyAccountId] int NULL,
    [LegacyAccountNumber] nvarchar(50) NULL,
    [Status] nvarchar(20) NOT NULL,
    [NomineeName] nvarchar(100) NULL,
    [NomineeRelation] nvarchar(50) NULL,
    [Remarks] nvarchar(250) NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    [ModifiedBy] int NULL,
    [ModifiedDate] datetime2 NULL,
    CONSTRAINT [PK_FdAccounts] PRIMARY KEY ([FdAccountID]),
    CONSTRAINT [FK_FdAccounts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_FdAccounts_FdSchemes_FdSchemeID] FOREIGN KEY ([FdSchemeID]) REFERENCES [FdSchemes] ([FdSchemeID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_FdAccounts_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_FdAccounts_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LoanApplications] (
    [LoanApplicationID] int NOT NULL IDENTITY,
    [ApplicationNo] nvarchar(50) NOT NULL,
    [ApplicationDate] datetime2 NOT NULL,
    [MemberID] int NOT NULL,
    [CoMemberID] int NULL,
    [CoMember2ID] int NULL,
    [LoanRateID] int NOT NULL,
    [RequestedAmount] decimal(18,2) NOT NULL,
    [InterestRate] decimal(18,2) NOT NULL,
    [DurationMonths] int NOT NULL,
    [InstallmentFrequency] nvarchar(50) NOT NULL,
    [InstallmentAmount] decimal(18,2) NOT NULL,
    [NoOfInstallments] int NOT NULL,
    [FirstInstallmentDate] datetime2 NULL,
    [MaturityDate] datetime2 NULL,
    [RecommendedByDirectorID] int NULL,
    [Purpose] nvarchar(200) NULL,
    [Guarantor1MemberID] int NULL,
    [Guarantor2MemberID] int NULL,
    [SecurityDetails] nvarchar(500) NULL,
    [SecurityValue] decimal(18,2) NOT NULL,
    [LoanAccountNo] nvarchar(50) NULL,
    CONSTRAINT [PK_LoanApplications] PRIMARY KEY ([LoanApplicationID]),
    CONSTRAINT [FK_LoanApplications_LoanRates_LoanRateID] FOREIGN KEY ([LoanRateID]) REFERENCES [LoanRates] ([LoanRateID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanApplications_Members_CoMember2ID] FOREIGN KEY ([CoMember2ID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanApplications_Members_CoMemberID] FOREIGN KEY ([CoMemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanApplications_Members_Guarantor1MemberID] FOREIGN KEY ([Guarantor1MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanApplications_Members_Guarantor2MemberID] FOREIGN KEY ([Guarantor2MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanApplications_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanApplications_Members_RecommendedByDirectorID] FOREIGN KEY ([RecommendedByDirectorID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [MemberOpeningBalances] (
    [MemberOpeningBalanceID] int NOT NULL IDENTITY,
    [MemberID] int NOT NULL,
    [LedgerID] int NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    [BalanceType] nvarchar(2) NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [UpdatedBy] int NULL,
    [UpdatedOn] datetime2 NULL,
    CONSTRAINT [PK_MemberOpeningBalances] PRIMARY KEY ([MemberOpeningBalanceID]),
    CONSTRAINT [FK_MemberOpeningBalances_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_MemberOpeningBalances_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PigmyAccounts] (
    [PigmyAccountID] int NOT NULL IDENTITY,
    [AccountNo] nvarchar(30) NOT NULL,
    [MemberID] int NOT NULL,
    [BranchID] int NOT NULL,
    [PigmySchemeID] int NOT NULL,
    [PigmyAgentID] int NOT NULL,
    [OpeningDate] datetime2 NOT NULL,
    [InterestRate] decimal(5,2) NOT NULL,
    [MaturityDate] datetime2 NOT NULL,
    [TotalDepositedAmount] decimal(18,2) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [LegacyAccountId] int NULL,
    [LegacyAccountNumber] nvarchar(50) NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_PigmyAccounts] PRIMARY KEY ([PigmyAccountID]),
    CONSTRAINT [FK_PigmyAccounts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PigmyAccounts_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PigmyAccounts_PigmyAgents_PigmyAgentID] FOREIGN KEY ([PigmyAgentID]) REFERENCES [PigmyAgents] ([PigmyAgentID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PigmyAccounts_PigmySchemes_PigmySchemeID] FOREIGN KEY ([PigmySchemeID]) REFERENCES [PigmySchemes] ([PigmySchemeID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [RdAccounts] (
    [RdAccountID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [MemberID] int NOT NULL,
    [RdSchemeID] int NOT NULL,
    [AccountNo] nvarchar(30) NOT NULL,
    [OpeningDate] datetime2 NOT NULL,
    [InstallmentAmount] decimal(18,2) NOT NULL,
    [DurationMonths] int NOT NULL,
    [InterestRate] decimal(5,2) NOT NULL,
    [MaturityDate] datetime2 NOT NULL,
    [MaturityAmount] decimal(18,2) NOT NULL,
    [TotalPaidInstallments] int NOT NULL,
    [TotalDepositedAmount] decimal(18,2) NOT NULL,
    [IsLegacyAccount] bit NOT NULL,
    [LegacyAccruedInt] decimal(18,2) NOT NULL,
    [LegacyAccountId] int NULL,
    [LegacyAccountNumber] nvarchar(50) NULL,
    [Status] nvarchar(20) NOT NULL,
    [NomineeName] nvarchar(100) NULL,
    [NomineeRelation] nvarchar(50) NULL,
    [Remarks] nvarchar(250) NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    [ModifiedBy] int NULL,
    [ModifiedDate] datetime2 NULL,
    CONSTRAINT [PK_RdAccounts] PRIMARY KEY ([RdAccountID]),
    CONSTRAINT [FK_RdAccounts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_RdAccounts_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_RdAccounts_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_RdAccounts_RdSchemes_RdSchemeID] FOREIGN KEY ([RdSchemeID]) REFERENCES [RdSchemes] ([RdSchemeID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SavingAccountMasters] (
    [SavingAccountID] int NOT NULL IDENTITY,
    [BranchID] int NOT NULL,
    [AccountNo] nvarchar(20) NOT NULL,
    [MemberID] int NOT NULL,
    [AccountType] nvarchar(20) NOT NULL,
    [OpeningDate] datetime2 NOT NULL,
    [IsLegacyAccount] bit NOT NULL,
    [LegacyAccountId] int NULL,
    [LegacyAccountNumber] nvarchar(50) NULL,
    [LedgerID] int NOT NULL,
    [OpeningBalance] decimal(18,2) NOT NULL,
    [CurrentBalance] decimal(18,2) NOT NULL,
    [InterestRate] decimal(5,2) NOT NULL,
    [MinimumBalance] decimal(18,2) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [ClosingDate] datetime2 NULL,
    [NomineeName] nvarchar(150) NULL,
    [NomineeRelation] nvarchar(50) NULL,
    [NomineeAddress] nvarchar(500) NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [UpdatedBy] int NULL,
    [UpdatedOn] datetime2 NULL,
    CONSTRAINT [PK_SavingAccountMasters] PRIMARY KEY ([SavingAccountID]),
    CONSTRAINT [FK_SavingAccountMasters_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SavingAccountMasters_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SavingAccountMasters_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [ShareAccounts] (
    [ShareAccountId] int NOT NULL IDENTITY,
    [AccountNo] nvarchar(20) NOT NULL,
    [MemberId] int NOT NULL,
    [TotalShareAmount] decimal(18,2) NOT NULL,
    [TotalShareCount] int NOT NULL,
    [DividendPayableBalance] decimal(18,2) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [OpeningDate] datetime2 NOT NULL,
    [LegacyAccountId] int NULL,
    [LegacyAccountNumber] nvarchar(50) NULL,
    CONSTRAINT [PK_ShareAccounts] PRIMARY KEY ([ShareAccountId]),
    CONSTRAINT [FK_ShareAccounts_Members_MemberId] FOREIGN KEY ([MemberId]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [VoucherDetails] (
    [VoucherDetailID] int NOT NULL IDENTITY,
    [VoucherID] int NOT NULL,
    [LedgerID] int NOT NULL,
    [MemberID] int NULL,
    [DrCr] nvarchar(2) NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_VoucherDetails] PRIMARY KEY ([VoucherDetailID]),
    CONSTRAINT [FK_VoucherDetails_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_VoucherDetails_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_VoucherDetails_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Assets] (
    [AssetID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [CategoryID] int NOT NULL,
    [AssetCode] nvarchar(30) NOT NULL,
    [AssetName] nvarchar(150) NOT NULL,
    [PurchaseDate] datetime2 NOT NULL,
    [OriginalCost] decimal(18,2) NOT NULL,
    [AccumulatedDepreciation] decimal(18,2) NOT NULL,
    [CurrentBookValue] decimal(18,2) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [Location] nvarchar(100) NULL,
    [Custodian] nvarchar(100) NULL,
    [IsOpeningBalance] bit NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [UpdatedBy] int NULL,
    [UpdatedOn] datetime2 NULL,
    CONSTRAINT [PK_Assets] PRIMARY KEY ([AssetID]),
    CONSTRAINT [FK_Assets_AssetCategories_CategoryID] FOREIGN KEY ([CategoryID]) REFERENCES [AssetCategories] ([CategoryID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Assets_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Assets_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [UserLoginAudits] (
    [AuditID] int NOT NULL IDENTITY,
    [UserID] int NOT NULL,
    [LoginTime] datetime2 NOT NULL,
    [LogoutTime] datetime2 NULL,
    [IPAddress] nvarchar(50) NULL,
    [DeviceDetails] nvarchar(255) NULL,
    [Status] nvarchar(50) NOT NULL,
    CONSTRAINT [PK_UserLoginAudits] PRIMARY KEY ([AuditID]),
    CONSTRAINT [FK_UserLoginAudits_Users_UserID] FOREIGN KEY ([UserID]) REFERENCES [Users] ([UserID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [InvestmentAccounts] (
    [InvestmentAccountID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [InvestmentInstitutionID] int NOT NULL,
    [SchemeID] int NOT NULL,
    [InvestmentNo] nvarchar(30) NOT NULL,
    [InvestmentDate] datetime2 NOT NULL,
    [PrincipalAmount] decimal(18,2) NOT NULL,
    [InterestRate] decimal(5,2) NOT NULL,
    [MaturityDate] datetime2 NOT NULL,
    [ExpectedMaturityAmount] decimal(18,2) NOT NULL,
    [AccruedInterestTillMigration] decimal(18,2) NOT NULL,
    [BookValue] decimal(18,2) NOT NULL,
    [IsLegacyAccount] bit NOT NULL,
    [NomineeName] nvarchar(100) NULL,
    [NomineeRelation] nvarchar(50) NULL,
    [Remarks] nvarchar(250) NULL,
    [Status] nvarchar(20) NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    [ModifiedBy] int NULL,
    [ModifiedDate] datetime2 NULL,
    CONSTRAINT [PK_InvestmentAccounts] PRIMARY KEY ([InvestmentAccountID]),
    CONSTRAINT [FK_InvestmentAccounts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentAccounts_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentAccounts_InvestmentInstitutions_InvestmentInstitutionID] FOREIGN KEY ([InvestmentInstitutionID]) REFERENCES [InvestmentInstitutions] ([InstitutionID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentAccounts_InvestmentSchemes_SchemeID] FOREIGN KEY ([SchemeID]) REFERENCES [InvestmentSchemes] ([SchemeID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [FdInterestAccruals] (
    [AccrualID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [FdAccountID] int NOT NULL,
    [VoucherID] int NOT NULL,
    [AccrualDate] datetime2 NOT NULL,
    [CalculatedDays] int NOT NULL,
    [InterestAmount] decimal(18,2) NOT NULL,
    [IsPosted] bit NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_FdInterestAccruals] PRIMARY KEY ([AccrualID]),
    CONSTRAINT [FK_FdInterestAccruals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_FdInterestAccruals_FdAccounts_FdAccountID] FOREIGN KEY ([FdAccountID]) REFERENCES [FdAccounts] ([FdAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_FdInterestAccruals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_FdInterestAccruals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [FdTransactions] (
    [FdTransactionID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [FdAccountID] int NOT NULL,
    [VoucherID] int NOT NULL,
    [TransactionDate] datetime2 NOT NULL,
    [TransactionType] nvarchar(20) NOT NULL,
    [DebitCredit] nvarchar(2) NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_FdTransactions] PRIMARY KEY ([FdTransactionID]),
    CONSTRAINT [FK_FdTransactions_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_FdTransactions_FdAccounts_FdAccountID] FOREIGN KEY ([FdAccountID]) REFERENCES [FdAccounts] ([FdAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_FdTransactions_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_FdTransactions_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LoanAccounts] (
    [LoanAccountID] int NOT NULL IDENTITY,
    [BranchID] int NOT NULL,
    [LoanApplicationID] int NULL,
    [MemberID] int NOT NULL,
    [CoMemberID] int NULL,
    [CoMember2ID] int NULL,
    [LoanRateID] int NOT NULL,
    [LoanAccountNo] nvarchar(50) NOT NULL,
    [PrincipalBalance] decimal(18,2) NOT NULL,
    [InterestBalance] decimal(18,2) NOT NULL,
    [OverdueInterestBalance] decimal(18,2) NOT NULL,
    [OpeningDate] datetime2 NOT NULL,
    [LoanDisbursementDate] datetime2 NULL,
    [SanctionedAmount] decimal(18,2) NOT NULL,
    [InterestRate] decimal(18,2) NOT NULL,
    [DurationMonths] int NOT NULL,
    [InstallmentAmount] decimal(18,2) NOT NULL,
    [FirstInstallmentDate] datetime2 NULL,
    [MaturityDate] datetime2 NULL,
    [InstallmentFrequency] nvarchar(50) NOT NULL,
    [LastInstallmentPaidDate] datetime2 NULL,
    [NoOfInstallments] int NOT NULL,
    [RecommendedByDirectorID] int NULL,
    [Guarantor1MemberID] int NULL,
    [Guarantor2MemberID] int NULL,
    [SecurityDetails] nvarchar(500) NULL,
    [SecurityValue] decimal(18,2) NOT NULL,
    [IsOpeningBalance] bit NOT NULL,
    [LegacyAccountId] int NULL,
    [LegacyAccountNumber] nvarchar(50) NULL,
    [Status] nvarchar(20) NOT NULL,
    CONSTRAINT [PK_LoanAccounts] PRIMARY KEY ([LoanAccountID]),
    CONSTRAINT [FK_LoanAccounts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanAccounts_LoanApplications_LoanApplicationID] FOREIGN KEY ([LoanApplicationID]) REFERENCES [LoanApplications] ([LoanApplicationID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanAccounts_LoanRates_LoanRateID] FOREIGN KEY ([LoanRateID]) REFERENCES [LoanRates] ([LoanRateID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanAccounts_Members_CoMember2ID] FOREIGN KEY ([CoMember2ID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanAccounts_Members_CoMemberID] FOREIGN KEY ([CoMemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanAccounts_Members_Guarantor1MemberID] FOREIGN KEY ([Guarantor1MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanAccounts_Members_Guarantor2MemberID] FOREIGN KEY ([Guarantor2MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanAccounts_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanAccounts_Members_RecommendedByDirectorID] FOREIGN KEY ([RecommendedByDirectorID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PigmyCollections] (
    [CollectionId] bigint NOT NULL IDENTITY,
    [PigmyAccountId] int NOT NULL,
    [AgentId] int NOT NULL,
    [CollectionDate] datetime2 NOT NULL,
    [OpeningBalance] decimal(18,2) NOT NULL,
    [CollectionAmount] decimal(18,2) NOT NULL,
    [ClosingBalance] decimal(18,2) NOT NULL,
    [ReceiptNo] nvarchar(50) NOT NULL,
    [CollectionSource] nvarchar(20) NOT NULL,
    [ImportBatchId] uniqueidentifier NULL,
    [SyncReferenceId] nvarchar(100) NULL,
    [IsVoucherGenerated] bit NOT NULL,
    [VoucherId] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_PigmyCollections] PRIMARY KEY ([CollectionId]),
    CONSTRAINT [FK_PigmyCollections_PigmyAccounts_PigmyAccountId] FOREIGN KEY ([PigmyAccountId]) REFERENCES [PigmyAccounts] ([PigmyAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PigmyCollections_PigmyAgents_AgentId] FOREIGN KEY ([AgentId]) REFERENCES [PigmyAgents] ([PigmyAgentID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PigmyCollections_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PigmyInterestLogs] (
    [LogId] int NOT NULL IDENTITY,
    [PigmyAccountId] int NOT NULL,
    [CalculationDate] datetime2 NOT NULL,
    [PeriodStartDate] datetime2 NOT NULL,
    [PeriodEndDate] datetime2 NOT NULL,
    [InterestAmount] decimal(18,2) NOT NULL,
    [VoucherId] int NULL,
    [Status] nvarchar(20) NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_PigmyInterestLogs] PRIMARY KEY ([LogId]),
    CONSTRAINT [FK_PigmyInterestLogs_PigmyAccounts_PigmyAccountId] FOREIGN KEY ([PigmyAccountId]) REFERENCES [PigmyAccounts] ([PigmyAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PigmyInterestLogs_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PigmyOpeningBalances] (
    [PigmyOpeningBalanceID] int NOT NULL IDENTITY,
    [PigmyAccountID] int NOT NULL,
    [FinancialYear] nvarchar(9) NOT NULL,
    [AsOfDate] datetime2 NOT NULL,
    [MigratedBalanceAmount] decimal(18,2) NOT NULL,
    [MigrationRemarks] nvarchar(255) NULL,
    [IsPostedToLedger] bit NOT NULL,
    [MigratedBy] int NOT NULL,
    [MigratedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_PigmyOpeningBalances] PRIMARY KEY ([PigmyOpeningBalanceID]),
    CONSTRAINT [FK_PigmyOpeningBalances_PigmyAccounts_PigmyAccountID] FOREIGN KEY ([PigmyAccountID]) REFERENCES [PigmyAccounts] ([PigmyAccountID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PigmyTransactions] (
    [PigmyTransactionID] int NOT NULL IDENTITY,
    [PigmyAccountID] int NOT NULL,
    [TransactionDate] datetime2 NOT NULL,
    [ValueDate] datetime2 NOT NULL,
    [TransactionType] nvarchar(20) NOT NULL,
    [DrAmount] decimal(18,2) NOT NULL,
    [CrAmount] decimal(18,2) NOT NULL,
    [BalanceAmount] decimal(18,2) NOT NULL,
    [Narration] nvarchar(255) NOT NULL,
    [ReferenceId] nvarchar(50) NULL,
    [MakerId] int NOT NULL,
    [PostedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_PigmyTransactions] PRIMARY KEY ([PigmyTransactionID]),
    CONSTRAINT [FK_PigmyTransactions_PigmyAccounts_PigmyAccountID] FOREIGN KEY ([PigmyAccountID]) REFERENCES [PigmyAccounts] ([PigmyAccountID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [RdInterestAccruals] (
    [AccrualID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [RdAccountID] int NOT NULL,
    [VoucherID] int NOT NULL,
    [AccrualDate] datetime2 NOT NULL,
    [InterestAmount] decimal(18,2) NOT NULL,
    [IsPosted] bit NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_RdInterestAccruals] PRIMARY KEY ([AccrualID]),
    CONSTRAINT [FK_RdInterestAccruals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_RdInterestAccruals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_RdInterestAccruals_RdAccounts_RdAccountID] FOREIGN KEY ([RdAccountID]) REFERENCES [RdAccounts] ([RdAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_RdInterestAccruals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [RdTransactions] (
    [RdTransactionID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [RdAccountID] int NOT NULL,
    [VoucherID] int NOT NULL,
    [TransactionDate] datetime2 NOT NULL,
    [TransactionType] nvarchar(20) NOT NULL,
    [InstallmentNo] int NULL,
    [DebitCredit] nvarchar(2) NOT NULL,
    [PrincipalAmount] decimal(18,2) NOT NULL,
    [PenaltyAmount] decimal(18,2) NOT NULL,
    [InterestAmount] decimal(18,2) NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_RdTransactions] PRIMARY KEY ([RdTransactionID]),
    CONSTRAINT [FK_RdTransactions_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_RdTransactions_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_RdTransactions_RdAccounts_RdAccountID] FOREIGN KEY ([RdAccountID]) REFERENCES [RdAccounts] ([RdAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_RdTransactions_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SavingAccountClosings] (
    [ClosingID] int NOT NULL IDENTITY,
    [SavingAccountID] int NOT NULL,
    [ClosureDate] datetime2 NOT NULL,
    [GrossBalance] decimal(18,2) NOT NULL,
    [ClosingCharges] decimal(18,2) NOT NULL,
    [NetPayable] decimal(18,2) NOT NULL,
    [PaymentMode] nvarchar(20) NOT NULL,
    [VoucherNo] nvarchar(50) NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_SavingAccountClosings] PRIMARY KEY ([ClosingID]),
    CONSTRAINT [FK_SavingAccountClosings_SavingAccountMasters_SavingAccountID] FOREIGN KEY ([SavingAccountID]) REFERENCES [SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SavingAccountJointHolders] (
    [JointHolderID] int NOT NULL IDENTITY,
    [SavingAccountID] int NOT NULL,
    [MemberID] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_SavingAccountJointHolders] PRIMARY KEY ([JointHolderID]),
    CONSTRAINT [FK_SavingAccountJointHolders_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SavingAccountJointHolders_SavingAccountMasters_SavingAccountID] FOREIGN KEY ([SavingAccountID]) REFERENCES [SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SavingTransactions] (
    [TransactionID] int NOT NULL IDENTITY,
    [SavingAccountID] int NOT NULL,
    [TargetSavingAccountID] int NULL,
    [TransactionDate] datetime2 NOT NULL,
    [TransactionType] nvarchar(20) NOT NULL,
    [PaymentMode] nvarchar(20) NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    [BalanceAfterTxn] decimal(18,2) NOT NULL,
    [Narration] nvarchar(255) NULL,
    [VoucherNo] nvarchar(50) NULL,
    [IsPrintedOnPassbook] bit NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_SavingTransactions] PRIMARY KEY ([TransactionID]),
    CONSTRAINT [FK_SavingTransactions_SavingAccountMasters_SavingAccountID] FOREIGN KEY ([SavingAccountID]) REFERENCES [SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SavingTransactions_SavingAccountMasters_TargetSavingAccountID] FOREIGN KEY ([TargetSavingAccountID]) REFERENCES [SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [DividendDistributions] (
    [DividendId] int NOT NULL IDENTITY,
    [ShareAccountId] int NOT NULL,
    [FinancialYear] nvarchar(20) NOT NULL,
    [DividendPercentage] decimal(5,2) NOT NULL,
    [DividendAmount] decimal(18,2) NOT NULL,
    [PayoutDate] datetime2 NOT NULL,
    [IsPaid] bit NOT NULL,
    [VoucherId] int NULL,
    CONSTRAINT [PK_DividendDistributions] PRIMARY KEY ([DividendId]),
    CONSTRAINT [FK_DividendDistributions_ShareAccounts_ShareAccountId] FOREIGN KEY ([ShareAccountId]) REFERENCES [ShareAccounts] ([ShareAccountId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DividendDistributions_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [ShareCertificates] (
    [CertificateId] int NOT NULL IDENTITY,
    [ShareAccountId] int NOT NULL,
    [CertificateNo] nvarchar(50) NOT NULL,
    [IssueDate] datetime2 NOT NULL,
    [FromShareNo] bigint NOT NULL,
    [ToShareNo] bigint NOT NULL,
    [NumberOfShares] int NOT NULL,
    [FaceValue] decimal(18,2) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [PrintCount] int NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    [ModifiedBy] int NULL,
    [ModifiedDate] datetime2 NULL,
    [CancellationReason] nvarchar(max) NULL,
    CONSTRAINT [PK_ShareCertificates] PRIMARY KEY ([CertificateId]),
    CONSTRAINT [FK_ShareCertificates_ShareAccounts_ShareAccountId] FOREIGN KEY ([ShareAccountId]) REFERENCES [ShareAccounts] ([ShareAccountId]) ON DELETE NO ACTION
);
GO


CREATE TABLE [ShareTransactions] (
    [TransactionId] int NOT NULL IDENTITY,
    [ShareAccountId] int NOT NULL,
    [TransactionDate] datetime2 NOT NULL,
    [TransactionType] nvarchar(50) NOT NULL,
    [NumberOfShares] int NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    [Narration] nvarchar(255) NOT NULL,
    [VoucherId] int NULL,
    CONSTRAINT [PK_ShareTransactions] PRIMARY KEY ([TransactionId]),
    CONSTRAINT [FK_ShareTransactions_ShareAccounts_ShareAccountId] FOREIGN KEY ([ShareAccountId]) REFERENCES [ShareAccounts] ([ShareAccountId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_ShareTransactions_Vouchers_VoucherId] FOREIGN KEY ([VoucherId]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [AssetAllocations] (
    [AllocationID] int NOT NULL IDENTITY,
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
    CONSTRAINT [PK_AssetAllocations] PRIMARY KEY ([AllocationID]),
    CONSTRAINT [FK_AssetAllocations_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES [Assets] ([AssetID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetAllocations_Branches_AllocatedBranchID] FOREIGN KEY ([AllocatedBranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetAllocations_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetAllocations_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [AssetDepreciations] (
    [DepreciationID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [AssetID] int NOT NULL,
    [CalculationDate] datetime2 NOT NULL,
    [Method] nvarchar(10) NOT NULL,
    [Rate] decimal(5,2) NOT NULL,
    [DepreciationAmount] decimal(18,2) NOT NULL,
    [BookValueBefore] decimal(18,2) NOT NULL,
    [BookValueAfter] decimal(18,2) NOT NULL,
    [VoucherID] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [UpdatedBy] int NULL,
    [UpdatedOn] datetime2 NULL,
    CONSTRAINT [PK_AssetDepreciations] PRIMARY KEY ([DepreciationID]),
    CONSTRAINT [FK_AssetDepreciations_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES [Assets] ([AssetID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetDepreciations_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetDepreciations_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetDepreciations_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [AssetDisposals] (
    [DisposalID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [AssetID] int NOT NULL,
    [DisposalDate] datetime2 NOT NULL,
    [DisposalType] nvarchar(30) NOT NULL,
    [BookValueAtDisposal] decimal(18,2) NOT NULL,
    [SaleAmount] decimal(18,2) NOT NULL,
    [ProfitOrLoss] decimal(18,2) NOT NULL,
    [BuyerName] nvarchar(150) NULL,
    [VoucherID] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [UpdatedBy] int NULL,
    [UpdatedOn] datetime2 NULL,
    CONSTRAINT [PK_AssetDisposals] PRIMARY KEY ([DisposalID]),
    CONSTRAINT [FK_AssetDisposals_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES [Assets] ([AssetID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetDisposals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetDisposals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetDisposals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [AssetMaintenances] (
    [MaintenanceID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [AssetID] int NOT NULL,
    [MaintenanceDate] datetime2 NOT NULL,
    [MaintenanceType] nvarchar(30) NOT NULL,
    [ServiceProvider] nvarchar(150) NOT NULL,
    [Cost] decimal(18,2) NOT NULL,
    [Remarks] nvarchar(500) NULL,
    [NextServiceDate] datetime2 NULL,
    [VoucherID] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [UpdatedBy] int NULL,
    [UpdatedOn] datetime2 NULL,
    CONSTRAINT [PK_AssetMaintenances] PRIMARY KEY ([MaintenanceID]),
    CONSTRAINT [FK_AssetMaintenances_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES [Assets] ([AssetID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetMaintenances_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetMaintenances_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetMaintenances_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [AssetTransfers] (
    [TransferID] int NOT NULL IDENTITY,
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
    CONSTRAINT [PK_AssetTransfers] PRIMARY KEY ([TransferID]),
    CONSTRAINT [FK_AssetTransfers_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES [Assets] ([AssetID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetTransfers_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetTransfers_Branches_FromBranchID] FOREIGN KEY ([FromBranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetTransfers_Branches_ToBranchID] FOREIGN KEY ([ToBranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetTransfers_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [AssetVerifications] (
    [VerificationID] int NOT NULL IDENTITY,
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
    CONSTRAINT [PK_AssetVerifications] PRIMARY KEY ([VerificationID]),
    CONSTRAINT [FK_AssetVerifications_Assets_AssetID] FOREIGN KEY ([AssetID]) REFERENCES [Assets] ([AssetID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetVerifications_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AssetVerifications_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [InvestmentInterestAccruals] (
    [AccrualID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [InvestmentAccountID] int NOT NULL,
    [AccrualDate] datetime2 NOT NULL,
    [InterestAmount] decimal(18,2) NOT NULL,
    [VoucherID] int NULL,
    [IsPosted] bit NOT NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_InvestmentInterestAccruals] PRIMARY KEY ([AccrualID]),
    CONSTRAINT [FK_InvestmentInterestAccruals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentInterestAccruals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentInterestAccruals_InvestmentAccounts_InvestmentAccountID] FOREIGN KEY ([InvestmentAccountID]) REFERENCES [InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentInterestAccruals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [InvestmentInterestReceipts] (
    [ReceiptID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [InvestmentAccountID] int NOT NULL,
    [ReceiptDate] datetime2 NOT NULL,
    [ReceivedAmount] decimal(18,2) NOT NULL,
    [VoucherID] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_InvestmentInterestReceipts] PRIMARY KEY ([ReceiptID]),
    CONSTRAINT [FK_InvestmentInterestReceipts_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentInterestReceipts_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentInterestReceipts_InvestmentAccounts_InvestmentAccountID] FOREIGN KEY ([InvestmentAccountID]) REFERENCES [InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentInterestReceipts_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [InvestmentMaturities] (
    [MaturityID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [InvestmentAccountID] int NOT NULL,
    [MaturityDate] datetime2 NOT NULL,
    [PrincipalReceived] decimal(18,2) NOT NULL,
    [InterestReceived] decimal(18,2) NOT NULL,
    [TotalReceived] decimal(18,2) NOT NULL,
    [VoucherID] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_InvestmentMaturities] PRIMARY KEY ([MaturityID]),
    CONSTRAINT [FK_InvestmentMaturities_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentMaturities_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentMaturities_InvestmentAccounts_InvestmentAccountID] FOREIGN KEY ([InvestmentAccountID]) REFERENCES [InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentMaturities_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [InvestmentPrematureWithdrawals] (
    [WithdrawalID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [InvestmentAccountID] int NOT NULL,
    [WithdrawalDate] datetime2 NOT NULL,
    [PrincipalPaid] decimal(18,2) NOT NULL,
    [RevisedInterestRate] decimal(5,2) NOT NULL,
    [InterestPaid] decimal(18,2) NOT NULL,
    [PenaltyAmount] decimal(18,2) NOT NULL,
    [NetPayout] decimal(18,2) NOT NULL,
    [VoucherID] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_InvestmentPrematureWithdrawals] PRIMARY KEY ([WithdrawalID]),
    CONSTRAINT [FK_InvestmentPrematureWithdrawals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentPrematureWithdrawals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentPrematureWithdrawals_InvestmentAccounts_InvestmentAccountID] FOREIGN KEY ([InvestmentAccountID]) REFERENCES [InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentPrematureWithdrawals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [InvestmentRenewals] (
    [RenewalID] int NOT NULL IDENTITY,
    [InstitutionID] int NOT NULL,
    [BranchID] int NOT NULL,
    [FinancialYearID] int NOT NULL,
    [OldInvestmentAccountID] int NOT NULL,
    [NewInvestmentAccountID] int NOT NULL,
    [RenewalType] nvarchar(30) NOT NULL,
    [RenewalAmount] decimal(18,2) NOT NULL,
    [RenewalDate] datetime2 NOT NULL,
    [VoucherID] int NULL,
    [CreatedBy] int NOT NULL,
    [CreatedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_InvestmentRenewals] PRIMARY KEY ([RenewalID]),
    CONSTRAINT [FK_InvestmentRenewals_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentRenewals_FinancialYears_FinancialYearID] FOREIGN KEY ([FinancialYearID]) REFERENCES [FinancialYears] ([FinancialYearID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentRenewals_InvestmentAccounts_NewInvestmentAccountID] FOREIGN KEY ([NewInvestmentAccountID]) REFERENCES [InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentRenewals_InvestmentAccounts_OldInvestmentAccountID] FOREIGN KEY ([OldInvestmentAccountID]) REFERENCES [InvestmentAccounts] ([InvestmentAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_InvestmentRenewals_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [CollateralComplianceLogs] (
    [CollateralComplianceLogID] int NOT NULL IDENTITY,
    [LoanAccountID] int NOT NULL,
    [CollateralType] nvarchar(50) NOT NULL,
    [ValuationDate] datetime2 NOT NULL,
    [ValuationValue] decimal(18,2) NOT NULL,
    [ValuersCount] int NOT NULL,
    [LastInspectionDate] datetime2 NOT NULL,
    [InsuranceExpiryDate] datetime2 NOT NULL,
    [LastStockStatementDate] datetime2 NULL,
    [IsAuditorVerified] bit NOT NULL,
    [IsMarginMaintained] bit NOT NULL,
    [CollateralValue] decimal(18,2) NULL,
    [CollateralDescription] nvarchar(max) NULL,
    [MarginPercent] decimal(5,2) NULL,
    [InspectorName] nvarchar(100) NULL,
    [Remarks] nvarchar(500) NULL,
    [CreatedOn] datetime2 NOT NULL,
    CONSTRAINT [PK_CollateralComplianceLogs] PRIMARY KEY ([CollateralComplianceLogID]),
    CONSTRAINT [FK_CollateralComplianceLogs_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES [LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [GoldLoanDetails] (
    [GoldLoanDetailID] int NOT NULL IDENTITY,
    [LoanAccountID] int NOT NULL,
    [OrnamentName] nvarchar(200) NOT NULL,
    [Quantity] int NOT NULL,
    [GrossWeight] decimal(18,3) NOT NULL,
    [NetWeight] decimal(18,3) NOT NULL,
    [Purity] decimal(18,2) NOT NULL,
    [GoldRatePerGram] decimal(18,2) NOT NULL,
    [EstimatedValue] decimal(18,2) NOT NULL,
    [ImagePath] nvarchar(500) NULL,
    CONSTRAINT [PK_GoldLoanDetails] PRIMARY KEY ([GoldLoanDetailID]),
    CONSTRAINT [FK_GoldLoanDetails_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES [LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LoanAccountNpaStatuses] (
    [LoanAccountNpaStatusID] int NOT NULL IDENTITY,
    [LoanAccountID] int NOT NULL,
    [AsOfDate] datetime2 NOT NULL,
    [OverdueDate] datetime2 NULL,
    [OutOfOrderDate] datetime2 NULL,
    [Category] nvarchar(50) NOT NULL,
    [SecurityType] nvarchar(50) NOT NULL,
    [OutstandingBalance] decimal(18,2) NOT NULL,
    [CompliantCollateralValue] decimal(18,2) NOT NULL,
    [ProvisionRequired] decimal(18,2) NOT NULL,
    [ProvisionHeld] decimal(18,2) NOT NULL,
    [IsAutoClassified] bit NOT NULL,
    [LastClassificationRunId] int NOT NULL,
    [AuditorRemarks] nvarchar(500) NULL,
    CONSTRAINT [PK_LoanAccountNpaStatuses] PRIMARY KEY ([LoanAccountNpaStatusID]),
    CONSTRAINT [FK_LoanAccountNpaStatuses_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES [LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanAccountNpaStatuses_NpaClassificationRuns_LastClassificationRunId] FOREIGN KEY ([LastClassificationRunId]) REFERENCES [NpaClassificationRuns] ([NpaClassificationRunID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LoanCollections] (
    [LoanCollectionID] int NOT NULL IDENTITY,
    [LoanAccountID] int NOT NULL,
    [CollectionDate] datetime2 NOT NULL,
    [ReceiptNo] nvarchar(50) NOT NULL,
    [TotalAmountReceived] decimal(18,2) NOT NULL,
    [SurchargeCollected] decimal(18,2) NOT NULL,
    [PenaltyInterestCollected] decimal(18,2) NOT NULL,
    [InterestCollected] decimal(18,2) NOT NULL,
    [PrincipalCollected] decimal(18,2) NOT NULL,
    [PaymentMode] nvarchar(50) NOT NULL,
    [BankName] nvarchar(100) NULL,
    [ChequeNo] nvarchar(50) NULL,
    [BankAccountLedgerID] int NULL,
    [TransferFromSavingAccountNo] nvarchar(50) NULL,
    [VoucherID] int NULL,
    [Remarks] nvarchar(200) NULL,
    CONSTRAINT [PK_LoanCollections] PRIMARY KEY ([LoanCollectionID]),
    CONSTRAINT [FK_LoanCollections_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES [LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanCollections_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LoanDisbursements] (
    [LoanDisbursementID] int NOT NULL IDENTITY,
    [LoanAccountID] int NOT NULL,
    [DisbursementDate] datetime2 NOT NULL,
    [SanctionedAmount] decimal(18,2) NOT NULL,
    [DisbursementAmount] decimal(18,2) NOT NULL,
    [ProcessingFee] decimal(18,2) NOT NULL,
    [ShareDeduction] decimal(18,2) NOT NULL,
    [InsuranceDeduction] decimal(18,2) NOT NULL,
    [StationeryCharges] decimal(18,2) NOT NULL,
    [OtherDeductions] decimal(18,2) NOT NULL,
    [NetAmountPaid] decimal(18,2) NOT NULL,
    [PaymentMode] nvarchar(50) NOT NULL,
    [BankName] nvarchar(100) NULL,
    [ChequeNo] nvarchar(50) NULL,
    [BankAccountLedgerID] int NULL,
    [TransferToSavingAccountNo] nvarchar(50) NULL,
    [VoucherID] int NULL,
    [Remarks] nvarchar(200) NULL,
    [LoanInstallmentType] nvarchar(100) NULL,
    CONSTRAINT [PK_LoanDisbursements] PRIMARY KEY ([LoanDisbursementID]),
    CONSTRAINT [FK_LoanDisbursements_Ledgers_BankAccountLedgerID] FOREIGN KEY ([BankAccountLedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanDisbursements_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES [LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanDisbursements_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LoanDocuments] (
    [LoanDocumentID] int NOT NULL IDENTITY,
    [LoanAccountID] int NOT NULL,
    [DocumentType] nvarchar(100) NOT NULL,
    [DocumentName] nvarchar(200) NOT NULL,
    [FilePath] nvarchar(500) NOT NULL,
    [UploadedDate] datetime2 NOT NULL,
    CONSTRAINT [PK_LoanDocuments] PRIMARY KEY ([LoanDocumentID]),
    CONSTRAINT [FK_LoanDocuments_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES [LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LoanInstallmentSchedules] (
    [ScheduleID] int NOT NULL IDENTITY,
    [LoanAccountID] int NOT NULL,
    [InstallmentNo] int NOT NULL,
    [DueDate] datetime2 NOT NULL,
    [PrincipalAmount] decimal(18,2) NOT NULL,
    [InterestAmount] decimal(18,2) NOT NULL,
    [TotalAmount] decimal(18,2) NOT NULL,
    [BalanceAmount] decimal(18,2) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [PaidDate] datetime2 NULL,
    [OpeningBalance] decimal(18,2) NOT NULL,
    [ClosingBalance] decimal(18,2) NOT NULL,
    [Days] int NOT NULL,
    [InterestRate] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_LoanInstallmentSchedules] PRIMARY KEY ([ScheduleID]),
    CONSTRAINT [FK_LoanInstallmentSchedules_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES [LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [OverdueInterestLedgers] (
    [OverdueInterestLedgerID] int NOT NULL IDENTITY,
    [LoanAccountID] int NOT NULL,
    [TransactionDate] datetime2 NOT NULL,
    [DebitAmount] decimal(18,2) NOT NULL,
    [CreditAmount] decimal(18,2) NOT NULL,
    [VoucherID] int NULL,
    [Particulars] nvarchar(250) NOT NULL,
    CONSTRAINT [PK_OverdueInterestLedgers] PRIMARY KEY ([OverdueInterestLedgerID]),
    CONSTRAINT [FK_OverdueInterestLedgers_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES [LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_OverdueInterestLedgers_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [OverdueRecoveryLedgers] (
    [OverdueRecoveryLedgerID] int NOT NULL IDENTITY,
    [LoanAccountID] int NOT NULL,
    [TransactionDate] datetime2 NOT NULL,
    [DebitAmount] decimal(18,2) NOT NULL,
    [CreditAmount] decimal(18,2) NOT NULL,
    [VoucherID] int NULL,
    [Particulars] nvarchar(250) NOT NULL,
    CONSTRAINT [PK_OverdueRecoveryLedgers] PRIMARY KEY ([OverdueRecoveryLedgerID]),
    CONSTRAINT [FK_OverdueRecoveryLedgers_LoanAccounts_LoanAccountID] FOREIGN KEY ([LoanAccountID]) REFERENCES [LoanAccounts] ([LoanAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_OverdueRecoveryLedgers_Vouchers_VoucherID] FOREIGN KEY ([VoucherID]) REFERENCES [Vouchers] ([VoucherID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SavingPassbooks] (
    [PassbookLogID] int NOT NULL IDENTITY,
    [SavingAccountID] int NOT NULL,
    [TransactionID] int NOT NULL,
    [PrintedLineNo] int NOT NULL,
    [PrintedPageNo] int NOT NULL,
    [PrintedOn] datetime2 NOT NULL,
    [PrintedBy] int NOT NULL,
    CONSTRAINT [PK_SavingPassbooks] PRIMARY KEY ([PassbookLogID]),
    CONSTRAINT [FK_SavingPassbooks_SavingAccountMasters_SavingAccountID] FOREIGN KEY ([SavingAccountID]) REFERENCES [SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SavingPassbooks_SavingTransactions_TransactionID] FOREIGN KEY ([TransactionID]) REFERENCES [SavingTransactions] ([TransactionID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [ShareCertificatePrintHistories] (
    [PrintHistoryId] int NOT NULL IDENTITY,
    [CertificateId] int NOT NULL,
    [ActionType] nvarchar(20) NOT NULL,
    [PrintedBy] int NOT NULL,
    [PrintedOn] datetime2 NOT NULL,
    [IPAddress] nvarchar(50) NULL,
    CONSTRAINT [PK_ShareCertificatePrintHistories] PRIMARY KEY ([PrintHistoryId]),
    CONSTRAINT [FK_ShareCertificatePrintHistories_ShareCertificates_CertificateId] FOREIGN KEY ([CertificateId]) REFERENCES [ShareCertificates] ([CertificateId]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LoanCollectionFees] (
    [LoanCollectionFeeID] int NOT NULL IDENTITY,
    [LoanCollectionID] int NOT NULL,
    [LedgerID] int NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_LoanCollectionFees] PRIMARY KEY ([LoanCollectionFeeID]),
    CONSTRAINT [FK_LoanCollectionFees_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanCollectionFees_LoanCollections_LoanCollectionID] FOREIGN KEY ([LoanCollectionID]) REFERENCES [LoanCollections] ([LoanCollectionID]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LoanDisbursementDeductions] (
    [LoanDisbursementDeductionID] int NOT NULL IDENTITY,
    [LoanDisbursementID] int NOT NULL,
    [LedgerID] int NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_LoanDisbursementDeductions] PRIMARY KEY ([LoanDisbursementDeductionID]),
    CONSTRAINT [FK_LoanDisbursementDeductions_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LoanDisbursementDeductions_LoanDisbursements_LoanDisbursementID] FOREIGN KEY ([LoanDisbursementID]) REFERENCES [LoanDisbursements] ([LoanDisbursementID]) ON DELETE NO ACTION
);
GO


CREATE INDEX [IX_AccountGroups_ParentGroupID] ON [AccountGroups] ([ParentGroupID]);
GO


CREATE INDEX [IX_AssetAllocations_AllocatedBranchID] ON [AssetAllocations] ([AllocatedBranchID]);
GO


CREATE INDEX [IX_AssetAllocations_AssetID] ON [AssetAllocations] ([AssetID]);
GO


CREATE INDEX [IX_AssetAllocations_BranchID] ON [AssetAllocations] ([BranchID]);
GO


CREATE INDEX [IX_AssetAllocations_FinancialYearID] ON [AssetAllocations] ([FinancialYearID]);
GO


CREATE INDEX [IX_AssetCategories_BranchID] ON [AssetCategories] ([BranchID]);
GO


CREATE INDEX [IX_AssetCategories_FinancialYearID] ON [AssetCategories] ([FinancialYearID]);
GO


CREATE INDEX [IX_AssetDepreciations_AssetID] ON [AssetDepreciations] ([AssetID]);
GO


CREATE INDEX [IX_AssetDepreciations_BranchID] ON [AssetDepreciations] ([BranchID]);
GO


CREATE INDEX [IX_AssetDepreciations_FinancialYearID] ON [AssetDepreciations] ([FinancialYearID]);
GO


CREATE INDEX [IX_AssetDepreciations_VoucherID] ON [AssetDepreciations] ([VoucherID]);
GO


CREATE INDEX [IX_AssetDisposals_AssetID] ON [AssetDisposals] ([AssetID]);
GO


CREATE INDEX [IX_AssetDisposals_BranchID] ON [AssetDisposals] ([BranchID]);
GO


CREATE INDEX [IX_AssetDisposals_FinancialYearID] ON [AssetDisposals] ([FinancialYearID]);
GO


CREATE INDEX [IX_AssetDisposals_VoucherID] ON [AssetDisposals] ([VoucherID]);
GO


CREATE INDEX [IX_AssetMaintenances_AssetID] ON [AssetMaintenances] ([AssetID]);
GO


CREATE INDEX [IX_AssetMaintenances_BranchID] ON [AssetMaintenances] ([BranchID]);
GO


CREATE INDEX [IX_AssetMaintenances_FinancialYearID] ON [AssetMaintenances] ([FinancialYearID]);
GO


CREATE INDEX [IX_AssetMaintenances_VoucherID] ON [AssetMaintenances] ([VoucherID]);
GO


CREATE INDEX [IX_AssetPurchases_BankLedgerID] ON [AssetPurchases] ([BankLedgerID]);
GO


CREATE INDEX [IX_AssetPurchases_BranchID] ON [AssetPurchases] ([BranchID]);
GO


CREATE INDEX [IX_AssetPurchases_FinancialYearID] ON [AssetPurchases] ([FinancialYearID]);
GO


CREATE INDEX [IX_AssetPurchases_VoucherID] ON [AssetPurchases] ([VoucherID]);
GO


CREATE INDEX [IX_Assets_BranchID] ON [Assets] ([BranchID]);
GO


CREATE INDEX [IX_Assets_CategoryID] ON [Assets] ([CategoryID]);
GO


CREATE INDEX [IX_Assets_FinancialYearID] ON [Assets] ([FinancialYearID]);
GO


CREATE INDEX [IX_AssetTransfers_AssetID] ON [AssetTransfers] ([AssetID]);
GO


CREATE INDEX [IX_AssetTransfers_BranchID] ON [AssetTransfers] ([BranchID]);
GO


CREATE INDEX [IX_AssetTransfers_FinancialYearID] ON [AssetTransfers] ([FinancialYearID]);
GO


CREATE INDEX [IX_AssetTransfers_FromBranchID] ON [AssetTransfers] ([FromBranchID]);
GO


CREATE INDEX [IX_AssetTransfers_ToBranchID] ON [AssetTransfers] ([ToBranchID]);
GO


CREATE INDEX [IX_AssetVerifications_AssetID] ON [AssetVerifications] ([AssetID]);
GO


CREATE INDEX [IX_AssetVerifications_BranchID] ON [AssetVerifications] ([BranchID]);
GO


CREATE INDEX [IX_AssetVerifications_FinancialYearID] ON [AssetVerifications] ([FinancialYearID]);
GO


CREATE INDEX [IX_BorrowerLinkedAccounts_LinkedMemberID] ON [BorrowerLinkedAccounts] ([LinkedMemberID]);
GO


CREATE INDEX [IX_BorrowerLinkedAccounts_ParentMemberID] ON [BorrowerLinkedAccounts] ([ParentMemberID]);
GO


CREATE INDEX [IX_BranchDayEndStatuses_BranchID] ON [BranchDayEndStatuses] ([BranchID]);
GO


CREATE INDEX [IX_CollateralComplianceLogs_LoanAccountID] ON [CollateralComplianceLogs] ([LoanAccountID]);
GO


CREATE INDEX [IX_CommitteeMembers_MemberID] ON [CommitteeMembers] ([MemberID]);
GO


CREATE INDEX [IX_DemandMemberDetails_DemandNoticeId] ON [DemandMemberDetails] ([DemandNoticeId]);
GO


CREATE INDEX [IX_DemandMemberDetails_MemberId] ON [DemandMemberDetails] ([MemberId]);
GO


CREATE INDEX [IX_DemandNotices_BranchId] ON [DemandNotices] ([BranchId]);
GO


CREATE INDEX [IX_DemandNotices_EmployerId] ON [DemandNotices] ([EmployerId]);
GO


CREATE INDEX [IX_DemandRecoveries_DemandNoticeId] ON [DemandRecoveries] ([DemandNoticeId]);
GO


CREATE INDEX [IX_DemandRecoveries_VoucherId] ON [DemandRecoveries] ([VoucherId]);
GO


CREATE INDEX [IX_DividendDistributions_ShareAccountId] ON [DividendDistributions] ([ShareAccountId]);
GO


CREATE INDEX [IX_DividendDistributions_VoucherId] ON [DividendDistributions] ([VoucherId]);
GO


CREATE INDEX [IX_EmployeeBankDetails_BranchID] ON [EmployeeBankDetails] ([BranchID]);
GO


CREATE UNIQUE INDEX [IX_EmployeeBankDetails_CIFNo] ON [EmployeeBankDetails] ([CIFNo]);
GO


CREATE INDEX [IX_EmployeeBankDetails_DepartmentID] ON [EmployeeBankDetails] ([DepartmentID]);
GO


CREATE UNIQUE INDEX [IX_EmployeeBankDetails_EmployeeID] ON [EmployeeBankDetails] ([EmployeeID]);
GO


CREATE INDEX [IX_EodBatchProcessLogs_BranchID] ON [EodBatchProcessLogs] ([BranchID]);
GO


CREATE INDEX [IX_FdAccounts_BranchID] ON [FdAccounts] ([BranchID]);
GO


CREATE INDEX [IX_FdAccounts_FdSchemeID] ON [FdAccounts] ([FdSchemeID]);
GO


CREATE INDEX [IX_FdAccounts_FinancialYearID] ON [FdAccounts] ([FinancialYearID]);
GO


CREATE INDEX [IX_FdAccounts_MemberID] ON [FdAccounts] ([MemberID]);
GO


CREATE INDEX [IX_FdAccountSequences_BranchID] ON [FdAccountSequences] ([BranchID]);
GO


CREATE INDEX [IX_FdInterestAccruals_BranchID] ON [FdInterestAccruals] ([BranchID]);
GO


CREATE INDEX [IX_FdInterestAccruals_FdAccountID] ON [FdInterestAccruals] ([FdAccountID]);
GO


CREATE INDEX [IX_FdInterestAccruals_FinancialYearID] ON [FdInterestAccruals] ([FinancialYearID]);
GO


CREATE INDEX [IX_FdInterestAccruals_VoucherID] ON [FdInterestAccruals] ([VoucherID]);
GO


CREATE INDEX [IX_FdSchemes_BranchID] ON [FdSchemes] ([BranchID]);
GO


CREATE INDEX [IX_FdTransactions_BranchID] ON [FdTransactions] ([BranchID]);
GO


CREATE INDEX [IX_FdTransactions_FdAccountID] ON [FdTransactions] ([FdAccountID]);
GO


CREATE INDEX [IX_FdTransactions_FinancialYearID] ON [FdTransactions] ([FinancialYearID]);
GO


CREATE INDEX [IX_FdTransactions_VoucherID] ON [FdTransactions] ([VoucherID]);
GO


CREATE INDEX [IX_GoldLoanDetails_LoanAccountID] ON [GoldLoanDetails] ([LoanAccountID]);
GO


CREATE INDEX [IX_InvestmentAccounts_BranchID] ON [InvestmentAccounts] ([BranchID]);
GO


CREATE INDEX [IX_InvestmentAccounts_FinancialYearID] ON [InvestmentAccounts] ([FinancialYearID]);
GO


CREATE INDEX [IX_InvestmentAccounts_InvestmentInstitutionID] ON [InvestmentAccounts] ([InvestmentInstitutionID]);
GO


CREATE INDEX [IX_InvestmentAccounts_SchemeID] ON [InvestmentAccounts] ([SchemeID]);
GO


CREATE INDEX [IX_InvestmentAccountSequences_BranchID] ON [InvestmentAccountSequences] ([BranchID]);
GO


CREATE INDEX [IX_InvestmentInstitutions_BranchID] ON [InvestmentInstitutions] ([BranchID]);
GO


CREATE INDEX [IX_InvestmentInterestAccruals_BranchID] ON [InvestmentInterestAccruals] ([BranchID]);
GO


CREATE INDEX [IX_InvestmentInterestAccruals_FinancialYearID] ON [InvestmentInterestAccruals] ([FinancialYearID]);
GO


CREATE INDEX [IX_InvestmentInterestAccruals_InvestmentAccountID] ON [InvestmentInterestAccruals] ([InvestmentAccountID]);
GO


CREATE INDEX [IX_InvestmentInterestAccruals_VoucherID] ON [InvestmentInterestAccruals] ([VoucherID]);
GO


CREATE INDEX [IX_InvestmentInterestReceipts_BranchID] ON [InvestmentInterestReceipts] ([BranchID]);
GO


CREATE INDEX [IX_InvestmentInterestReceipts_FinancialYearID] ON [InvestmentInterestReceipts] ([FinancialYearID]);
GO


CREATE INDEX [IX_InvestmentInterestReceipts_InvestmentAccountID] ON [InvestmentInterestReceipts] ([InvestmentAccountID]);
GO


CREATE INDEX [IX_InvestmentInterestReceipts_VoucherID] ON [InvestmentInterestReceipts] ([VoucherID]);
GO


CREATE INDEX [IX_InvestmentMaturities_BranchID] ON [InvestmentMaturities] ([BranchID]);
GO


CREATE INDEX [IX_InvestmentMaturities_FinancialYearID] ON [InvestmentMaturities] ([FinancialYearID]);
GO


CREATE INDEX [IX_InvestmentMaturities_InvestmentAccountID] ON [InvestmentMaturities] ([InvestmentAccountID]);
GO


CREATE INDEX [IX_InvestmentMaturities_VoucherID] ON [InvestmentMaturities] ([VoucherID]);
GO


CREATE INDEX [IX_InvestmentPrematureWithdrawals_BranchID] ON [InvestmentPrematureWithdrawals] ([BranchID]);
GO


CREATE INDEX [IX_InvestmentPrematureWithdrawals_FinancialYearID] ON [InvestmentPrematureWithdrawals] ([FinancialYearID]);
GO


CREATE INDEX [IX_InvestmentPrematureWithdrawals_InvestmentAccountID] ON [InvestmentPrematureWithdrawals] ([InvestmentAccountID]);
GO


CREATE INDEX [IX_InvestmentPrematureWithdrawals_VoucherID] ON [InvestmentPrematureWithdrawals] ([VoucherID]);
GO


CREATE INDEX [IX_InvestmentRenewals_BranchID] ON [InvestmentRenewals] ([BranchID]);
GO


CREATE INDEX [IX_InvestmentRenewals_FinancialYearID] ON [InvestmentRenewals] ([FinancialYearID]);
GO


CREATE INDEX [IX_InvestmentRenewals_NewInvestmentAccountID] ON [InvestmentRenewals] ([NewInvestmentAccountID]);
GO


CREATE INDEX [IX_InvestmentRenewals_OldInvestmentAccountID] ON [InvestmentRenewals] ([OldInvestmentAccountID]);
GO


CREATE INDEX [IX_InvestmentRenewals_VoucherID] ON [InvestmentRenewals] ([VoucherID]);
GO


CREATE INDEX [IX_InvestmentSchemes_BranchID] ON [InvestmentSchemes] ([BranchID]);
GO


CREATE INDEX [IX_InvestmentSchemes_InvestmentInstitutionID] ON [InvestmentSchemes] ([InvestmentInstitutionID]);
GO


CREATE INDEX [IX_InvestmentVoucherMappings_BranchID] ON [InvestmentVoucherMappings] ([BranchID]);
GO


CREATE INDEX [IX_Ledgers_GroupID] ON [Ledgers] ([GroupID]);
GO


CREATE INDEX [IX_LoanAccountNpaStatuses_LastClassificationRunId] ON [LoanAccountNpaStatuses] ([LastClassificationRunId]);
GO


CREATE INDEX [IX_LoanAccountNpaStatuses_LoanAccountID] ON [LoanAccountNpaStatuses] ([LoanAccountID]);
GO


CREATE INDEX [IX_LoanAccounts_BranchID] ON [LoanAccounts] ([BranchID]);
GO


CREATE INDEX [IX_LoanAccounts_CoMember2ID] ON [LoanAccounts] ([CoMember2ID]);
GO


CREATE INDEX [IX_LoanAccounts_CoMemberID] ON [LoanAccounts] ([CoMemberID]);
GO


CREATE INDEX [IX_LoanAccounts_Guarantor1MemberID] ON [LoanAccounts] ([Guarantor1MemberID]);
GO


CREATE INDEX [IX_LoanAccounts_Guarantor2MemberID] ON [LoanAccounts] ([Guarantor2MemberID]);
GO


CREATE INDEX [IX_LoanAccounts_LoanApplicationID] ON [LoanAccounts] ([LoanApplicationID]);
GO


CREATE INDEX [IX_LoanAccounts_LoanRateID] ON [LoanAccounts] ([LoanRateID]);
GO


CREATE INDEX [IX_LoanAccounts_MemberID] ON [LoanAccounts] ([MemberID]);
GO


CREATE INDEX [IX_LoanAccounts_RecommendedByDirectorID] ON [LoanAccounts] ([RecommendedByDirectorID]);
GO


CREATE INDEX [IX_LoanApplications_CoMember2ID] ON [LoanApplications] ([CoMember2ID]);
GO


CREATE INDEX [IX_LoanApplications_CoMemberID] ON [LoanApplications] ([CoMemberID]);
GO


CREATE INDEX [IX_LoanApplications_Guarantor1MemberID] ON [LoanApplications] ([Guarantor1MemberID]);
GO


CREATE INDEX [IX_LoanApplications_Guarantor2MemberID] ON [LoanApplications] ([Guarantor2MemberID]);
GO


CREATE INDEX [IX_LoanApplications_LoanRateID] ON [LoanApplications] ([LoanRateID]);
GO


CREATE INDEX [IX_LoanApplications_MemberID] ON [LoanApplications] ([MemberID]);
GO


CREATE INDEX [IX_LoanApplications_RecommendedByDirectorID] ON [LoanApplications] ([RecommendedByDirectorID]);
GO


CREATE INDEX [IX_LoanCollectionFees_LedgerID] ON [LoanCollectionFees] ([LedgerID]);
GO


CREATE INDEX [IX_LoanCollectionFees_LoanCollectionID] ON [LoanCollectionFees] ([LoanCollectionID]);
GO


CREATE INDEX [IX_LoanCollections_LoanAccountID] ON [LoanCollections] ([LoanAccountID]);
GO


CREATE INDEX [IX_LoanCollections_VoucherID] ON [LoanCollections] ([VoucherID]);
GO


CREATE INDEX [IX_LoanDisbursementDeductions_LedgerID] ON [LoanDisbursementDeductions] ([LedgerID]);
GO


CREATE INDEX [IX_LoanDisbursementDeductions_LoanDisbursementID] ON [LoanDisbursementDeductions] ([LoanDisbursementID]);
GO


CREATE INDEX [IX_LoanDisbursements_BankAccountLedgerID] ON [LoanDisbursements] ([BankAccountLedgerID]);
GO


CREATE INDEX [IX_LoanDisbursements_LoanAccountID] ON [LoanDisbursements] ([LoanAccountID]);
GO


CREATE INDEX [IX_LoanDisbursements_VoucherID] ON [LoanDisbursements] ([VoucherID]);
GO


CREATE INDEX [IX_LoanDocuments_LoanAccountID] ON [LoanDocuments] ([LoanAccountID]);
GO


CREATE INDEX [IX_LoanInstallmentSchedules_LoanAccountID] ON [LoanInstallmentSchedules] ([LoanAccountID]);
GO


CREATE INDEX [IX_MemberOpeningBalances_LedgerID] ON [MemberOpeningBalances] ([LedgerID]);
GO


CREATE INDEX [IX_MemberOpeningBalances_MemberID] ON [MemberOpeningBalances] ([MemberID]);
GO


CREATE UNIQUE INDEX [IX_Members_AadhaarNo] ON [Members] ([AadhaarNo]);
GO


CREATE INDEX [IX_Members_BranchID] ON [Members] ([BranchID]);
GO


CREATE INDEX [IX_Members_EmployerId] ON [Members] ([EmployerId]);
GO


CREATE UNIQUE INDEX [IX_Members_MemberCode] ON [Members] ([MemberCode]) WHERE [MemberCode] IS NOT NULL AND [MemberCode] <> '';
GO


CREATE INDEX [IX_Members_MobileNo] ON [Members] ([MobileNo]);
GO


CREATE INDEX [IX_Members_Village] ON [Members] ([Village]);
GO


CREATE INDEX [IX_OverdueInterestLedgers_LoanAccountID] ON [OverdueInterestLedgers] ([LoanAccountID]);
GO


CREATE INDEX [IX_OverdueInterestLedgers_VoucherID] ON [OverdueInterestLedgers] ([VoucherID]);
GO


CREATE INDEX [IX_OverdueRecoveryLedgers_LoanAccountID] ON [OverdueRecoveryLedgers] ([LoanAccountID]);
GO


CREATE INDEX [IX_OverdueRecoveryLedgers_VoucherID] ON [OverdueRecoveryLedgers] ([VoucherID]);
GO


CREATE INDEX [IX_PigmyAccounts_BranchID] ON [PigmyAccounts] ([BranchID]);
GO


CREATE INDEX [IX_PigmyAccounts_MemberID] ON [PigmyAccounts] ([MemberID]);
GO


CREATE INDEX [IX_PigmyAccounts_PigmyAgentID] ON [PigmyAccounts] ([PigmyAgentID]);
GO


CREATE INDEX [IX_PigmyAccounts_PigmySchemeID] ON [PigmyAccounts] ([PigmySchemeID]);
GO


CREATE INDEX [IX_PigmyAgentCashDeposits_AgentId] ON [PigmyAgentCashDeposits] ([AgentId]);
GO


CREATE INDEX [IX_PigmyAgentCashDeposits_VoucherId] ON [PigmyAgentCashDeposits] ([VoucherId]);
GO


CREATE INDEX [IX_PigmyAgentCommissions_AgentId] ON [PigmyAgentCommissions] ([AgentId]);
GO


CREATE INDEX [IX_PigmyAgentCommissions_VoucherId] ON [PigmyAgentCommissions] ([VoucherId]);
GO


CREATE INDEX [IX_PigmyCollections_AgentId] ON [PigmyCollections] ([AgentId]);
GO


CREATE UNIQUE INDEX [IX_PigmyCollections_PigmyAccountId_CollectionDate] ON [PigmyCollections] ([PigmyAccountId], [CollectionDate]) WHERE [CollectionSource] IN ('MANUAL', 'IMPORT');
GO


CREATE INDEX [IX_PigmyCollections_VoucherId] ON [PigmyCollections] ([VoucherId]);
GO


CREATE INDEX [IX_PigmyCommissionSettings_AgentId] ON [PigmyCommissionSettings] ([AgentId]);
GO


CREATE INDEX [IX_PigmyInterestLogs_PigmyAccountId] ON [PigmyInterestLogs] ([PigmyAccountId]);
GO


CREATE INDEX [IX_PigmyInterestLogs_VoucherId] ON [PigmyInterestLogs] ([VoucherId]);
GO


CREATE INDEX [IX_PigmyOpeningBalances_PigmyAccountID] ON [PigmyOpeningBalances] ([PigmyAccountID]);
GO


CREATE INDEX [IX_PigmyTransactions_PigmyAccountID] ON [PigmyTransactions] ([PigmyAccountID]);
GO


CREATE INDEX [IX_PigmyVoucherMappings_BranchId] ON [PigmyVoucherMappings] ([BranchId]);
GO


CREATE INDEX [IX_PigmyVoucherMappings_CreditLedgerId] ON [PigmyVoucherMappings] ([CreditLedgerId]);
GO


CREATE INDEX [IX_PigmyVoucherMappings_DebitLedgerId] ON [PigmyVoucherMappings] ([DebitLedgerId]);
GO


CREATE INDEX [IX_RdAccounts_BranchID] ON [RdAccounts] ([BranchID]);
GO


CREATE INDEX [IX_RdAccounts_FinancialYearID] ON [RdAccounts] ([FinancialYearID]);
GO


CREATE INDEX [IX_RdAccounts_MemberID] ON [RdAccounts] ([MemberID]);
GO


CREATE INDEX [IX_RdAccounts_RdSchemeID] ON [RdAccounts] ([RdSchemeID]);
GO


CREATE INDEX [IX_RdAccountSequences_BranchID] ON [RdAccountSequences] ([BranchID]);
GO


CREATE INDEX [IX_RdInterestAccruals_BranchID] ON [RdInterestAccruals] ([BranchID]);
GO


CREATE INDEX [IX_RdInterestAccruals_FinancialYearID] ON [RdInterestAccruals] ([FinancialYearID]);
GO


CREATE INDEX [IX_RdInterestAccruals_RdAccountID] ON [RdInterestAccruals] ([RdAccountID]);
GO


CREATE INDEX [IX_RdInterestAccruals_VoucherID] ON [RdInterestAccruals] ([VoucherID]);
GO


CREATE INDEX [IX_RdSchemes_BranchID] ON [RdSchemes] ([BranchID]);
GO


CREATE INDEX [IX_RdTransactions_BranchID] ON [RdTransactions] ([BranchID]);
GO


CREATE INDEX [IX_RdTransactions_FinancialYearID] ON [RdTransactions] ([FinancialYearID]);
GO


CREATE INDEX [IX_RdTransactions_RdAccountID] ON [RdTransactions] ([RdAccountID]);
GO


CREATE INDEX [IX_RdTransactions_VoucherID] ON [RdTransactions] ([VoucherID]);
GO


CREATE INDEX [IX_SavingAccountClosings_SavingAccountID] ON [SavingAccountClosings] ([SavingAccountID]);
GO


CREATE INDEX [IX_SavingAccountJointHolders_MemberID] ON [SavingAccountJointHolders] ([MemberID]);
GO


CREATE INDEX [IX_SavingAccountJointHolders_SavingAccountID] ON [SavingAccountJointHolders] ([SavingAccountID]);
GO


CREATE INDEX [IX_SavingAccountMasters_BranchID] ON [SavingAccountMasters] ([BranchID]);
GO


CREATE INDEX [IX_SavingAccountMasters_LedgerID] ON [SavingAccountMasters] ([LedgerID]);
GO


CREATE INDEX [IX_SavingAccountMasters_MemberID] ON [SavingAccountMasters] ([MemberID]);
GO


CREATE INDEX [IX_SavingInterestPostings_FinancialYearID] ON [SavingInterestPostings] ([FinancialYearID]);
GO


CREATE INDEX [IX_SavingInterestSettings_LedgerID] ON [SavingInterestSettings] ([LedgerID]);
GO


CREATE INDEX [IX_SavingPassbooks_SavingAccountID] ON [SavingPassbooks] ([SavingAccountID]);
GO


CREATE INDEX [IX_SavingPassbooks_TransactionID] ON [SavingPassbooks] ([TransactionID]);
GO


CREATE INDEX [IX_SavingTransactions_SavingAccountID] ON [SavingTransactions] ([SavingAccountID]);
GO


CREATE INDEX [IX_SavingTransactions_TargetSavingAccountID] ON [SavingTransactions] ([TargetSavingAccountID]);
GO


CREATE INDEX [IX_SavingVoucherMappings_LedgerID] ON [SavingVoucherMappings] ([LedgerID]);
GO


CREATE INDEX [IX_ShareAccounts_MemberId] ON [ShareAccounts] ([MemberId]);
GO


CREATE INDEX [IX_ShareCertificatePrintHistories_CertificateId] ON [ShareCertificatePrintHistories] ([CertificateId]);
GO


CREATE INDEX [IX_ShareCertificates_ShareAccountId] ON [ShareCertificates] ([ShareAccountId]);
GO


CREATE INDEX [IX_ShareTransactions_ShareAccountId] ON [ShareTransactions] ([ShareAccountId]);
GO


CREATE INDEX [IX_ShareTransactions_VoucherId] ON [ShareTransactions] ([VoucherId]);
GO


CREATE INDEX [IX_UserLoginAudits_UserID] ON [UserLoginAudits] ([UserID]);
GO


CREATE INDEX [IX_Users_DefaultBranchID] ON [Users] ([DefaultBranchID]);
GO


CREATE INDEX [IX_Users_RoleID] ON [Users] ([RoleID]);
GO


CREATE INDEX [IX_VoucherDetails_LedgerID] ON [VoucherDetails] ([LedgerID]);
GO


CREATE INDEX [IX_VoucherDetails_MemberID] ON [VoucherDetails] ([MemberID]);
GO


CREATE INDEX [IX_VoucherDetails_VoucherID] ON [VoucherDetails] ([VoucherID]);
GO


CREATE INDEX [IX_VoucherMappings_CreditLedgerID] ON [VoucherMappings] ([CreditLedgerID]);
GO


CREATE INDEX [IX_VoucherMappings_DebitLedgerID] ON [VoucherMappings] ([DebitLedgerID]);
GO


CREATE INDEX [IX_Vouchers_BranchID] ON [Vouchers] ([BranchID]);
GO


