-- ====================================================================================================
-- SCRIPT: Compare_Database_Schema_Diff.sql
-- PURPOSE: Compare Schema (Tables & Columns) between Source (Gold Master) and Target Database
-- INSTRUCTIONS:
--   1. Change @SourceDB and @TargetDB to match your database names.
--   2. Run this script in SSMS or via sqlcmd.
--   3. Review the Summary and Detailed Missing Items lists.
-- ====================================================================================================

-- !!! SET YOUR DATABASE NAMES HERE !!!
DECLARE @SourceDB SYSNAME = 'SmartBanking_Template';  -- Golden Master Baseline
DECLARE @TargetDB SYSNAME = 'SmartBanking_Test2';     -- Change to the Database you want to check

SET NOCOUNT ON;

PRINT '====================================================================================================';
PRINT 'SMARTBANKING DATABASE SCHEMA PARITY AUDIT REPORT';
PRINT 'Source Database (Golden Master) : [' + @SourceDB + ']';
PRINT 'Target Database (Sanstha/Branch): [' + @TargetDB + ']';
PRINT 'Audit Timestamp                 : ' + CONVERT(VARCHAR(30), GETDATE(), 120);
PRINT '====================================================================================================';

-- Check if both databases exist
IF DB_ID(@SourceDB) IS NULL
BEGIN
    RAISERROR(N'ERROR: Source database [%s] does not exist on this SQL Server instance.', 16, 1, @SourceDB);
    RETURN;
END

IF DB_ID(@TargetDB) IS NULL
BEGIN
    RAISERROR(N'ERROR: Target database [%s] does not exist on this SQL Server instance.', 16, 1, @TargetDB);
    RETURN;
END

DECLARE @sql NVARCHAR(MAX);

-- ----------------------------------------------------------------------------------------------------
-- 1. SUMMARY AUDIT COUNTERS
-- ----------------------------------------------------------------------------------------------------
SET @sql = N'
WITH SourceTables AS (
    SELECT TABLE_NAME 
    FROM ' + QUOTENAME(@SourceDB) + N'.INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = ''BASE TABLE''
),
TargetTables AS (
    SELECT TABLE_NAME 
    FROM ' + QUOTENAME(@TargetDB) + N'.INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = ''BASE TABLE''
),
SourceColumns AS (
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM ' + QUOTENAME(@SourceDB) + N'.INFORMATION_SCHEMA.COLUMNS
),
TargetColumns AS (
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM ' + QUOTENAME(@TargetDB) + N'.INFORMATION_SCHEMA.COLUMNS
)
SELECT 
    ''' + @SourceDB + N''' AS SourceDB,
    ''' + @TargetDB + N''' AS TargetDB,
    (SELECT COUNT(*) FROM SourceTables) AS SourceTablesCount,
    (SELECT COUNT(*) FROM TargetTables) AS TargetTablesCount,
    (SELECT COUNT(*) FROM SourceTables s WHERE NOT EXISTS (SELECT 1 FROM TargetTables t WHERE t.TABLE_NAME = s.TABLE_NAME)) AS MissingTablesCount,
    (SELECT COUNT(*) FROM SourceColumns) AS SourceColumnsCount,
    (SELECT COUNT(*) FROM TargetColumns) AS TargetColumnsCount,
    (SELECT COUNT(*) FROM SourceColumns s WHERE NOT EXISTS (SELECT 1 FROM TargetColumns t WHERE t.TABLE_NAME = s.TABLE_NAME AND t.COLUMN_NAME = s.COLUMN_NAME)) AS MissingColumnsCount,
    CASE 
        WHEN (SELECT COUNT(*) FROM SourceTables s WHERE NOT EXISTS (SELECT 1 FROM TargetTables t WHERE t.TABLE_NAME = s.TABLE_NAME)) = 0
         AND (SELECT COUNT(*) FROM SourceColumns s WHERE NOT EXISTS (SELECT 1 FROM TargetColumns t WHERE t.TABLE_NAME = s.TABLE_NAME AND t.COLUMN_NAME = s.COLUMN_NAME)) = 0
        THEN ''100% IN SYNC - FULL PARITY (READY)''
        ELSE ''OUT OF SYNC - RUN Universal_Schema_Only_Sync.sql''
    END AS OverallStatus;
';
EXEC sp_executesql @sql;

-- ----------------------------------------------------------------------------------------------------
-- 2. LIST MISSING TABLES IN TARGET DATABASE
-- ----------------------------------------------------------------------------------------------------
PRINT '';
PRINT '>>> 1. MISSING TABLES IN TARGET DATABASE ([' + @TargetDB + ']):';
SET @sql = N'
WITH SourceTables AS (
    SELECT TABLE_NAME 
    FROM ' + QUOTENAME(@SourceDB) + N'.INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = ''BASE TABLE''
),
TargetTables AS (
    SELECT TABLE_NAME 
    FROM ' + QUOTENAME(@TargetDB) + N'.INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = ''BASE TABLE''
)
SELECT 
    s.TABLE_NAME AS [Missing_Table_Name],
    ''MISSING IN ' + @TargetDB + N''' AS [Status],
    ''Run Universal_Schema_Only_Sync.sql to create'' AS [ResolutionAction]
FROM SourceTables s
WHERE NOT EXISTS (SELECT 1 FROM TargetTables t WHERE t.TABLE_NAME = s.TABLE_NAME)
ORDER BY s.TABLE_NAME;
';
EXEC sp_executesql @sql;

-- ----------------------------------------------------------------------------------------------------
-- 3. LIST MISSING COLUMNS IN TARGET DATABASE (FOR EXISTING TABLES)
-- ----------------------------------------------------------------------------------------------------
PRINT '';
PRINT '>>> 2. MISSING COLUMNS IN TARGET DATABASE ([' + @TargetDB + ']):';
SET @sql = N'
WITH SourceCols AS (
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM ' + QUOTENAME(@SourceDB) + N'.INFORMATION_SCHEMA.COLUMNS
),
TargetCols AS (
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM ' + QUOTENAME(@TargetDB) + N'.INFORMATION_SCHEMA.COLUMNS
),
TargetTables AS (
    SELECT TABLE_NAME 
    FROM ' + QUOTENAME(@TargetDB) + N'.INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = ''BASE TABLE''
)
SELECT 
    s.TABLE_NAME AS [Table_Name],
    s.COLUMN_NAME AS [Missing_Column_Name],
    s.DATA_TYPE + 
        CASE 
            WHEN s.DATA_TYPE IN (''nvarchar'', ''varchar'', ''char'', ''nchar'') THEN 
                ''('' + CASE WHEN s.CHARACTER_MAXIMUM_LENGTH = -1 THEN ''MAX'' ELSE CAST(s.CHARACTER_MAXIMUM_LENGTH AS VARCHAR(10)) END + '')''
            ELSE ''''
        END AS [DataType],
    s.IS_NULLABLE AS [Nullable],
    ''MISSING COLUMN'' AS [Status]
FROM SourceCols s
JOIN TargetTables tt ON s.TABLE_NAME = tt.TABLE_NAME
WHERE NOT EXISTS (SELECT 1 FROM TargetCols t WHERE t.TABLE_NAME = s.TABLE_NAME AND t.COLUMN_NAME = s.COLUMN_NAME)
ORDER BY s.TABLE_NAME, s.COLUMN_NAME;
';
EXEC sp_executesql @sql;

PRINT '';
PRINT '====================================================================================================';
PRINT 'END OF AUDIT REPORT';
PRINT '====================================================================================================';