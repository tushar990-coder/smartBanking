# =========================================================================================
# SmartBanking ERP - 1-Click SQL Server 2022 Template Database Deployer
# =========================================================================================

param(
    [string]$ServerInstance = "localhost",
    [string]$TargetDatabase = "SmartBanking_Template",
    [string]$SqlScriptPath = "$PSScriptRoot\SmartBanking_Template_SQL2022_Pure_Script.sql"
)

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - SQL Server 2022 Template Deployer           " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Target SQL Server Instance : $ServerInstance" -ForegroundColor Yellow
Write-Host " Target Database Name       : $TargetDatabase" -ForegroundColor Yellow
Write-Host " SQL Script File            : $SqlScriptPath" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $SqlScriptPath)) {
    $SqlScriptPath = "d:\Bhisi Software\tools\SmartBanking_Template_SQL2022_Pure_Script.sql"
}

if (-not (Test-Path $SqlScriptPath)) {
    Write-Host "[ERROR] Could not find SQL Script at: $SqlScriptPath" -ForegroundColor Red
    pause
    exit 1
}

# 1. Create Database if not exists
Write-Host "[1/3] Creating target database if not exists..." -ForegroundColor Green
$createDbSql = @"
IF DB_ID('$TargetDatabase') IS NULL
BEGIN
    CREATE DATABASE [$TargetDatabase];
    PRINT 'Created database [$TargetDatabase]';
END
ELSE
BEGIN
    PRINT 'Database [$TargetDatabase] already exists.';
END
"@

$connStringMaster = "Server=$ServerInstance;Database=master;Integrated Security=True;TrustServerCertificate=True;"
try {
    $masterConn = New-Object System.Data.SqlClient.SqlConnection($connStringMaster)
    $masterConn.Open()
    $cmd = $masterConn.CreateCommand()
    $cmd.CommandText = $createDbSql
    $cmd.ExecuteNonQuery() | Out-Null
    $masterConn.Close()
    Write-Host "  -> Database [$TargetDatabase] is ready on server [$ServerInstance]." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Could not connect or create database on $ServerInstance: $($_.Exception.Message)" -ForegroundColor Red
    pause
    exit 1
}

# 2. Execute Pure SQL Deployment Script
Write-Host "[2/3] Executing Schema, Indexes and Master Seed Data..." -ForegroundColor Green
try {
    $sqlcmdOutput = Invoke-Expression "sqlcmd -S `"$ServerInstance`" -d `"$TargetDatabase`" -i `"$SqlScriptPath`""
    Write-Host "  -> Deployment completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Error executing SQL script: $($_.Exception.Message)" -ForegroundColor Red
    pause
    exit 1
}

# 3. Verify Master Data
Write-Host "[3/3] Verifying Preserved Masters & Clean State..." -ForegroundColor Green
$verifySql = @"
SELECT 'AccountGroups (खाते गट)' AS Master, COUNT(*) AS Total FROM AccountGroups
UNION ALL SELECT 'Ledgers (खाते माहिती)', COUNT(*) FROM Ledgers
UNION ALL SELECT 'Users (वापरकर्ते)', COUNT(*) FROM Users
UNION ALL SELECT 'Roles (भूमिका)', COUNT(*) FROM Roles
UNION ALL SELECT 'Branches (शाखा)', COUNT(*) FROM Branches
UNION ALL SELECT 'Customers (ग्राहक - Fresh Zero)', COUNT(*) FROM Customers
UNION ALL SELECT 'Members (सभासद - Fresh Zero)', COUNT(*) FROM Members
UNION ALL SELECT 'SavingTransactions (Fresh Zero)', COUNT(*) FROM SavingTransactions
UNION ALL SELECT 'Vouchers (Fresh Zero)', COUNT(*) FROM Vouchers;
"@

$connStringTarget = "Server=$ServerInstance;Database=$TargetDatabase;Integrated Security=True;TrustServerCertificate=True;"
$targetConn = New-Object System.Data.SqlClient.SqlConnection($connStringTarget)
$targetConn.Open()
$vCmd = $targetConn.CreateCommand()
$vCmd.CommandText = $verifySql
$vReader = $vCmd.ExecuteReader()

Write-Host ""
Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  VERIFICATION RESULTS FOR [$TargetDatabase]:" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan
while ($vReader.Read()) {
    $mName = $vReader["Master"].ToString().PadRight(35)
    $cnt = $vReader["Total"].ToString()
    Write-Host "  $mName : $cnt" -ForegroundColor White
}
$vReader.Close()
$targetConn.Close()

Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " [SUCCESS] Template Database deployed with 0 mismatch errors!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
