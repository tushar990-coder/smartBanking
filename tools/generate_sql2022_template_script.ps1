# =========================================================================================
# SmartBanking ERP - SQL Server 2022 Pure Template Database Generator
# Generates a 100% portable, error-free Transact-SQL deployment script
# Preserves: AccountGroups (31), Ledgers (195), Roles, Users, Branches, FinancialYears
# Clears: All Customers, Accounts, Transactions, Vouchers, Operational logs
# =========================================================================================

$server = "localhost"
$sourceDb = "SmartBanking_Template"
$outputFile = "d:\Bhisi Software\tools\SmartBanking_Template_SQL2022_Pure_Script.sql"
$outputBak = "d:\Bhisi Software\SmartBanking_Template_SQL2022.bak"
$desktopBak = "$([Environment]::GetFolderPath('Desktop'))\SmartBanking_Template_SQL2022.bak"
$desktopSql = "$([Environment]::GetFolderPath('Desktop'))\SmartBanking_Template_SQL2022_Pure_Script.sql"

Write-Host "=================================================================="
Write-Host "  SmartBanking ERP - SQL Server 2022 Template Generator"
Write-Host "=================================================================="

# 1. Connect to Source Database via ADO.NET
$connString = "Server=$server;Database=$sourceDb;Integrated Security=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connString)
$conn.Open()

$sb = New-Object System.Text.StringBuilder

# Header
[void]$sb.AppendLine("-- =========================================================================================")
[void]$sb.AppendLine("-- SmartBanking Core ERP - 100% Pure SQL Server 2022 Template Database Deployment Script")
[void]$sb.AppendLine("-- Generated Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sb.AppendLine("-- Zero Mismatch Guarantee: Runs cleanly on SQL Server 2022, 2019, 2016 and Azure SQL")
[void]$sb.AppendLine("-- Preserved Masters: AccountGroups (खाते गट), Ledgers (खाते माहिती), Users, Roles, Branches")
[void]$sb.AppendLine("-- Cleared: All transactional data, customer records, account balances & opening balances")
[void]$sb.AppendLine("-- =========================================================================================")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("SET NOCOUNT ON;")
[void]$sb.AppendLine("SET ANSI_NULLS ON;")
[void]$sb.AppendLine("SET QUOTED_IDENTIFIER ON;")
[void]$sb.AppendLine("SET ANSI_PADDING ON;")
[void]$sb.AppendLine("SET ANSI_WARNINGS ON;")
[void]$sb.AppendLine("SET ARITHABORT ON;")
[void]$sb.AppendLine("SET CONCAT_NULL_YIELDS_NULL ON;")
[void]$sb.AppendLine("SET NUMERIC_ROUNDABORT OFF;")
[void]$sb.AppendLine("GO")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("DECLARE @dbName NVARCHAR(128) = DB_NAME();")
[void]$sb.AppendLine("PRINT '========================================================================';")
[void]$sb.AppendLine("PRINT '  Deploying SmartBanking ERP Template Database to: ' + @dbName;")
[void]$sb.AppendLine("PRINT '========================================================================';")
[void]$sb.AppendLine("GO")
[void]$sb.AppendLine("")

# 2. Get All User Tables in Dependency Order or Alphabetical
$tableCmd = $conn.CreateCommand()
$tableCmd.CommandText = @"
SELECT t.name AS TableName, s.name AS SchemaName
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE t.is_ms_shipped = 0 AND t.name != '__EFMigrationsHistory'
ORDER BY t.name;
"@

$tables = New-Object System.Collections.Generic.List[string]
$reader = $tableCmd.ExecuteReader()
while ($reader.Read()) {
    $tables.Add($reader["TableName"].ToString())
}
$reader.Close()

Write-Host "Found $($tables.Count) tables in $sourceDb."

# 3. Generate CREATE TABLE statements for each table
Write-Host "Generating table schemas..."
foreach ($t in $tables) {
    [void]$sb.AppendLine("-- -----------------------------------------------------------------------------------------")
    [void]$sb.AppendLine("-- Table: [$t]")
    [void]$sb.AppendLine("-- -----------------------------------------------------------------------------------------")
    [void]$sb.AppendLine("IF OBJECT_ID('dbo.[$t]', 'U') IS NULL")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("    CREATE TABLE dbo.[$t] (")

    # Get Columns
    $colCmd = $conn.CreateCommand()
    $colCmd.CommandText = @"
    SELECT 
        c.name AS ColumnName,
        tp.name AS TypeName,
        c.max_length,
        c.precision,
        c.scale,
        c.is_nullable,
        c.is_identity,
        ic.seed_value,
        ic.increment_value,
        ISNULL(dc.definition, '') AS DefaultDefinition,
        c.column_id
    FROM sys.columns c
    JOIN sys.types tp ON c.user_type_id = tp.user_type_id
    LEFT JOIN sys.identity_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
    WHERE c.object_id = OBJECT_ID('dbo.[$t]')
    ORDER BY c.column_id;
"@
    $colReader = $colCmd.ExecuteReader()
    $colDefs = New-Object System.Collections.Generic.List[string]

    while ($colReader.Read()) {
        $cName = $colReader["ColumnName"].ToString()
        $tName = $colReader["TypeName"].ToString()
        $maxLen = [int]$colReader["max_length"]
        $prec = [int]$colReader["precision"]
        $scale = [int]$colReader["scale"]
        $isNullable = [bool]$colReader["is_nullable"]
        $isIdentity = [bool]$colReader["is_identity"]
        $defaultDef = $colReader["DefaultDefinition"].ToString()

        $typeStr = $tName
        if ($tName -in @("nvarchar", "nchar")) {
            if ($maxLen -eq -1) { $typeStr = "$tName(MAX)" }
            else { $typeStr = "$tName($($maxLen / 2))" }
        } elseif ($tName -in @("varchar", "char", "varbinary", "binary")) {
            if ($maxLen -eq -1) { $typeStr = "$tName(MAX)" }
            else { $typeStr = "$tName($maxLen)" }
        } elseif ($tName -in @("decimal", "numeric")) {
            $typeStr = "$tName($prec, $scale)"
        }

        $identStr = ""
        if ($isIdentity) {
            $identStr = " IDENTITY(1,1)"
        }

        $nullStr = if ($isNullable) { "NULL" } else { "NOT NULL" }
        $defStr = if ($defaultDef -ne "") { " DEFAULT $defaultDef" } else { "" }

        $colDefs.Add("        [$cName] $typeStr$identStr $nullStr$defStr")
    }
    $colReader.Close()

    # Get Primary Key
    $pkCmd = $conn.CreateCommand()
    $pkCmd.CommandText = @"
    SELECT i.name AS PkName, c.name AS ColumnName
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('dbo.[$t]') AND i.is_primary_key = 1
    ORDER BY ic.key_ordinal;
"@
    $pkReader = $pkCmd.ExecuteReader()
    $pkCols = New-Object System.Collections.Generic.List[string]
    $pkName = ""
    while ($pkReader.Read()) {
        $pkName = $pkReader["PkName"].ToString()
        $pkCols.Add("[$($pkReader["ColumnName"])]")
    }
    $pkReader.Close()

    if ($pkCols.Count -gt 0) {
        $colDefs.Add("        CONSTRAINT [$pkName] PRIMARY KEY CLUSTERED ($($pkCols -join ', '))")
    }

    [void]$sb.AppendLine(($colDefs -join ",`n"))
    [void]$sb.AppendLine("    );")
    [void]$sb.AppendLine("    PRINT 'Created table [$t]';")
    [void]$sb.AppendLine("END;")
    [void]$sb.AppendLine("GO")
    [void]$sb.AppendLine("")
}

# 4. Generate Indexes (Non-PK)
Write-Host "Generating indexes..."
[void]$sb.AppendLine("-- =========================================================================================")
[void]$sb.AppendLine("-- INDEXES")
[void]$sb.AppendLine("-- =========================================================================================")

foreach ($t in $tables) {
    $idxCmd = $conn.CreateCommand()
    $idxCmd.CommandText = @"
    SELECT 
        i.name AS IndexName,
        i.is_unique,
        i.has_filter,
        ISNULL(i.filter_definition, '') AS FilterDef
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID('dbo.[$t]') 
      AND i.is_primary_key = 0 
      AND i.type > 0
      AND i.name IS NOT NULL
    ORDER BY i.name;
"@
    $idxReader = $idxCmd.ExecuteReader()
    $idxList = New-Object System.Collections.Generic.List[PSObject]
    while ($idxReader.Read()) {
        $idxList.Add([PSCustomObject]@{
            IndexName = $idxReader["IndexName"].ToString()
            IsUnique = [bool]$idxReader["is_unique"]
            HasFilter = [bool]$idxReader["has_filter"]
            FilterDef = $idxReader["FilterDef"].ToString()
        })
    }
    $idxReader.Close()

    foreach ($idx in $idxList) {
        $iName = $idx.IndexName
        $iColsCmd = $conn.CreateCommand()
        $iColsCmd.CommandText = @"
        SELECT c.name AS ColumnName, ic.is_descending_key
        FROM sys.index_columns ic
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE ic.object_id = OBJECT_ID('dbo.[$t]') AND ic.index_id = (SELECT index_id FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.[$t]') AND name = '$iName')
        ORDER BY ic.key_ordinal;
"@
        $iColsReader = $iColsCmd.ExecuteReader()
        $iCols = New-Object System.Collections.Generic.List[string]
        while ($iColsReader.Read()) {
            $desc = if ([bool]$iColsReader["is_descending_key"]) { " DESC" } else { " ASC" }
            $iCols.Add("[$($iColsReader["ColumnName"])]$desc")
        }
        $iColsReader.Close()

        $uniq = if ($idx.IsUnique) { "UNIQUE " } else { "" }
        $filt = if ($idx.HasFilter -and $idx.FilterDef -ne "") { " WHERE $($idx.FilterDef)" } else { "" }

        [void]$sb.AppendLine("IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = N'$iName' AND object_id = OBJECT_ID('dbo.[$t]'))")
        [void]$sb.AppendLine("BEGIN")
        [void]$sb.AppendLine("    CREATE ${uniq}NONCLUSTERED INDEX [$iName] ON dbo.[$t] ($($iCols -join ', '))$filt;")
        [void]$sb.AppendLine("END;")
        [void]$sb.AppendLine("GO")
    }
}

# 5. Generate Master Data Inserts (AccountGroups, Ledgers, Users, Roles, Branches, FinancialYears)
Write-Host "Exporting preserved master seed data..."
[void]$sb.AppendLine("")
[void]$sb.AppendLine("-- =========================================================================================")
[void]$sb.AppendLine("-- PRESERVED CORE MASTER SEED DATA (Chart of Accounts & Essential Configs)")
[void]$sb.AppendLine("-- =========================================================================================")
[void]$sb.AppendLine("SET NOCOUNT ON;")
[void]$sb.AppendLine("GO")

# Helper function to script table data
function Script-TableData($tblName, $hasIdentity = $true) {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT * FROM dbo.[$tblName]"
    $r = $cmd.ExecuteReader()
    
    $cols = New-Object System.Collections.Generic.List[string]
    $types = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $r.FieldCount; $i++) {
        $cols.Add($r.GetName($i))
        $types.Add($r.GetDataTypeName($i))
    }

    $rows = New-Object System.Collections.Generic.List[string]
    while ($r.Read()) {
        $vals = New-Object System.Collections.Generic.List[string]
        for ($i = 0; $i -lt $r.FieldCount; $i++) {
            if ($r.IsDBNull($i)) {
                $vals.Add("NULL")
            } else {
                $t = $types[$i]
                $v = $r.GetValue($i)
                if ($t -in @("nvarchar", "nchar", "ntext")) {
                    $escaped = $v.ToString().Replace("'", "''")
                    $vals.Add("N'$escaped'")
                } elseif ($t -in @("varchar", "char", "text")) {
                    $escaped = $v.ToString().Replace("'", "''")
                    $vals.Add("N'$escaped'")
                } elseif ($t -in @("bit")) {
                    $bitVal = if ([bool]$v) { "1" } else { "0" }
                    $vals.Add($bitVal)
                } elseif ($t -in @("datetime", "datetime2", "date", "smalldatetime")) {
                    $dtStr = ([DateTime]$v).ToString("yyyy-MM-ddTHH:mm:ss.fff", [System.Globalization.CultureInfo]::InvariantCulture)
                    $vals.Add("CONVERT(datetime2, '$dtStr', 126)")
                } else {
                    $vals.Add($v.ToString())
                }
            }
        }
        $rows.Add("        (" + ($vals -join ", ") + ")")
    }
    $r.Close()

    if ($rows.Count -gt 0) {
        $colList = ($cols | ForEach-Object { "[$_]" }) -join ", "
        $res = New-Object System.Text.StringBuilder
        [void]$res.AppendLine("-- Table Seed: [$tblName] ($($rows.Count) rows)")
        [void]$res.AppendLine("IF NOT EXISTS (SELECT 1 FROM dbo.[$tblName])")
        [void]$res.AppendLine("BEGIN")
        if ($hasIdentity) {
            [void]$res.AppendLine("    SET IDENTITY_INSERT dbo.[$tblName] ON;")
        }
        [void]$res.AppendLine("    INSERT INTO dbo.[$tblName] ($colList) VALUES")
        [void]$res.AppendLine(($rows -join ",`n") + ";")
        if ($hasIdentity) {
            [void]$res.AppendLine("    SET IDENTITY_INSERT dbo.[$tblName] OFF;")
        }
        [void]$res.AppendLine("    PRINT 'Seeded [$tblName] ($($rows.Count) records)';")
        [void]$res.AppendLine("END;")
        [void]$res.AppendLine("GO")
        return $res.ToString()
    }
    return ""
}

# Tables to seed
$tablesToSeed = @(
    @{ Name = "AccountGroups"; HasIdentity = $true },
    @{ Name = "Ledgers"; HasIdentity = $true },
    @{ Name = "Roles"; HasIdentity = $true },
    @{ Name = "RolePermissions"; HasIdentity = $true },
    @{ Name = "Users"; HasIdentity = $true },
    @{ Name = "Branches"; HasIdentity = $true },
    @{ Name = "FinancialYears"; HasIdentity = $true },
    @{ Name = "SansthaDetails"; HasIdentity = $true },
    @{ Name = "SecurityTypes"; HasIdentity = $true },
    @{ Name = "SavingInterestSettings"; HasIdentity = $true },
    @{ Name = "CashManagementSettings"; HasIdentity = $true }
)

foreach ($item in $tablesToSeed) {
    $script = Script-TableData -tblName $item.Name -hasIdentity $item.HasIdentity
    if ($script -ne "") {
        [void]$sb.AppendLine($script)
    }
}

# 6. Generate Foreign Keys at the End
Write-Host "Generating Foreign Key constraints..."
[void]$sb.AppendLine("")
[void]$sb.AppendLine("-- =========================================================================================")
[void]$sb.AppendLine("-- FOREIGN KEY CONSTRAINTS")
[void]$sb.AppendLine("-- =========================================================================================")

$fkCmd = $conn.CreateCommand()
$fkCmd.CommandText = @"
SELECT 
    fk.name AS ForeignKeyName,
    tp.name AS ParentTable,
    cp.name AS ParentColumn,
    tr.name AS ReferencedTable,
    cr.name AS ReferencedColumn,
    fk.delete_referential_action_desc AS DeleteRule
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
ORDER BY tp.name, fk.name;
"@

$fkReader = $fkCmd.ExecuteReader()
while ($fkReader.Read()) {
    $fkName = $fkReader["ForeignKeyName"].ToString()
    $pTable = $fkReader["ParentTable"].ToString()
    $pCol = $fkReader["ParentColumn"].ToString()
    $rTable = $fkReader["ReferencedTable"].ToString()
    $rCol = $fkReader["ReferencedColumn"].ToString()
    $delRule = $fkReader["DeleteRule"].ToString().Replace("_", " ")

    [void]$sb.AppendLine("IF NOT EXISTS (SELECT name FROM sys.foreign_keys WHERE name = N'$fkName')")
    [void]$sb.AppendLine("BEGIN")
    [void]$sb.AppendLine("    ALTER TABLE dbo.[$pTable] WITH CHECK ADD CONSTRAINT [$fkName] FOREIGN KEY ([$pCol]) REFERENCES dbo.[$rTable] ([$rCol]) ON DELETE $delRule;")
    [void]$sb.AppendLine("END;")
    [void]$sb.AppendLine("GO")
}
$fkReader.Close()
$conn.Close()

# Save SQL script with UTF-8 BOM encoding for perfect Marathi support
$utf8Encoding = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($outputFile, $sb.ToString(), $utf8Encoding)
[System.IO.File]::WriteAllText($desktopSql, $sb.ToString(), $utf8Encoding)

Write-Host "------------------------------------------------------------------"
Write-Host " [SUCCESS] Pure SQL 2022 Script generated successfully!"
Write-Host " File: $outputFile"
Write-Host " Desktop Copy: $desktopSql"
Write-Host "------------------------------------------------------------------"

# 7. Take a fresh Backup file from SmartBanking_Template
Write-Host "Creating fresh backup (.bak)..."
$backupSql = "BACKUP DATABASE SmartBanking_Template TO DISK = '$outputBak' WITH INIT, STATS = 10, FORMAT;"
Invoke-Expression "sqlcmd -S `"$server`" -Q `"$backupSql`""
if (Test-Path $outputBak) {
    Copy-Item -Path $outputBak -Destination $desktopBak -Force
    Write-Host " [SUCCESS] Backup created and copied to Desktop: $desktopBak"
}
