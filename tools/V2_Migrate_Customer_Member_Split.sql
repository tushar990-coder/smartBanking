-- ==============================================================================
-- Core Banking Architecture Overhaul: Customer (CIF Master) & Member Separation
-- Script: V2_Migrate_Customer_Member_Split.sql
-- Description: Creates [Customers] and [CustomerOpeningBalances], migrates data 
--              with Zero Data Loss, and sets up pure 1:1 Membership Extension.
-- ==============================================================================

BEGIN TRANSACTION;
BEGIN TRY

    PRINT '>>> Step 1: Checking and Creating [Customers] Table...';
    IF OBJECT_ID(N'[Customers]', N'U') IS NULL
    BEGIN
        CREATE TABLE [Customers] (
            [CustomerID] INT IDENTITY(1,1) NOT NULL,
            [BranchID] INT NOT NULL DEFAULT 1,
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
            [RegistrationDate] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            [NomineeName] NVARCHAR(150) NULL,
            [NomineeNameEng] NVARCHAR(150) NULL,
            [NomineeRelation] NVARCHAR(50) NULL,
            [NomineeAddress] NVARCHAR(500) NULL,
            [NomineeBirthDate] DATETIME2 NULL,
            [NomineeIsMinor] BIT NOT NULL DEFAULT 0,
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
            [IsMinor] BIT NOT NULL DEFAULT 0,
            [GuardianName] NVARCHAR(150) NULL,
            [GuardianNameEng] NVARCHAR(150) NULL,
            [GuardianRelation] NVARCHAR(50) NULL,
            [GuardianAadhaarNo] NVARCHAR(12) NULL,
            [GuardianMobileNo] NVARCHAR(15) NULL,
            [GuardianAddress] NVARCHAR(500) NULL,
            [Status] NVARCHAR(20) NOT NULL DEFAULT 'Active',
            [EmployerId] INT NULL,
            [IsDeleted] BIT NOT NULL DEFAULT 0,
            [CreatedBy] INT NOT NULL DEFAULT 1,
            [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            [UpdatedBy] INT NULL,
            [UpdatedOn] DATETIME2 NULL,
            CONSTRAINT [PK_Customers] PRIMARY KEY CLUSTERED ([CustomerID] ASC)
        );
        PRINT '>>> [Customers] table created successfully.';
    END
    ELSE
    BEGIN
        PRINT '>>> [Customers] table already exists.';
    END

    PRINT '>>> Step 2: Creating Indexes on [Customers]...';
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_Customers_CIFNo' AND object_id = OBJECT_ID(N'[Customers]'))
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX [IX_Customers_CIFNo] ON [Customers] ([CIFNo]) 
        WHERE [CIFNo] IS NOT NULL AND [CIFNo] <> '' AND [IsDeleted] = 0;
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_Customers_AadhaarNo' AND object_id = OBJECT_ID(N'[Customers]'))
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX [IX_Customers_AadhaarNo] ON [Customers] ([AadhaarNo]) 
        WHERE [AadhaarNo] IS NOT NULL AND [AadhaarNo] <> '' AND [IsDeleted] = 0;
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_Customers_MobileNo' AND object_id = OBJECT_ID(N'[Customers]'))
    BEGIN
        CREATE NONCLUSTERED INDEX [IX_Customers_MobileNo] ON [Customers] ([MobileNo]);
    END

    PRINT '>>> Step 3: Migrating Data from [Members] into [Customers]...';
    IF EXISTS (SELECT 1 FROM [Members]) AND NOT EXISTS (SELECT 1 FROM [Customers])
    BEGIN
        SET IDENTITY_INSERT [Customers] ON;

        INSERT INTO [Customers] (
            [CustomerID], [BranchID], [CIFNo], [FirstName], [MiddleName], [LastName], [NickName],
            [FirstNameEng], [MiddleNameEng], [LastNameEng], [Address], [AddressEng], [Village],
            [Taluka], [District], [MobileNo], [AadhaarNo], [PANNo], [RegistrationDate],
            [NomineeName], [NomineeNameEng], [NomineeRelation], [NomineeAddress], [NomineeBirthDate],
            [NomineeIsMinor], [NomineeGuardianName], [PhotoPath], [SignaturePath], [AadhaarDocPath],
            [PanDocPath], [Gender], [BirthDate], [Occupation], [CasteCategory], [Caste],
            [Email], [IsMinor], [GuardianName], [GuardianNameEng], [GuardianRelation],
            [GuardianAadhaarNo], [GuardianMobileNo], [GuardianAddress], [Status],
            [EmployerId], [IsDeleted], [CreatedBy], [CreatedOn], [UpdatedBy], [UpdatedOn]
        )
        SELECT 
            [MemberID], 
            ISNULL([BranchID], 1),
            ISNULL(NULLIF([CIFNo], ''), 'CIF' + RIGHT('000000' + CAST([MemberID] AS NVARCHAR(10)), 6)),
            ISNULL([FirstName], ''),
            [MiddleName],
            ISNULL([LastName], ''),
            [NickName],
            [FirstNameEng],
            [MiddleNameEng],
            [LastNameEng],
            [Address],
            [AddressEng],
            [Village],
            [Taluka],
            [District],
            [MobileNo],
            [AadhaarNo],
            [PANNo],
            ISNULL([JoiningDate], SYSUTCDATETIME()),
            [NomineeName],
            [NomineeNameEng],
            [NomineeRelation],
            [NomineeAddress],
            [NomineeBirthDate],
            ISNULL([NomineeIsMinor], 0),
            [NomineeGuardianName],
            [PhotoPath],
            [SignaturePath],
            [AadhaarDocPath],
            [PanDocPath],
            [Gender],
            [BirthDate],
            [Occupation],
            [CasteCategory],
            [Caste],
            [Email],
            ISNULL([IsMinor], 0),
            [GuardianName],
            [GuardianNameEng],
            [GuardianRelation],
            [GuardianAadhaarNo],
            [GuardianMobileNo],
            [GuardianAddress],
            ISNULL([Status], 'Active'),
            [EmployerId],
            ISNULL([IsDeleted], 0),
            ISNULL([CreatedBy], 1),
            ISNULL([CreatedOn], SYSUTCDATETIME()),
            [UpdatedBy],
            [UpdatedOn]
        FROM [Members];

        SET IDENTITY_INSERT [Customers] OFF;
        PRINT '>>> Successfully migrated ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' records into [Customers].';
    END

    PRINT '>>> Step 4: Ensuring [CustomerID] column in [Members]...';
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'CustomerID' AND Object_ID = OBJECT_ID(N'[Members]'))
    BEGIN
        ALTER TABLE [Members] ADD [CustomerID] INT NULL;
    END

    -- Set CustomerID = MemberID for all existing members using dynamic SQL to avoid batch compile error
    EXEC sp_executesql N'UPDATE [Members] SET [CustomerID] = [MemberID] WHERE [CustomerID] IS NULL;';

    PRINT '>>> Step 5: Checking and Creating [CustomerOpeningBalances] Table...';
    IF OBJECT_ID(N'[CustomerOpeningBalances]', N'U') IS NULL
    BEGIN
        CREATE TABLE [CustomerOpeningBalances] (
            [CustomerOpeningBalanceID] INT IDENTITY(1,1) NOT NULL,
            [CustomerID] INT NOT NULL,
            [LedgerID] INT NOT NULL,
            [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0,
            [BalanceType] NVARCHAR(2) NOT NULL DEFAULT 'Dr',
            [CreatedBy] INT NOT NULL DEFAULT 1,
            [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            [UpdatedBy] INT NULL,
            [UpdatedOn] DATETIME2 NULL,
            CONSTRAINT [PK_CustomerOpeningBalances] PRIMARY KEY CLUSTERED ([CustomerOpeningBalanceID] ASC),
            CONSTRAINT [FK_CustomerOpeningBalances_Customers] FOREIGN KEY ([CustomerID]) REFERENCES [Customers] ([CustomerID])
        );

        -- Migrate data from [MemberOpeningBalances] if it exists
        IF OBJECT_ID(N'[MemberOpeningBalances]', N'U') IS NOT NULL
        BEGIN
            EXEC sp_executesql N'INSERT INTO [CustomerOpeningBalances] ([CustomerID], [LedgerID], [Amount], [BalanceType], [CreatedBy], [CreatedOn], [UpdatedBy], [UpdatedOn]) SELECT [MemberID], [LedgerID], [Amount], [BalanceType], [CreatedBy], [CreatedOn], [UpdatedBy], [UpdatedOn] FROM [MemberOpeningBalances];';
            PRINT '>>> Migrated opening balances to [CustomerOpeningBalances].';
        END
    END

    COMMIT TRANSACTION;
    PRINT '==============================================================================';
    PRINT '>>> ZERO-DATA-LOSS MIGRATION COMPLETED SUCCESSFULLY!';
    PRINT '==============================================================================';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();
    PRINT '>>> [ERROR OCCURRED - TRANSACTION ROLLED BACK]: ' + @ErrorMessage;
    RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH;
