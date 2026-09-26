-- =========================================================================================
-- SmartBanking CBS: Safe Unique Index Migration for FD SchemeCode
-- Purpose: Ensures every FD Scheme has a unique SchemeCode without duplicates or nulls
-- Zero Data Loss Guarantee: Auto-resolves any existing duplicates before creating index
-- =========================================================================================

SET NOCOUNT ON;
PRINT N'Starting Unique SchemeCode Enforcement for FdSchemes...';

-- 1. Ensure SchemeCode column is trimmed and no nulls
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.FdSchemes') AND name = 'SchemeCode')
BEGIN
    -- Fix NULL or empty SchemeCodes
    UPDATE [dbo].[FdSchemes]
    SET [SchemeCode] = 'FD' + RIGHT('000' + CAST([FdSchemeID] AS NVARCHAR(10)), 3)
    WHERE [SchemeCode] IS NULL OR LTRIM(RTRIM([SchemeCode])) = '';

    -- Trim whitespace
    UPDATE [dbo].[FdSchemes]
    SET [SchemeCode] = LTRIM(RTRIM([SchemeCode]))
    WHERE [SchemeCode] <> LTRIM(RTRIM([SchemeCode]));

    -- 2. Deduplicate existing duplicate SchemeCodes (if any)
    ;WITH DuplicateCTE AS (
        SELECT 
            [FdSchemeID],
            [SchemeCode],
            ROW_NUMBER() OVER (
                PARTITION BY UPPER(LTRIM(RTRIM([SchemeCode]))) 
                ORDER BY [FdSchemeID] ASC
            ) AS RowNum
        FROM [dbo].[FdSchemes]
    )
    UPDATE [dbo].[FdSchemes]
    SET [SchemeCode] = LEFT([dbo].[FdSchemes].[SchemeCode], 14) + '-' + CAST([dbo].[FdSchemes].[FdSchemeID] AS NVARCHAR(5))
    FROM [dbo].[FdSchemes]
    INNER JOIN DuplicateCTE ON [dbo].[FdSchemes].[FdSchemeID] = DuplicateCTE.[FdSchemeID]
    WHERE DuplicateCTE.RowNum > 1;

    IF @@ROWCOUNT > 0
    BEGIN
        PRINT N'  + Auto-resolved existing duplicate SchemeCodes by suffixing FdSchemeID.';
    END

    -- 3. Create Unique Nonclustered Index
    IF NOT EXISTS (
        SELECT * FROM sys.indexes 
        WHERE name = 'UQ_FdSchemes_SchemeCode' 
          AND object_id = OBJECT_ID('dbo.FdSchemes')
    )
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX [UQ_FdSchemes_SchemeCode]
        ON [dbo].[FdSchemes]([SchemeCode] ASC);

        PRINT N'  + [SUCCESS] Created Unique Index [UQ_FdSchemes_SchemeCode] on dbo.FdSchemes([SchemeCode]).';
    END
    ELSE
    BEGIN
        PRINT N'  + Unique Index [UQ_FdSchemes_SchemeCode] already exists.';
    END
END
ELSE
BEGIN
    PRINT N'  + [WARNING] SchemeCode column not found in FdSchemes.';
END
GO
