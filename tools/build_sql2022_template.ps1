[System.Reflection.Assembly]::LoadWithPartialName('Microsoft.SqlServer.Smo') | Out-Null
[System.Reflection.Assembly]::LoadWithPartialName('Microsoft.SqlServer.SmoExtended') | Out-Null

$serverName = ".\SQLEXPRESS01"
$dbName = "SmartBanking_Template"
$outputSql = "d:\Bhisi Software\tools\template_export\SmartBanking_Template_Server2022.sql"

$server = New-Object Microsoft.SqlServer.Management.Smo.Server($serverName)
$db = $server.Databases[$dbName]

if ($null -eq $db) {
    Write-Error "Database $dbName not found."
    exit 1
}

Write-Host "Initializing Scripter for SQL Server 2022 (Version 160)..."
$scripter = New-Object Microsoft.SqlServer.Management.Smo.Scripter($server)
$scripter.Options.TargetServerVersion = [Microsoft.SqlServer.Management.Smo.SqlServerVersion]::Version160
$scripter.Options.ScriptSchema = $true
$scripter.Options.ScriptData = $false
$scripter.Options.Indexes = $true
$scripter.Options.DriAllConstraints = $true
$scripter.Options.DriForeignKeys = $false  # FKs will be scripted separately after data
$scripter.Options.DriPrimaryKey = $true
$scripter.Options.DriUniqueKeys = $true
$scripter.Options.DriDefaults = $true
$scripter.Options.Triggers = $false
$scripter.Options.AnsiPadding = $true
$scripter.Options.IncludeHeaders = $false

$sw = New-Object System.IO.StreamWriter($outputSql, $false, [System.Text.Encoding]::UTF8)

# Header
$sw.WriteLine("-- ===========================================================================")
$sw.WriteLine("-- SmartBanking_Template - Master Template Database Creation Script")
$sw.WriteLine("-- Fully Compatible with: Microsoft SQL Server 2022 (Version 160) & Earlier")
$sw.WriteLine("-- Pure CIF-First Architecture (Zero MemberID Fallback in FD/RD/Pigmy)")
$sw.WriteLine("-- Generated Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$sw.WriteLine("-- ===========================================================================")
$sw.WriteLine("USE master;")
$sw.WriteLine("GO")
$sw.WriteLine("IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'$dbName')")
$sw.WriteLine("BEGIN")
$sw.WriteLine("    CREATE DATABASE [$dbName];")
$sw.WriteLine("END")
$sw.WriteLine("GO")
$sw.WriteLine("ALTER DATABASE [$dbName] SET COMPATIBILITY_LEVEL = 160;")
$sw.WriteLine("GO")
$sw.WriteLine("USE [$dbName];")
$sw.WriteLine("GO")
$sw.WriteLine("SET ANSI_NULLS ON;")
$sw.WriteLine("SET QUOTED_IDENTIFIER ON;")
$sw.WriteLine("GO")

# 1. Script Tables
Write-Host "Scripting tables..."
$tables = $db.Tables | Where-Object { -not $_.IsSystemObject }
foreach ($tbl in $tables) {
    $lines = $scripter.EnumScript($tbl)
    foreach ($line in $lines) {
        $sw.WriteLine($line)
        $sw.WriteLine("GO")
    }
}

# 2. Master Data Inserts
$masterTables = @(
    "Roles",
    "Branches",
    "SansthaDetails",
    "FinancialYears",
    "Users",
    "BankMasters",
    "CashManagementSettings",
    "Cashiers",
    "AccountGroups",
    "Ledgers",
    "ShareSchemes",
    "FdSchemes",
    "RdSchemes",
    "PigmySchemes",
    "SavingInterestSettings",
    "LoanRates",
    "NpaConfigs",
    "NpaProvisionSlabs",
    "CifSequences",
    "SystemVersionHistories"
)

Write-Host "Scripting master data inserts..."
$connStr = "Server=.\SQLEXPRESS01;Database=SmartBanking_Template;Trusted_Connection=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

foreach ($mTable in $masterTables) {
    $tblObj = $db.Tables[$mTable]
    if ($null -eq $tblObj) { continue }
    
    $hasIdentity = $false
    foreach ($col in $tblObj.Columns) {
        if ($col.Identity) { $hasIdentity = $true; break }
    }
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT * FROM [dbo].[$mTable]"
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $dt = New-Object System.Data.DataTable
    $adapter.Fill($dt) | Out-Null
    
    if ($dt.Rows.Count -gt 0) {
        $sw.WriteLine("-- -------------------------------------------------------------")
        $sw.WriteLine("-- Master Data: [dbo].[$mTable] ($($dt.Rows.Count) rows)")
        $sw.WriteLine("-- -------------------------------------------------------------")
        if ($hasIdentity) {
            $sw.WriteLine("SET IDENTITY_INSERT [dbo].[$mTable] ON;")
            $sw.WriteLine("GO")
        }
        
        $colNames = @()
        foreach ($c in $dt.Columns) {
            $colNames += "[" + $c.ColumnName + "]"
        }
        $colListStr = $colNames -join ", "
        
        foreach ($row in $dt.Rows) {
            $valParts = @()
            for ($i = 0; $i -lt $dt.Columns.Count; $i++) {
                $val = $row[$i]
                if ($val -is [System.DBNull] -or $null -eq $val) {
                    $valParts += "NULL"
                } elseif ($val -is [System.Boolean]) {
                    $valParts += if ($val) { "1" } else { "0" }
                } elseif ($val -is [System.Byte] -or $val -is [System.Int16] -or $val -is [System.Int32] -or $val -is [System.Int64] -or $val -is [System.Decimal] -or $val -is [System.Double] -or $val -is [System.Single]) {
                    $valParts += $val.ToString()
                } elseif ($val -is [System.DateTime]) {
                    $valParts += "'" + $val.ToString("yyyy-MM-dd HH:mm:ss.fff") + "'"
                } else {
                    $esc = $val.ToString().Replace("'", "''")
                    $valParts += "N'" + $esc + "'"
                }
            }
            $valListStr = $valParts -join ", "
            $sw.WriteLine("INSERT INTO [dbo].[$mTable] ($colListStr) VALUES ($valListStr);")
        }
        $sw.WriteLine("GO")
        
        if ($hasIdentity) {
            $sw.WriteLine("SET IDENTITY_INSERT [dbo].[$mTable] OFF;")
            $sw.WriteLine("GO")
        }
    }
}
$conn.Close()

# 3. Script Foreign Keys
Write-Host "Scripting foreign keys..."
foreach ($tbl in $tables) {
    if ($tbl.ForeignKeys.Count -gt 0) {
        foreach ($fk in $tbl.ForeignKeys) {
            $lines = $fk.Script()
            foreach ($line in $lines) {
                $sw.WriteLine($line)
                $sw.WriteLine("GO")
            }
        }
    }
}

# 4. Script Views
Write-Host "Scripting views..."
foreach ($view in $db.Views) {
    if (-not $view.IsSystemObject) {
        $lines = $view.Script()
        foreach ($line in $lines) {
            $sw.WriteLine($line)
            $sw.WriteLine("GO")
        }
    }
}

# 5. Script Stored Procedures
Write-Host "Scripting stored procedures..."
$conn2 = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn2.Open()
$cmdSp = $conn2.CreateCommand()
$cmdSp.CommandText = "SELECT definition FROM sys.sql_modules WHERE object_id IN (SELECT object_id FROM sys.procedures WHERE is_ms_shipped = 0)"
$rSp = $cmdSp.ExecuteReader()
while ($rSp.Read()) {
    $sw.WriteLine("SET ANSI_NULLS ON;")
    $sw.WriteLine("SET QUOTED_IDENTIFIER ON;")
    $sw.WriteLine("GO")
    $sw.WriteLine($rSp[0])
    $sw.WriteLine("GO")
}
$conn2.Close()

# 6. Reseed Identity values and Reset CIF Sequences
Write-Host "Adding reseed and sequence reset block..."
$sw.WriteLine("-- =============================================================")
$sw.WriteLine("-- Identity Reseed & CIF Sequence Initialization")
$sw.WriteLine("-- =============================================================")
$sw.WriteLine("UPDATE [dbo].[CifSequences] SET [CurrentValue] = 0, [LastUpdated] = GETDATE();")
$sw.WriteLine("GO")

$sw.WriteLine(@"
DECLARE @reseedSql NVARCHAR(MAX) = N'';
SELECT @reseedSql += N'
IF OBJECT_ID(''' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ''', ''U'') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ')
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(''' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ''') AND last_value IS NOT NULL)
        BEGIN
            DBCC CHECKIDENT (''' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ''', RESEED, 0) WITH NO_INFOMSGS;
        END
    END
END;'
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.identity_columns c ON t.object_id = c.object_id
WHERE t.is_ms_shipped = 0;

EXEC sp_executesql @reseedSql;
GO
PRINT '===========================================================================';
PRINT '  SmartBanking_Template DATABASE READY FOR PRODUCTION CBS SYSTEM!          ';
PRINT '===========================================================================';
GO
"@)

$sw.Close()
Write-Host "Successfully generated SQL Server 2022 compatible script at $outputSql"
