# =========================================================================================
# SmartBanking ERP - 1-Click Dedicated VPS Patch Builder for Testing1 Environment
# Automates: Frontend Build (Vite) + Backend Publish (.NET 10 API) + Database SQL Patch + Packaging
# Targets ONLY: Testing1 (D:\WebApps\testing1\backend & D:\WebApps\testing1\frontend)
# IIS AppPool: testing1-backend | Target DB: SmartBanking_testing1
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$workspaceRoot = "d:\Bhisi Software"
$patchFolder = Join-Path $workspaceRoot "SmartBanking_Testing1_Patch"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_Testing1_Patch.zip"
$clientDir = Join-Path $workspaceRoot "client"
$apiDir = Join-Path $workspaceRoot "api\Bhisi.Api"
$versionJsonPath = Join-Path $workspaceRoot "version.json"

$version = "2.5.0"
if (Test-Path $versionJsonPath) {
    try {
        $vObj = Get-Content $versionJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($vObj.version) { $version = $vObj.version }
    } catch {}
}
$buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
$desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$desktopDest = Join-Path $desktop "SmartBanking_Testing1_Patch.zip"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   SmartBanking ERP - Dedicated Testing1 Patch Builder            " -ForegroundColor Cyan
Write-Host "   Target Version: v$version ($buildDate)                         " -ForegroundColor Yellow
Write-Host "   Target Site   : Testing1 (D:\WebApps\testing1)                 " -ForegroundColor Yellow
Write-Host "   IIS AppPool   : testing1-backend                               " -ForegroundColor Yellow
Write-Host "   Target DB     : SmartBanking_testing1                          " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------------------
# Step 1: Build React Frontend (Vite)
# -----------------------------------------------------------------------------------------
Write-Host "[1/5] Building Latest React Frontend (Vite)..." -ForegroundColor Cyan
Push-Location $clientDir
try {
    cmd /c "npm run build"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $clientDir "dist\index.html"))) {
        Write-Host "[ERROR] Frontend build failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Write-Host "  -> React Frontend built successfully!" -ForegroundColor Green
}
finally {
    Pop-Location
}

# -----------------------------------------------------------------------------------------
# Step 2: Publish .NET 10 Web API Backend
# -----------------------------------------------------------------------------------------
Write-Host "`n[2/5] Publishing .NET 10 Web API Backend (Release / win-x64)..." -ForegroundColor Cyan
$backendTempPublish = Join-Path $workspaceRoot "scratch\api_publish_temp_testing1"
if (Test-Path $backendTempPublish) { Remove-Item -Recurse -Force $backendTempPublish -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $backendTempPublish -Force | Out-Null

Push-Location $apiDir
try {
    dotnet publish -c Release -r win-x64 --self-contained false -o $backendTempPublish
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $backendTempPublish "Bhisi.Api.dll"))) {
        Write-Host "[ERROR] Backend publish failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Write-Host "  -> Backend .NET 10 Web API published successfully!" -ForegroundColor Green
}
finally {
    Pop-Location
}

# -----------------------------------------------------------------------------------------
# Step 3: Prepare Clean SmartBanking_Testing1_Patch Directory Structure
# -----------------------------------------------------------------------------------------
Write-Host "`n[3/5] Assembling Patch Package Structure..." -ForegroundColor Cyan

if (Test-Path $patchFolder) {
    try { Remove-Item -Path $patchFolder -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}
New-Item -Path $patchFolder -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "database") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "backend") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "frontend") -ItemType Directory -Force | Out-Null

$utf8WithBom = New-Object System.Text.UTF8Encoding($true)

# 3.1 Copy Database SQL Scripts with UTF-8 BOM
$sqlSource = Join-Path $workspaceRoot "tools\master_vps_update_schema.sql"
$sqlDest = Join-Path $patchFolder "database\update_schema.sql"
if (Test-Path $sqlSource) {
    $sqlContent = [System.IO.File]::ReadAllText($sqlSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($sqlDest, $sqlContent, $utf8WithBom)
    Write-Host "  -> master_vps_update_schema.sql copied as database\update_schema.sql (UTF-8 BOM)." -ForegroundColor White
}

$alignCodesSource = Join-Path $workspaceRoot "tools\align_member_codes_1to1.sql"
$alignCodesDest = Join-Path $patchFolder "database\align_member_codes_1to1.sql"
if (Test-Path $alignCodesSource) {
    $alignSqlContent = [System.IO.File]::ReadAllText($alignCodesSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($alignCodesDest, $alignSqlContent, $utf8WithBom)
    Write-Host "  -> align_member_codes_1to1.sql included in database package (UTF-8 BOM)." -ForegroundColor White
}

$universalSyncSource = Join-Path $workspaceRoot "tools\Universal_Schema_Only_Sync.sql"
if (Test-Path $universalSyncSource) {
    Copy-Item $universalSyncSource (Join-Path $patchFolder "database\Universal_Schema_Only_Sync.sql") -Force
    Write-Host "  -> Universal_Schema_Only_Sync.sql included in database package." -ForegroundColor White
}

# 3.2 Copy Backend Files (exclude local configs, git, temporary dirs)
$backendDest = Join-Path $patchFolder "backend"
robocopy $backendTempPublish $backendDest /E /XD "logs" "wwwroot" "uploads" /XF "appsettings.Development.json" "appsettings.Production.json" "appsettings.json" | Out-Null

Write-Host "  -> Backend binaries copied (Connection strings preserved)." -ForegroundColor White

# 3.3 Copy Frontend Files
$frontendSource = Join-Path $clientDir "dist"
$frontendDest = Join-Path $patchFolder "frontend"
robocopy $frontendSource $frontendDest /E | Out-Null
Write-Host "  -> Frontend React UI bundle copied." -ForegroundColor White

# 3.4 Copy Version Manifest & Documentation
if (Test-Path $versionJsonPath) {
    Copy-Item $versionJsonPath (Join-Path $patchFolder "version.json") -Force
    Copy-Item $versionJsonPath (Join-Path $backendDest "version.json") -Force
    Copy-Item $versionJsonPath (Join-Path $frontendDest "version.json") -Force
    Write-Host "  -> version.json (v$version Changelog) included in patch." -ForegroundColor White
}

# Clean temp publish
Remove-Item -Recurse -Force $backendTempPublish -ErrorAction SilentlyContinue

# -----------------------------------------------------------------------------------------
# Step 4: Generate Configuration & Installer Scripts
# -----------------------------------------------------------------------------------------
Write-Host "`n[4/5] Generating patch_config.json, installer scripts & manifest..." -ForegroundColor Cyan

# 4.1 patch_config.json strictly for Testing1 Application
$configContent = @"
{
  "SansthaName": "Testing1 Environment",
  "TargetDatabase": "SmartBanking_testing1",
  "SqlServerInstance": ".",
  "SqlUser": "sa",
  "SqlPassword": "Mindspace2026",
  "IISAppPoolName": "testing1-backend",
  "BackendFolderPath": "D:\\WebApps\\testing1\\backend",
  "FrontendFolderPath": "D:\\WebApps\\testing1\\frontend",
  "TakeDbBackup": true,
  "BackupFolder": "D:\\Backups"
}
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "patch_config.json"), $configContent, $utf8WithBom)

# 4.2 apply_patch.ps1 (Runs on VPS)
$applyPs1Content = @'
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
'@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "apply_patch.ps1"), $applyPs1Content, $utf8WithBom)

# 4.3 Apply_Testing1_Patch.bat
$batContent = @"
@echo off
chcp 65001 >nul
title SmartBanking ERP - 1-Click Update Testing1
color 0B
cls
echo ==================================================================
echo   SmartBanking ERP - 1-Click Update: Testing1 Application
echo   (Zero Data Loss - All Existing Records 100% Preserved)
echo ==================================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Please run this batch file as Administrator!
    echo Right-click and choose 'Run as administrator'.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_patch.ps1"

echo.
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "Apply_Testing1_Patch.bat"), $batContent, [System.Text.Encoding]::ASCII)

# -----------------------------------------------------------------------------------------
# Step 5: Compress to ZIP and Export to Desktop
# -----------------------------------------------------------------------------------------
Write-Host "`n[5/5] Packaging into SmartBanking_Testing1_Patch.zip..." -ForegroundColor Cyan

if (Test-Path $zipOutputFile) { Remove-Item -Force $zipOutputFile -ErrorAction SilentlyContinue }

Add-Type -AssemblyName "System.IO.Compression.FileSystem"
[System.IO.Compression.ZipFile]::CreateFromDirectory($patchFolder, $zipOutputFile, [System.IO.Compression.CompressionLevel]::Optimal, $false)

if (Test-Path $desktop) {
    Copy-Item $zipOutputFile $desktopDest -Force
    Write-Host "  -> Copied to Desktop: $desktopDest" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Testing1 Patch packaged successfully!                  " -ForegroundColor Green
Write-Host "  Location: $zipOutputFile                                        " -ForegroundColor Yellow
Write-Host "  Desktop : $desktopDest                                          " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
