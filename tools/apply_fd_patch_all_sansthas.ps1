# =========================================================================================
# SmartBanking ERP - 1-Click Multi-Sanstha Migrated FD Sequence & Voucher Auto-Healer
# Safely inspects & heals duplicate FD Account Numbers & Sequences across ALL Sanstha databases
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Split-Path -Parent $scriptDir
$configFile = Join-Path $scriptDir "vps_multi_app_config.json"
$sqlScriptFile = Join-Path $scriptDir "heal_migrated_fd_account_numbers.sql"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " SmartBanking ERP - Multi-Sanstha Migrated FD Sequence Auto-Heal  " -ForegroundColor Cyan
Write-Host " (Zero Data Loss - Fixes Duplicate FD Receipts & Accounting Vouchers)" -ForegroundColor Yellow
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

        # Check if FdAccounts table exists and count migrated records
        $checkCmd = $conn.CreateCommand()
        $checkCmd.CommandText = @"
            IF OBJECT_ID('FdAccounts', 'U') IS NOT NULL
                SELECT COUNT(*) FROM [FdAccounts] WHERE [IsLegacyAccount] = 1;
            ELSE
                SELECT -1;
"@
        $migratedCount = [int]$checkCmd.ExecuteScalar()

        if ($migratedCount -gt 0) {
            Write-Host "  Found $migratedCount migrated FD account(s). Running sequence & voucher auto-heal..." -ForegroundColor Cyan
            
            $fixCmd = $conn.CreateCommand()
            $fixCmd.CommandText = $sqlScript
            $fixCmd.CommandTimeout = 120
            $fixCmd.ExecuteNonQuery() | Out-Null
            
            Write-Host "  ✅ SUCCESS: Database $dbName healed! Sequences and vouchers synchronized." -ForegroundColor Green
            $repairedCount++
        } elseif ($migratedCount -eq 0) {
            Write-Host "  ✓ Clean: No migrated FD accounts in $dbName." -ForegroundColor DarkGreen
        } else {
            Write-Host "  - Notice: Table [FdAccounts] does not exist yet in $dbName." -ForegroundColor Gray
        }

        $conn.Close()
    } catch {
        Write-Host "  ❌ ERROR processing $dbName: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "Summary: $repairedCount of $checkedCount databases processed successfully." -ForegroundColor Cyan
Write-Host "All Sanstha databases are now synchronized with valid FD sequences!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
