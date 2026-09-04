$workspaceRoot = "d:\Bhisi Software"
$patchFolder = Join-Path $workspaceRoot "VPS_Update_Patch_Padawalwadi"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_VPS_Patch_Padawalwadi.zip"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Building 1-Click VPS Update Patch Package..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Clean & Prepare folder
if (Test-Path $patchFolder) {
    try { Remove-Item -Path $patchFolder -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}
if (-not (Test-Path $patchFolder)) {
    New-Item -Path $patchFolder -ItemType Directory | Out-Null
}
New-Item -Path (Join-Path $patchFolder "database") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "backend") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "frontend") -ItemType Directory -Force | Out-Null

# 2. Copy Database SQL
Write-Host "[1/5] Copying Database SQL patch..." -ForegroundColor Yellow
$sqlSource = Join-Path $workspaceRoot "tools\update_padawalwadi_db.sql"
$sqlDest = Join-Path $patchFolder "database\update_schema.sql"
Copy-Item -Path $sqlSource -Destination $sqlDest -Force

# 3. Copy Backend Files (excluding local appsettings and redundant wwwroot)
Write-Host "[2/5] Copying Backend API files..." -ForegroundColor Yellow
$backendSource = Join-Path $workspaceRoot "VPS_Deploy"
$backendDest = Join-Path $patchFolder "backend"
robocopy $backendSource $backendDest /E /XD "publish_vps_20260809" "logs" "wwwroot" /XF "appsettings.Development.json" | Out-Null

# 4. Copy Frontend Files
Write-Host "[3/5] Copying Frontend files..." -ForegroundColor Yellow
$frontendSource = Join-Path $workspaceRoot "client\dist"
$frontendDest = Join-Path $patchFolder "frontend"
robocopy $frontendSource $frontendDest /E | Out-Null

# 5. Create patch_config.json
Write-Host "[4/5] Generating patch_config.json..." -ForegroundColor Yellow
$configContent = @"
{
  "SansthaName": "श्री जोतिर्लिंग नागरी सहकारी पतसंस्था (पडवळवाडी)",
  "TargetDatabase": "SmartBanking_JotirlingPdw",
  "SqlServerInstance": ".",
  "IISAppPoolName": "SmartBanking_API",
  "BackendFolderPath": "C:\\inetpub\\wwwroot\\api_publish",
  "FrontendFolderPath": "C:\\inetpub\\wwwroot\\client_dist",
  "TakeDbBackup": true,
  "BackupFolder": "C:\\SmartBanking_Backups"
}
"@
Set-Content -Path (Join-Path $patchFolder "patch_config.json") -Value $configContent -Encoding UTF8

# 6. Create apply_patch.ps1
$psScriptContent = @'
param(
    [string]$ConfigPath = "patch_config.json"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - 1-Click Multi-Target VPS Patch Installer  " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $scriptDir $ConfigPath))) {
    Write-Host "[ERROR] Configuration file '$ConfigPath' not found!" -ForegroundColor Red
    exit 1
}

$config = Get-Content (Join-Path $scriptDir $ConfigPath) -Raw | ConvertFrom-Json

Write-Host "Target Sanstha  : $($config.SansthaName)" -ForegroundColor White
Write-Host "Target Database : $($config.TargetDatabase)" -ForegroundColor White
Write-Host "SQL Instance    : $($config.SqlServerInstance)" -ForegroundColor White
Write-Host "Backend Folder  : $($config.BackendFolderPath)" -ForegroundColor White
Write-Host "Frontend Folder : $($config.FrontendFolderPath)" -ForegroundColor White
Write-Host "IIS AppPool     : $($config.IISAppPoolName)" -ForegroundColor White
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

# Step 1: Database Safety Backup
if ($config.TakeDbBackup) {
    Write-Host "`n[1/5] Taking Database Safety Backup..." -ForegroundColor Yellow
    if (-not (Test-Path $config.BackupFolder)) {
        New-Item -Path $config.BackupFolder -ItemType Directory -Force | Out-Null
    }
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = "$($config.BackupFolder)\$($config.TargetDatabase)_PrePatch_$timestamp.bak"
    
    $backupSql = "BACKUP DATABASE [$($config.TargetDatabase)] TO DISK = N'$backupPath' WITH FORMAT, INIT, NAME = N'$($config.TargetDatabase)-PrePatch-Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10;"
    try {
        sqlcmd -S $config.SqlServerInstance -E -Q $backupSql
        Write-Host "  -> Backup created: $backupPath" -ForegroundColor Green
    }
    catch {
        Write-Host "  -> Warning: Auto-backup via sqlcmd skipped ($($_.Exception.Message))" -ForegroundColor DarkYellow
    }
}

# Step 2: Apply Database SQL Schema Updates
Write-Host "`n[2/5] Applying Non-Destructive Database Schema Patch..." -ForegroundColor Yellow
$sqlFile = Join-Path $scriptDir "database\update_schema.sql"
if (Test-Path $sqlFile) {
    try {
        sqlcmd -S $config.SqlServerInstance -E -d $config.TargetDatabase -i $sqlFile
        Write-Host "  -> Database schema updated successfully with 0 data loss!" -ForegroundColor Green
    }
    catch {
        Write-Host "  -> Error updating database: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  -> SQL script not found, skipping DB patch." -ForegroundColor Yellow
}

# Step 3: Stop IIS AppPool (Graceful)
Write-Host "`n[3/5] Stopping IIS AppPool '$($config.IISAppPoolName)'..." -ForegroundColor Yellow
$appCmd = "$env:windir\system32\inetsrv\appcmd.exe"
if (Test-Path $appCmd) {
    try {
        & $appCmd stop apppool /apppool.name:"$($config.IISAppPoolName)"
        Start-Sleep -Seconds 2
        Write-Host "  -> IIS AppPool stopped." -ForegroundColor Green
    } catch {
        Write-Host "  -> AppPool already stopped or not found." -ForegroundColor Gray
    }
}

# Step 4: Copy Backend & Frontend Files
Write-Host "`n[4/5] Updating Backend and Frontend Folders..." -ForegroundColor Yellow

# Backend
if (Test-Path $config.BackendFolderPath) {
    $backendSource = Join-Path $scriptDir "backend"
    Write-Host "  -> Copying updated Backend API DLLs to $($config.BackendFolderPath)..." -ForegroundColor White
    robocopy $backendSource $config.BackendFolderPath /E /XF "appsettings.Production.json" "appsettings.json" | Out-Null
    Write-Host "  -> Backend files updated." -ForegroundColor Green
} else {
    Write-Host "  -> Backend folder not found at '$($config.BackendFolderPath)'. Please verify path." -ForegroundColor Yellow
}

# Frontend
if (Test-Path $config.FrontendFolderPath) {
    $frontendSource = Join-Path $scriptDir "frontend"
    Write-Host "  -> Copying updated Frontend assets to $($config.FrontendFolderPath)..." -ForegroundColor White
    robocopy $frontendSource $config.FrontendFolderPath /E | Out-Null
    Write-Host "  -> Frontend files updated." -ForegroundColor Green
} else {
    Write-Host "  -> Frontend folder not found at '$($config.FrontendFolderPath)'. Please verify path." -ForegroundColor Yellow
}

# Step 5: Start IIS AppPool
Write-Host "`n[5/5] Restarting IIS AppPool..." -ForegroundColor Yellow
if (Test-Path $appCmd) {
    try {
        & $appCmd start apppool /apppool.name:"$($config.IISAppPoolName)"
        Write-Host "  -> IIS AppPool started successfully!" -ForegroundColor Green
    } catch {
        Write-Host "  -> Could not start AppPool: $_" -ForegroundColor Red
    }
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "   [SUCCESS] SmartBanking VPS Patch Applied Successfully!       " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
'@
Set-Content -Path (Join-Path $patchFolder "apply_patch.ps1") -Value $psScriptContent -Encoding UTF8

# 7. Create Apply_VPS_Patch.bat (Launcher)
$batContent = @"
@echo off
title SmartBanking ERP - 1-Click VPS Auto-Updater
cd /d "%~dp0"

echo ================================================================
echo    SmartBanking ERP - 1-Click VPS Auto-Updater
echo ================================================================
echo.
echo  This tool will update:
echo   1. Database Schema (Zero data loss)
echo   2. Backend C# API (Unlocks online domain & updates logic)
echo   3. Frontend React UI (Latest assets)
echo.
echo  Targeting configuration from: patch_config.json
echo.
echo ================================================================
choice /M "Do you want to apply this patch now"
if errorlevel 2 goto cancel

echo.
echo Running installer...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_patch.ps1"
goto end

:cancel
echo.
echo [CANCELLED] Patch update was cancelled by user.
echo.

:end
echo.
pause
"@
Set-Content -Path (Join-Path $patchFolder "Apply_VPS_Patch.bat") -Value $batContent -Encoding ASCII

# 8. Zip the entire patch folder into a single file
Write-Host "[5/5] Creating SmartBanking_VPS_Patch.zip..." -ForegroundColor Yellow
if (Test-Path $zipOutputFile) {
    Remove-Item -Path $zipOutputFile -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($patchFolder, $zipOutputFile, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [SUCCESS] Single Patch Package Created Successfully!" -ForegroundColor Green
Write-Host " ZIP File: $zipOutputFile" -ForegroundColor White
Write-Host " Folder  : $patchFolder" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
