# SmartBanking ERP - Safe Client Update & Schema Sync Patch (Zero Data Loss)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "    SmartBanking ERP - Client System Update Patch                 " -ForegroundColor Cyan
Write-Host "    (Zero Data Loss - All Existing Records 100% Preserved)        " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$configPath = Join-Path $PSScriptRoot "appsettings.Production.json"
if (-not (Test-Path $configPath)) {
    $configPath = Join-Path $PSScriptRoot "appsettings.json"
}

$targetServer = "."
$targetDb = "SmartBanking_JotirlingPdw"

if (Test-Path $configPath) {
    $json = Get-Content $configPath -Raw
    if ($json -match 'Server=([^;]+);') { $targetServer = $matches[1] }
    if ($json -match 'Database=([^;]+);') { $targetDb = $matches[1] }
}

Write-Host "Target Server:   $targetServer" -ForegroundColor Yellow
Write-Host "Target Database: $targetDb" -ForegroundColor Yellow
Write-Host ""

$instances = @($targetServer, ".", ".\SQLEXPRESS", "(local)", "localhost")
$connected = $false
$workingInstance = $null

foreach ($inst in $instances) {
    try {
        $connStr = "Server=$inst;Database=$targetDb;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=3;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        $conn.Close()
        $connected = $true
        $workingInstance = $inst
        break
    } catch { }
}

if (-not $connected) {
    Write-Host "[ERROR] Could not connect to database '$targetDb'!" -ForegroundColor Red
    Read-Host "Press ENTER to exit"
    exit 1
}

Write-Host "Applying non-destructive core banking schema sync..." -ForegroundColor Cyan

$dbConnStr = "Server=$workingInstance;Database=$targetDb;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=30;"
$dbConn = New-Object System.Data.SqlClient.SqlConnection($dbConnStr)
$dbConn.Open()

$patchSql = @"
    -- 1. AccountGroups DisplayOrder
    IF COL_LENGTH('AccountGroups', 'DisplayOrder') IS NULL
    BEGIN
        ALTER TABLE [AccountGroups] ADD [DisplayOrder] INT NOT NULL DEFAULT 0;
    END

    -- 2. Ledgers LedgerCode
    IF COL_LENGTH('Ledgers', 'LedgerCode') IS NULL
    BEGIN
        ALTER TABLE [Ledgers] ADD [LedgerCode] NVARCHAR(50) NULL;
    END

    -- 3. Set Default Display Order for Standard Groups if zero
    UPDATE [AccountGroups] SET [DisplayOrder] = 1 WHERE [GroupName] LIKE N'%भाग भांडवल%' AND [DisplayOrder] = 0;
    UPDATE [AccountGroups] SET [DisplayOrder] = 2 WHERE [GroupName] LIKE N'%राखीव%' AND [DisplayOrder] = 0;
    UPDATE [AccountGroups] SET [DisplayOrder] = 3 WHERE [GroupName] LIKE N'%ठेवी%' AND [DisplayOrder] = 0;
    UPDATE [AccountGroups] SET [DisplayOrder] = 4 WHERE [GroupName] LIKE N'%इतर देणी%' AND [DisplayOrder] = 0;
    UPDATE [AccountGroups] SET [DisplayOrder] = 1 WHERE [GroupName] LIKE N'%रोकड%' AND [DisplayOrder] = 0;
    UPDATE [AccountGroups] SET [DisplayOrder] = 2 WHERE [GroupName] LIKE N'%बँकेतील शिल्लक%' AND [DisplayOrder] = 0;
    UPDATE [AccountGroups] SET [DisplayOrder] = 3 WHERE [GroupName] LIKE N'%गुंतवणूक%' AND [DisplayOrder] = 0;
    UPDATE [AccountGroups] SET [DisplayOrder] = 4 WHERE [GroupName] LIKE N'%कर्ज%' AND [DisplayOrder] = 0;
    UPDATE [AccountGroups] SET [DisplayOrder] = 5 WHERE [GroupName] LIKE N'%मालमत्ता%' AND [DisplayOrder] = 0;
    UPDATE [AccountGroups] SET [DisplayOrder] = 6 WHERE [GroupName] LIKE N'%इतर येणे%' AND [DisplayOrder] = 0;
"@

$cmd = $dbConn.CreateCommand()
$cmd.CommandText = $patchSql
$cmd.ExecuteNonQuery() | Out-Null

$cmd.CommandText = "SELECT COUNT(*) FROM [AccountGroups]"
$accGroupsCount = [int]$cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM [Ledgers]"
$ledgersCount = [int]$cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM [Members]"
$membersCount = [int]$cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM [Vouchers]"
$vouchersCount = [int]$cmd.ExecuteScalar()

$dbConn.Close()

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "              CLIENT UPDATE COMPLETED SUCCESSFULLY!               " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  -> Account Groups synced: $accGroupsCount records [OK]" -ForegroundColor Green
Write-Host "  -> General Ledgers:       $ledgersCount records [OK]" -ForegroundColor Green
Write-Host "  -> Members Preserved:     $membersCount records [OK]" -ForegroundColor Green
Write-Host "  -> Vouchers Preserved:    $vouchersCount records [OK]" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[SUCCESS] सर्व नवीन ताळेबंद व नफा-तोटा अपडेट्स यशस्वीरीत्या लागू झाले आहेत!" -ForegroundColor Green
Write-Host ""
Read-Host "Press ENTER to continue (बाहेर पडण्यासाठी ENTER दाबा)"
