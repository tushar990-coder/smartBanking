# =========================================================================================
# SmartBanking ERP - 1-Click Multi-Sanstha Orphaned Closed FD Accounts Auto-Healer
# Safely restores orphaned closed FD accounts across ALL Sanstha databases on VPS
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Split-Path -Parent $scriptDir
$configFile = Join-Path $scriptDir "vps_multi_app_config.json"
$sqlScriptFile = Join-Path $scriptDir "heal_orphaned_closed_fd_accounts.sql"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " SmartBanking ERP - Multi-Sanstha Orphaned Closed FD Auto-Heal    " -ForegroundColor Cyan
Write-Host " (Zero Data Loss - Restores Closed FDs with Deleted Vouchers)    " -ForegroundColor Yellow
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

$checkedCount = 0
$successCount = 0
$failureCount = 0

foreach ($target in $config.Targets) {
    $dbName = $target.TargetDatabase
    $sansthaName = $target.SansthaName
    $checkedCount++

    Write-Host "`n[$checkedCount/$($config.Targets.Count)] Processing: $sansthaName ($dbName)..." -ForegroundColor White

    # Build connection strings (Dual-Auth: SQL Auth on VPS, Trusted_Connection fallback on local)
    $conn = $null
    if ($config.SqlUser -and $config.SqlPassword) {
        $sqlConnStr = "Server=$sqlServer;Database=$dbName;User Id=$($config.SqlUser);Password=$($config.SqlPassword);TrustServerCertificate=True;Connect Timeout=5;"
        try {
            $c = New-Object System.Data.SqlClient.SqlConnection($sqlConnStr)
            $c.Open()
            $conn = $c
        } catch {}
    }
    if ($conn -eq $null) {
        $winConnStr = "Server=$sqlServer;Database=$dbName;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=5;"
        try {
            $c = New-Object System.Data.SqlClient.SqlConnection($winConnStr)
            $c.Open()
            $conn = $c
        } catch {
            Write-Host "  -> [ERROR] Failed to connect to $($dbName) : $($_.Exception.Message)" -ForegroundColor Red
            $failureCount++
            continue
        }
    }

    try {

        # Capture SQL PRINT statements
        $handler = [System.Data.SqlClient.SqlInfoMessageEventHandler] {
            param($sender, $event)
            Write-Host "   $($event.Message)" -ForegroundColor Gray
        }
        $conn.add_InfoMessage($handler)

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

        $conn.Close()
        Write-Host "  -> [OK] Successfully processed $dbName!" -ForegroundColor Green
        $successCount++
    }
    catch {
        Write-Host "  -> [ERROR] Failed on $dbName : $($_.Exception.Message)" -ForegroundColor Red
        $failureCount++
    }
}

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host " SUMMARY: Checked: $checkedCount | Success: $successCount | Errors: $failureCount" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
