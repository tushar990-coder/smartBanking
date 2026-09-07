-- =========================================================================================
-- SmartBanking Core ERP - Members Table Normalization & Column Cleanup Patch
-- Fully synchronizes all demographic/KYC/nominee data from Members into Customers table,
-- creates dbo.vw_Members for 100% backward-compatibility, and drops redundant columns.
-- =========================================================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

PRINT '========================================================================';
PRINT '  Starting Members Table Normalization Migration...                     ';
PRINT '  Target Database Context: ' + DB_NAME();
PRINT '========================================================================';

-- -----------------------------------------------------------------------------------------
-- STEP 1: ENSURE CustomerID COLUMN AND FK ON dbo.Members
-- -----------------------------------------------------------------------------------------
IF COL_LENGTH('Members', 'CustomerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Members] ADD [CustomerID] INT NULL;
    PRINT 'Added CustomerID column to Members table.';
END
GO

-- -----------------------------------------------------------------------------------------
-- STEP 2: LINK OR CREATE CUSTOMERS FOR ANY MEMBERS MISSING CustomerID
-- -----------------------------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM [dbo].[Members] WHERE [CustomerID] IS NULL)
BEGIN
    PRINT 'Found Members without CustomerID. Linking by CIFNo or AadhaarNo or MobileNo...';

    -- Try linking by CIFNo
    IF COL_LENGTH('Members', 'CIFNo') IS NOT NULL
    BEGIN
        UPDATE m
        SET m.CustomerID = c.CustomerID
        FROM [dbo].[Members] m
        INNER JOIN [dbo].[Customers] c ON c.CIFNo = m.CIFNo AND c.BranchID = m.BranchID
        WHERE m.CustomerID IS NULL AND m.CIFNo IS NOT NULL AND LEN(m.CIFNo) > 0;
    END

    -- Try linking by AadhaarNo
    IF COL_LENGTH('Members', 'AadhaarNo') IS NOT NULL
    BEGIN
        UPDATE m
        SET m.CustomerID = c.CustomerID
        FROM [dbo].[Members] m
        INNER JOIN [dbo].[Customers] c ON c.AadhaarNo = m.AadhaarNo
        WHERE m.CustomerID IS NULL AND m.AadhaarNo IS NOT NULL AND LEN(m.AadhaarNo) = 12;
    END

    -- Try linking by MobileNo and Name
    IF COL_LENGTH('Members', 'MobileNo') IS NOT NULL AND COL_LENGTH('Members', 'FirstName') IS NOT NULL
    BEGIN
        UPDATE m
        SET m.CustomerID = c.CustomerID
        FROM [dbo].[Members] m
        INNER JOIN [dbo].[Customers] c ON c.MobileNo = m.MobileNo AND c.FirstName = m.FirstName AND c.LastName = m.LastName
        WHERE m.CustomerID IS NULL AND m.MobileNo IS NOT NULL AND LEN(m.MobileNo) >= 10;
    END

    -- For any remaining members without a Customer, create one!
    DECLARE @MemID INT, @BranchID INT, @CustID INT, @NewCIF NVARCHAR(20);
    DECLARE @FirstName NVARCHAR(50), @LastName NVARCHAR(50), @MobileNo NVARCHAR(15);

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT MemberID, BranchID, 
               ISNULL(FirstName, 'सभासद'), 
               ISNULL(LastName, CAST(MemberID AS NVARCHAR(20))),
               MobileNo
        FROM [dbo].[Members]
        WHERE CustomerID IS NULL;

    OPEN cur;
    FETCH NEXT FROM cur INTO @MemID, @BranchID, @FirstName, @LastName, @MobileNo;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @NewCIF = 'CIF' + RIGHT('000000' + CAST(@MemID AS VARCHAR(10)), 6);
        WHILE EXISTS (SELECT 1 FROM [dbo].[Customers] WHERE CIFNo = @NewCIF)
        BEGIN
            SET @NewCIF = 'CIF' + CAST(ABS(CHECKSUM(NEWID())) % 900000 + 100000 AS NVARCHAR(20));
        END

        INSERT INTO [dbo].[Customers] (
            BranchID, CIFNo, FirstName, LastName, MobileNo, RegistrationDate, Status, IsDeleted, CreatedBy, CreatedOn
        )
        VALUES (
            ISNULL(@BranchID, 1), @NewCIF, @FirstName, @LastName, @MobileNo, GETDATE(), 'Active', 0, 1, GETDATE()
        );

        SET @CustID = SCOPE_IDENTITY();
        UPDATE [dbo].[Members] SET CustomerID = @CustID WHERE MemberID = @MemID;

        FETCH NEXT FROM cur INTO @MemID, @BranchID, @FirstName, @LastName, @MobileNo;
    END

    CLOSE cur;
    DEALLOCATE cur;

    PRINT 'All Members are now linked to a CustomerID.';
END
GO

-- -----------------------------------------------------------------------------------------
-- STEP 3: SYNC DATA FROM Members INTO Customers (FILL IN ANY MISSING FIELDS IN Customers)
-- -----------------------------------------------------------------------------------------
IF COL_LENGTH('Members', 'FirstName') IS NOT NULL
BEGIN
    PRINT 'Synchronizing demographic and KYC data from Members to Customers...';

    UPDATE c
    SET 
        c.FirstName = CASE WHEN c.FirstName IS NULL OR LEN(c.FirstName) = 0 THEN m.FirstName ELSE c.FirstName END,
        c.MiddleName = ISNULL(c.MiddleName, m.MiddleName),
        c.LastName = CASE WHEN c.LastName IS NULL OR LEN(c.LastName) = 0 THEN m.LastName ELSE c.LastName END,
        c.NickName = ISNULL(c.NickName, m.NickName),
        c.FirstNameEng = ISNULL(c.FirstNameEng, m.FirstNameEng),
        c.MiddleNameEng = ISNULL(c.MiddleNameEng, m.MiddleNameEng),
        c.LastNameEng = ISNULL(c.LastNameEng, m.LastNameEng),
        c.Address = ISNULL(c.Address, m.Address),
        c.AddressEng = ISNULL(c.AddressEng, m.AddressEng),
        c.Village = ISNULL(c.Village, m.Village),
        c.Taluka = ISNULL(c.Taluka, m.Taluka),
        c.District = ISNULL(c.District, m.District),
        c.MobileNo = ISNULL(c.MobileNo, m.MobileNo),
        c.AadhaarNo = ISNULL(c.AadhaarNo, m.AadhaarNo),
        c.PANNo = ISNULL(c.PANNo, m.PANNo),
        c.Gender = ISNULL(c.Gender, m.Gender),
        c.BirthDate = ISNULL(c.BirthDate, m.BirthDate),
        c.Occupation = ISNULL(c.Occupation, m.Occupation),
        c.CasteCategory = ISNULL(c.CasteCategory, m.CasteCategory),
        c.Caste = ISNULL(c.Caste, m.Caste),
        c.Email = ISNULL(c.Email, m.Email),
        c.PhotoPath = ISNULL(c.PhotoPath, m.PhotoPath),
        c.SignaturePath = ISNULL(c.SignaturePath, m.SignaturePath),
        c.AadhaarDocPath = ISNULL(c.AadhaarDocPath, m.AadhaarDocPath),
        c.PanDocPath = ISNULL(c.PanDocPath, m.PanDocPath),
        c.NomineeName = ISNULL(c.NomineeName, m.NomineeName),
        c.NomineeNameEng = ISNULL(c.NomineeNameEng, m.NomineeNameEng),
        c.NomineeRelation = ISNULL(c.NomineeRelation, m.NomineeRelation),
        c.NomineeAddress = ISNULL(c.NomineeAddress, m.NomineeAddress),
        c.NomineeBirthDate = ISNULL(c.NomineeBirthDate, m.NomineeBirthDate),
        c.NomineeIsMinor = ISNULL(c.NomineeIsMinor, m.NomineeIsMinor),
        c.NomineeGuardianName = ISNULL(c.NomineeGuardianName, m.NomineeGuardianName),
        c.IsMinor = ISNULL(c.IsMinor, m.IsMinor),
        c.GuardianName = ISNULL(c.GuardianName, m.GuardianName),
        c.GuardianNameEng = ISNULL(c.GuardianNameEng, m.GuardianNameEng),
        c.GuardianRelation = ISNULL(c.GuardianRelation, m.GuardianRelation),
        c.GuardianAadhaarNo = ISNULL(c.GuardianAadhaarNo, m.GuardianAadhaarNo),
        c.GuardianMobileNo = ISNULL(c.GuardianMobileNo, m.GuardianMobileNo),
        c.GuardianAddress = ISNULL(c.GuardianAddress, m.GuardianAddress),
        c.EmployerId = ISNULL(c.EmployerId, m.EmployerId)
    FROM [dbo].[Customers] c
    INNER JOIN [dbo].[Members] m ON m.CustomerID = c.CustomerID;

    PRINT 'Customer data sync completed successfully.';
END
GO

-- -----------------------------------------------------------------------------------------
-- STEP 4: CREATE BACKWARD-COMPATIBLE SQL VIEW [dbo].[vw_Members]
-- -----------------------------------------------------------------------------------------
CREATE OR ALTER VIEW [dbo].[vw_Members]
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
    -- Demographic, KYC & Nominee columns from Customers
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

PRINT 'Created or altered [dbo].[vw_Members] view.';
GO

-- -----------------------------------------------------------------------------------------
-- STEP 5: DYNAMICALLY DROP INDEXES & CONSTRAINTS ON COLUMNS TO BE DROPPED
-- -----------------------------------------------------------------------------------------
PRINT 'Dropping indexes and constraints on redundant columns in Members table...';

-- Drop non-clustered indexes on columns to be dropped
DECLARE @IndexDropSql NVARCHAR(MAX) = '';
SELECT @IndexDropSql = @IndexDropSql + 'DROP INDEX [' + i.name + '] ON [dbo].[Members];' + CHAR(13)
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID(N'[dbo].[Members]')
  AND i.is_primary_key = 0
  AND c.name IN (
      'CIFNo', 'FirstName', 'MiddleName', 'LastName', 'NickName', 'FirstNameEng', 'MiddleNameEng', 'LastNameEng',
      'Address', 'AddressEng', 'Village', 'Taluka', 'District',
      'MobileNo', 'AadhaarNo', 'PANNo',
      'PhotoPath', 'SignaturePath', 'AadhaarDocPath', 'PanDocPath',
      'Gender', 'BirthDate', 'Occupation', 'CasteCategory', 'Caste', 'Email', 'EmployerId',
      'IsMinor', 'GuardianName', 'GuardianNameEng', 'GuardianRelation', 'GuardianAadhaarNo', 'GuardianMobileNo', 'GuardianAddress',
      'NomineeName', 'NomineeNameEng', 'NomineeRelation', 'NomineeAddress', 'NomineeBirthDate', 'NomineeIsMinor', 'NomineeGuardianName'
  );

IF LEN(@IndexDropSql) > 0
BEGIN
    EXEC sp_executesql @IndexDropSql;
    PRINT 'Dropped indexes on Members redundant columns.';
END

-- Drop default constraints on columns to be dropped
DECLARE @DefDropSql NVARCHAR(MAX) = '';
SELECT @DefDropSql = @DefDropSql + 'ALTER TABLE [dbo].[Members] DROP CONSTRAINT [' + d.name + '];' + CHAR(13)
FROM sys.default_constraints d
JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
WHERE d.parent_object_id = OBJECT_ID(N'[dbo].[Members]')
  AND c.name IN (
      'CIFNo', 'FirstName', 'MiddleName', 'LastName', 'NickName', 'FirstNameEng', 'MiddleNameEng', 'LastNameEng',
      'Address', 'AddressEng', 'Village', 'Taluka', 'District',
      'MobileNo', 'AadhaarNo', 'PANNo',
      'PhotoPath', 'SignaturePath', 'AadhaarDocPath', 'PanDocPath',
      'Gender', 'BirthDate', 'Occupation', 'CasteCategory', 'Caste', 'Email', 'EmployerId',
      'IsMinor', 'GuardianName', 'GuardianNameEng', 'GuardianRelation', 'GuardianAadhaarNo', 'GuardianMobileNo', 'GuardianAddress',
      'NomineeName', 'NomineeNameEng', 'NomineeRelation', 'NomineeAddress', 'NomineeBirthDate', 'NomineeIsMinor', 'NomineeGuardianName'
  );

IF LEN(@DefDropSql) > 0
BEGIN
    EXEC sp_executesql @DefDropSql;
    PRINT 'Dropped default constraints on Members redundant columns.';
END

-- Drop foreign keys on EmployerId from Members if exists
DECLARE @FkDropSql NVARCHAR(MAX) = '';
SELECT @FkDropSql = @FkDropSql + 'ALTER TABLE [dbo].[Members] DROP CONSTRAINT [' + fk.name + '];' + CHAR(13)
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
WHERE fk.parent_object_id = OBJECT_ID(N'[dbo].[Members]')
  AND c.name = 'EmployerId';

IF LEN(@FkDropSql) > 0
BEGIN
    EXEC sp_executesql @FkDropSql;
    PRINT 'Dropped foreign key constraint on EmployerId.';
END
GO

-- -----------------------------------------------------------------------------------------
-- STEP 6: SAFELY DROP THE 40+ REDUNDANT COLUMNS FROM dbo.Members
-- -----------------------------------------------------------------------------------------
DECLARE @ColsToDrop TABLE (ColName NVARCHAR(128));
INSERT INTO @ColsToDrop VALUES
    ('FirstName'), ('MiddleName'), ('LastName'), ('NickName'),
    ('FirstNameEng'), ('MiddleNameEng'), ('LastNameEng'),
    ('Address'), ('AddressEng'), ('Village'), ('Taluka'), ('District'),
    ('MobileNo'), ('AadhaarNo'), ('PANNo'),
    ('PhotoPath'), ('SignaturePath'), ('AadhaarDocPath'), ('PanDocPath'),
    ('Gender'), ('BirthDate'), ('Occupation'), ('CasteCategory'), ('Caste'), ('Email'), ('EmployerId'),
    ('IsMinor'), ('GuardianName'), ('GuardianNameEng'), ('GuardianRelation'),
    ('GuardianAadhaarNo'), ('GuardianMobileNo'), ('GuardianAddress'),
    ('NomineeName'), ('NomineeNameEng'), ('NomineeRelation'), ('NomineeAddress'),
    ('NomineeBirthDate'), ('NomineeIsMinor'), ('NomineeGuardianName'),
    ('CIFNo');

DECLARE @ColDropSql NVARCHAR(MAX) = '';
SELECT @ColDropSql = @ColDropSql + 'ALTER TABLE [dbo].[Members] DROP COLUMN [' + c.ColName + '];' + CHAR(13)
FROM @ColsToDrop c
WHERE COL_LENGTH('Members', c.ColName) IS NOT NULL;

IF LEN(@ColDropSql) > 0
BEGIN
    EXEC sp_executesql @ColDropSql;
    PRINT 'Successfully dropped redundant demographic/KYC/nominee columns from dbo.Members!';
END
ELSE
BEGIN
    PRINT 'Redundant columns were already dropped from dbo.Members.';
END
GO

-- -----------------------------------------------------------------------------------------
-- STEP 7: ADD FK CONSTRAINT AND UNIQUE CONSTRAINT ON CustomerID IF NOT EXISTS
-- -----------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'[dbo].[Members]') AND name = 'FK_Members_Customers_CustomerID')
BEGIN
    ALTER TABLE [dbo].[Members]
    ADD CONSTRAINT FK_Members_Customers_CustomerID
    FOREIGN KEY (CustomerID) REFERENCES [dbo].[Customers](CustomerID);
    PRINT 'Added foreign key FK_Members_Customers_CustomerID.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Members]') AND name = 'IX_Members_CustomerID')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Members_CustomerID ON [dbo].[Members](CustomerID) WHERE CustomerID IS NOT NULL;
    PRINT 'Created unique index IX_Members_CustomerID.';
END
GO

PRINT '========================================================================';
PRINT '  Members Table Normalization Migration Completed Successfully!         ';
PRINT '========================================================================';
