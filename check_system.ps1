[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "       SmartBanking ERP - Client System & Database Diagnostic     " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check SQL Server Services
Write-Host "[1/4] Checking SQL Server Services..." -ForegroundColor Yellow
$sqlServices = Get-Service -Name "MSSQLSERVER", "MSSQL$*" -ErrorAction SilentlyContinue

if ($sqlServices) {
    foreach ($s in $sqlServices) {
        $statusColor = if ($s.Status -eq 'Running') { 'Green' } else { 'Red' }
        Write-Host "  -> Service: $($s.DisplayName) ($($s.Name)) - Status: $($s.Status)" -ForegroundColor $statusColor
        if ($s.Status -ne 'Running') {
            Write-Host "     Starting service $($s.Name)..." -ForegroundColor Yellow
            try {
                Start-Service -Name $s.Name -ErrorAction Stop
                Write-Host "     [OK] Started successfully!" -ForegroundColor Green
            } catch {
                Write-Host "     [FAILED] Could not start: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "  [WARNING] No standard MSSQL engine services found in Windows Services!" -ForegroundColor Red
}

Write-Host ""
# 2. Check Database Connection
Write-Host "[2/4] Testing SQL Server Connection & Databases..." -ForegroundColor Yellow
$instances = @(".", ".\SQLEXPRESS", "(local)", "localhost", "localhost\SQLEXPRESS")

foreach ($inst in $instances) {
    try {
        $connStr = "Server=$inst;Database=master;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=2;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name;"
        $reader = $cmd.ExecuteReader()
        $dbList = @()
        while ($reader.Read()) {
            $dbList += $reader.GetString(0)
        }
        $reader.Close()
        $conn.Close()
        
        $dbsStr = if ($dbList.Count -gt 0) { $dbList -join ", " } else { "No user databases found" }
        Write-Host "  [OK] Connected to '$inst' -> Existing Databases: [$dbsStr]" -ForegroundColor Green
    } catch {
        Write-Host "  [--] '$inst' -> Not reachable ($($_.Exception.Message))" -ForegroundColor Gray
    }
}

Write-Host ""
# 3. Check App Configuration
Write-Host "[3/4] Checking appsettings Configuration..." -ForegroundColor Yellow
$configPath = Join-Path $PSScriptRoot "appsettings.Production.json"
if (-not (Test-Path $configPath)) {
    $configPath = Join-Path $PSScriptRoot "appsettings.json"
}

if (Test-Path $configPath) {
    try {
        $json = Get-Content $configPath -Raw -Encoding UTF8
        Write-Host "  -> Active Config: $(Split-Path $configPath -Leaf)" -ForegroundColor Cyan
        if ($json -match 'Server=([^;]+);') {
            Write-Host "  -> Target SQL Server: $($matches[1])" -ForegroundColor Cyan
        }
        if ($json -match 'Database=([^;]+);') {
            Write-Host "  -> Target Database:   $($matches[1])" -ForegroundColor Cyan
        }
        if ([string]::IsNullOrWhiteSpace($json)) {
            Write-Host "  [ERROR] $configPath is EMPTY (0 bytes)! Please replace it from USB." -ForegroundColor Red
        } else {
            Write-Host "  [OK] Configuration file syntax is valid." -ForegroundColor Green
        }
    } catch {
        Write-Host "  [ERROR] Failed to read $configPath : $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  [WARNING] appsettings.json not found in current folder!" -ForegroundColor Red
}

Write-Host ""
# 4. Read Latest Logs
Write-Host "[4/4] Reading Last Server Exception from Logs..." -ForegroundColor Yellow
$logsFolder = Join-Path $PSScriptRoot "logs"
if (Test-Path $logsFolder) {
    $latestLog = Get-ChildItem -Path $logsFolder -Filter "bhisi-erp-log-*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestLog) {
        Write-Host "  -> Latest Log: $($latestLog.Name)" -ForegroundColor Cyan
        $lines = Get-Content $latestLog.FullName -Tail 15
        Write-Host "------------------------------------------------------------------" -ForegroundColor Gray
        foreach ($line in $lines) {
            if ($line -match '\[ERR\]|\[FTL\]|Exception') {
                Write-Host $line -ForegroundColor Red
            } else {
                Write-Host $line -ForegroundColor Gray
            }
        }
        Write-Host "------------------------------------------------------------------" -ForegroundColor Gray
    } else {
        Write-Host "  No log files found." -ForegroundColor Gray
    }
} else {
    Write-Host "  No logs folder found." -ForegroundColor Gray
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTIC COMPLETED." -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press ENTER to exit (बाहेर पडण्यासाठी ENTER दाबा)"
