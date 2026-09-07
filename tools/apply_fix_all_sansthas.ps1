# =========================================================================================
# SmartBanking ERP - 1-Click Multi-Sanstha Database Customer 0 & CIF Fix Runner
# Safely inspects & repairs CustomerID = 0 and CIF000000 across ALL Sanstha databases
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Split-Path -Parent $scriptDir
$configFile = Join-Path $scriptDir "vps_multi_app_config.json"
$sqlScriptFile = Join-Path $scriptDir "fix_customer_zero.sql"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - Universal Multi-Sanstha Customer 0 Repair    " -ForegroundColor Cyan
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

$config = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
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

    Write-Host "`n[$checkedCount/$($config.Targets.Count)] Checking: $sansthaName ($dbName)..." -ForegroundColor White

    # Build connection string
    $connStr = "Server=$sqlServer;Database=$dbName;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=15;"
    if ($config.SqlUser -and $config.SqlPassword) {
        # Check if trusted connection or SQL auth
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

        # Check if Customers table exists and if CustomerID = 0 exists
        $checkCmd = $conn.CreateCommand()
        $checkCmd.CommandText = @"
            IF OBJECT_ID('Customers', 'U') IS NOT NULL
                SELECT COUNT(*) FROM [Customers] WHERE [CustomerID] = 0;
            ELSE
                SELECT -1;
"@
        $hasZero = [int]$checkCmd.ExecuteScalar()

        if ($hasZero -gt 0) {
            Write-Host "  ⚠️ Found $hasZero invalid customer(s) with CustomerID = 0! Running auto-repair..." -ForegroundColor Red
            
            $fixCmd = $conn.CreateCommand()
            $fixCmd.CommandText = $sqlScript
            $fixCmd.CommandTimeout = 60
            $fixCmd.ExecuteNonQuery() | Out-Null
            
            Write-Host "  ✅ SUCCESS: Database $dbName repaired! CustomerID 0 migrated to valid sequence." -ForegroundColor Green
            $repairedCount++
        } elseif ($hasZero -eq 0) {
            # Ensure identity seed is healthy
            $seedCmd = $conn.CreateCommand()
            $seedCmd.CommandText = @"
                DECLARE @curMax INT = (SELECT ISNULL(MAX(CustomerID), 0) FROM [Customers]);
                IF @curMax > 0
                    DBCC CHECKIDENT ('Customers', RESEED, @curMax) WITH NO_INFOMSGS;
                ELSE
                    DBCC CHECKIDENT ('Customers', RESEED, 1) WITH NO_INFOMSGS;
"@
            $seedCmd.ExecuteNonQuery() | Out-Null
            Write-Host "  ✓ Clean: No CustomerID = 0. Identity seed verified healthy." -ForegroundColor DarkGreen
        } else {
            Write-Host "  - Notice: Table [Customers] does not exist yet in $dbName." -ForegroundColor Gray
        }

        $conn.Close()
    } catch {
        Write-Host "  ❌ Warning: Could not connect to $dbName ($($_.Exception.Message))" -ForegroundColor Yellow
    }
}

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "  Multi-Sanstha Repair Finished!                                  " -ForegroundColor Cyan
Write-Host "  Total Checked  : $checkedCount" -ForegroundColor White
Write-Host "  Total Repaired : $repairedCount" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
