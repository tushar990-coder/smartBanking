-- =========================================================================================
-- SmartBanking ERP - Permanent Repair Script for CustomerID = 0 & CIF000000
-- Safe, Atomic, Zero-Data-Loss Migration of CustomerID 0 to CustomerID 1 (or Next Available)
-- =========================================================================================

SET NOCOUNT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM [Customers] WHERE [CustomerID] = 0)
    BEGIN
        PRINT '>>> Found Customer with ID = 0. Starting permanent repair...';

        -- Determine the target CustomerID (1 if available, otherwise MAX + 1)
        DECLARE @TargetID INT;
        IF NOT EXISTS (SELECT 1 FROM [Customers] WHERE [CustomerID] = 1)
            SET @TargetID = 1;
        ELSE
            SET @TargetID = (SELECT ISNULL(MAX([CustomerID]), 1) + 1 FROM [Customers]);

        DECLARE @NewCIF NVARCHAR(20) = 'CIF' + RIGHT('000000' + CAST(@TargetID AS VARCHAR(10)), 6);

        PRINT '>>> Migrating CustomerID 0 to ' + CAST(@TargetID AS VARCHAR(10)) + ' with CIF ' + @NewCIF;

        -- Step 1: Allow Identity Insert and insert the corrected customer row
        SET IDENTITY_INSERT [Customers] ON;

        INSERT INTO [Customers] (
            [CustomerID], [BranchID], [CIFNo], [LegacyCustomerNo], [FirstName], [MiddleName], [LastName],
            [NickName], [FirstNameEng], [MiddleNameEng], [LastNameEng], [Address], [AddressEng], [Village],
            [Taluka], [District], [MobileNo], [AadhaarNo], [PANNo], [RegistrationDate], [NomineeName],
            [NomineeNameEng], [NomineeRelation], [NomineeAddress], [NomineeBirthDate], [NomineeIsMinor],
            [NomineeGuardianName], [PhotoPath], [SignaturePath], [AadhaarDocPath], [PanDocPath], [Gender],
            [BirthDate], [Occupation], [CasteCategory], [Caste], [Email], [IsMinor], [GuardianName],
            [GuardianNameEng], [GuardianRelation], [GuardianAadhaarNo], [GuardianMobileNo], [GuardianAddress],
            [Status], [EmployerId], [IsDeleted], [CreatedBy], [CreatedOn], [UpdatedBy], [UpdatedOn]
        )
        SELECT 
            @TargetID, [BranchID], @NewCIF, [LegacyCustomerNo],
            [FirstName], [MiddleName], [LastName], [NickName], [FirstNameEng], [MiddleNameEng], [LastNameEng],
            [Address], [AddressEng], [Village], [Taluka], [District], [MobileNo], [AadhaarNo], [PANNo],
            [RegistrationDate], [NomineeName], [NomineeNameEng], [NomineeRelation], [NomineeAddress],
            [NomineeBirthDate], [NomineeIsMinor], [NomineeGuardianName], [PhotoPath], [SignaturePath],
            [AadhaarDocPath], [PanDocPath], [Gender], [BirthDate], [Occupation], [CasteCategory], [Caste],
            [Email], [IsMinor], [GuardianName], [GuardianNameEng], [GuardianRelation], [GuardianAadhaarNo],
            [GuardianMobileNo], [GuardianAddress], [Status], [EmployerId], [IsDeleted], [CreatedBy],
            [CreatedOn], [UpdatedBy], [UpdatedOn]
        FROM [Customers]
        WHERE [CustomerID] = 0;

        SET IDENTITY_INSERT [Customers] OFF;

        -- Step 2: Migrate all linked child records from CustomerID 0 to @TargetID
        PRINT '>>> Updating referencing banking records...';

        IF OBJECT_ID(N'[Members]', N'U') IS NOT NULL
        BEGIN
            UPDATE [Members] 
            SET [CustomerID] = @TargetID, [CIFNo] = @NewCIF 
            WHERE [CustomerID] = 0 OR [CIFNo] = 'CIF000000';
        END

        IF OBJECT_ID(N'[SavingAccountMasters]', N'U') IS NOT NULL
            UPDATE [SavingAccountMasters] SET [CustomerID] = @TargetID WHERE [CustomerID] = 0;

        IF OBJECT_ID(N'[LoanAccounts]', N'U') IS NOT NULL
            UPDATE [LoanAccounts] SET [CustomerID] = @TargetID WHERE [CustomerID] = 0;

        IF OBJECT_ID(N'[FdAccounts]', N'U') IS NOT NULL
            UPDATE [FdAccounts] SET [CustomerID] = @TargetID WHERE [CustomerID] = 0;

        IF OBJECT_ID(N'[RdAccounts]', N'U') IS NOT NULL
            UPDATE [RdAccounts] SET [CustomerID] = @TargetID WHERE [CustomerID] = 0;

        IF OBJECT_ID(N'[PigmyAccounts]', N'U') IS NOT NULL
            UPDATE [PigmyAccounts] SET [CustomerID] = @TargetID WHERE [CustomerID] = 0;

        IF OBJECT_ID(N'[CustomerOpeningBalances]', N'U') IS NOT NULL
            UPDATE [CustomerOpeningBalances] SET [CustomerID] = @TargetID WHERE [CustomerID] = 0;

        IF OBJECT_ID(N'[LockerAllotments]', N'U') IS NOT NULL
            UPDATE [LockerAllotments] SET [CustomerID] = @TargetID WHERE [CustomerID] = 0;

        IF OBJECT_ID(N'[ShareAccounts]', N'U') IS NOT NULL
            UPDATE [ShareAccounts] SET [CustomerID] = @TargetID WHERE [CustomerID] = 0;

        -- Step 3: Remove the old invalid CustomerID 0 row
        DELETE FROM [Customers] WHERE [CustomerID] = 0;

        -- Step 4: Ensure Identity counter is properly seeded
        DECLARE @MaxCId INT = (SELECT ISNULL(MAX([CustomerID]), 1) FROM [Customers]);
        DBCC CHECKIDENT ('Customers', RESEED, @MaxCId);

        PRINT '>>> SUCCESS: CustomerID 0 migrated to ' + CAST(@TargetID AS VARCHAR(10)) + ' (' + @NewCIF + ') successfully.';
    END
    ELSE
    BEGIN
        PRINT '>>> No Customer with ID 0 found. Checking identity seed...';
        DECLARE @CurrentMax INT = (SELECT ISNULL(MAX([CustomerID]), 0) FROM [Customers]);
        IF @CurrentMax > 0
            DBCC CHECKIDENT ('Customers', RESEED, @CurrentMax);
        ELSE
            DBCC CHECKIDENT ('Customers', RESEED, 1);
    END

    COMMIT TRANSACTION;
    PRINT '>>> Database check and auto-repair finished successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@Err, 16, 1);
END CATCH;
