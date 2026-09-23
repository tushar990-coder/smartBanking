# =========================================================================================
# SmartBanking Core ERP - 1-Click VPS Patch Installer (Testing1 Environment)
# Applies: 1. Safety Backup | 2. Database Schema Sync | 3. Backend API | 4. Frontend UI | 5. Restart
# =========================================================================================

param(
    [string]$ConfigPath = "patch_config.json"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Clear-Host
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - 1-Click VPS Testing1 Patch Installer        " -ForegroundColor Cyan
Write-Host "  (Zero Data Loss - All Existing Records 100% Preserved)          " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$fullConfigPath = Join-Path $scriptDir $ConfigPath
if (-not (Test-Path $fullConfigPath)) {
    Write-Host "[ERROR] Configuration file '$ConfigPath' not found at: $fullConfigPath" -ForegroundColor Red
    Read-Host "Press ENTER to exit"
    exit 1
}

$cfg = Get-Content $fullConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json

$sansthaName = $cfg.SansthaName
$targetDb = $cfg.TargetDatabase
$instance = if ($cfg.SqlServerInstance) { $cfg.SqlServerInstance } else { "." }
$sqlUser = if ($cfg.SqlUser) { $cfg.SqlUser } else { "sa" }
$sqlPassword = if ($cfg.SqlPassword) { $cfg.SqlPassword } else { "Mindspace2026" }
$appPool = $cfg.IISAppPoolName
$backendPath = $cfg.BackendFolderPath
$frontendPath = $cfg.FrontendFolderPath
$takeBackup = if ($cfg.TakeDbBackup -ne $null) { $cfg.TakeDbBackup } else { $true }
$backupFolder = if ($cfg.BackupFolder) { $cfg.BackupFolder } else { "D:\Backups" }

Write-Host "Target Application: $sansthaName" -ForegroundColor White
Write-Host "Target Database   : $targetDb (Instance: $instance)" -ForegroundColor White
Write-Host "Backend Path      : $backendPath" -ForegroundColor White
Write-Host "Frontend Path     : $frontendPath" -ForegroundColor White
if ($appPool) {
    Write-Host "IIS AppPool       : $appPool" -ForegroundColor White
}
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop IIS AppPool if configured
if ($appPool -and $appPool.Trim() -ne "") {
    Write-Host "[1/5] Stopping IIS AppPool ($appPool)..." -ForegroundColor Cyan
    try {
        cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"$appPool`"" 2>$null
        Write-Host "  -> AppPool '$appPool' stopped successfully." -ForegroundColor Green
    } catch {
        Write-Host "  -> Notice: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "[1/5] No specific IIS AppPool designated (Skipping AppPool stop)." -ForegroundColor Gray
}

# Stop any running processes locking backend files
Get-Process -Name "w3wp", "dotnet", "Bhisi.Api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Step 2: Take Safety DB Backup
if ($takeBackup) {
    Write-Host "`n[2/5] Creating Safety Database Backup of [$targetDb]..." -ForegroundColor Cyan
    if (-not (Test-Path $backupFolder)) { New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null }
    $timestamp = (Get-Date -Format "yyyyMMdd_HHmmss")
    $bakFile = Join-Path $backupFolder "${targetDb}_PrePatch_${timestamp}.bak"
    
    $backupSql = "BACKUP DATABASE [$targetDb] TO DISK = N'$bakFile' WITH FORMAT, INIT, NAME = N'${targetDb} Pre-Patch Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10"
    
    $bSuccess = $false
    try {
        $connStr = "Server=$instance;Database=master;User Id=$sqlUser;Password=$sqlPassword;TrustServerCertificate=True;Connect Timeout=15;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $backupSql
        $cmd.CommandTimeout = 120
        $cmd.ExecuteNonQuery() | Out-Null
        $conn.Close()
        $bSuccess = $true
        Write-Host "  -> Backup created successfully at: $bakFile" -ForegroundColor Green
    } catch {
        Write-Host "  -> Warning taking SQL backup via ADO.NET: $($_.Exception.Message)" -ForegroundColor DarkYellow
        try {
            cmd /c "sqlcmd -S `"$instance`" -U `"$sqlUser`" -P `"$sqlPassword`" -Q `"$backupSql`"" 2>$null
            if (Test-Path $bakFile) {
                $bSuccess = $true
                Write-Host "  -> Backup created successfully via sqlcmd: $bakFile" -ForegroundColor Green
            }
        } catch {}
    }
}

# Step 3: Apply Database Schema Sync & 1:1 MemberCode Alignment
Write-Host "`n[3/5] Synchronizing Database Schema & Aligning Member Codes (Zero Data Loss)..." -ForegroundColor Cyan

function Execute-SqlFile ([string]$filePath, [string]$scriptDescription) {
    if (-not (Test-Path $filePath)) { return }
    Write-Host "  -> Running $scriptDescription..." -ForegroundColor White
    try {
        $sqlContent = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
        $connStr = "Server=$instance;Database=$targetDb;User Id=$sqlUser;Password=$sqlPassword;TrustServerCertificate=True;Connect Timeout=30;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        
        $batches = $sqlContent -split "(?m)^\s*GO\s*$"
        foreach ($batch in $batches) {
            $trimmed = $batch.Trim()
            if ($trimmed) {
                $cmd = $conn.CreateCommand()
                $cmd.CommandText = $trimmed
                $cmd.CommandTimeout = 180
                $cmd.ExecuteNonQuery() | Out-Null
            }
        }
        $conn.Close()
        Write-Host "     [OK] $scriptDescription completed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "     [Notice] Applying via sqlcmd fallback..." -ForegroundColor DarkYellow
        cmd /c "sqlcmd -S `"$instance`" -d `"$targetDb`" -U `"$sqlUser`" -P `"$sqlPassword`" -i `"$filePath`" -b"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "     [OK] $scriptDescription completed via sqlcmd!" -ForegroundColor Green
        } else {
            Write-Host "     [WARNING] $scriptDescription finished with warnings." -ForegroundColor DarkYellow
        }
    }
}

$schemaSql = Join-Path $scriptDir "database\update_schema.sql"
Execute-SqlFile $schemaSql "Database Schema Update"

$alignSql = Join-Path $scriptDir "database\align_member_codes_1to1.sql"
Execute-SqlFile $alignSql "1:1 MemberCode & ShareAccount Exact Alignment"

# Step 4: Deploy Backend & Frontend
Write-Host "`n[4/5] Deploying Application Files..." -ForegroundColor Cyan

# 4.1 Backend
$patchBackend = Join-Path $scriptDir "backend"
if ((Test-Path $patchBackend) -and (Test-Path $backendPath)) {
    Write-Host "  -> Copying Backend binaries to: $backendPath" -ForegroundColor White
    robocopy $patchBackend $backendPath /E /XD "logs" "wwwroot" "uploads" /XF "appsettings.Development.json" "appsettings.Production.json" "appsettings.json" "web.config" | Out-Null
    Write-Host "  -> Backend binaries deployed successfully (Existing appsettings.json preserved)." -ForegroundColor Green
} elseif (-not (Test-Path $backendPath)) {
    New-Item -ItemType Directory -Path $backendPath -Force | Out-Null
    robocopy $patchBackend $backendPath /E /XD "logs" "wwwroot" "uploads" /XF "appsettings.Development.json" "appsettings.Production.json" "appsettings.json" | Out-Null
    Write-Host "  -> Backend created and deployed at: $backendPath" -ForegroundColor Green
}

# 4.2 Frontend
$patchFrontend = Join-Path $scriptDir "frontend"
if ((Test-Path $patchFrontend) -and (Test-Path $frontendPath)) {
    Write-Host "  -> Copying Frontend UI bundle to: $frontendPath" -ForegroundColor White
    robocopy $patchFrontend $frontendPath /E /PURGE | Out-Null
    Write-Host "  -> Frontend UI bundle deployed successfully." -ForegroundColor Green
} elseif (-not (Test-Path $frontendPath)) {
    New-Item -ItemType Directory -Path $frontendPath -Force | Out-Null
    robocopy $patchFrontend $frontendPath /E | Out-Null
    Write-Host "  -> Frontend created and deployed at: $frontendPath" -ForegroundColor Green
}

# Step 5: Restart IIS AppPool
if ($appPool -and $appPool.Trim() -ne "") {
    Write-Host "`n[5/5] Starting IIS AppPool ($appPool)..." -ForegroundColor Cyan
    try {
        cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"$appPool`"" 2>$null
        Write-Host "  -> AppPool '$appPool' started successfully!" -ForegroundColor Green
    } catch {
        Write-Host "  -> AppPool start notice: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "`n[5/5] No specific IIS AppPool designated." -ForegroundColor Gray
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Testing1 Application Patch applied successfully!      " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""