param(
    [string]$server = ".",
    [string]$sourceDb = "SmartBanking",
    [string]$targetDb = "Test2"
)

$masterConnStr = "Server=$server;Database=master;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
$targetConnStr = "Server=$server;Database=$targetDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"

Add-Type -AssemblyName "System.Data"

function Execute-NonQuery ($connectionString, $query) {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $query
    $cmd.CommandTimeout = 600
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
    $cmd.CommandTimeout = 600
    try {
        return $cmd.ExecuteScalar()
    } finally {
        $conn.Close()
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Creating Empty Deployment Database: [$targetDb]" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Get Source DB File Details
$conn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT name, physical_name, type_desc FROM sys.master_files WHERE database_id = DB_ID('$sourceDb')"
$r = $cmd.ExecuteReader()
$files = @()
while ($r.Read()) {
    $files += [PSCustomObject]@{
        Name = $r["name"].ToString()
        PhysicalName = $r["physical_name"].ToString()
        Type = $r["type_desc"].ToString()
    }
}
$conn.Close()

$dataFile = $files | Where-Object { $_.Type -eq "ROWS" } | Select-Object -First 1
$logFile = $files | Where-Object { $_.Type -eq "LOG" } | Select-Object -First 1

$dataDir = [System.IO.Path]::GetDirectoryName($dataFile.PhysicalName)
$targetMdf = [System.IO.Path]::Combine($dataDir, "$targetDb`_Deploy_Data.mdf")
$targetLdf = [System.IO.Path]::Combine($dataDir, "$targetDb`_Deploy_Log.ldf")
$backupFile = [System.IO.Path]::Combine($dataDir, "$targetDb`_temp_backup.bak")

Write-Host "Source Data File: $($dataFile.Name)"
Write-Host "Source Log File:  $($logFile.Name)"
Write-Host "Target MDF:       $targetMdf"
Write-Host "Target LDF:       $targetLdf"
Write-Host "Temp Backup File: $backupFile"

# 2. Check & Drop Target DB if exists
$dbExists = Execute-Scalar $masterConnStr "SELECT COUNT(*) FROM sys.databases WHERE name = '$targetDb'"
if ($dbExists -gt 0) {
    Write-Host "`n1. Dropping existing target database [$targetDb]..." -ForegroundColor DarkYellow
    Execute-NonQuery $masterConnStr "ALTER DATABASE [$targetDb] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$targetDb];"
}

# Clean any existing orphaned files if present
if (Test-Path $targetMdf) { Remove-Item $targetMdf -Force -ErrorAction SilentlyContinue }
if (Test-Path $targetLdf) { Remove-Item $targetLdf -Force -ErrorAction SilentlyContinue }

# 3. Take backup inside SQL Server data directory
Write-Host "`n2. Taking backup of source [$sourceDb]..." -ForegroundColor Yellow
$backupSql = "BACKUP DATABASE [$sourceDb] TO DISK = '$backupFile' WITH INIT, FORMAT, COPY_ONLY;"
Execute-NonQuery $masterConnStr $backupSql
Write-Host "   Backup created successfully." -ForegroundColor Green

# 4. Restore as Target DB
Write-Host "`n3. Restoring as new database [$targetDb]..." -ForegroundColor Yellow
$restoreSql = @"
RESTORE DATABASE [$targetDb]
FROM DISK = '$backupFile'
WITH MOVE '$($dataFile.Name)' TO '$targetMdf',
MOVE '$($logFile.Name)' TO '$targetLdf',
REPLACE;
"@
Execute-NonQuery $masterConnStr $restoreSql
Write-Host "   Database [$targetDb] restored successfully." -ForegroundColor Green

# Clean up temp backup
if (Test-Path $backupFile) {
    Remove-Item $backupFile -Force
    Write-Host "   Temporary backup file cleaned." -ForegroundColor Gray
}

# 5. Clean Non-Master Data
Write-Host "`n4. Clearing transactional/member data while strictly preserving Master Tables..." -ForegroundColor Yellow

$cleanSql = @"
USE [$targetDb];
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

-- Disable all foreign key constraints
EXEC sp_MSForEachTable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';

-- 1. Vouchers & Transactions
IF OBJECT_ID('dbo.VoucherDetails') IS NOT NULL DELETE FROM [dbo].[VoucherDetails];
IF OBJECT_ID('dbo.Vouchers') IS NOT NULL DELETE FROM [dbo].[Vouchers];

-- 2. Loans & Advances
IF OBJECT_ID('dbo.LoanCollectionFees') IS NOT NULL DELETE FROM [dbo].[LoanCollectionFees];
IF OBJECT_ID('dbo.LoanCollections') IS NOT NULL DELETE FROM [dbo].[LoanCollections];
IF OBJECT_ID('dbo.LoanInstallmentSchedules') IS NOT NULL DELETE FROM [dbo].[LoanInstallmentSchedules];
IF OBJECT_ID('dbo.LoanDisbursementDeductions') IS NOT NULL DELETE FROM [dbo].[LoanDisbursementDeductions];
IF OBJECT_ID('dbo.LoanDisbursements') IS NOT NULL DELETE FROM [dbo].[LoanDisbursements];
IF OBJECT_ID('dbo.CollateralComplianceLogs') IS NOT NULL DELETE FROM [dbo].[CollateralComplianceLogs];
IF OBJECT_ID('dbo.LoanAccountNpaStatuses') IS NOT NULL DELETE FROM [dbo].[LoanAccountNpaStatuses];
IF OBJECT_ID('dbo.NpaClassificationRuns') IS NOT NULL DELETE FROM [dbo].[NpaClassificationRuns];
IF OBJECT_ID('dbo.OverdueInterestLedgers') IS NOT NULL DELETE FROM [dbo].[OverdueInterestLedgers];
IF OBJECT_ID('dbo.OverdueRecoveryLedgers') IS NOT NULL DELETE FROM [dbo].[OverdueRecoveryLedgers];
IF OBJECT_ID('dbo.BorrowerLinkedAccounts') IS NOT NULL DELETE FROM [dbo].[BorrowerLinkedAccounts];
IF OBJECT_ID('dbo.LoanDocuments') IS NOT NULL DELETE FROM [dbo].[LoanDocuments];
IF OBJECT_ID('dbo.GoldLoanDetails') IS NOT NULL DELETE FROM [dbo].[GoldLoanDetails];
IF OBJECT_ID('dbo.LoanAccounts') IS NOT NULL DELETE FROM [dbo].[LoanAccounts];
IF OBJECT_ID('dbo.LoanApplications') IS NOT NULL DELETE FROM [dbo].[LoanApplications];

-- 3. Savings Accounts
IF OBJECT_ID('dbo.SavingTransactions') IS NOT NULL DELETE FROM [dbo].[SavingTransactions];
IF OBJECT_ID('dbo.SavingPassbooks') IS NOT NULL DELETE FROM [dbo].[SavingPassbooks];
IF OBJECT_ID('dbo.SavingInterestPostings') IS NOT NULL DELETE FROM [dbo].[SavingInterestPostings];
IF OBJECT_ID('dbo.SavingAccountClosings') IS NOT NULL DELETE FROM [dbo].[SavingAccountClosings];
IF OBJECT_ID('dbo.SavingAccountJointHolders') IS NOT NULL DELETE FROM [dbo].[SavingAccountJointHolders];
IF OBJECT_ID('dbo.SavingAccountMasters') IS NOT NULL DELETE FROM [dbo].[SavingAccountMasters];

-- 4. Pigmy / Daily Deposit
IF OBJECT_ID('dbo.PigmyCollections') IS NOT NULL DELETE FROM [dbo].[PigmyCollections];
IF OBJECT_ID('dbo.PigmyTransactions') IS NOT NULL DELETE FROM [dbo].[PigmyTransactions];
IF OBJECT_ID('dbo.PigmyInterestLogs') IS NOT NULL DELETE FROM [dbo].[PigmyInterestLogs];
IF OBJECT_ID('dbo.PigmyOpeningBalances') IS NOT NULL DELETE FROM [dbo].[PigmyOpeningBalances];
IF OBJECT_ID('dbo.PigmyAgentCashDeposits') IS NOT NULL DELETE FROM [dbo].[PigmyAgentCashDeposits];
IF OBJECT_ID('dbo.PigmyAgentCommissions') IS NOT NULL DELETE FROM [dbo].[PigmyAgentCommissions];
IF OBJECT_ID('dbo.PigmyAccounts') IS NOT NULL DELETE FROM [dbo].[PigmyAccounts];
IF OBJECT_ID('dbo.PigmyAccountSequences') IS NOT NULL DELETE FROM [dbo].[PigmyAccountSequences];

-- 5. FD (Fixed Deposit)
IF OBJECT_ID('dbo.FdInterestAccruals') IS NOT NULL DELETE FROM [dbo].[FdInterestAccruals];
IF OBJECT_ID('dbo.FdTransactions') IS NOT NULL DELETE FROM [dbo].[FdTransactions];
IF OBJECT_ID('dbo.FdAccounts') IS NOT NULL DELETE FROM [dbo].[FdAccounts];
IF OBJECT_ID('dbo.FdAccountSequences') IS NOT NULL DELETE FROM [dbo].[FdAccountSequences];

-- 6. RD (Recurring Deposit)
IF OBJECT_ID('dbo.RdInterestAccruals') IS NOT NULL DELETE FROM [dbo].[RdInterestAccruals];
IF OBJECT_ID('dbo.RdTransactions') IS NOT NULL DELETE FROM [dbo].[RdTransactions];
IF OBJECT_ID('dbo.RdAccounts') IS NOT NULL DELETE FROM [dbo].[RdAccounts];

-- 7. Investment
IF OBJECT_ID('dbo.InvestmentInterestAccruals') IS NOT NULL DELETE FROM [dbo].[InvestmentInterestAccruals];
IF OBJECT_ID('dbo.InvestmentInterestReceipts') IS NOT NULL DELETE FROM [dbo].[InvestmentInterestReceipts];
IF OBJECT_ID('dbo.InvestmentMaturities') IS NOT NULL DELETE FROM [dbo].[InvestmentMaturities];
IF OBJECT_ID('dbo.InvestmentRenewals') IS NOT NULL DELETE FROM [dbo].[InvestmentRenewals];
IF OBJECT_ID('dbo.InvestmentPrematureWithdrawals') IS NOT NULL DELETE FROM [dbo].[InvestmentPrematureWithdrawals];
IF OBJECT_ID('dbo.InvestmentAccounts') IS NOT NULL DELETE FROM [dbo].[InvestmentAccounts];

-- 8. Assets
IF OBJECT_ID('dbo.AssetAllocations') IS NOT NULL DELETE FROM [dbo].[AssetAllocations];
IF OBJECT_ID('dbo.AssetDepreciations') IS NOT NULL DELETE FROM [dbo].[AssetDepreciations];
IF OBJECT_ID('dbo.AssetDisposals') IS NOT NULL DELETE FROM [dbo].[AssetDisposals];
IF OBJECT_ID('dbo.AssetMaintenances') IS NOT NULL DELETE FROM [dbo].[AssetMaintenances];
IF OBJECT_ID('dbo.AssetPurchases') IS NOT NULL DELETE FROM [dbo].[AssetPurchases];
IF OBJECT_ID('dbo.AssetTransfers') IS NOT NULL DELETE FROM [dbo].[AssetTransfers];
IF OBJECT_ID('dbo.AssetVerifications') IS NOT NULL DELETE FROM [dbo].[AssetVerifications];
IF OBJECT_ID('dbo.Assets') IS NOT NULL DELETE FROM [dbo].[Assets];

-- 9. Share Capital & Members
IF OBJECT_ID('dbo.ShareCertificatePrintHistories') IS NOT NULL DELETE FROM [dbo].[ShareCertificatePrintHistories];
IF OBJECT_ID('dbo.DividendDistributions') IS NOT NULL DELETE FROM [dbo].[DividendDistributions];
IF OBJECT_ID('dbo.ShareTransactions') IS NOT NULL DELETE FROM [dbo].[ShareTransactions];
IF OBJECT_ID('dbo.ShareCertificates') IS NOT NULL DELETE FROM [dbo].[ShareCertificates];
IF OBJECT_ID('dbo.ShareAccounts') IS NOT NULL DELETE FROM [dbo].[ShareAccounts];
IF OBJECT_ID('dbo.CommitteeMembers') IS NOT NULL DELETE FROM [dbo].[CommitteeMembers];
IF OBJECT_ID('dbo.PigmyAgents') IS NOT NULL DELETE FROM [dbo].[PigmyAgents];
IF OBJECT_ID('dbo.MemberOpeningBalances') IS NOT NULL DELETE FROM [dbo].[MemberOpeningBalances];
IF OBJECT_ID('dbo.Members') IS NOT NULL DELETE FROM [dbo].[Members];

-- 10. Audit, Logs & System Notifications
IF OBJECT_ID('dbo.AuditLogs') IS NOT NULL DELETE FROM [dbo].[AuditLogs];
IF OBJECT_ID('dbo.UserLoginAudits') IS NOT NULL DELETE FROM [dbo].[UserLoginAudits];
IF OBJECT_ID('dbo.SystemNotifications') IS NOT NULL DELETE FROM [dbo].[SystemNotifications];
IF OBJECT_ID('dbo.EodBatchProcessLogs') IS NOT NULL DELETE FROM [dbo].[EodBatchProcessLogs];

-- Re-enable constraints
EXEC sp_MSForEachTable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL';

-- Reseed Identities for cleaned tables
DECLARE @preserveTables TABLE (TableName NVARCHAR(128));
INSERT INTO @preserveTables VALUES 
('Users'), ('Roles'), ('AccountGroups'), ('Ledgers'), ('Branches'), ('BranchMasters'), 
('FinancialYears'), ('SansthaDetails'), ('NpaConfigs'), ('NpaProvisionSlabs'), 
('LoanRates'), ('FdSchemes'), ('RdSchemes'), ('PigmySchemes'), ('PigmyCommissionSettings'),
('SavingInterestSettings'), ('InvestmentInstitutions'), ('InvestmentSchemes'), 
('LockerTypes'), ('SecurityTypes'), ('CommitteeMembers'), ('BankMasters'), ('DepartmentMasters'),
('VoucherMappings'), ('__EFMigrationsHistory');

DECLARE @table NVARCHAR(128);
DECLARE cur CURSOR FOR 
    SELECT t.name 
    FROM sys.tables t 
    WHERE t.name NOT IN (SELECT TableName FROM @preserveTables);

OPEN cur;
FETCH NEXT FROM cur INTO @table;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF IDENT_SEED(@table) IS NOT NULL
    BEGIN
        BEGIN TRY
            DBCC CHECKIDENT (@table, RESEED, 0);
        END TRY
        BEGIN CATCH
        END CATCH
    END;
    FETCH NEXT FROM cur INTO @table;
END;
CLOSE cur;
DEALLOCATE cur;
"@

Execute-NonQuery $targetConnStr $cleanSql
Write-Host "   Cleanup complete." -ForegroundColor Green

# 6. Report Retained Data in Test2
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  Summary of Preserved Master Data in [$targetDb]:" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$conn = New-Object System.Data.SqlClient.SqlConnection($targetConnStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
SELECT t.name AS TableName, i.rows AS [RowCount]
FROM sys.tables t
INNER JOIN sys.sysindexes i ON t.object_id = i.id AND i.indid < 2
WHERE i.rows > 0
ORDER BY t.name ASC
"@
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    Write-Host "  [Preserved] $($r['TableName']): $($r['RowCount']) rows" -ForegroundColor Green
}
$conn.Close()

Write-Host "`n=== SUCCESS: Empty Deployment Database [$targetDb] is Ready! ===" -ForegroundColor Green
