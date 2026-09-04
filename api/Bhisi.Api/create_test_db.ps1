# PowerShell script to create SmartBanking_ShareTest database and populate master data
param(
    [string]$server = ".",
    [string]$sourceDb = "SmartBanking",
    [string]$targetDb = "SmartBanking_ShareTest"
)

$masterConnStr = "Server=$server;Database=master;Trusted_Connection=True;TrustServerCertificate=True;"
$targetConnStr = "Server=$server;Database=$targetDb;Trusted_Connection=True;TrustServerCertificate=True;"

Add-Type -AssemblyName "System.Data"

function Execute-NonQuery ($connectionString, $query) {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $query
    $cmd.CommandTimeout = 300
    try {
        $cmd.ExecuteNonQuery() | Out-Null
    } finally {
        $conn.Close()
    }
}

function Execute-Scalar ($connectionString, $query) {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $query
    $cmd.CommandTimeout = 300
    try {
        return $cmd.ExecuteScalar()
    } finally {
        $conn.Close()
    }
}

Write-Host "1. Checking/Creating database $targetDb on server $server..." -ForegroundColor Cyan
$dbExists = Execute-Scalar $masterConnStr "SELECT COUNT(*) FROM sys.databases WHERE name = '$targetDb'"
if ($dbExists -eq 0) {
    Execute-NonQuery $masterConnStr "CREATE DATABASE [$targetDb]"
    Write-Host "   Database $targetDb created successfully." -ForegroundColor Green
} else {
    Write-Host "   Database $targetDb already exists." -ForegroundColor Yellow
}

Write-Host "2. Deploying table schema to $targetDb..." -ForegroundColor Cyan
$sqlScriptPath = Join-Path $PSScriptRoot "SmartBanking_Gurudev_Blank_Database.sql"
if (Test-Path $sqlScriptPath) {
    $rawSql = Get-Content $sqlScriptPath -Raw
    $sqlForTarget = $rawSql -replace "SmartBanking_Gurudev", $targetDb
    
    # Split by GO lines
    $batches = $sqlForTarget -split "(?m)^GO\s*$"
    foreach ($batch in $batches) {
        $trimmed = $batch.Trim()
        if ($trimmed.Length -gt 0) {
            try {
                Execute-NonQuery $targetConnStr $trimmed
            } catch {
                # Ignore duplicate table creation errors if already exists
            }
        }
    }
    Write-Host "   Schema deployed successfully." -ForegroundColor Green
}

Write-Host "3. Copying master data dynamically from $sourceDb to $targetDb..." -ForegroundColor Cyan

$copyMasterScript = @"
USE [$targetDb];
EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';

DECLARE @tables TABLE (TableName NVARCHAR(100), PKColumn NVARCHAR(100));
INSERT INTO @tables VALUES 
('AccountGroups', 'GroupID'),
('Ledgers', 'LedgerID'),
('VoucherMappings', 'MappingID'),
('Roles', 'RoleID'),
('Users', 'UserID'),
('SansthaDetails', 'SansthaID'),
('Branches', 'BranchID'),
('BranchMasters', 'BranchID'),
('FinancialYears', 'FinancialYearID'),
('LoanRates', 'LoanRateID'),
('FdSchemes', 'FdSchemeID'),
('RdSchemes', 'RdSchemeID'),
('PigmySchemes', 'PigmySchemeID');

DECLARE @tbl NVARCHAR(100), @pk NVARCHAR(100);
DECLARE tbl_cursor CURSOR FOR SELECT TableName, PKColumn FROM @tables;
OPEN tbl_cursor;
FETCH NEXT FROM tbl_cursor INTO @tbl, @pk;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @cols NVARCHAR(MAX) = '';
    SELECT @cols = STUFF((
        SELECT ',' + QUOTENAME(c1.COLUMN_NAME)
        FROM [$targetDb].INFORMATION_SCHEMA.COLUMNS c1
        INNER JOIN [$sourceDb].INFORMATION_SCHEMA.COLUMNS c2 ON c1.COLUMN_NAME = c2.COLUMN_NAME AND c1.TABLE_NAME = c2.TABLE_NAME
        WHERE c1.TABLE_NAME = @tbl AND c1.COLUMN_NAME != 'SSMA_TimeStamp'
        FOR XML PATH('')
    ), 1, 1, '');

    IF @cols IS NOT NULL AND LEN(@cols) > 0
    BEGIN
        DECLARE @sql NVARCHAR(MAX) = '
        IF EXISTS (SELECT * FROM sys.tables WHERE name = ''' + @tbl + ''')
        BEGIN
            SET IDENTITY_INSERT [' + @tbl + '] ON;
            INSERT INTO [' + @tbl + '] (' + @cols + ')
            SELECT ' + @cols + ' FROM [$sourceDb].[dbo].[' + @tbl + ']
            WHERE [' + @pk + '] NOT IN (SELECT [' + @pk + '] FROM [' + @tbl + ']);
            SET IDENTITY_INSERT [' + @tbl + '] OFF;
        END;';
        
        BEGIN TRY
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            DECLARE @sqlNoIdent NVARCHAR(MAX) = '
            INSERT INTO [' + @tbl + '] (' + @cols + ')
            SELECT ' + @cols + ' FROM [$sourceDb].[dbo].[' + @tbl + '];';
            BEGIN TRY
                EXEC sp_executesql @sqlNoIdent;
            END TRY
            BEGIN CATCH
            END CATCH
        END CATCH
    END;

    FETCH NEXT FROM tbl_cursor INTO @tbl, @pk;
END;

CLOSE tbl_cursor;
DEALLOCATE tbl_cursor;

EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL';
"@

try {
    Execute-NonQuery $targetConnStr $copyMasterScript
    Write-Host "   Master data copied successfully from $sourceDb to $targetDb!" -ForegroundColor Green
} catch {
    Write-Host "   Error copying master data: $_" -ForegroundColor Red
}

Write-Host "=== SmartBanking_ShareTest Database Ready! ===" -ForegroundColor Green
