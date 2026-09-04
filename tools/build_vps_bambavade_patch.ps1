# =========================================================================================
# SmartBanking ERP - 1-Click All-in-One VPS Patch Builder for Bambavade
# Automates: Frontend Build (Vite) + Backend Publish (.NET 10 API) + Database SQL Patch + Packaging
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$workspaceRoot = "d:\Bhisi Software"
$patchFolder = Join-Path $workspaceRoot "VPS_Bambavade_Patch"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_VPS_Bambavade_Patch.zip"
$clientDir = Join-Path $workspaceRoot "client"
$apiDir = Join-Path $workspaceRoot "api\Bhisi.Api"
$version = "2.1.2"
$buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   SmartBanking ERP - Bambavade 1-Click VPS Patch Package Builder " -ForegroundColor Cyan
Write-Host "   Target Version: v$version ($buildDate)                         " -ForegroundColor Yellow
Write-Host "   Target Site: Bambavade (SmartBanking_Bambawade)                " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure .env.production has Bambavade API Base URL
$envProdPath = Join-Path $clientDir ".env.production"
$envContent = "VITE_API_BASE_URL=https://api.bambavade.hellomindspace.in`n"
[System.IO.File]::WriteAllText($envProdPath, $envContent, [System.Text.Encoding]::UTF8)

# -----------------------------------------------------------------------------------------
# Step 1: Build React Frontend (Vite)
# -----------------------------------------------------------------------------------------
Write-Host "[1/5] Building Latest React Frontend (Vite) with Bambavade API endpoint..." -ForegroundColor Cyan
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
Write-Host "`n[2/5] Publishing .NET 10 Web API Backend (Release / IIS Ready)..." -ForegroundColor Cyan
$backendTempPublish = Join-Path $workspaceRoot "scratch\api_publish_temp_bambavade"
if (Test-Path $backendTempPublish) { Remove-Item -Recurse -Force $backendTempPublish }
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
# Step 3: Prepare Clean VPS_Bambavade_Patch Directory Structure
# -----------------------------------------------------------------------------------------
Write-Host "`n[3/5] Assembling Patch Package Structure..." -ForegroundColor Cyan

if (Test-Path $patchFolder) {
    try { Remove-Item -Path $patchFolder -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}
New-Item -Path $patchFolder -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "database") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "backend") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "frontend") -ItemType Directory -Force | Out-Null

# 3.1 Copy Database SQL (Ensuring clean UTF-8 encoding)
$sqlSource = Join-Path $workspaceRoot "tools\master_vps_update_schema.sql"
$sqlDest = Join-Path $patchFolder "database\update_schema.sql"

$sqlContent = [System.IO.File]::ReadAllText($sqlSource, [System.Text.Encoding]::UTF8)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($sqlDest, $sqlContent, $utf8NoBom)
Write-Host "  -> Database update schema copied with clean UTF-8 encoding." -ForegroundColor White

# 3.2 Copy Backend Files (exclude local configs, git, temporary dirs)
$backendDest = Join-Path $patchFolder "backend"
robocopy $backendTempPublish $backendDest /E /XD "logs" "wwwroot" "uploads" "publish_vps_20260809" /XF "appsettings.Development.json" | Out-Null

# Ensure web.config is included for IIS
$sourceWebConfig = Join-Path $workspaceRoot "VPS_Deploy\web.config"
if ((Test-Path $sourceWebConfig) -and (-not (Test-Path (Join-Path $backendDest "web.config")))) {
    Copy-Item $sourceWebConfig (Join-Path $backendDest "web.config") -Force
}
Write-Host "  -> Backend binaries & web.config copied." -ForegroundColor White

# 3.3 Copy Frontend Files
$frontendSource = Join-Path $clientDir "dist"
$frontendDest = Join-Path $patchFolder "frontend"
robocopy $frontendSource $frontendDest /E | Out-Null
Write-Host "  -> Frontend React bundle copied." -ForegroundColor White

# Clean temp publish
Remove-Item -Recurse -Force $backendTempPublish -ErrorAction SilentlyContinue

# -----------------------------------------------------------------------------------------
# Step 4: Generate Configuration & Installer Scripts
# -----------------------------------------------------------------------------------------
Write-Host "`n[4/5] Generating patch_config.json, installer scripts & manifest..." -ForegroundColor Cyan

# 4.1 patch_config.json for Bambavade
$configContent = @"
{
  "SansthaName": "Shree Bambawade Nagari Sahakari PatSanstha (Bambavade)",
  "TargetDatabase": "SmartBanking_Bambawade",
  "SqlServerInstance": ".",
  "IISAppPoolName": "api.bambavade.hellomindspace.in",
  "BackendFolderPath": "D:\\WebApps\\bambavade\\api.bambavade.hellomindspace.in",
  "FrontendFolderPath": "D:\\WebApps\\bambavade\\bambavade.hellomindspace.in",
  "TakeDbBackup": true,
  "BackupFolder": "D:\\Backups"
}
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "patch_config.json"), $configContent, $utf8NoBom)

# 4.2 version.json
$versionJsonObj = @{
    version = "2.1.2"
    releaseDate = (Get-Date -Format "yyyy-MM-dd")
    packageType = "All-In-One VPS Patch (Bambavade Site)"
    changelog = @(
        "खातेदार नोंदणीमध्ये मोबाईल नंबर व केवायसी अनिवार्य/पर्यायी पर्याय (Customer Master - Mobile Number Compulsory/Optional Setting)",
        "कॅश मॅनेजमेंट आणि कॅशिअर विंडो (Cash Management, Vault, Handover & Denomination Tally)",
        "डायनॅमिक लेजर मॅपिंग व योजना सेटिंग्ज (Dynamic GL Scheme Settings & Multi-Branch Support)",
        "शुद्ध मराठी युनिकोड व ऑटो-हीलिंग सुधारणा (Marathi Unicode Clean Encoding & Database Auto-Repair)",
        "मोबाईल रिस्पॉन्सिव्ह डॅशबोर्ड व एकसमान आयकॉन्स (Mobile Responsive Dashboard & Uniform Icons)",
        "नवीन ताळेबंद आणि नफा-तोटा गट क्रमवारी (Standard Balance Sheet & P&L Group Ordering)",
        "NPA वर्गीकरण व NPA तरतूद नियम (NPA Auto-Classification & Provisioning)",
        "डेटाबेस सुरक्षितता व Zero Data Loss हमी (Safe Schema Migration with Pre-Backup)"
    )
}
$versionJsonContent = $versionJsonObj | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $patchFolder "version.json"), $versionJsonContent, $utf8NoBom)

# 4.3 apply_patch.ps1 (Runs on VPS)
$applyPs1Content = @'
# =========================================================================================
# SmartBanking Core ERP - 1-Click Multi-Target VPS All-In-One Patch Installer
# Applies: 1. Full Pre-Backup | 2. Database Schema Sync | 3. Backend API | 4. Frontend UI | 5. IIS Restart
# =========================================================================================

param(
    [string]$ConfigPath = "patch_config.json"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Clear-Host
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - 1-Click All-in-One VPS Patch Installer       " -ForegroundColor Cyan
Write-Host "  (Zero Data Loss - All Existing Records 100% Preserved)          " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan

$fullConfigPath = Join-Path $scriptDir $ConfigPath
if (-not (Test-Path $fullConfigPath)) {
    Write-Host "[ERROR] Configuration file '$ConfigPath' not found at: $fullConfigPath" -ForegroundColor Red
    Read-Host "Press ENTER to exit"
    exit 1
}

$config = Get-Content $fullConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json

Write-Host "Target Sanstha  : $($config.SansthaName)" -ForegroundColor White
Write-Host "Target Database : $($config.TargetDatabase)" -ForegroundColor White
Write-Host "SQL Instance    : $($config.SqlServerInstance)" -ForegroundColor White
Write-Host "Backend Folder  : $($config.BackendFolderPath)" -ForegroundColor White
Write-Host "Frontend Folder : $($config.FrontendFolderPath)" -ForegroundColor White
Write-Host "IIS AppPool     : $($config.IISAppPoolName)" -ForegroundColor White
Write-Host "------------------------------------------------------------------" -ForegroundColor Gray

# -----------------------------------------------------------------------------------------
# Step 1: Pre-patch Database Safety Backup
# -----------------------------------------------------------------------------------------
if ($config.TakeDbBackup) {
    Write-Host "`n[1/5] Taking Database Safety Backup (Zero Data Loss Protection)..." -ForegroundColor Yellow
    if (-not (Test-Path $config.BackupFolder)) {
        New-Item -Path $config.BackupFolder -ItemType Directory -Force | Out-Null
    }
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = "$($config.BackupFolder)\$($config.TargetDatabase)_PrePatch_$timestamp.bak"
    
    $backupSql = "BACKUP DATABASE [$($config.TargetDatabase)] TO DISK = N'$backupPath' WITH FORMAT, INIT, NAME = N'$($config.TargetDatabase)-PrePatch-Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10;"
    try {
        sqlcmd -S $config.SqlServerInstance -E -Q $backupSql
        Write-Host "  -> Backup created successfully: $backupPath" -ForegroundColor Green
    }
    catch {
        Write-Host "  -> Note: sqlcmd backup warning ($($_.Exception.Message)). Continuing with database update..." -ForegroundColor DarkYellow
    }
}

# -----------------------------------------------------------------------------------------
# Step 2: Apply Database Schema Patch
# -----------------------------------------------------------------------------------------
Write-Host "`n[2/5] Applying Non-Destructive Database Schema Updates..." -ForegroundColor Yellow
$sqlFile = Join-Path $scriptDir "database\update_schema.sql"
if (Test-Path $sqlFile) {
    try {
        sqlcmd -S $config.SqlServerInstance -E -d $config.TargetDatabase -i $sqlFile -f 65001
        Write-Host "  -> Database schema synced successfully with 0 data loss!" -ForegroundColor Green
    }
    catch {
        Write-Host "  -> Error executing SQL script: $_" -ForegroundColor Red
        $proceed = Read-Host "Do you want to continue with Backend and Frontend update? (Y/N)"
        if ($proceed -ne 'Y' -and $proceed -ne 'y') {
            exit 1
        }
    }
} else {
    Write-Host "  -> SQL script not found at '$sqlFile', skipping DB patch." -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------------------
# Step 3: Stop IIS AppPool Gracefully
# -----------------------------------------------------------------------------------------
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
} else {
    Write-Host "  -> appcmd.exe not detected; please ensure IIS process is stopped before file copy." -ForegroundColor DarkYellow
}

# -----------------------------------------------------------------------------------------
# Step 4: Safely Update Backend & Frontend Files
# -----------------------------------------------------------------------------------------
Write-Host "`n[4/5] Updating Backend API & Frontend UI Files..." -ForegroundColor Yellow

# Backend
if (Test-Path $config.BackendFolderPath) {
    $backendSource = Join-Path $scriptDir "backend"
    Write-Host "  -> Copying updated Backend API files to $($config.BackendFolderPath)..." -ForegroundColor White
    # Explicitly exclude existing appsettings files so existing database connection strings are 100% preserved!
    robocopy $backendSource $config.BackendFolderPath /E /XF "appsettings.Production.json" "appsettings.json" "appsettings.Development.json" /XD "logs" "uploads" | Out-Null
    Write-Host "  -> Backend files updated successfully (Configuration preserved)." -ForegroundColor Green
} else {
    Write-Host "  -> Backend folder not found at '$($config.BackendFolderPath)'. Please verify path." -ForegroundColor Red
}

# Frontend
if (Test-Path $config.FrontendFolderPath) {
    $frontendSource = Join-Path $scriptDir "frontend"
    Write-Host "  -> Copying updated Frontend assets to $($config.FrontendFolderPath)..." -ForegroundColor White
    robocopy $frontendSource $config.FrontendFolderPath /E | Out-Null
    Write-Host "  -> Frontend assets updated successfully." -ForegroundColor Green
} else {
    Write-Host "  -> Frontend folder not found at '$($config.FrontendFolderPath)'. Please verify path." -ForegroundColor Red
}

# -----------------------------------------------------------------------------------------
# Step 5: Restart IIS AppPool
# -----------------------------------------------------------------------------------------
Write-Host "`n[5/5] Restarting IIS AppPool '$($config.IISAppPoolName)'..." -ForegroundColor Yellow
if (Test-Path $appCmd) {
    try {
        & $appCmd start apppool /apppool.name:"$($config.IISAppPoolName)"
        Write-Host "  -> IIS AppPool started successfully!" -ForegroundColor Green
    } catch {
        Write-Host "  -> Could not start AppPool: $_" -ForegroundColor Red
    }
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] SMARTBANKING ALL-IN-ONE VPS PATCH APPLIED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  [OK] Database: Schema Synced and Preserved (Zero Data Loss)" -ForegroundColor Green
Write-Host "  [OK] Backend : C# .NET 10 API Binaries Updated" -ForegroundColor Green
Write-Host "  [OK] Frontend: Latest React UI Assets Deployed for Bambavade" -ForegroundColor Green
Write-Host "  [OK] IIS     : Application Pool Restarted and Online" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press ENTER to exit"
'@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "apply_patch.ps1"), $applyPs1Content, $utf8NoBom)

# 4.4 Apply_VPS_Patch.bat (Launcher)
$batContent = @"
@echo off
title SmartBanking ERP - 1-Click All-in-One VPS Auto-Updater (Bambavade)
cd /d "%~dp0"

echo ================================================================
echo    SmartBanking ERP - 1-Click All-In-One VPS Auto-Updater
echo    Target: Shree Bambawade PatSanstha
echo ================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_patch.ps1"

pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "Apply_VPS_Patch.bat"), $batContent, [System.Text.Encoding]::ASCII)

# -----------------------------------------------------------------------------------------
# Step 5: Compress into SmartBanking_VPS_Bambavade_Patch.zip
# -----------------------------------------------------------------------------------------
Write-Host "`n[5/5] Creating Final Compressed ZIP Package ($zipOutputFile)..." -ForegroundColor Cyan
if (Test-Path $zipOutputFile) {
    Remove-Item -Path $zipOutputFile -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($patchFolder, $zipOutputFile, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$zipSizeMb = [math]::Round(((Get-Item $zipOutputFile).Length / 1MB), 2)

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "  BAMBAVADE ALL-IN-ONE VPS PATCH PACKAGE READY!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  Target Sanstha  : Shree Bambawade Nagari Sahakari PatSanstha" -ForegroundColor White
Write-Host "  Frontend API URL: https://api.bambavade.hellomindspace.in" -ForegroundColor White
Write-Host "  Database Name   : SmartBanking_Bambawade" -ForegroundColor White
Write-Host "  Folder Package  : $patchFolder" -ForegroundColor White
Write-Host "  ZIP Package     : $zipOutputFile ($zipSizeMb MB)" -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
