# =========================================================================================
# SmartBanking ERP - 1-Click Multi-Sanstha LoanRate Unique Index Migration
# Safely applies IX_LoanRates_LoanCode & IX_LoanRates_LoanType across ALL Sanstha databases
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configFile = Join-Path $scriptDir "vps_multi_app_config.json"
$sqlScriptFile = Join-Path $scriptDir "add_unique_index_loan_rates.sql"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " SmartBanking ERP - Multi-Sanstha LoanRate Unique Index Deployer  " -ForegroundColor Cyan
Write-Host " (Zero Data Loss - Enforces Unique LoanCode & LoanType Constraints)" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $configFile)) {
    Write-Host "[ERROR] Config file not found at: $configFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $sqlScriptFile)) {
    Write-Host "[ERROR] SQL migration script not found at: $sqlScriptFile" -ForegroundColor Red
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

$appliedCount = 0
$checkedCount = 0

foreach ($target in $config.Targets) {
    $dbName = $target.TargetDatabase
    $sansthaName = $target.SansthaName
    $checkedCount++

    Write-Host "`n[$checkedCount/$($config.Targets.Count)] Processing: $sansthaName ($dbName)..." -ForegroundColor White

    # Build connection string
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

        $batches = $sqlScript -split '(?m)^\s*GO\s*$'
        foreach ($batch in $batches) {
            $trimmed = $batch.Trim()
            if ($trimmed.Length -gt 0) {
                $cmd = $conn.CreateCommand()
                $cmd.CommandText = $trimmed
                $cmd.CommandTimeout = 60
                $cmd.ExecuteNonQuery() | Out-Null
            }
        }

        # Verify
        $verifyCmd = $conn.CreateCommand()
        $verifyCmd.CommandText = "SELECT COUNT(*) FROM sys.indexes WHERE name IN ('IX_LoanRates_LoanCode', 'IX_LoanRates_LoanType') AND object_id = OBJECT_ID('LoanRates')"
        $idxCount = [int]$verifyCmd.ExecuteScalar()

        $conn.Close()

        if ($idxCount -eq 2) {
            Write-Host "  ✅ SUCCESS: Unique Indexes (LoanCode & LoanType) active on $dbName" -ForegroundColor Green
            $appliedCount++
        } else {
            Write-Host "  ⚠️ WARNING: Index count on $dbName is $idxCount (expected 2)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ❌ ERROR on database $dbName : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host " Migration Completed: $appliedCount of $checkedCount Sanstha databases verified." -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
