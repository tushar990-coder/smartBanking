-- =========================================================================================
-- SmartBanking CBS: Safe Unique Index Migration for LoanRates (LoanCode & LoanType)
-- Purpose: Ensures every Loan Scheme has a strictly unique LoanCode & LoanType
-- Zero Data Loss Guarantee: Auto-resolves any existing duplicates before creating index
-- =========================================================================================

SET NOCOUNT ON;
PRINT N'Starting Unique LoanCode & LoanType Enforcement for LoanRates...';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanRates')
BEGIN
    -- -------------------------------------------------------------
    -- 1. LOAN CODE UNIQUE INDEX ENFORCEMENT
    -- -------------------------------------------------------------
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LoanRates') AND name = 'LoanCode')
    BEGIN
        -- Fix NULL or empty LoanCode
        UPDATE [dbo].[LoanRates]
        SET [LoanCode] = 'LN' + RIGHT('00' + CAST([LoanRateID] AS NVARCHAR(10)), 2)
        WHERE [LoanCode] IS NULL OR LTRIM(RTRIM([LoanCode])) = '';

        -- Trim whitespace
        UPDATE [dbo].[LoanRates]
        SET [LoanCode] = LTRIM(RTRIM([LoanCode]))
        WHERE [LoanCode] <> LTRIM(RTRIM([LoanCode]));

        -- Deduplicate existing duplicate LoanCode (if any)
        ;WITH DuplicateCodeCTE AS (
            SELECT 
                [LoanRateID],
                [LoanCode],
                ROW_NUMBER() OVER (
                    PARTITION BY UPPER(LTRIM(RTRIM([LoanCode]))) 
                    ORDER BY [LoanRateID] ASC
                ) AS RowNum
            FROM [dbo].[LoanRates]
        )
        UPDATE [dbo].[LoanRates]
        SET [LoanCode] = LEFT([dbo].[LoanRates].[LoanCode], 40) + '-' + CAST([dbo].[LoanRates].[LoanRateID] AS NVARCHAR(5))
        FROM [dbo].[LoanRates]
        INNER JOIN DuplicateCodeCTE ON [dbo].[LoanRates].[LoanRateID] = DuplicateCodeCTE.[LoanRateID]
        WHERE DuplicateCodeCTE.RowNum > 1;

        IF @@ROWCOUNT > 0
        BEGIN
            PRINT N'  + Auto-resolved existing duplicate LoanCodes by suffixing LoanRateID.';
        END

        -- Create Unique Nonclustered Index on LoanCode
        IF NOT EXISTS (
            SELECT * FROM sys.indexes 
            WHERE name = 'IX_LoanRates_LoanCode' 
              AND object_id = OBJECT_ID('dbo.LoanRates')
        )
        BEGIN
            CREATE UNIQUE NONCLUSTERED INDEX [IX_LoanRates_LoanCode]
            ON [dbo].[LoanRates]([LoanCode] ASC)
            WHERE [LoanCode] IS NOT NULL AND [LoanCode] <> '';

            PRINT N'  + [SUCCESS] Created Unique Index [IX_LoanRates_LoanCode] on dbo.LoanRates([LoanCode]).';
        END
        ELSE
        BEGIN
            PRINT N'  + Unique Index [IX_LoanRates_LoanCode] already exists.';
        END
    END

    -- -------------------------------------------------------------
    -- 2. LOAN TYPE UNIQUE INDEX ENFORCEMENT
    -- -------------------------------------------------------------
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LoanRates') AND name = 'LoanType')
    BEGIN
        -- Fix NULL or empty LoanType
        UPDATE [dbo].[LoanRates]
        SET [LoanType] = N'कर्ज योजना ' + CAST([LoanRateID] AS NVARCHAR(10))
        WHERE [LoanType] IS NULL OR LTRIM(RTRIM([LoanType])) = '';

        -- Trim whitespace
        UPDATE [dbo].[LoanRates]
        SET [LoanType] = LTRIM(RTRIM([LoanType]))
        WHERE [LoanType] <> LTRIM(RTRIM([LoanType]));

        -- Deduplicate existing duplicate LoanType (if any)
        ;WITH DuplicateTypeCTE AS (
            SELECT 
                [LoanRateID],
                [LoanType],
                ROW_NUMBER() OVER (
                    PARTITION BY UPPER(LTRIM(RTRIM([LoanType]))) 
                    ORDER BY [LoanRateID] ASC
                ) AS RowNum
            FROM [dbo].[LoanRates]
        )
        UPDATE [dbo].[LoanRates]
        SET [LoanType] = LEFT([dbo].[LoanRates].[LoanType], 80) + N' (' + CAST([dbo].[LoanRates].[LoanRateID] AS NVARCHAR(5)) + N')'
        FROM [dbo].[LoanRates]
        INNER JOIN DuplicateTypeCTE ON [dbo].[LoanRates].[LoanRateID] = DuplicateTypeCTE.[LoanRateID]
        WHERE DuplicateTypeCTE.RowNum > 1;

        IF @@ROWCOUNT > 0
        BEGIN
            PRINT N'  + Auto-resolved existing duplicate LoanTypes by suffixing LoanRateID.';
        END

        -- Create Unique Nonclustered Index on LoanType
        IF NOT EXISTS (
            SELECT * FROM sys.indexes 
            WHERE name = 'IX_LoanRates_LoanType' 
              AND object_id = OBJECT_ID('dbo.LoanRates')
        )
        BEGIN
            CREATE UNIQUE NONCLUSTERED INDEX [IX_LoanRates_LoanType]
            ON [dbo].[LoanRates]([LoanType] ASC)
            WHERE [LoanType] IS NOT NULL AND [LoanType] <> '';

            PRINT N'  + [SUCCESS] Created Unique Index [IX_LoanRates_LoanType] on dbo.LoanRates([LoanType]).';
        END
        ELSE
        BEGIN
            PRINT N'  + Unique Index [IX_LoanRates_LoanType] already exists.';
        END
    END
END
ELSE
BEGIN
    PRINT N'  + [WARNING] LoanRates table does not exist in this database.';
END
GO
