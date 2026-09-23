/*
====================================================================================================
 SMARTBANKING CORE BANKING SYSTEM (CBS)
 MODULE: PIGMY / DAILY DEPOSIT (पिग्मी ठेव योजना)
 SCRIPT: 14-Digit Standardized Account Number Engine & Data Migration (300 Scheme Series)
 VERSION: v2.5.3
 DATE: 2026-09-23
====================================================================================================
*/

SET NOCOUNT ON;
PRINT '================================================================================';
PRINT '  STARTING PIGMY 14-DIGIT CBS ACCOUNT NUMBER STANDARDIZATION & MIGRATION        ';
PRINT '================================================================================';
GO

----------------------------------------------------------------------------------------------------
-- STEP 1: CREATE OR UPDATE HELPER FUNCTION FOR LUHN MODULO-10 CHECKSUM
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[fn_CalculateLuhnCheckDigit]', N'FN') IS NOT NULL
BEGIN
    DROP FUNCTION [dbo].[fn_CalculateLuhnCheckDigit];
END
GO

CREATE FUNCTION [dbo].[fn_CalculateLuhnCheckDigit](@InputDigits VARCHAR(50))
RETURNS INT
AS
BEGIN
    DECLARE @Sum INT = 0;
    DECLARE @Alternate BIT = 1;
    DECLARE @Len INT = LEN(@InputDigits);
    DECLARE @i INT = @Len;
    DECLARE @Digit INT;

    -- Luhn Modulo-10 algorithm processing from right to left
    WHILE @i >= 1
    BEGIN
        SET @Digit = CAST(SUBSTRING(@InputDigits, @i, 1) AS INT);
        IF @Alternate = 1
        BEGIN
            SET @Digit = @Digit * 2;
            IF @Digit > 9
            BEGIN
                SET @Digit = @Digit - 9;
            END
        END
        SET @Sum = @Sum + @Digit;
        SET @Alternate = 1 - @Alternate;
        SET @i = @i - 1;
    END

    DECLARE @Mod INT = @Sum % 10;
    RETURN CASE WHEN @Mod = 0 THEN 0 ELSE 10 - @Mod END;
END
GO
PRINT '  [Step 1] Luhn Modulo-10 Checksum scalar function created.';
GO

----------------------------------------------------------------------------------------------------
-- STEP 2: STANDARDIZE BRANCH CODES (3-Digit Format: 001, 002...)
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Branches]', N'U') IS NOT NULL
BEGIN
    UPDATE [dbo].[Branches] 
    SET [BranchCode] = RIGHT('000' + LTRIM(RTRIM(CAST([BranchID] AS VARCHAR(10)))), 3)
    WHERE [BranchCode] IS NULL OR LEN(LTRIM(RTRIM([BranchCode]))) <> 3 OR [BranchCode] NOT LIKE '[0-9][0-9][0-9]';

    IF NOT EXISTS (SELECT 1 FROM [dbo].[Branches] WHERE [BranchID] = 1)
    BEGIN
        SET IDENTITY_INSERT [dbo].[Branches] ON;
        INSERT INTO [dbo].[Branches] ([BranchID], [BranchName], [BranchCode], [IsActive])
        VALUES (1, N'मुख्य शाखा', '001', 1);
        SET IDENTITY_INSERT [dbo].[Branches] OFF;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[Branches] SET [BranchCode] = '001' WHERE [BranchID] = 1 AND ([BranchCode] IS NULL OR [BranchCode] <> '001');
    END
    PRINT '  [Step 2] Branches standardized to 3-digit CBS format.';
END
GO

----------------------------------------------------------------------------------------------------
-- STEP 3: STANDARDIZE PIGMY SCHEME CODES (3-Digit Format: 301, 302...)
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmySchemes]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'SchemeCode') IS NULL
    BEGIN
        ALTER TABLE [dbo].[PigmySchemes] ADD [SchemeCode] NVARCHAR(50) NULL;
    END
END
GO

IF OBJECT_ID(N'[dbo].[PigmySchemes]', N'U') IS NOT NULL
BEGIN
    -- Update or assign pure 3-digit scheme code (e.g. 301, 302, 303)
    ;WITH SchemeSeq AS (
        SELECT [PigmySchemeID], [SchemeCode],
               ROW_NUMBER() OVER (ORDER BY [PigmySchemeID]) AS RowNum
        FROM [dbo].[PigmySchemes]
    )
    UPDATE s
    SET [SchemeCode] = CAST((300 + RowNum) AS NVARCHAR(10))
    FROM [dbo].[PigmySchemes] s
    JOIN SchemeSeq q ON s.[PigmySchemeID] = q.[PigmySchemeID]
    WHERE s.[SchemeCode] IS NULL 
       OR LTRIM(RTRIM(s.[SchemeCode])) = '' 
       OR s.[SchemeCode] LIKE 'PGS%' 
       OR LEN(LTRIM(RTRIM(s.[SchemeCode]))) <> 3
       OR s.[SchemeCode] NOT LIKE '[0-9][0-9][0-9]';

    PRINT '  [Step 3] PigmySchemes standardized to pure 3-digit scheme codes (301, 302...).';
END
GO

----------------------------------------------------------------------------------------------------
-- STEP 4: CREATE OR UPGRADE PigmyAccountSequences TABLE
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyAccountSequences]', N'U') IS NULL
BEGIN
    PRINT '  [Step 4] Creating PigmyAccountSequences table...';
    CREATE TABLE [dbo].[PigmyAccountSequences] (
        [SequenceID] INT IDENTITY(1,1) NOT NULL,
        [BranchID] INT NOT NULL,
        [SchemeCodeNumeric] INT NOT NULL DEFAULT 301,
        [LastSequenceNumber] INT NOT NULL DEFAULT 0,
        [UpdatedOn] DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [PK_PigmyAccountSequences] PRIMARY KEY CLUSTERED ([SequenceID] ASC)
    );
END
GO

IF OBJECT_ID(N'[dbo].[PigmyAccountSequences]', N'U') IS NOT NULL
BEGIN
    -- Rename ID to SequenceID if exists as ID
    IF COL_LENGTH(N'[dbo].[PigmyAccountSequences]', N'ID') IS NOT NULL AND COL_LENGTH(N'[dbo].[PigmyAccountSequences]', N'SequenceID') IS NULL
    BEGIN
        EXEC sp_rename 'dbo.PigmyAccountSequences.ID', 'SequenceID', 'COLUMN';
    END

    -- Ensure SchemeCodeNumeric column exists
    IF COL_LENGTH(N'[dbo].[PigmyAccountSequences]', N'SchemeCodeNumeric') IS NULL
    BEGIN
        ALTER TABLE [dbo].[PigmyAccountSequences] ADD [SchemeCodeNumeric] INT NOT NULL CONSTRAINT DF_PigmyAccountSequences_SchemeCodeNumeric DEFAULT 301;
    END

    -- Ensure UpdatedOn column exists
    IF COL_LENGTH(N'[dbo].[PigmyAccountSequences]', N'UpdatedOn') IS NULL
    BEGIN
        ALTER TABLE [dbo].[PigmyAccountSequences] ADD [UpdatedOn] DATETIME2 NOT NULL CONSTRAINT DF_PigmyAccountSequences_UpdatedOn DEFAULT GETDATE();
    END
END
GO

IF OBJECT_ID(N'[dbo].[PigmyAccountSequences]', N'U') IS NOT NULL
BEGIN
    -- Ensure Unique Index exists
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PigmyAccountSequences_Branch_Scheme' AND object_id = OBJECT_ID('dbo.PigmyAccountSequences'))
    BEGIN
        -- Drop any old unique indexes on BranchID alone if present
        DECLARE @idxName NVARCHAR(250);
        SELECT @idxName = name FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.PigmyAccountSequences') AND is_unique = 1 AND is_primary_key = 0;
        IF @idxName IS NOT NULL
        BEGIN
            EXEC('DROP INDEX [' + @idxName + '] ON [dbo].[PigmyAccountSequences];');
        END

        CREATE UNIQUE NONCLUSTERED INDEX [IX_PigmyAccountSequences_Branch_Scheme] 
        ON [dbo].[PigmyAccountSequences] ([BranchID] ASC, [SchemeCodeNumeric] ASC);
    END
    PRINT '  [Step 4] PigmyAccountSequences table structure verified.';
END
GO

----------------------------------------------------------------------------------------------------
-- STEP 5: ENHANCE PigmyAccounts TABLE WITH PreviousAccountNo & INDEXES
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyAccounts]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'[dbo].[PigmyAccounts]', N'PreviousAccountNo') IS NULL
    BEGIN
        ALTER TABLE [dbo].[PigmyAccounts] ADD [PreviousAccountNo] NVARCHAR(50) NULL;
        PRINT '  [Step 5] Added [PreviousAccountNo] column to [dbo].[PigmyAccounts].';
    END
END
GO

IF OBJECT_ID(N'[dbo].[PigmyAccounts]', N'U') IS NOT NULL
BEGIN
    -- Create non-clustered index on PreviousAccountNo for high performance multi-tier search
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PigmyAccounts_PreviousAccountNo' AND object_id = OBJECT_ID('dbo.PigmyAccounts'))
    BEGIN
        CREATE NONCLUSTERED INDEX [IX_PigmyAccounts_PreviousAccountNo] 
        ON [dbo].[PigmyAccounts] ([PreviousAccountNo] ASC) WHERE [PreviousAccountNo] IS NOT NULL;
        PRINT '  [Step 5] Created index on [PreviousAccountNo].';
    END

    -- Create non-clustered index on AccountNo
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PigmyAccounts_AccountNo' AND object_id = OBJECT_ID('dbo.PigmyAccounts'))
    BEGIN
        CREATE NONCLUSTERED INDEX [IX_PigmyAccounts_AccountNo] 
        ON [dbo].[PigmyAccounts] ([AccountNo] ASC);
        PRINT '  [Step 5] Created index on [AccountNo].';
    END
END
GO

----------------------------------------------------------------------------------------------------
-- STEP 6: DATA MIGRATION & 14-DIGIT CBS ACCOUNT GENERATION ENGINE
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[PigmyAccounts]', N'U') IS NOT NULL
BEGIN
    PRINT '  [Step 6] Migrating existing Pigmy Accounts to 14-digit CBS standard...';

    -- 6.1: Backup legacy account number to PreviousAccountNo
    UPDATE [dbo].[PigmyAccounts]
    SET [PreviousAccountNo] = LTRIM(RTRIM([AccountNo]))
    WHERE ([PreviousAccountNo] IS NULL OR LTRIM(RTRIM([PreviousAccountNo])) = '')
      AND [AccountNo] IS NOT NULL 
      AND LTRIM(RTRIM([AccountNo])) <> ''
      AND (LEN(LTRIM(RTRIM([AccountNo]))) <> 14 OR [AccountNo] NOT LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]');

    -- 6.2: Assign 14-digit CBS account number to non-standardized accounts
    ;WITH NumberedAccounts AS (
        SELECT 
            p.[PigmyAccountID],
            p.[BranchID],
            COALESCE(p.[PigmySchemeID], 1) AS [PigmySchemeID],
            COALESCE(
                CASE WHEN ISNUMERIC(s.[SchemeCode]) = 1 THEN CAST(s.[SchemeCode] AS INT) ELSE 301 END,
                301
            ) AS [SchemeCodeNumeric],
            ROW_NUMBER() OVER (
                PARTITION BY p.[BranchID], COALESCE(CASE WHEN ISNUMERIC(s.[SchemeCode]) = 1 THEN CAST(s.[SchemeCode] AS INT) ELSE 301 END, 301)
                ORDER BY p.[OpeningDate], p.[PigmyAccountID]
            ) AS [AccountSequence]
        FROM [dbo].[PigmyAccounts] p
        LEFT JOIN [dbo].[PigmySchemes] s ON p.[PigmySchemeID] = s.[PigmySchemeID]
        WHERE p.[AccountNo] IS NULL 
           OR LEN(LTRIM(RTRIM(p.[AccountNo]))) <> 14 
           OR p.[AccountNo] NOT LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
    ),
    Calculated14Digit AS (
        SELECT 
            n.[PigmyAccountID],
            RIGHT('000' + CAST(n.[BranchID] AS VARCHAR(10)), 3) +
            RIGHT('000' + CAST(n.[SchemeCodeNumeric] AS VARCHAR(10)), 3) +
            RIGHT('0000000' + CAST(n.[AccountSequence] AS VARCHAR(10)), 7) AS [ThirteenDigits]
        FROM NumberedAccounts n
    )
    UPDATE p
    SET p.[AccountNo] = c.[ThirteenDigits] + CAST([dbo].[fn_CalculateLuhnCheckDigit](c.[ThirteenDigits]) AS VARCHAR(1))
    FROM [dbo].[PigmyAccounts] p
    JOIN Calculated14Digit c ON p.[PigmyAccountID] = c.[PigmyAccountID];

    -- 6.3: Synchronize PigmyAccountSequences Counter per (BranchID, SchemeCodeNumeric)
    ;WITH BranchSchemeStats AS (
        SELECT 
            p.[BranchID],
            COALESCE(CASE WHEN ISNUMERIC(s.[SchemeCode]) = 1 THEN CAST(s.[SchemeCode] AS INT) ELSE 301 END, 301) AS [SchemeCodeNumeric],
            COUNT(*) AS [TotalCount]
        FROM [dbo].[PigmyAccounts] p
        LEFT JOIN [dbo].[PigmySchemes] s ON p.[PigmySchemeID] = s.[PigmySchemeID]
        GROUP BY p.[BranchID], COALESCE(CASE WHEN ISNUMERIC(s.[SchemeCode]) = 1 THEN CAST(s.[SchemeCode] AS INT) ELSE 301 END, 301)
    )
    MERGE [dbo].[PigmyAccountSequences] AS target
    USING BranchSchemeStats AS source
    ON (target.[BranchID] = source.[BranchID] AND target.[SchemeCodeNumeric] = source.[SchemeCodeNumeric])
    WHEN MATCHED THEN
        UPDATE SET target.[LastSequenceNumber] = CASE WHEN source.[TotalCount] > target.[LastSequenceNumber] THEN source.[TotalCount] ELSE target.[LastSequenceNumber] END,
                   target.[UpdatedOn] = GETDATE()
    WHEN NOT MATCHED THEN
        INSERT ([BranchID], [SchemeCodeNumeric], [LastSequenceNumber], [UpdatedOn])
        VALUES (source.[BranchID], source.[SchemeCodeNumeric], source.[TotalCount], GETDATE());

    -- Ensure default entry for Branch 1 & Scheme 301 exists
    IF NOT EXISTS (SELECT 1 FROM [dbo].[PigmyAccountSequences] WHERE [BranchID] = 1 AND [SchemeCodeNumeric] = 301)
    BEGIN
        INSERT INTO [dbo].[PigmyAccountSequences] ([BranchID], [SchemeCodeNumeric], [LastSequenceNumber], [UpdatedOn])
        VALUES (1, 301, 0, GETDATE());
    END

    PRINT '  [Step 6] Migration completed successfully!';
END
GO

----------------------------------------------------------------------------------------------------
-- STEP 7: RECORD MIGRATION IN SYSTEM VERSION HISTORY
----------------------------------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[SystemVersionHistories]', N'U') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[SystemVersionHistories] ([VersionNumber], [AppliedOn], [PatchName], [Status], [Remarks], [AppliedBy], [ReleaseDate])
    VALUES (
        '2.5.3', 
        GETUTCDATE(), 
        'Pigmy 14-Digit CBS Account Number Standardization (300 Series)', 
        'SUCCESS', 
        'Standard 14-Digit CBS Pigmy Account Architecture: [3-digit Branch] + [3-digit Scheme (301, 302)] + [7-digit Sequence] + [1-digit Luhn Modulo-10 Checksum], PigmyAccountSequences atomic engine, PreviousAccountNo legacy preservation, and 3-digit scheme master.', 
        'Database Administrator / Development Team',
        CONVERT(VARCHAR(10), GETDATE(), 120)
    );
    PRINT '  [Step 7] Recorded version v2.5.3 in SystemVersionHistories.';
END
GO

----------------------------------------------------------------------------------------------------
-- STEP 8: VERIFICATION & AUDIT REPORT
----------------------------------------------------------------------------------------------------
PRINT ' ';
PRINT '================================================================================';
PRINT '  VERIFICATION & AUDIT REPORT                                                   ';
PRINT '================================================================================';

SELECT 
    'Pigmy Accounts Summary' AS [Metric],
    COUNT(*) AS [TotalAccounts],
    SUM(CASE WHEN LEN(LTRIM(RTRIM([AccountNo]))) = 14 AND [AccountNo] LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN 1 ELSE 0 END) AS [Standardized14DigitCount],
    SUM(CASE WHEN [PreviousAccountNo] IS NOT NULL AND LTRIM(RTRIM([PreviousAccountNo])) <> '' THEN 1 ELSE 0 END) AS [PreservedLegacyCount]
FROM [dbo].[PigmyAccounts];

SELECT 
    [BranchID],
    [SchemeCodeNumeric],
    [LastSequenceNumber],
    [UpdatedOn]
FROM [dbo].[PigmyAccountSequences]
ORDER BY [BranchID], [SchemeCodeNumeric];

SELECT TOP 5
    [PigmyAccountID],
    [AccountNo] AS [New_14Digit_AccountNo],
    [PreviousAccountNo] AS [Preserved_Legacy_AccountNo],
    [CustomerID],
    [BranchID],
    [PigmySchemeID],
    [TotalDepositedAmount],
    [Status]
FROM [dbo].[PigmyAccounts]
ORDER BY [PigmyAccountID] DESC;

PRINT '================================================================================';
PRINT '  [SUCCESS] PIGMY 14-DIGIT CBS ACCOUNT ENGINE STANDARDIZATION READY!            ';
PRINT '================================================================================';
GO
