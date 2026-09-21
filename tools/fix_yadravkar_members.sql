-- ========================================================================
-- SmartBanking ERP - Yadravkar Sanstha Members Table 13-Column Alignment
-- Target Database: SmartBanking_maharshiyadrav
-- Removes 15 leftover redundant columns and cleans all constraints
-- ========================================================================

SET NOCOUNT ON;
PRINT '========================================================================';
PRINT '  Starting Dedicated Members Normalization for Yadravkar Sanstha...     ';
PRINT '  Target Database Context: ' + DB_NAME();
PRINT '========================================================================';

IF OBJECT_ID(N'[dbo].[Members]', N'U') IS NOT NULL
BEGIN
    -- 1. Drop all default constraints on the 15 redundant columns
    DECLARE @DfDrop NVARCHAR(MAX) = '';
    SELECT @DfDrop = @DfDrop + 'ALTER TABLE [dbo].[Members] DROP CONSTRAINT [' + d.name + '];' + CHAR(13)
    FROM sys.default_constraints d
    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
    WHERE d.parent_object_id = OBJECT_ID(N'[dbo].[Members]')
      AND c.name IN (
          'AddressEng', 'Caste', 'CasteCategory', 'Email', 'FirstNameEng',
          'GuardianAadhaarNo', 'GuardianAddress', 'GuardianMobileNo', 'GuardianName',
          'GuardianNameEng', 'GuardianRelation', 'IsMinor', 'LastNameEng',
          'MiddleNameEng', 'NomineeNameEng', 'NomineeRelation', 'NomineeAddress',
          'NomineeBirthDate', 'NomineeIsMinor', 'NomineeGuardianName'
      );
    IF LEN(@DfDrop) > 0
    BEGIN
        EXEC sp_executesql @DfDrop;
        PRINT 'Dropped default constraints on redundant columns.';
    END

    -- 2. Drop any check constraints on redundant columns
    DECLARE @CkDrop NVARCHAR(MAX) = '';
    SELECT @CkDrop = @CkDrop + 'ALTER TABLE [dbo].[Members] DROP CONSTRAINT [' + ck.name + '];' + CHAR(13)
    FROM sys.check_constraints ck
    JOIN sys.columns c ON ck.parent_object_id = c.object_id AND ck.parent_column_id = c.column_id
    WHERE ck.parent_object_id = OBJECT_ID(N'[dbo].[Members]')
      AND c.name IN (
          'AddressEng', 'Caste', 'CasteCategory', 'Email', 'FirstNameEng',
          'GuardianAadhaarNo', 'GuardianAddress', 'GuardianMobileNo', 'GuardianName',
          'GuardianNameEng', 'GuardianRelation', 'IsMinor', 'LastNameEng',
          'MiddleNameEng', 'NomineeNameEng'
      );
    IF LEN(@CkDrop) > 0
    BEGIN
        EXEC sp_executesql @CkDrop;
        PRINT 'Dropped check constraints on redundant columns.';
    END

    -- 3. Drop any indexes on redundant columns
    DECLARE @IdxDrop NVARCHAR(MAX) = '';
    SELECT @IdxDrop = @IdxDrop + 'DROP INDEX [' + i.name + '] ON [dbo].[Members];' + CHAR(13)
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID(N'[dbo].[Members]')
      AND i.is_primary_key = 0
      AND c.name IN (
          'AddressEng', 'Caste', 'CasteCategory', 'Email', 'FirstNameEng',
          'GuardianAadhaarNo', 'GuardianAddress', 'GuardianMobileNo', 'GuardianName',
          'GuardianNameEng', 'GuardianRelation', 'IsMinor', 'LastNameEng',
          'MiddleNameEng', 'NomineeNameEng'
      );
    IF LEN(@IdxDrop) > 0
    BEGIN
        EXEC sp_executesql @IdxDrop;
        PRINT 'Dropped indexes on redundant columns.';
    END

    -- 4. Drop the 15 redundant columns individually
    DECLARE @ColsToDrop TABLE (ColName NVARCHAR(128));
    INSERT INTO @ColsToDrop VALUES
        ('FirstNameEng'), ('MiddleNameEng'), ('LastNameEng'),
        ('AddressEng'), ('NomineeNameEng'), ('CasteCategory'), ('Caste'),
        ('Email'), ('IsMinor'), ('GuardianName'), ('GuardianNameEng'),
        ('GuardianRelation'), ('GuardianAadhaarNo'), ('GuardianMobileNo'), ('GuardianAddress');

    DECLARE @curCol NVARCHAR(128);
    DECLARE col_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT ColName FROM @ColsToDrop;
    OPEN col_cursor;
    FETCH NEXT FROM col_cursor INTO @curCol;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF COL_LENGTH('dbo.Members', @curCol) IS NOT NULL
        BEGIN
            BEGIN TRY
                DECLARE @dropStmt NVARCHAR(MAX) = 'ALTER TABLE [dbo].[Members] DROP COLUMN [' + @curCol + '];';
                EXEC sp_executesql @dropStmt;
                PRINT '  -> Dropped column: ' + @curCol;
            END TRY
            BEGIN CATCH
                PRINT '  -> Warning dropping ' + @curCol + ': ' + ERROR_MESSAGE();
            END CATCH
        END
        FETCH NEXT FROM col_cursor INTO @curCol;
    END
    CLOSE col_cursor;
    DEALLOCATE col_cursor;

    -- 5. Verification
    DECLARE @finalColCount INT;
    SELECT @finalColCount = COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Members';
    PRINT '------------------------------------------------------------------------';
    PRINT 'Final Members Table Column Count in ' + DB_NAME() + ': ' + CAST(@finalColCount AS VARCHAR(10));
    IF @finalColCount = 13
        PRINT '[SUCCESS] Members Table in Yadravkar Database successfully normalized to 13 canonical columns!';
    ELSE
        PRINT '[WARNING] Column count is ' + CAST(@finalColCount AS VARCHAR(10)) + ' (Expected 13).';
    PRINT '------------------------------------------------------------------------';
END
GO
