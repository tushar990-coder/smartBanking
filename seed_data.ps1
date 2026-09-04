# SmartBanking ERP - Seed Initial Data Tool
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "     SmartBanking ERP - Initial Data Seeder (Users, Branch, FY)   " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Read Target Database from appsettings
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
    Write-Host "[त्रुटी] '$targetDb' डेटाबेसशी संपर्क होऊ शकला नाही." -ForegroundColor Red
    Read-Host "Press ENTER to exit"
    exit 1
}

Write-Host "[OK] Connected to '$workingInstance' -> Database '$targetDb'" -ForegroundColor Green
Write-Host ""
Write-Host "Inserting Roles, Admin User, Branch, and Financial Year..." -ForegroundColor Cyan

$sqlFile = Join-Path $PSScriptRoot "Seed_Initial_Data.sql"
if (Test-Path $sqlFile) {
    try {
        $sqlContent = Get-Content -Path $sqlFile -Raw -Encoding UTF8
        $dbConnStr = "Server=$workingInstance;Database=$targetDb;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=30;"
        $dbConn = New-Object System.Data.SqlClient.SqlConnection($dbConnStr)
        $dbConn.Open()
        
        $cmd = $dbConn.CreateCommand()
        $cmd.CommandText = $sqlContent
        $cmd.ExecuteNonQuery() | Out-Null
        $dbConn.Close()
        
        Write-Host ""
        Write-Host "==================================================================" -ForegroundColor Green
        Write-Host "  SUCCESS! All initial data inserted successfully!                " -ForegroundColor Green
        Write-Host "  सर्व आवश्यक डेटा (Branch, Financial Year, Admin) तयार झाला आहे! " -ForegroundColor Green
        Write-Host "==================================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Default Login Credentials:" -ForegroundColor Yellow
        Write-Host "  Branch:         मुख्य शाखा (Main Branch)" -ForegroundColor White
        Write-Host "  Financial Year: 2026-2027" -ForegroundColor White
        Write-Host "  Username:       admin" -ForegroundColor White
        Write-Host "  Password:       admin123" -ForegroundColor White
        Write-Host ""
    } catch {
        Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "[ERROR] Seed_Initial_Data.sql file not found in current folder!" -ForegroundColor Red
}

Read-Host "Press ENTER to exit (बाहेर पडण्यासाठी ENTER दाबा)"
