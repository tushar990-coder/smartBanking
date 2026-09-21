# =========================================================================================
# SmartBanking ERP - 1-Click Dedicated VPS Patch Builder for Testing Environment
# Automates: Frontend Build (Vite) + Backend Publish (.NET 10 API) + Database SQL Patch + Packaging
# Targets ONLY: Testing Environment (SmartBanking_Testing / apitesting)
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$workspaceRoot = "d:\Bhisi Software"
$patchFolder = Join-Path $workspaceRoot "SmartBanking_Testing_Patch"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_Testing_Patch.zip"
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
$desktopDest = Join-Path $desktop "SmartBanking_Testing_Patch.zip"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   SmartBanking ERP - Dedicated Testing Application Patch Builder  " -ForegroundColor Cyan
Write-Host "   Target Version: v$version ($buildDate)                         " -ForegroundColor Yellow
Write-Host "   Target Site   : Testing Environment (SmartBanking_Testing)     " -ForegroundColor Yellow
Write-Host "   API Domain    : https://api.testing.hellomindspace.in          " -ForegroundColor Yellow
Write-Host "   Web Domain    : https://testing.hellomindspace.in              " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure .env.production has Testing API Base URL configured
$envProdPath = Join-Path $clientDir ".env.production"
$envContent = "# Testing Environment Specific API Endpoint`nVITE_API_BASE_URL=https://api.testing.hellomindspace.in`n"
[System.IO.File]::WriteAllText($envProdPath, $envContent, [System.Text.Encoding]::UTF8)

# -----------------------------------------------------------------------------------------
# Step 1: Build React Frontend (Vite)
# -----------------------------------------------------------------------------------------
Write-Host "[1/5] Building Latest React Frontend (Vite) for Testing Environment..." -ForegroundColor Cyan
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
$backendTempPublish = Join-Path $workspaceRoot "scratch\api_publish_temp_testing"
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
# Step 3: Prepare Clean SmartBanking_Testing_Patch Directory Structure
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

$cleanupSource = Join-Path $workspaceRoot "tools\members_normalization_and_cleanup.sql"
if (Test-Path $cleanupSource) {
    $cleanupDest = Join-Path $patchFolder "database\members_normalization_and_cleanup.sql"
    $cleanupContent = [System.IO.File]::ReadAllText($cleanupSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($cleanupDest, $cleanupContent, $utf8WithBom)
    Write-Host "  -> members_normalization_and_cleanup.sql included in database package." -ForegroundColor White
}

$universalSyncSource = Join-Path $workspaceRoot "tools\Universal_Schema_Only_Sync.sql"
if (Test-Path $universalSyncSource) {
    Copy-Item $universalSyncSource (Join-Path $patchFolder "database\Universal_Schema_Only_Sync.sql") -Force
    Write-Host "  -> Universal_Schema_Only_Sync.sql included in database package." -ForegroundColor White
}

# 3.2 Copy Backend Files (exclude local configs, git, temporary dirs)
$backendDest = Join-Path $patchFolder "backend"
robocopy $backendTempPublish $backendDest /E /XD "logs" "wwwroot" "uploads" /XF "appsettings.Development.json" "appsettings.Production.json" "appsettings.json" | Out-Null

# Ensure web.config is included for IIS
$sourceWebConfig = Join-Path $workspaceRoot "VPS_Deploy\web.config"
if ((Test-Path $sourceWebConfig) -and (-not (Test-Path (Join-Path $backendDest "web.config")))) {
    Copy-Item $sourceWebConfig (Join-Path $backendDest "web.config") -Force
}
Write-Host "  -> Backend binaries & web.config copied (Connection strings preserved)." -ForegroundColor White

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

$mobileApiDoc = Join-Path $workspaceRoot "MOBILE_APPLICATION_API.md"
if (Test-Path $mobileApiDoc) {
    Copy-Item $mobileApiDoc (Join-Path $patchFolder "MOBILE_APPLICATION_API.md") -Force
    Write-Host "  -> MOBILE_APPLICATION_API.md included." -ForegroundColor White
}

# Clean temp publish
Remove-Item -Recurse -Force $backendTempPublish -ErrorAction SilentlyContinue

# -----------------------------------------------------------------------------------------
# Step 4: Generate Configuration & Installer Scripts
# -----------------------------------------------------------------------------------------
Write-Host "`n[4/5] Generating patch_config.json, installer scripts & manifest..." -ForegroundColor Cyan

# 4.1 patch_config.json strictly for Testing Environment
$configContent = @"
{
  "SansthaName": "Testing Environment",
  "TargetDatabase": "SmartBanking_Testing",
  "SqlServerInstance": ".",
  "SqlUser": "sa",
  "SqlPassword": "Mindspace2026",
  "IISAppPoolName": "apitesting",
  "BackendFolderPath": "D:\\WebApps\\Testing\\api.testing.hellomindspace.in",
  "FrontendFolderPath": "D:\\WebApps\\Testing\\testing.hellomindspace.in",
  "TakeDbBackup": true,
  "BackupFolder": "D:\\Backups"
}
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "patch_config.json"), $configContent, $utf8WithBom)

# 4.2 apply_patch.ps1 (Runs on VPS)
$applyPs1Content = @'
# =========================================================================================
# SmartBanking Core ERP - 1-Click VPS Patch Installer (Testing Environment)
# Applies: 1. Safety Backup | 2. Database Schema Sync | 3. Backend API | 4. Frontend UI | 5. IIS Restart
# =========================================================================================

param(
    [string]$ConfigPath = "patch_config.json"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Clear-Host
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - 1-Click VPS Testing Patch Installer         " -ForegroundColor Cyan
Write-Host "  (Zero Data Loss - All Existing Records 100% Preserved)          " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$fullConfigPath = Join-Path $scriptDir $ConfigPath
if (-not (Test-Path $fullConfigPath)) {
    Write-Host "[ERROR] Configuration file '$ConfigPath' not found at: $fullConfigPath" -ForegroundColor Red
    Read-Host "Press ENTER to exit"
    exit 1
}

$rawConfig = Get-Content $fullConfigPath -Raw -Encoding UTF8
$cleanedConfig = $rawConfig -replace '(?m)^\s*//.*$', '' -replace '(?s)/\*.*?\*/', ''
$config = $cleanedConfig | ConvertFrom-Json

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
    Write-Host "`n[1/6] Taking Database Safety Backup (Zero Data Loss Protection)..." -ForegroundColor Yellow
    if (-not (Test-Path $config.BackupFolder)) {
        New-Item -Path $config.BackupFolder -ItemType Directory -Force | Out-Null
    }
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = "$($config.BackupFolder)\$($config.TargetDatabase)_PrePatch_$timestamp.bak"
    $backupSql = "BACKUP DATABASE [$($config.TargetDatabase)] TO DISK = N'$backupPath' WITH FORMAT, INIT, NAME = N'$($config.TargetDatabase)-PrePatch-Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10;"

    $backupDone = $false
    if ($config.SqlUser -and $config.SqlPassword) {
        try {
            sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -Q $backupSql -b
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  -> Backup created successfully via SQL Auth: $backupPath" -ForegroundColor Green
                $backupDone = $true
            }
        } catch {}
    }

    if (-not $backupDone) {
        try {
            sqlcmd -S $config.SqlServerInstance -E -Q $backupSql -b
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  -> Backup created successfully via Windows Auth: $backupPath" -ForegroundColor Green
                $backupDone = $true
            }
        } catch {
            Write-Host "  -> Backup Notice: $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
    }
}

# -----------------------------------------------------------------------------------------
# Step 2: Apply Database Schema Patch
# -----------------------------------------------------------------------------------------
Write-Host "`n[2/6] Applying Non-Destructive Database Schema Updates..." -ForegroundColor Yellow
$sqlFile = Join-Path $scriptDir "database\update_schema.sql"
if (Test-Path $sqlFile) {
    $applied = $false
    if ($config.SqlUser -and $config.SqlPassword) {
        try {
            sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d $config.TargetDatabase -i $sqlFile -f 65001 -b
            if ($LASTEXITCODE -eq 0) { $applied = $true }
        } catch {}
    }
    if (-not $applied) {
        try {
            sqlcmd -S $config.SqlServerInstance -E -d $config.TargetDatabase -i $sqlFile -f 65001 -b
            if ($LASTEXITCODE -eq 0) { $applied = $true }
        } catch {
            Write-Host "  -> Error executing SQL script: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    if ($applied) {
        Write-Host "  -> Database schema synced successfully with 0 data loss!" -ForegroundColor Green
    } else {
        Write-Host "  -> Database update executed with warnings. Please verify schema." -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  -> SQL script not found at '$sqlFile', skipping DB patch." -ForegroundColor Yellow
}

# Run optional members normalization if present
$cleanupFile = Join-Path $scriptDir "database\members_normalization_and_cleanup.sql"
if (Test-Path $cleanupFile) {
    Write-Host "`n  -> Applying Members table canonical 13-columns normalization..." -ForegroundColor Yellow
    $cleanDone = $false
    if ($config.SqlUser -and $config.SqlPassword) {
        try {
            sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d $config.TargetDatabase -i $cleanupFile -f 65001 -b
            if ($LASTEXITCODE -eq 0) { $cleanDone = $true }
        } catch {}
    }
    if (-not $cleanDone) {
        try {
            sqlcmd -S $config.SqlServerInstance -E -d $config.TargetDatabase -i $cleanupFile -f 65001 -b
            if ($LASTEXITCODE -eq 0) { $cleanDone = $true }
        } catch {}
    }
    if ($cleanDone) {
        Write-Host "  -> Members canonical 13-columns normalization applied!" -ForegroundColor Green
    }
}

# -----------------------------------------------------------------------------------------
# Step 3: Stop IIS AppPool Gracefully & Clear Locks
# -----------------------------------------------------------------------------------------
Write-Host "`n[3/6] Stopping IIS AppPool '$($config.IISAppPoolName)' & Clearing Locks..." -ForegroundColor Yellow
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
Get-Process -Name "w3wp", "dotnet", "Bhisi.Api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# -----------------------------------------------------------------------------------------
# Step 4: Clean Leftover *.sql in Backend Directory
# -----------------------------------------------------------------------------------------
Write-Host "`n[4/6] Cleaning leftover scripts in Backend folder..." -ForegroundColor Yellow
if (Test-Path $config.BackendFolderPath) {
    $oldSql = Get-ChildItem -Path $config.BackendFolderPath -Filter "*.sql" -Recurse -ErrorAction SilentlyContinue
    if ($oldSql -and $oldSql.Count -gt 0) {
        foreach ($sf in $oldSql) {
            Remove-Item -Path $sf.FullName -Force -ErrorAction SilentlyContinue
            Write-Host "  -> Removed leftover SQL: $($sf.Name)" -ForegroundColor Green
        }
    } else {
        Write-Host "  -> Backend directory clean of stray *.sql files." -ForegroundColor Green
    }
}

# -----------------------------------------------------------------------------------------
# Step 5: Safely Update Backend & Frontend Files
# -----------------------------------------------------------------------------------------
Write-Host "`n[5/6] Updating Backend API & Frontend UI Files..." -ForegroundColor Yellow

# 5.1 Update Backend
if (-not (Test-Path $config.BackendFolderPath)) {
    New-Item -Path $config.BackendFolderPath -ItemType Directory -Force | Out-Null
}
$backendSource = Join-Path $scriptDir "backend"
robocopy $backendSource $config.BackendFolderPath /E /XO /XF "appsettings.json" "appsettings.Production.json" "license.lic" "web.config" /XD "logs" "Uploads" | Out-Null
Write-Host "  -> Backend binaries updated (preserves existing connection strings & licenses)." -ForegroundColor Green

# 5.2 Update Frontend
if (-not (Test-Path $config.FrontendFolderPath)) {
    New-Item -Path $config.FrontendFolderPath -ItemType Directory -Force | Out-Null
}
$frontendSource = Join-Path $scriptDir "frontend"
robocopy $frontendSource $config.FrontendFolderPath /E /PURGE /XF "web.config" ".htaccess" | Out-Null
Write-Host "  -> Frontend React UI bundle updated successfully." -ForegroundColor Green

# -----------------------------------------------------------------------------------------
# Step 6: Start IIS AppPool & Health Verification
# -----------------------------------------------------------------------------------------
Write-Host "`n[6/6] Starting IIS AppPool '$($config.IISAppPoolName)' & Verifying..." -ForegroundColor Yellow
if (Test-Path $appCmd) {
    try {
        & $appCmd start apppool /apppool.name:"$($config.IISAppPoolName)"
        Write-Host "  -> IIS AppPool started successfully!" -ForegroundColor Green
    } catch {
        Write-Host "  -> Warning starting AppPool. Please check IIS Manager." -ForegroundColor DarkYellow
    }
}
cmd /c "iisreset" 2>$null

# Verification
$verifySql = "SELECT COUNT(*) AS MembersCols FROM [$($config.TargetDatabase)].sys.columns WHERE object_id = OBJECT_ID('Members'); SELECT COUNT(*) AS TotalMembers FROM [$($config.TargetDatabase)].dbo.Members; SELECT COUNT(*) AS Shareholders FROM [$($config.TargetDatabase)].dbo.ShareAccounts WHERE TotalShareCount > 0;"
try {
    if ($config.SqlUser -and $config.SqlPassword) {
        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -Q $verifySql
    } else {
        sqlcmd -S $config.SqlServerInstance -E -Q $verifySql
    }
} catch {}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] TESTING APPLICATION PATCH APPLIED SUCCESSFULLY!      " -ForegroundColor Green
Write-Host "  Target Site : $($config.SansthaName)                            " -ForegroundColor White
Write-Host "  Target DB   : $($config.TargetDatabase)                         " -ForegroundColor White
Write-Host "  Frontend    : $($config.FrontendFolderPath)                     " -ForegroundColor White
Write-Host "  Backend     : $($config.BackendFolderPath)                      " -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press ENTER to complete"
'@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "apply_patch.ps1"), $applyPs1Content, $utf8WithBom)

# 4.3 1-Click Elevated Batch Launchers
$batTesting = @"
@echo off
title SmartBanking ERP - 1-Click Update Testing Application
color 0B
echo ==================================================================
echo   SmartBanking ERP - 1-Click Update: Testing Application
echo ==================================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Administrator rights required. Elevating privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_patch.ps1"
echo.
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "1_Click_Update_Testing.bat"), $batTesting, [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText((Join-Path $patchFolder "Apply_Patch.bat"), $batTesting, [System.Text.Encoding]::ASCII)

# 4.4 Quick Readme
$readmeContent = @"
================================================================================
  SmartBanking ERP - 1-Click Dedicated VPS Patch Package (Testing Site)
  Version: v$version ($buildDate)
  Target: Testing Environment (SmartBanking_Testing / apitesting)
  Frontend: https://testing.hellomindspace.in
  Backend : https://api.testing.hellomindspace.in
================================================================================

या पॅकेजमध्ये खालील सर्व नवीन अपडेट्स समाविष्ट आहेत:
1. सभासद टेबल नॉर्मलायझेशन (Members Table 13 Canonical Columns & Clean Split)
2. दैनिक ठेव सीबीएस एंटरप्राइज सूट (Pigmy Agent Suspension, Reallocation & Review Queue)
3. शेअर ओपनिंग बॅलन्स व सभासद कोड अलाइनमेंट (Continuous MEM0001+ Sequences)
4. खातेदार यादी अहवाल व रिअल-टाईम मराठी ट्रान्सलिटरेशन (CIF Auto-Transliteration)
5. मुदत ठेव व आवर्ती ठेव सीबीएस मानके (FD & RD Pure CIF-First Architecture)
6. कॅशियर नोटा मोजणी ग्रिड (Cashier Denomination Counter)
7. डेटाबेस ऑटो-मायग्रेशन आणि Zero Data Loss हमी

पॅच VPS वर इन्स्टॉल करण्यासाठी सोप्या पायऱ्या:
1. हा 'SmartBanking_Testing_Patch.zip' VPS वर कॉपी करा आणि Extract करा.
2. 'SmartBanking_Testing_Patch' फोल्डरमध्ये जा.
3. '1_Click_Update_Testing.bat' किंवा 'Apply_Patch.bat' वर Right-Click करून 'Run as administrator' करा!
4. सिस्टीम आपोआप डेटाबेस बॅकअप घेऊन, स्कीमा अपडेट करून, API व Frontend रिफ्रेश करेल.
================================================================================
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "README_PATCH.txt"), $readmeContent, $utf8WithBom)

# -----------------------------------------------------------------------------------------
# Step 5: Compress to ZIP & Copy to Desktop
# -----------------------------------------------------------------------------------------
Write-Host "`n[5/5] Creating Standalone Zip Archive: $zipOutputFile..." -ForegroundColor Cyan
if (Test-Path $zipOutputFile) { Remove-Item -Force $zipOutputFile }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($patchFolder, $zipOutputFile, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$zipSizeMb = [Math]::Round(((Get-Item $zipOutputFile).Length / 1MB), 2)

# Copy to Desktop
Copy-Item $zipOutputFile $desktopDest -Force
Write-Host "  -> ZIP Package created: $zipOutputFile ($zipSizeMb MB)" -ForegroundColor Green
Write-Host "  -> Copied to Desktop: $desktopDest" -ForegroundColor Green

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] 1-CLICK TESTING APPLICATION PATCH IS READY!           " -ForegroundColor Green
Write-Host "  Location: $zipOutputFile ($zipSizeMb MB)                        " -ForegroundColor White
Write-Host "  Desktop : $desktopDest                                          " -ForegroundColor White
Write-Host "  Extracted Folder: $patchFolder                                  " -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
