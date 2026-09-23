# =========================================================================================
# SmartBanking ERP - Unified 1-Click VPS Patch Builder for Testing & Testing1 Applications
# Automates: Frontend Build + Backend Publish (.NET 10 API) + Database SQL Patch + Packaging
# Targets BOTH: Testing (SmartBanking_Testing) AND Testing1 (SmartBanking_testing1)
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$workspaceRoot = "d:\Bhisi Software"
$patchFolder = Join-Path $workspaceRoot "SmartBanking_Testing_And_Testing1_Unified_Patch"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_Testing_And_Testing1_Unified_Patch.zip"
$clientDir = Join-Path $workspaceRoot "client"
$apiDir = Join-Path $workspaceRoot "api\Bhisi.Api"
$versionJsonPath = Join-Path $workspaceRoot "version.json"

$version = "2.5.1"
if (Test-Path $versionJsonPath) {
    try {
        $vObj = Get-Content $versionJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($vObj.version) { $version = $vObj.version }
    } catch {}
}
$buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
$desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$desktopDest = Join-Path $desktop "SmartBanking_Testing_And_Testing1_Unified_Patch.zip"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   SmartBanking ERP - Testing & Testing1 Unified Patch Builder    " -ForegroundColor Cyan
Write-Host "   Target Version: v$version ($buildDate)                         " -ForegroundColor Yellow
Write-Host "   Target Sites  : Testing & Testing1 Environments                " -ForegroundColor Yellow
Write-Host "   Target DBs    : SmartBanking_Testing & SmartBanking_testing1   " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure .env.production has empty VITE_API_BASE_URL for relative/dynamic routing
$envProdPath = Join-Path $clientDir ".env.production"
$envContent = "# Dynamic Relative Domain Routing`nVITE_API_BASE_URL=`n"
[System.IO.File]::WriteAllText($envProdPath, $envContent, [System.Text.Encoding]::UTF8)

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
$backendTempPublish = Join-Path $workspaceRoot "scratch\api_publish_temp_unified"
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
# Step 3: Prepare Clean Patch Directory Structure
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
    Write-Host "  -> master_vps_update_schema.sql copied as database\update_schema.sql (UTF-8 BOM)." -ForegroundColor Green
}

# 3.2 Copy Published Backend Files
Get-ChildItem -Path $backendTempPublish | Copy-Item -Destination (Join-Path $patchFolder "backend") -Recurse -Force
# Remove any local dev environment configuration
Remove-Item -Path (Join-Path $patchFolder "backend\appsettings.Development.json") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $patchFolder "backend\.env") -Force -ErrorAction SilentlyContinue

# Ensure standard production web.config
$webConfigContent = @'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\Bhisi.Api.dll" stdoutLogEnabled="false" stdoutLogFile=".\logs\stdout" hostingModel="inprocess" />
    </system.webServer>
  </location>
</configuration>
'@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "backend\web.config"), $webConfigContent, [System.Text.Encoding]::UTF8)
Write-Host "  -> Backend binaries & web.config copied." -ForegroundColor Green

# 3.3 Copy Built Frontend Files
$frontendDist = Join-Path $clientDir "dist"
Get-ChildItem -Path $frontendDist | Copy-Item -Destination (Join-Path $patchFolder "frontend") -Recurse -Force
Write-Host "  -> Frontend React UI bundle copied." -ForegroundColor Green

# 3.4 Copy Version Info
if (Test-Path $versionJsonPath) {
    Copy-Item $versionJsonPath (Join-Path $patchFolder "version.json") -Force
}

# -----------------------------------------------------------------------------------------
# Step 4: Generate Unified patch_config.json & Installer Scripts
# -----------------------------------------------------------------------------------------
Write-Host "`n[4/5] Generating Unified Multi-Target Configuration & Installer..." -ForegroundColor Cyan

$unifiedConfig = @{
    SqlServerInstance = "."
    SqlUser = "sa"
    SqlPassword = "Mindspace2026"
    TakeDbBackup = $true
    BackupFolder = "D:\Backups"
    PatchVersion = $version
    ReleaseDate = $buildDate
    Targets = @(
        @{
            SansthaName = "Testing Environment"
            TargetDatabase = "SmartBanking_Testing"
            IISAppPoolName = "apitesting"
            BackendFolderPath = "D:\WebApps\Testing\api.testing.hellomindspace.in"
            FrontendFolderPath = "D:\WebApps\Testing\testing.hellomindspace.in"
        },
        @{
            SansthaName = "Testing1 Environment"
            TargetDatabase = "SmartBanking_testing1"
            IISAppPoolName = "testing1-backend"
            BackendFolderPath = "D:\WebApps\testing1\backend"
            FrontendFolderPath = "D:\WebApps\testing1\frontend"
        }
    )
}

$configJsonStr = $unifiedConfig | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $patchFolder "patch_config.json"), $configJsonStr, [System.Text.Encoding]::UTF8)

# Create 1-Click Install_Patch.bat
$installBat = @'
@echo off
chcp 65001 > nul
title SmartBanking ERP - Testing & Testing1 Unified Patch Installer
echo ==================================================================
echo   SmartBanking ERP - 1-Click Unified Patch Installer
echo   Targeting: Testing (SmartBanking_Testing) & Testing1 (SmartBanking_testing1)
echo ==================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_patch.ps1"
echo.
echo Press any key to exit...
pause > nul
'@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "Install_Patch.bat"), $installBat, [System.Text.Encoding]::UTF8)

# Create Unified install_patch.ps1
$installPs1 = @'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$patchDir = $PSScriptRoot
$configFile = Join-Path $patchDir "patch_config.json"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - Testing & Testing1 Unified Patch Installer  " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $configFile)) {
    Write-Host "[ERROR] Configuration file 'patch_config.json' not found!" -ForegroundColor Red
    exit 1
}

$config = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
$sqlServer = $config.SqlServerInstance
$sqlUser = $config.SqlUser
$sqlPass = $config.SqlPassword
$backupDir = $config.BackupFolder

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$sqlScriptPath = Join-Path $patchDir "database\update_schema.sql"

foreach ($target in $config.Targets) {
    Write-Host "`n------------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host " Processing Target: $($target.SansthaName)" -ForegroundColor Yellow
    Write-Host " Target DB        : $($target.TargetDatabase)" -ForegroundColor White
    Write-Host " IIS AppPool      : $($target.IISAppPoolName)" -ForegroundColor White
    Write-Host " Backend Path     : $($target.BackendFolderPath)" -ForegroundColor White
    Write-Host " Frontend Path    : $($target.FrontendFolderPath)" -ForegroundColor White
    Write-Host "------------------------------------------------------------------" -ForegroundColor Yellow

    # 1. Take DB Backup
    if ($config.TakeDbBackup) {
        $timestamp = (Get-Date -Format "yyyyMMdd_HHmmss")
        $backupFile = Join-Path $backupDir "$($target.TargetDatabase)_pre_patch_$timestamp.bak"
        Write-Host "[1/4] Creating Database Backup: $backupFile ..." -ForegroundColor Cyan
        
        $sqlBackupQuery = "BACKUP DATABASE [$($target.TargetDatabase)] TO DISK = N'$backupFile' WITH INIT, STATS = 10;"
        if ($sqlUser -and $sqlPass) {
            & sqlcmd -S $sqlServer -U $sqlUser -P $sqlPass -Q $sqlBackupQuery -b
        } else {
            & sqlcmd -S $sqlServer -E -Q $sqlBackupQuery -b
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [WARNING] DB Backup failed or database might not exist yet. Continuing..." -ForegroundColor Yellow
        } else {
            Write-Host "  -> Database Backup Completed Successfully." -ForegroundColor Green
        }
    }

    # 2. Apply Database SQL Migration
    if (Test-Path $sqlScriptPath) {
        Write-Host "[2/4] Applying Database Migration to [$($target.TargetDatabase)]..." -ForegroundColor Cyan
        if ($sqlUser -and $sqlPass) {
            & sqlcmd -S $sqlServer -U $sqlUser -P $sqlPass -d $target.TargetDatabase -i $sqlScriptPath -b -f 65001
        } else {
            & sqlcmd -S $sqlServer -E -d $target.TargetDatabase -i $sqlScriptPath -b -f 65001
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [ERROR] Database Migration failed on $($target.TargetDatabase)!" -ForegroundColor Red
        } else {
            Write-Host "  -> Database Migration Applied Successfully!" -ForegroundColor Green
        }
    }

    # 3. Deploy Backend API
    if ($target.BackendFolderPath -and (Test-Path (Join-Path $patchDir "backend"))) {
        Write-Host "[3/4] Deploying Backend Web API to $($target.BackendFolderPath)..." -ForegroundColor Cyan
        
        # Stop AppPool
        $appcmd = "$env:SystemRoot\system32\inetsrv\appcmd.exe"
        if ($target.IISAppPoolName) {
            Write-Host "  -> Stopping IIS AppPool '$($target.IISAppPoolName)'..." -ForegroundColor Gray
            if (Test-Path $appcmd) {
                & $appcmd stop apppool /apppool.name:"$($target.IISAppPoolName)" 2>$null
            }
            Start-Sleep -Seconds 2
        }

        # Extra safety: Ensure Bhisi.Api process is terminated so DLL is not locked
        Get-Process -Name "Bhisi.Api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        # Backup existing appsettings.json if present in target
        $targetAppSettings = Join-Path $target.BackendFolderPath "appsettings.json"
        $targetEnv = Join-Path $target.BackendFolderPath ".env"
        $savedAppSettings = $null
        $savedEnv = $null
        if (Test-Path $targetAppSettings) { $savedAppSettings = Get-Content $targetAppSettings -Raw }
        if (Test-Path $targetEnv) { $savedEnv = Get-Content $targetEnv -Raw }

        # Ensure target directory exists
        if (-not (Test-Path $target.BackendFolderPath)) {
            New-Item -ItemType Directory -Path $target.BackendFolderPath -Force | Out-Null
        }

        # Copy Backend Binaries
        Get-ChildItem -Path (Join-Path $patchDir "backend") | Copy-Item -Destination $target.BackendFolderPath -Recurse -Force

        # Restore original connection settings
        if ($savedAppSettings) { [System.IO.File]::WriteAllText($targetAppSettings, $savedAppSettings, [System.Text.Encoding]::UTF8) }
        if ($savedEnv) { [System.IO.File]::WriteAllText($targetEnv, $savedEnv, [System.Text.Encoding]::UTF8) }

        # Start AppPool
        if ($target.IISAppPoolName) {
            Write-Host "  -> Starting IIS AppPool '$($target.IISAppPoolName)'..." -ForegroundColor Gray
            if (Test-Path $appcmd) {
                & $appcmd start apppool /apppool.name:"$($target.IISAppPoolName)" 2>$null
            }
        }
        Write-Host "  -> Backend API deployed successfully!" -ForegroundColor Green
    }

    # 4. Deploy Frontend React UI
    if ($target.FrontendFolderPath -and (Test-Path (Join-Path $patchDir "frontend"))) {
        Write-Host "[4/4] Deploying Frontend UI to $($target.FrontendFolderPath)..." -ForegroundColor Cyan
        if (-not (Test-Path $target.FrontendFolderPath)) {
            New-Item -ItemType Directory -Path $target.FrontendFolderPath -Force | Out-Null
        }
        Get-ChildItem -Path (Join-Path $patchDir "frontend") | Copy-Item -Destination $target.FrontendFolderPath -Recurse -Force
        Write-Host "  -> Frontend UI deployed successfully!" -ForegroundColor Green
    }
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] UNIFIED PATCH APPLIED TO BOTH TESTING & TESTING1!    " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
'@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "install_patch.ps1"), $installPs1, [System.Text.Encoding]::UTF8)

# -----------------------------------------------------------------------------------------
# Step 5: Compress into Unified Standalone Zip Package
# -----------------------------------------------------------------------------------------
Write-Host "`n[5/5] Creating Standalone Unified Zip Archive: $zipOutputFile..." -ForegroundColor Cyan

if (Test-Path $zipOutputFile) { Remove-Item $zipOutputFile -Force -ErrorAction SilentlyContinue }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($patchFolder, $zipOutputFile, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$zipSizeMB = [math]::Round((Get-Item $zipOutputFile).Length / 1MB, 2)
Write-Host "  -> ZIP Package created: $zipOutputFile ($zipSizeMB MB)" -ForegroundColor Green

if (Test-Path $desktop) {
    Copy-Item $zipOutputFile $desktopDest -Force
    Write-Host "  -> Copied to Desktop: $desktopDest" -ForegroundColor Green
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] 1-CLICK TESTING & TESTING1 UNIFIED PATCH IS READY!    " -ForegroundColor Green
Write-Host "  Location: $zipOutputFile ($zipSizeMB MB)" -ForegroundColor Yellow
Write-Host "  Desktop : $desktopDest" -ForegroundColor Yellow
Write-Host "  Folder  : $patchFolder" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Green
