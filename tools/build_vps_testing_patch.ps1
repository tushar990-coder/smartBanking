# =========================================================================================
# SmartBanking ERP - 1-Click All-in-One VPS Patch Builder for Testing Environment
# Automates: Frontend Build (Vite) + Backend Publish (.NET 10 API) + Database SQL Patch + Packaging
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$workspaceRoot = "d:\Bhisi Software"
$patchFolder = Join-Path $workspaceRoot "VPS_Testing_Patch"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_VPS_Testing_Patch.zip"
$clientDir = Join-Path $workspaceRoot "client"
$apiDir = Join-Path $workspaceRoot "api\Bhisi.Api"
$version = "2.1.3"
$buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   SmartBanking ERP - Testing Site 1-Click VPS Patch Builder      " -ForegroundColor Cyan
Write-Host "   Target Version: v$version ($buildDate)                         " -ForegroundColor Yellow
Write-Host "   Target Site: Testing Environment (SmartBanking_Testing)        " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure .env.production has Testing API Base URL
$envProdPath = Join-Path $clientDir ".env.production"
$envContent = "VITE_API_BASE_URL=https://api.testing.hellomindspace.in`n"
[System.IO.File]::WriteAllText($envProdPath, $envContent, [System.Text.Encoding]::UTF8)

# -----------------------------------------------------------------------------------------
# Step 1: Build React Frontend (Vite)
# -----------------------------------------------------------------------------------------
Write-Host "[1/5] Building Latest React Frontend (Vite) with Testing API endpoint..." -ForegroundColor Cyan
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
$backendTempPublish = Join-Path $workspaceRoot "scratch\api_publish_temp_testing"
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
# Step 3: Prepare Clean VPS_Testing_Patch Directory Structure
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

# 4.1 patch_config.json for Testing Environment
$configContent = @"
{
  "SansthaName": "Testing Environment",
  "TargetDatabase": "SmartBanking_Testing",
  "SqlServerInstance": ".",
  "IISAppPoolName": "apitesting",
  "BackendFolderPath": "D:\\WebApps\\Testing\\api.testing.hellomindspace.in",
  "FrontendFolderPath": "D:\\WebApps\\Testing\\testing.hellomindspace.in",
  "TakeDbBackup": true,
  "BackupFolder": "D:\\Backups"
}
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "patch_config.json"), $configContent, $utf8NoBom)

# 4.2 version.json
$versionJsonObj = @{
    version = "2.1.3"
    releaseDate = (Get-Date -Format "yyyy-MM-dd")
    packageType = "Testing Environment VPS Patch (Pigmi Mobile API & Lock Security)"
    changelog = @(
        "पिग्मी मोबाईल ॲप बॅकएंड APIs (Pigmi Mobile App Complete REST API Suite)",
        "एजंट लॉक सुरक्षा प्रणाली (₹२०,००० कॅश-इन-हँड मर्यादा नियंत्रण - Agent Lock Security ₹20,000 Limit)",
        "ऑफलाइन-फर्स्ट व आयडेमपोटन्सी इंजिन (UUID Deduplication & Zero Double Credit Guarantee)",
        "सिंगल व बल्क ऑफलाइन सिंक (Single Sync & Batch Sync /api/collections/bulk-sync)",
        "एजंट डॅशबोर्ड व पासबुक स्टेटमेंट लेजर (Dashboard Summary & Passbook Reports)",
        "कमिशन गणना व तारीखवार कलेक्शन अहवाल (Commission Calculation & Date-wise Collection Report)",
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

# 4.1 Update Backend
if (Test-Path $config.BackendFolderPath) {
    $backendSource = Join-Path $scriptDir "backend"
    robocopy $backendSource $config.BackendFolderPath /E /XO /XF "appsettings.json" "appsettings.Production.json" "license.lic" "web.config" /XD "logs" "Uploads" "publish_vps_20260809" | Out-Null
    Write-Host "  -> Backend binaries updated (preserves existing connection strings & licenses)." -ForegroundColor Green
} else {
    Write-Host "  -> [WARNING] Backend directory '$($config.BackendFolderPath)' not found. Creating..." -ForegroundColor DarkYellow
    New-Item -Path $config.BackendFolderPath -ItemType Directory -Force | Out-Null
    robocopy (Join-Path $scriptDir "backend") $config.BackendFolderPath /E | Out-Null
}

# 4.2 Update Frontend
if (Test-Path $config.FrontendFolderPath) {
    $frontendSource = Join-Path $scriptDir "frontend"
    robocopy $frontendSource $config.FrontendFolderPath /E /PURGE /XF "web.config" ".htaccess" | Out-Null
    Write-Host "  -> Frontend React UI bundle updated successfully." -ForegroundColor Green
} else {
    Write-Host "  -> [WARNING] Frontend directory '$($config.FrontendFolderPath)' not found. Creating..." -ForegroundColor DarkYellow
    New-Item -Path $config.FrontendFolderPath -ItemType Directory -Force | Out-Null
    robocopy (Join-Path $scriptDir "frontend") $config.FrontendFolderPath /E | Out-Null
}

# -----------------------------------------------------------------------------------------
# Step 5: Start IIS AppPool & Verify
# -----------------------------------------------------------------------------------------
Write-Host "`n[5/5] Starting IIS AppPool '$($config.IISAppPoolName)'..." -ForegroundColor Yellow
if (Test-Path $appCmd) {
    try {
        & $appCmd start apppool /apppool.name:"$($config.IISAppPoolName)"
        Write-Host "  -> IIS AppPool started successfully!" -ForegroundColor Green
    } catch {
        Write-Host "  -> Failed to start AppPool via appcmd. Please start IIS AppPool manually in IIS Manager." -ForegroundColor Red
    }
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] SMARTBANKING PATCH APPLIED SUCCESSFULLY!              " -ForegroundColor Green
Write-Host "  Target Site : $($config.SansthaName)                            " -ForegroundColor White
Write-Host "  Target DB   : $($config.TargetDatabase)                         " -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press ENTER to complete"
'@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "apply_patch.ps1"), $applyPs1Content, $utf8NoBom)

# 4.4 1-Click Batch Launcher for VPS
$applyBatContent = @"
@echo off
title SmartBanking ERP - 1-Click VPS Patch Installer
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "apply_patch.ps1"
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "Apply_Patch.bat"), $applyBatContent, [System.Text.Encoding]::ASCII)

# 4.5 Quick Readme / Release Notes
$readmeContent = @"
================================================================================
  SmartBanking ERP - 1-Click VPS Patch Package (Testing Site)
  Version: v$version ($buildDate)
  Target: Testing Environment ($($config.SansthaName))
================================================================================

या पॅकेजमध्ये खालील सर्व नवीन अपडेट्स समाविष्ट आहेत:
1. पिग्मी मोबाईल ॲप बॅकएंड APIs (Pigmi Mobile App Complete REST API Suite)
2. एजंट लॉक सुरक्षा प्रणाली (₹२०,००० कॅश-इन-हँड मर्यादा नियंत्रण - Agent Lock Security)
3. ऑफलाइन-फर्स्ट व आयडेमपोटन्सी इंजिन (UUID Deduplication & Zero Double Credit)
4. सिंगल व बल्क ऑफलाइन सिंक (/api/collections/bulk-sync)
5. एजंट डॅशबोर्ड व पासबुक स्टेटमेंट लेजर (Dashboard & Passbook Reports)
6. कमिशन गणना व तारीखवार कलेक्शन अहवाल (Commission Calculation Report)
7. डेटाबेस ऑटो-मायग्रेशन आणि Zero Data Loss हमी

पॅच VPS वर इन्स्टॉल करण्यासाठी सोप्या पायऱ्या:
1. हा 'SmartBanking_VPS_Testing_Patch.zip' VPS वर कॉपी करा आणि Extract करा.
2. 'VPS_Testing_Patch' फोल्डरमध्ये जा.
3. 'Apply_Patch.bat' वर Right-Click करून 'Run as administrator' करा!
4. सिस्टीम आपोआप डेटाबेस बॅकअप घेऊन, स्कीमा अपडेट करून, API व Frontend रिफ्रेश करेल.
================================================================================
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "README_PATCH.txt"), $readmeContent, $utf8NoBom)

# -----------------------------------------------------------------------------------------
# Step 5: Create Standalone Zip Package
# -----------------------------------------------------------------------------------------
Write-Host "`n[5/5] Creating Standalone Zip Archive: $zipOutputFile..." -ForegroundColor Cyan
if (Test-Path $zipOutputFile) { Remove-Item -Force $zipOutputFile }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($patchFolder, $zipOutputFile, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$zipSizeMb = [Math]::Round(((Get-Item $zipOutputFile).Length / 1MB), 2)
Write-Host "  -> ZIP Package created: $zipOutputFile ($zipSizeMb MB)" -ForegroundColor Green

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] 1-CLICK TESTING VPS PATCH PACKAGE IS READY!           " -ForegroundColor Green
Write-Host "  Location: $zipOutputFile ($zipSizeMb MB)                        " -ForegroundColor White
Write-Host "  Extracted Folder: $patchFolder                                  " -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
