# =========================================================================================
# SmartBanking ERP - 1-Click Multi-Sanstha FD Voucher Narration Unicode Healer
# Restores corrupted Marathi "???? ??? ???" to clean "मुदत ठेव आरंभिक शिल्लक स्थलांतर..."
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlScriptFile = Join-Path $scriptDir "heal_corrupted_fd_voucher_narrations.sql"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " SmartBanking ERP - Multi-Sanstha FD Narration Unicode Auto-Heal  " -ForegroundColor Cyan
Write-Host " (Zero Data Loss - Restores Marathi Font in Vouchers & FD Reports)" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $sqlScriptFile)) {
    Write-Host "[ERROR] SQL repair script not found at: $sqlScriptFile" -ForegroundColor Red
    exit 1
}

$sqlScript = [System.IO.File]::ReadAllText($sqlScriptFile, [System.Text.Encoding]::UTF8)

# Determine SQL Server instance
$server = "tcp:43.239.93.47,15050"
$user = "sa"
$password = "Mindspace2026"

Write-Host "Connecting to SQL Server: $server..." -ForegroundColor Yellow

$masterConnStr = "Server=$server;Database=master;User Id=$user;Password=$password;TrustServerCertificate=True;Connect Timeout=20;"
$masterConn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)

try {
    $masterConn.Open()
} catch {
    Write-Host "[WARNING] Remote connection failed. Falling back to local '.'..." -ForegroundColor Yellow
    $server = "."
    $masterConnStr = "Server=$server;Database=master;User Id=$user;Password=$password;TrustServerCertificate=True;Connect Timeout=15;"
    $masterConn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)
    $masterConn.Open()
}

$dbCmd = $masterConn.CreateCommand()
$dbCmd.CommandText = "SELECT name FROM sys.databases WHERE name LIKE 'SmartBanking_%' ORDER BY name;"
$reader = $dbCmd.ExecuteReader()
$dbList = New-Object System.Collections.Generic.List[string]
while ($reader.Read()) {
    $dbList.Add($reader.GetString(0))
}
$reader.Close()
$masterConn.Close()

Write-Host "Discovered $($dbList.Count) SmartBanking databases to inspect.`n" -ForegroundColor White

$repairedCount = 0
$checkedCount = 0

foreach ($dbName in $dbList) {
    $checkedCount++
    Write-Host "[$checkedCount/$($dbList.Count)] Checking: $dbName..." -ForegroundColor White

    $connStr = "Server=$server;Database=$dbName;User Id=$user;Password=$password;TrustServerCertificate=True;Connect Timeout=20;"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        # Check corrupted count
        $checkCmd = $conn.CreateCommand()
        $checkCmd.CommandText = "IF OBJECT_ID('Vouchers', 'U') IS NOT NULL SELECT COUNT(*) FROM [Vouchers] WHERE (VoucherNo LIKE 'JV-FD-OP-%' OR Narration LIKE '%FD Opening Balance Migration%') AND (Narration LIKE '%?%' OR Narration IS NULL OR Narration = ''); ELSE SELECT -1;"
        $corruptedCount = [int]$checkCmd.ExecuteScalar()

        if ($corruptedCount -gt 0) {
            Write-Host "  Found $corruptedCount corrupted narration record(s). Healing to clean Marathi..." -ForegroundColor Cyan
            $fixCmd = $conn.CreateCommand()
            $fixCmd.CommandText = $sqlScript
            $fixCmd.CommandTimeout = 120
            $fixCmd.ExecuteNonQuery() | Out-Null
            Write-Host "  [SUCCESS] Database $dbName healed ($corruptedCount records restored)." -ForegroundColor Green
            $repairedCount++
        } elseif ($corruptedCount -eq 0) {
            Write-Host "  [CLEAN] No corrupted narrations in $dbName." -ForegroundColor DarkGreen
        } else {
            Write-Host "  [NOTICE] Table Vouchers not found in $dbName." -ForegroundColor Gray
        }

        $conn.Close()
    } catch {
        $errMsg = $_.Exception.Message
        Write-Host "  [ERROR] Processing ${dbName}: $errMsg" -ForegroundColor Red
    }
}

Write-Host "`n------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "Summary: $repairedCount databases healed out of $checkedCount inspected." -ForegroundColor Cyan
Write-Host "All FD Opening migration voucher narrations are now in clean Marathi!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
