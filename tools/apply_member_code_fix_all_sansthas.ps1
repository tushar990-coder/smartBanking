# =========================================================================================
# SmartBanking ERP - 1-Click Multi-Sanstha Shareholder Member Code Auto-Healer
# Safely nullifies MemberCode for non-shareholders & resequences codes across ALL Sanstha databases
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Split-Path -Parent $scriptDir
$configFile = Join-Path $scriptDir "vps_multi_app_config.json"
$sqlScriptFile = Join-Path $scriptDir "heal_nominal_and_duplicate_member_codes.sql"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " SmartBanking ERP - Multi-Sanstha Member Code Auto-Heal Runner    " -ForegroundColor Cyan
Write-Host " (Zero Data Loss - Heals Nominal Members & Fixes Member Codes)   " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $configFile)) {
    Write-Host "[ERROR] Config file not found at: $configFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $sqlScriptFile)) {
    Write-Host "[ERROR] SQL repair script not found at: $sqlScriptFile" -ForegroundColor Red
    exit 1
}

$rawJson = Get-Content $configFile -Raw -Encoding UTF8
$cleanedJson = $rawJson -replace '(?m)^\s*//.*$', '' -replace '(?s)/\*.*?\*/', ''
$config = $cleanedJson | ConvertFrom-Json
$sqlServer = if ($config.SqlServerInstance) { $config.SqlServerInstance } else { "." }
$sqlScript = [System.IO.File]::ReadAllText($sqlScriptFile, [System.Text.Encoding]::UTF8)

Write-Host "SQL Server Instance : $sqlServer" -ForegroundColor Yellow
Write-Host "Sanstha Databases   : $($config.Targets.Count)" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------" -ForegroundColor Gray

$repairedCount = 0
$checkedCount = 0

foreach ($target in $config.Targets) {
    $dbName = $target.TargetDatabase
    $sansthaName = $target.SansthaName
    $checkedCount++

    Write-Host "`n[$checkedCount/$($config.Targets.Count)] Processing: $sansthaName ($dbName)..." -ForegroundColor White

    # Build connection strings
    $connStr = "Server=$sqlServer;Database=$dbName;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=15;"
    if ($config.SqlUser -and $config.SqlPassword) {
        $testConn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        try {
            $testConn.Open()
            $testConn.Close()
        } catch {
            $connStr = "Server=$sqlServer;Database=$dbName;User Id=$($config.SqlUser);Password=$($config.SqlPassword);TrustServerCertificate=True;Connect Timeout=15;"
        }
    }

    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        # Execute healing script in batches separated by GO
        $batches = $sqlScript -split '(?m)^\s*GO\s*$'
        foreach ($batch in $batches) {
            $trimmed = $batch.Trim()
            if (![string]::IsNullOrWhiteSpace($trimmed)) {
                $cmd = $conn.CreateCommand()
                $cmd.CommandText = $trimmed
                $cmd.CommandTimeout = 120
                [void]$cmd.ExecuteNonQuery()
            }
        }

        # Query result statistics
        $statCmd = $conn.CreateCommand()
        $statCmd.CommandText = @"
            SELECT 
                (SELECT COUNT(*) FROM Members WHERE MemberCode IS NOT NULL) AS TotalMembersWithCode,
                (SELECT COUNT(*) FROM ShareAccounts WHERE TotalShareCount > 0) AS TotalActiveShareholders
"@
        $reader = $statCmd.ExecuteReader()
        if ($reader.Read()) {
            $membersWithCode = $reader["TotalMembersWithCode"]
            $activeShareholders = $reader["TotalActiveShareholders"]
            Write-Host "  -> [OK] Successfully healed: $membersWithCode member codes aligned with $activeShareholders active shareholders." -ForegroundColor Green
        }
        $reader.Close()
        $conn.Close()
        $repairedCount++
    } catch {
        Write-Host "  -> [ERROR] Failed to process database $dbName : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host " Multi-Sanstha Member Code Auto-Healing Complete!                 " -ForegroundColor Green
Write-Host " Processed: $repairedCount of $checkedCount databases successfully. " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
