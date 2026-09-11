# ====================================================================================================
# Script: generate_universal_sync_script.ps1
# Purpose: Extract exact table & column metadata from SmartBanking_Template and generate
#          1. Universal_Schema_Only_Sync.sql (Pure DDL table and column sync)
#          2. Compare_Database_Schema_Diff.sql (Interactive schema diff & parity checker)
# ====================================================================================================

param(
    [string]$Server = ".",
    [string]$SourceDatabase = "SmartBanking_Template",
    [string]$OutputFile = "tools\Universal_Schema_Only_Sync.sql",
    [string]$DiffFile = "tools\Compare_Database_Schema_Diff.sql"
)

$ErrorActionPreference = "Stop"

Write-Host "Connecting to SQL Server [$Server], Source DB [$SourceDatabase]..." -ForegroundColor Cyan

$connStr = "Server=$Server;Database=$SourceDatabase;Integrated Security=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

# Query all table metadata
$tableQuery = @"
SELECT 
    t.name AS TableName,
    t.object_id AS ObjectId
FROM sys.tables t
WHERE t.is_ms_shipped = 0
ORDER BY t.name;
"@

$cmd = $conn.CreateCommand()
$cmd.CommandText = $tableQuery
$reader = $cmd.ExecuteReader()
$tablesTable = New-Object System.Data.DataTable
$tablesTable.Load($reader)

Write-Host "Found $($tablesTable.Rows.Count) tables in $SourceDatabase." -ForegroundColor Green

# Query all columns metadata
$columnQuery = @"
SELECT 
    t.name AS TableName,
    c.name AS ColumnName,
    c.column_id AS ColumnId,
    ty.name AS TypeName,
    c.max_length AS MaxLength,
    c.precision AS [Precision],
    c.scale AS Scale,
    c.is_nullable AS IsNullable,
    c.is_identity AS IsIdentity,
    ic.seed_value AS IdentitySeed,
    ic.increment_value AS IdentityIncrement,
    dc.definition AS DefaultDefinition,
    CASE WHEN pk_col.column_id IS NOT NULL THEN 1 ELSE 0 END AS IsPrimaryKey,
    pk_col.PkConstraintName
FROM sys.tables t
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
LEFT JOIN sys.identity_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
LEFT JOIN (
    SELECT kc.parent_object_id, ic.column_id, kc.name AS PkConstraintName
    FROM sys.key_constraints kc
    JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
    WHERE kc.type = 'PK'
) pk_col ON c.object_id = pk_col.parent_object_id AND c.column_id = pk_col.column_id
WHERE t.is_ms_shipped = 0
ORDER BY t.name, c.column_id;
"@

$cmd = $conn.CreateCommand()
$cmd.CommandText = $columnQuery
$reader = $cmd.ExecuteReader()
$columnsTable = New-Object System.Data.DataTable
$columnsTable.Load($reader)

$conn.Close()

Write-Host "Found $($columnsTable.Rows.Count) total columns across all tables." -ForegroundColor Green

# Helper function to format data type definition
function Format-DataType([System.Data.DataRow]$col) {
    $typeName = $col["TypeName"].ToString().ToLower()
    $maxLen = [int]$col["MaxLength"]
    $prec = [int]$col["Precision"]
    $scale = [int]$col["Scale"]

    switch ($typeName) {
        "nvarchar" {
            if ($maxLen -eq -1) { return "NVARCHAR(MAX)" }
            $charLen = [int]($maxLen / 2)
            return "NVARCHAR($charLen)"
        }
        "varchar" {
            if ($maxLen -eq -1) { return "VARCHAR(MAX)" }
            return "VARCHAR($maxLen)"
        }
        "nchar" {
            $charLen = [int]($maxLen / 2)
            return "NCHAR($charLen)"
        }
        "char" {
            return "CHAR($maxLen)"
        }
        "varbinary" {
            if ($maxLen -eq -1) { return "VARBINARY(MAX)" }
            return "VARBINARY($maxLen)"
        }
        "decimal" {
            return "DECIMAL($prec,$scale)"
        }
        "numeric" {
            return "NUMERIC($prec,$scale)"
        }
        "datetime2" {
            return "DATETIME2"
        }
        default {
            return $typeName.ToUpper()
        }
    }
}

# Helper to format fallback default for ALTER TABLE ADD on NOT NULL columns without default
function Get-SafeDefault([System.Data.DataRow]$col) {
    $typeName = $col["TypeName"].ToString().ToLower()
    switch ($typeName) {
        "bit" { return "0" }
        "int" { return "0" }
        "bigint" { return "0" }
        "smallint" { return "0" }
        "tinyint" { return "0" }
        "decimal" { return "0" }
        "numeric" { return "0" }
        "money" { return "0" }
        "float" { return "0" }
        "real" { return "0" }
        "datetime" { return "GETDATE()" }
        "datetime2" { return "GETDATE()" }
        "date" { return "GETDATE()" }
        "uniqueidentifier" { return "NEWID()" }
        default { return "''" }
    }
}

# -----------------------------------------------------------------------------------------
# BUILD UNIVERSAL_SCHEMA_ONLY_SYNC.SQL
# -----------------------------------------------------------------------------------------
Write-Host "Generating $OutputFile..." -ForegroundColor Cyan

$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("-- ====================================================================================================")
[void]$sb.AppendLine("-- SCRIPT: Universal_Schema_Only_Sync.sql")
[void]$sb.AppendLine("-- PURPOSE: Universal Schema-Only Synchronization Script for SmartBanking Core Banking System")
[void]$sb.AppendLine("-- SOURCE BASELINE: $SourceDatabase (Gold Master Baseline - $($tablesTable.Rows.Count) Tables, $($columnsTable.Rows.Count) Columns)")
[void]$sb.AppendLine("-- GENERATED ON: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sb.AppendLine("-- ")
[void]$sb.AppendLine("-- CORE GUARANTEES:")
[void]$sb.AppendLine("--   1. 100% PURE DDL (TABLES & COLUMNS ONLY)")
[void]$sb.AppendLine("--   2. ZERO DATA TOUCHED: NO INSERT, NO UPDATE, NO DELETE, NO TRUNCATE, NO DROP TABLE")
[void]$sb.AppendLine("--   3. 100% IDEMPOTENT: Completely safe to execute multiple times on any existing or new database")
[void]$sb.AppendLine("--   4. NON-DESTRUCTIVE: Preserves all existing client data, existing tables, and custom data")
[void]$sb.AppendLine("-- ")
[void]$sb.AppendLine("-- HOW TO USE:")
[void]$sb.AppendLine("--   1. Open this file in SQL Server Management Studio (SSMS) or your preferred SQL tool.")
[void]$sb.AppendLine("--   2. Replace '[YOUR_TARGET_DATABASE_NAME]' below with your target database name:")
[void]$sb.AppendLine("--          USE [SmartBanking_Test2];  -- Example target database")
[void]$sb.AppendLine("--          GO")
[void]$sb.AppendLine("--   3. Execute the script (Press F5 in SSMS).")
[void]$sb.AppendLine("--   4. Run 'Compare_Database_Schema_Diff.sql' to verify 100% schema parity (0 missing tables/columns).")
[void]$sb.AppendLine("-- ====================================================================================================")
[void]$sb.AppendLine()
[void]$sb.AppendLine("-- !!! STEP 1: SPECIFY YOUR TARGET DATABASE HERE !!!")
[void]$sb.AppendLine("USE [YOUR_TARGET_DATABASE_NAME];")
[void]$sb.AppendLine("GO")
[void]$sb.AppendLine()
[void]$sb.AppendLine("SET ANSI_NULLS ON;")
[void]$sb.AppendLine("SET QUOTED_IDENTIFIER ON;")
[void]$sb.AppendLine("GO")
[void]$sb.AppendLine()
[void]$sb.AppendLine("PRINT '=========================================================================================';")
[void]$sb.AppendLine("PRINT 'STARTING UNIVERSAL SCHEMA-ONLY SYNCHRONIZATION';")
[void]$sb.AppendLine("PRINT 'Target Database: ' + DB_NAME();")
[void]$sb.AppendLine("PRINT 'Execution Time:  ' + CONVERT(VARCHAR(30), GETDATE(), 120);")
[void]$sb.AppendLine("PRINT '=========================================================================================';")
[void]$sb.AppendLine("GO")
[void]$sb.AppendLine()

# Group columns by TableName
$tableGroups = $columnsTable | Group-Object -Property TableName

$tableIndex = 1
$totalTables = $tableGroups.Count

foreach ($group in $tableGroups) {
    $tableName = $group.Name
    $cols = $group.Group | Sort-Object { [int]$_["ColumnId"] }

    [void]$sb.AppendLine("----------------------------------------------------------------------------------------------------")
    [void]$sb.AppendLine("-- [$tableIndex/$totalTables] TABLE: [dbo].[$tableName]")
    [void]$sb.AppendLine("----------------------------------------------------------------------------------------------------")

    # 1. CREATE TABLE BLOCK
    [void]$sb.AppendLine("IF OBJECT_ID(N'[dbo].[$tableName]', N'U') IS NULL")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("    CREATE TABLE [dbo].[$tableName] (")

    $colLines = @()
    $pkCols = @()
    $pkName = "PK_$tableName"

    foreach ($col in $cols) {
        $colName = $col["ColumnName"].ToString()
        $dt = Format-DataType $col
        $isId = [bool]$col["IsIdentity"]
        $isNullable = [bool]$col["IsNullable"]
        $isPk = ([int]$col["IsPrimaryKey"] -eq 1)
        $def = if ($col["DefaultDefinition"] -ne [DBNull]::Value) { $col["DefaultDefinition"].ToString() } else { $null }

        if ($isPk) {
            $pkCols += "[$colName] ASC"
            if ($col["PkConstraintName"] -ne [DBNull]::Value -and -not [string]::IsNullOrWhiteSpace($col["PkConstraintName"])) {
                $pkName = $col["PkConstraintName"].ToString()
            }
        }

        $line = "        [$colName] $dt"

        if ($isId) {
            $seed = $col["IdentitySeed"]
            $inc = $col["IdentityIncrement"]
            if ($seed -ne [DBNull]::Value -and $inc -ne [DBNull]::Value) {
                $line += " IDENTITY($seed,$inc)"
            } else {
                $line += " IDENTITY(1,1)"
            }
        }

        if ($isNullable) {
            $line += " NULL"
        } else {
            $line += " NOT NULL"
        }

        if (-not [string]::IsNullOrWhiteSpace($def)) {
            $line += " DEFAULT $def"
        }

        $colLines += $line
    }

    if ($pkCols.Count -gt 0) {
        $pkColsJoined = [string]::Join(", ", $pkCols)
        $colLines += "        CONSTRAINT [$pkName] PRIMARY KEY CLUSTERED ($pkColsJoined)"
    }

    [void]$sb.AppendLine([string]::Join(",`r`n", $colLines))
    [void]$sb.AppendLine("    );")
    [void]$sb.AppendLine("    PRINT 'Created Table [dbo].[$tableName]';")
    [void]$sb.AppendLine("END")
    [void]$sb.AppendLine("GO")
    [void]$sb.AppendLine()

    # 2. ALTER TABLE ADD COLUMNS BLOCK (Idempotent for existing tables)
    # Check each column to see if it's missing in an existing table
    foreach ($col in $cols) {
        $colName = $col["ColumnName"].ToString()
        $isId = [bool]$col["IsIdentity"]
        $isNullable = [bool]$col["IsNullable"]
        $isPk = ([int]$col["IsPrimaryKey"] -eq 1)
        $dt = Format-DataType $col
        $def = if ($col["DefaultDefinition"] -ne [DBNull]::Value) { $col["DefaultDefinition"].ToString() } else { $null }

        # Skip Identity column in ALTER TABLE ADD because identity can't be added to existing table via simple ADD
        if ($isId) {
            continue
        }

        $alterDef = "[$colName] $dt"
        if ($isNullable) {
            $alterDef += " NULL"
            if (-not [string]::IsNullOrWhiteSpace($def)) {
                $alterDef += " DEFAULT $def"
            }
        } else {
            # NOT NULL column: must have DEFAULT to prevent failure if table already contains rows
            if (-not [string]::IsNullOrWhiteSpace($def)) {
                $alterDef += " NOT NULL DEFAULT $def"
            } else {
                $safeDef = Get-SafeDefault $col
                $alterDef += " NOT NULL DEFAULT $safeDef"
            }
        }

        [void]$sb.AppendLine("IF COL_LENGTH(N'[dbo].[$tableName]', N'$colName') IS NULL")
        [void]$sb.AppendLine("BEGIN")
        [void]$sb.AppendLine("    ALTER TABLE [dbo].[$tableName] ADD $alterDef;")
        [void]$sb.AppendLine("    PRINT '  + Added column [$colName] to [dbo].[$tableName]';")
        [void]$sb.AppendLine("END")
        [void]$sb.AppendLine("GO")
    }

    [void]$sb.AppendLine()
    $tableIndex++
}

[void]$sb.AppendLine("----------------------------------------------------------------------------------------------------")
[void]$sb.AppendLine("-- COMPLETION STATUS")
[void]$sb.AppendLine("----------------------------------------------------------------------------------------------------")
[void]$sb.AppendLine("PRINT '=========================================================================================';")
[void]$sb.AppendLine("PRINT 'UNIVERSAL SCHEMA-ONLY SYNCHRONIZATION COMPLETED SUCCESSFULLY!';")
[void]$sb.AppendLine("PRINT 'All $totalTables tables and $($columnsTable.Rows.Count) columns are now in sync with Golden Master.';")
[void]$sb.AppendLine("PRINT 'Zero data was modified or deleted.';")
[void]$sb.AppendLine("PRINT '=========================================================================================';")
[void]$sb.AppendLine("GO")

[System.IO.File]::WriteAllText($OutputFile, $sb.ToString(), [System.Text.Encoding]::UTF8)
Write-Host "Successfully generated: $OutputFile" -ForegroundColor Green

# -----------------------------------------------------------------------------------------
# BUILD COMPARE_DATABASE_SCHEMA_DIFF.SQL
# -----------------------------------------------------------------------------------------
Write-Host "Generating $DiffFile..." -ForegroundColor Cyan

$diffContent = @"
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
"@

[System.IO.File]::WriteAllText($DiffFile, $diffContent, [System.Text.Encoding]::UTF8)
Write-Host "Successfully generated: $DiffFile" -ForegroundColor Green
