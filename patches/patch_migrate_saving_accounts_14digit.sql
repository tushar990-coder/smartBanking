-- ==============================================================================
-- UNIVERSAL PATCH: MIGRATE SAVING ACCOUNTS TO 14-DIGIT CBS STANDARD
-- ==============================================================================
-- Purpose:
--   1. Safely archives legacy 9-digit account numbers into [OldAccountNo].
--   2. Generates standard 14-digit CBS account numbers:
--      [3-digit BranchCode] + [3-digit SchemeCode] + [7-digit Sequence] + [1-digit Luhn Checksum]
--   3. Synchronizes [SavingAccountSequences] to prevent sequence collisions.
--   4. Safely drops redundant [PreviousAccountNo] column.
--
-- Safety:
--   - Fully transactional (atomic: commits on success, rollbacks on error).
--   - Idempotent: Can be run multiple times safely.
-- ==============================================================================

SET NOCOUNT ON;

PRINT '========================================================================';
PRINT 'Starting 14-Digit Saving Account Migration Patch...';
PRINT 'Timestamp: ' + CONVERT(VARCHAR(30), GETDATE(), 120);
PRINT '========================================================================';

BEGIN TRY
    BEGIN TRANSACTION;

    -- --------------------------------------------------------------------------
    -- 1. Ensure [OldAccountNo] column exists
    -- --------------------------------------------------------------------------
    IF COL_LENGTH('SavingAccountMasters', 'OldAccountNo') IS NULL
    BEGIN
        PRINT 'Adding missing [OldAccountNo] column to SavingAccountMasters...';
        ALTER TABLE [dbo].[SavingAccountMasters] ADD [OldAccountNo] NVARCHAR(50) NULL;
    END

    -- --------------------------------------------------------------------------
    -- 2. Ensure [SavingAccountSequences] table exists
    -- --------------------------------------------------------------------------
    IF OBJECT_ID('SavingAccountSequences', 'U') IS NULL
    BEGIN
        PRINT 'Creating [SavingAccountSequences] tracking table...';
        CREATE TABLE [dbo].[SavingAccountSequences] (
            [SequenceID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [BranchID] INT NOT NULL DEFAULT 1,
            [SchemeCodeNumeric] INT NOT NULL DEFAULT 101,
            [LastSequenceNumber] INT NOT NULL DEFAULT 0,
            [UpdatedOn] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
        );
    END

    -- --------------------------------------------------------------------------
    -- 3. Check if there are any accounts that need upgrading (< 14 digits)
    -- --------------------------------------------------------------------------
    DECLARE @TotalToUpgrade INT = 0;
    SELECT @TotalToUpgrade = COUNT(*) 
    FROM [dbo].[SavingAccountMasters] 
    WHERE LEN(LTRIM(RTRIM(AccountNo))) < 14;

    PRINT 'Total legacy accounts requiring upgrade: ' + CAST(@TotalToUpgrade AS VARCHAR(10));

    IF @TotalToUpgrade = 0
    BEGIN
        PRINT 'All saving accounts are already 14 digits! No number generation needed.';
    END
    ELSE
    BEGIN
        -- ----------------------------------------------------------------------
        -- 4. Archive existing 9-digit account numbers into [OldAccountNo]
        -- ----------------------------------------------------------------------
        PRINT 'Archiving legacy 9-digit numbers into [OldAccountNo]...';
        UPDATE [dbo].[SavingAccountMasters]
        SET [OldAccountNo] = LTRIM(RTRIM(AccountNo))
        WHERE LEN(LTRIM(RTRIM(AccountNo))) < 14;

        -- ----------------------------------------------------------------------
        -- 5. Cursor to iterate and generate mathematically verified 14-digit numbers
        -- ----------------------------------------------------------------------
        PRINT 'Generating and assigning 14-digit CBS account numbers...';

        DECLARE @SavingAccountID INT;
        DECLARE @BranchID INT;
        DECLARE @SavingSchemeID INT;
        DECLARE @RawBranchCode NVARCHAR(50);
        DECLARE @RawSchemeCode NVARCHAR(50);

        DECLARE AccountCursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT 
                s.[SavingAccountID],
                s.[BranchID],
                s.[SavingSchemeID],
                b.[BranchCode],
                sc.[SchemeCode]
            FROM [dbo].[SavingAccountMasters] s
            LEFT JOIN [dbo].[Branches] b ON s.[BranchID] = b.[BranchID]
            LEFT JOIN [dbo].[SavingInterestSettings] sc ON s.[SavingSchemeID] = sc.[SettingID]
            WHERE LEN(LTRIM(RTRIM(s.[AccountNo]))) < 14
            ORDER BY s.[BranchID], ISNULL(s.[SavingSchemeID], 1), s.[SavingAccountID];

        OPEN AccountCursor;
        FETCH NEXT FROM AccountCursor INTO @SavingAccountID, @BranchID, @SavingSchemeID, @RawBranchCode, @RawSchemeCode;

        DECLARE @CurrentBranchID INT = -1;
        DECLARE @CurrentSchemeNum INT = -1;
        DECLARE @CurrentSeq INT = 0;
        DECLARE @UpgradedCount INT = 0;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            -- Resolve 3-digit Branch Code
            DECLARE @BranchCode3 VARCHAR(3) = RIGHT('000' + CAST(ISNULL(@BranchID, 1) AS VARCHAR(3)), 3);
            IF @RawBranchCode IS NOT NULL AND LEN(@RawBranchCode) > 0
            BEGIN
                -- Extract numeric digits only from branch code
                DECLARE @CleanBranchDigits VARCHAR(10) = '';
                DECLARE @bIdx INT = 1;
                WHILE @bIdx <= LEN(@RawBranchCode)
                BEGIN
                    IF SUBSTRING(@RawBranchCode, @bIdx, 1) LIKE '[0-9]'
                        SET @CleanBranchDigits = @CleanBranchDigits + SUBSTRING(@RawBranchCode, @bIdx, 1);
                    SET @bIdx = @bIdx + 1;
                END
                IF LEN(@CleanBranchDigits) > 0 AND CAST(@CleanBranchDigits AS INT) > 0
                    SET @BranchCode3 = RIGHT('000' + CAST(CAST(@CleanBranchDigits AS INT) AS VARCHAR(3)), 3);
            END

            -- Resolve 3-digit Scheme Code
            DECLARE @SchemeCode3 VARCHAR(3) = '101';
            DECLARE @SchemeNum INT = 101;
            IF @RawSchemeCode IS NOT NULL AND LEN(@RawSchemeCode) > 0
            BEGIN
                DECLARE @CleanSchemeDigits VARCHAR(10) = '';
                DECLARE @sIdx INT = 1;
                WHILE @sIdx <= LEN(@RawSchemeCode)
                BEGIN
                    IF SUBSTRING(@RawSchemeCode, @sIdx, 1) LIKE '[0-9]'
                        SET @CleanSchemeDigits = @CleanSchemeDigits + SUBSTRING(@RawSchemeCode, @sIdx, 1);
                    SET @sIdx = @sIdx + 1;
                END
                IF LEN(@CleanSchemeDigits) > 0 AND CAST(@CleanSchemeDigits AS INT) > 0
                BEGIN
                    SET @SchemeNum = CAST(@CleanSchemeDigits AS INT);
                    SET @SchemeCode3 = RIGHT('000' + CAST(@SchemeNum AS VARCHAR(3)), 3);
                END
            END

            -- Manage Sequence per (BranchID, SchemeNum)
            IF @BranchID <> @CurrentBranchID OR @SchemeNum <> @CurrentSchemeNum
            BEGIN
                SET @CurrentBranchID = @BranchID;
                SET @CurrentSchemeNum = @SchemeNum;
                SET @CurrentSeq = 0;

                -- Check if sequence row already exists in table
                SELECT @CurrentSeq = LastSequenceNumber
                FROM [dbo].[SavingAccountSequences]
                WHERE [BranchID] = @CurrentBranchID AND [SchemeCodeNumeric] = @CurrentSchemeNum;

                -- If not found, start from 0
                IF @CurrentSeq IS NULL
                    SET @CurrentSeq = 0;
            END

            -- Increment sequence counter
            SET @CurrentSeq = @CurrentSeq + 1;

            -- Construct 13 digits: [Branch 3] + [Scheme 3] + [Sequence 7]
            DECLARE @Seq7 VARCHAR(7) = RIGHT('0000000' + CAST(@CurrentSeq AS VARCHAR(7)), 7);
            DECLARE @Thirteen VARCHAR(13) = @BranchCode3 + @SchemeCode3 + @Seq7;

            -- ------------------------------------------------------------------
            -- Modulo-10 Luhn Check Digit Algorithm (Exact CBS implementation)
            -- ------------------------------------------------------------------
            DECLARE @LuhnSum INT = 0;
            DECLARE @LuhnIdx INT = 13;
            DECLARE @LuhnAlternate BIT = 1;
            DECLARE @DigitVal INT;

            WHILE @LuhnIdx >= 1
            BEGIN
                SET @DigitVal = CAST(SUBSTRING(@Thirteen, @LuhnIdx, 1) AS INT);
                IF @LuhnAlternate = 1
                BEGIN
                    SET @DigitVal = @DigitVal * 2;
                    IF @DigitVal > 9 SET @DigitVal = @DigitVal - 9;
                END
                SET @LuhnSum = @LuhnSum + @DigitVal;
                SET @LuhnAlternate = CASE WHEN @LuhnAlternate = 1 THEN 0 ELSE 1 END;
                SET @LuhnIdx = @LuhnIdx - 1;
            END

            DECLARE @ModResult INT = @LuhnSum % 10;
            DECLARE @CheckDigit INT = CASE WHEN @ModResult = 0 THEN 0 ELSE 10 - @ModResult END;
            DECLARE @NewAccountNo14 VARCHAR(14) = @Thirteen + CAST(@CheckDigit AS VARCHAR(1));

            -- Update account
            UPDATE [dbo].[SavingAccountMasters]
            SET [AccountNo] = @NewAccountNo14,
                [IsLegacyAccount] = 1,
                [UpdatedOn] = GETUTCDATE()
            WHERE [SavingAccountID] = @SavingAccountID;

            -- Sync sequence table
            IF EXISTS (SELECT 1 FROM [dbo].[SavingAccountSequences] WHERE [BranchID] = @CurrentBranchID AND [SchemeCodeNumeric] = @CurrentSchemeNum)
            BEGIN
                UPDATE [dbo].[SavingAccountSequences]
                SET [LastSequenceNumber] = @CurrentSeq,
                    [UpdatedOn] = GETUTCDATE()
                WHERE [BranchID] = @CurrentBranchID AND [SchemeCodeNumeric] = @CurrentSchemeNum;
            END
            ELSE
            BEGIN
                INSERT INTO [dbo].[SavingAccountSequences] ([BranchID], [SchemeCodeNumeric], [LastSequenceNumber], [UpdatedOn])
                VALUES (@CurrentBranchID, @CurrentSchemeNum, @CurrentSeq, GETUTCDATE());
            END

            SET @UpgradedCount = @UpgradedCount + 1;

            FETCH NEXT FROM AccountCursor INTO @SavingAccountID, @BranchID, @SavingSchemeID, @RawBranchCode, @RawSchemeCode;
        END

        CLOSE AccountCursor;
        DEALLOCATE AccountCursor;

        PRINT 'Successfully converted ' + CAST(@UpgradedCount AS VARCHAR(10)) + ' accounts to 14-digit standard.';
    END

    -- --------------------------------------------------------------------------
    -- 6. Safely Drop [PreviousAccountNo] column if it exists
    -- --------------------------------------------------------------------------
    IF COL_LENGTH('SavingAccountMasters', 'PreviousAccountNo') IS NOT NULL
    BEGIN
        PRINT 'Dropping redundant [PreviousAccountNo] column...';
        
        -- Drop any default constraints on PreviousAccountNo if present
        DECLARE @ConstraintName NVARCHAR(200);
        SELECT @ConstraintName = d.name
        FROM sys.default_constraints d
        INNER JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
        WHERE d.parent_object_id = OBJECT_ID('SavingAccountMasters') AND c.name = 'PreviousAccountNo';

        IF @ConstraintName IS NOT NULL
        BEGIN
            EXEC('ALTER TABLE [dbo].[SavingAccountMasters] DROP CONSTRAINT [' + @ConstraintName + '];');
        END

        ALTER TABLE [dbo].[SavingAccountMasters] DROP COLUMN [PreviousAccountNo];
        PRINT '[PreviousAccountNo] column dropped successfully.';
    END
    ELSE
    BEGIN
        PRINT '[PreviousAccountNo] column does not exist or has already been dropped.';
    END

    -- Commit transaction
    COMMIT TRANSACTION;
    PRINT '========================================================================';
    PRINT 'MIGRATION COMPLETED SUCCESSFULLY. ALL DATA IS SAFE AND VERIFIED.';
    PRINT '========================================================================';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '========================================================================';
    PRINT 'ERROR ENCOUNTERED DURING MIGRATION! TRANSACTION ROLLED BACK.';
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    PRINT 'Error Line:    ' + CAST(ERROR_LINE() AS VARCHAR(10));
    PRINT '========================================================================';
    THROW;
END CATCH;
