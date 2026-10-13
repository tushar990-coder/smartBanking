$masterConnStr = "Server=.;Database=master;Trusted_Connection=True;TrustServerCertificate=True"
$backupFile = "D:\Active DB\SmartBanking_Template_temp_copy.bak"
$targetMdf = "D:\Active DB\SmartBanking_FinEx.mdf"
$targetLdf = "D:\Active DB\SmartBanking_FinEx_log.ldf"

Add-Type -AssemblyName "System.Data"

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandTimeout = 600

    Write-Host "[1/4] Taking COPY_ONLY backup of SmartBanking_Template..." -ForegroundColor Cyan
    $cmd.CommandText = "BACKUP DATABASE [SmartBanking_Template] TO DISK = '$backupFile' WITH COPY_ONLY, FORMAT, INIT;"
    $cmd.ExecuteNonQuery() | Out-Null
    Write-Host "   Backup created successfully." -ForegroundColor Green

    Write-Host "[2/4] Restoring as new database SmartBanking_FinEx..." -ForegroundColor Cyan
    $cmd.CommandText = @"
RESTORE DATABASE [SmartBanking_FinEx]
FROM DISK = '$backupFile'
WITH MOVE 'SmartBanking_Template' TO '$targetMdf',
MOVE 'SmartBanking_Template_log' TO '$targetLdf',
REPLACE;
"@
    $cmd.ExecuteNonQuery() | Out-Null
    Write-Host "   Database [SmartBanking_FinEx] restored successfully." -ForegroundColor Green

    $conn.Close()
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
} finally {
    if (Test-Path $backupFile) {
        Remove-Item $backupFile -Force
        Write-Host "   Temporary backup file cleaned." -ForegroundColor Gray
    }
}

# Now clean all transactional / testing member records in SmartBanking_FinEx
Write-Host "[3/4] Cleaning testing data from SmartBanking_FinEx (preserving core structure & masters)..." -ForegroundColor Cyan
$targetConnStr = "Server=.;Database=SmartBanking_FinEx;Trusted_Connection=True;TrustServerCertificate=True"
try {
    $connTarget = New-Object System.Data.SqlClient.SqlConnection($targetConnStr)
    $connTarget.Open()
    $cmdTarget = $connTarget.CreateCommand()
    $cmdTarget.CommandTimeout = 600

    $cleanSql = @"
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all";

DECLARE @KeepTables TABLE (TableName NVARCHAR(256));
INSERT INTO @KeepTables (TableName) VALUES 
('Branches'),
('BranchMasters'),
('FinancialYears'),
('Users'),
('Roles'),
('RolePermissions'),
('SansthaDetails'),
('__EFMigrationsHistory');

IF COL_LENGTH('dbo.Branches', 'DefaultCashLedgerID') IS NOT NULL
BEGIN
    UPDATE [dbo].[Branches] SET [DefaultCashLedgerID] = NULL;
END

DECLARE @TableName NVARCHAR(256);
DECLARE @Sql NVARCHAR(MAX);

DECLARE table_cursor CURSOR FOR
SELECT t.name 
FROM sys.tables t
WHERE t.name NOT IN (SELECT TableName FROM @KeepTables)
ORDER BY t.name;

OPEN table_cursor;
FETCH NEXT FROM table_cursor INTO @TableName;

WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        SET @Sql = N'DELETE FROM [dbo].[' + @TableName + N'];';
        EXEC sp_executesql @Sql;
    END TRY
    BEGIN CATCH
    END CATCH;

    BEGIN TRY
        DBCC CHECKIDENT (@TableName, RESEED, 0);
    END TRY
    BEGIN CATCH
    END CATCH;

    FETCH NEXT FROM table_cursor INTO @TableName;
END;

CLOSE table_cursor;
DEALLOCATE table_cursor;

EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all";
"@
    $cmdTarget.CommandText = $cleanSql
    $cmdTarget.ExecuteNonQuery() | Out-Null
    Write-Host "   Cleanup complete! SmartBanking_FinEx is now a clean SmartBanking database." -ForegroundColor Green

    $cmdTarget.CommandText = "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
    $tCount = $cmdTarget.ExecuteScalar()
    Write-Host "[4/4] SmartBanking_FinEx Verification: Found $tCount tables!" -ForegroundColor Green

    $connTarget.Close()
} catch {
    Write-Host "ERROR during cleanup: $_" -ForegroundColor Red
}
