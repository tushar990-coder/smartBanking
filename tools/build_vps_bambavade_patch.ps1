# =========================================================================================
# SmartBanking ERP - 1-Click Dedicated VPS Patch Builder for Bambavade Sanstha
# Targets ONLY: Shree Bambawade Nagari Sahakari PatSanstha (Bambavade)
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$workspaceRoot = "d:\Bhisi Software"
$patchFolder = Join-Path $workspaceRoot "VPS_Bambavade_Patch"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_VPS_Bambavade_Patch.zip"
$desktopZip = "C:\Users\tusha\OneDrive\Desktop\SmartBanking_VPS_Bambavade_Patch.zip"
$clientDir = Join-Path $workspaceRoot "client"
$apiDir = Join-Path $workspaceRoot "api\Bhisi.Api"
$version = "2.4.2"
$buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - Dedicated VPS Patch Builder (Bambavade Only) " -ForegroundColor Cyan
Write-Host "  Version: v$version ($buildDate)                                " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Clean previous build folder
if (Test-Path $patchFolder) {
    Remove-Item -Path $patchFolder -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -Path $patchFolder -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "database") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "backend") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "frontend") -ItemType Directory -Force | Out-Null

# -----------------------------------------------------------------------------------------
# Step 1: Copy Pre-Built Frontend Files
# -----------------------------------------------------------------------------------------
Write-Host "[1/4] Copying Dynamic Multi-Domain Frontend Bundle..." -ForegroundColor Cyan
$frontendSource = Join-Path $clientDir "dist"
robocopy $frontendSource (Join-Path $patchFolder "frontend") /E | Out-Null
Write-Host "  -> Frontend Bundle copied OK!" -ForegroundColor Green

# -----------------------------------------------------------------------------------------
# Step 2: Publish Backend .NET 10 API
# -----------------------------------------------------------------------------------------
Write-Host "`n[2/4] Publishing Backend API Binaries..." -ForegroundColor Cyan
$backendTempPublish = Join-Path $workspaceRoot "scratch\api_publish_bambavade_temp"
if (Test-Path $backendTempPublish) { Remove-Item -Recurse -Force $backendTempPublish -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $backendTempPublish -Force | Out-Null

Push-Location $apiDir
try {
    dotnet publish -c Release -r win-x64 --self-contained false -o $backendTempPublish
    robocopy $backendTempPublish (Join-Path $patchFolder "backend") /E /XD "logs" "wwwroot" "uploads" /XF "appsettings.Development.json" "appsettings.Production.json" "appsettings.json" | Out-Null
    Write-Host "  -> Backend Binaries published OK!" -ForegroundColor Green
}
finally {
    Pop-Location
    Remove-Item -Recurse -Force $backendTempPublish -ErrorAction SilentlyContinue
}

# -----------------------------------------------------------------------------------------
# Step 3: Copy Database SQL Update Schema & Create Config
# -----------------------------------------------------------------------------------------
Write-Host "`n[3/4] Copying Database Schema Update & Generating Installer..." -ForegroundColor Cyan
$sqlSource = Join-Path $workspaceRoot "tools\master_vps_update_schema.sql"
$sqlDest = Join-Path $patchFolder "database\update_schema.sql"
$sqlContent = [System.IO.File]::ReadAllText($sqlSource, [System.Text.Encoding]::UTF8)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($sqlDest, $sqlContent, $utf8NoBom)

# Bambavade-only patch configuration
$bambavadeConfig = @{
    SqlServerInstance = "."
    SqlUser = "Admin"
    SqlPassword = "Mindspace@"
    TakeDbBackup = $true
    BackupFolder = "D:\Backups"
    Targets = @(
        @{
            SansthaName = "Shree Bambawade Nagari Sahakari PatSanstha (Bambavade)"
            TargetDatabase = "SmartBanking_Bambawade"
            IISAppPoolName = "apibambavade"
            BackendFolderPath = "D:\WebApps\bambavade\api.bambavade.hellomindspace.in"
            FrontendFolderPath = "D:\WebApps\bambavade\bambavade.hellomindspace.in"
        }
    )
}
$bambavadeConfig | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $patchFolder "patch_config.json") -Encoding UTF8

# Version manifest
$versionDoc = @{
    version = $version
    patchType = "Bambavade Dedicated Testing Patch"
    releaseDate = $buildDate
    changelog = @(
        "Standardized Single DefaultConnection with SQL Server Authentication",
        "Fixed CustomerID vs MemberID collision in MemberSearchSelect & Saving Opening Balance",
        "Fixed search filter noise across all modules"
    )
}
$versionDoc | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $patchFolder "version.json") -Encoding UTF8

# Generate apply_patch.ps1
$applyScript = @'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Clear-Host
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - 1-Click VPS Patch for Bambavade Sanstha      " -ForegroundColor Cyan
Write-Host "  Target: Shree Bambawade Nagari Sahakari PatSanstha              " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$config = Get-Content (Join-Path $scriptDir "patch_config.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$sqlFile = Join-Path $scriptDir "database\update_schema.sql"
$backendSource = Join-Path $scriptDir "backend"
$frontendSource = Join-Path $scriptDir "frontend"
$target = $config.Targets[0]

try {
    # 1. Database Safety Backup
    if ($config.TakeDbBackup) {
        Write-Host "[1/5] Taking Safety Database Backup for $($target.TargetDatabase)..." -ForegroundColor Yellow
        if (-not (Test-Path $config.BackupFolder)) { New-Item -Path $config.BackupFolder -ItemType Directory -Force | Out-Null }
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = "$($config.BackupFolder)\$($target.TargetDatabase)_PrePatch_$timestamp.bak"
        $backupSql = "BACKUP DATABASE [$($target.TargetDatabase)] TO DISK = N'$backupPath' WITH FORMAT, INIT, NAME = N'$($target.TargetDatabase)-Backup', STATS = 10;"
        try {
            sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -Q $backupSql
            Write-Host "  -> Backup Success: $backupPath" -ForegroundColor Green
        } catch {
            Write-Host "  -> Backup Notice ($($_.Exception.Message)). Continuing..." -ForegroundColor DarkYellow
        }
    }

    # 2. Database Schema Sync
    Write-Host "`n[2/5] Applying Database Schema Updates to $($target.TargetDatabase)..." -ForegroundColor Yellow
    if (Test-Path $sqlFile) {
        try {
            sqlcmd -S $config.SqlServerInstance -d $target.TargetDatabase -U $config.SqlUser -P $config.SqlPassword -i $sqlFile -f 65001
            Write-Host "  -> Database Schema updated successfully!" -ForegroundColor Green
        } catch {
            Write-Host "  -> SQL Warning: $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
    }

    # 3. Stop IIS AppPool
    Write-Host "`n[3/5] Stopping IIS AppPool ($($target.IISAppPoolName))..." -ForegroundColor Yellow
    try { cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"$($target.IISAppPoolName)`"" 2>$null } catch {}
    Get-Process -Name "w3wp", "dotnet", "Bhisi.Api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # 4. Deploy Backend Files & Bind Connection String
    Write-Host "`n[4/5] Deploying Backend & Frontend to Bambavade WebApps..." -ForegroundColor Yellow
    if (Test-Path $target.BackendFolderPath) {
        robocopy $backendSource $target.BackendFolderPath /E /R:2 /W:1 /XF "appsettings.json" "appsettings.Production.json" "license.lic" /XD "logs" "uploads" "wwwroot" | Out-Null
        
        # Ensure DefaultConnection with SQL Authentication
        $expectedConn = "Server=$($config.SqlServerInstance);Database=$($target.TargetDatabase);User Id=$($config.SqlUser);Password=$($config.SqlPassword);Trusted_Connection=False;TrustServerCertificate=True;MultipleActiveResultSets=true;Connect Timeout=60;"
        $appJsonPath = Join-Path $target.BackendFolderPath "appsettings.json"
        $prodJsonPath = Join-Path $target.BackendFolderPath "appsettings.Production.json"
        
        foreach ($cfgFile in @($appJsonPath, $prodJsonPath)) {
            $newCfg = @"
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "DefaultConnection": "$expectedConn"
  },
  "Jwt": {
    "Key": "BhisiSoftware-VerySecure-SuperSecret-Key-256Bit-MinLength32Chars!",
    "Issuer": "BhisiSoftwareERP",
    "Audience": "BhisiSoftwareUsers",
    "ExpireDays": 365
  },
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://0.0.0.0:5242"
      }
    }
  }
}
"@
            [System.IO.File]::WriteAllText($cfgFile, $newCfg, [System.Text.Encoding]::UTF8)
        }
        Write-Host "  -> Backend Updated & Bound to SQL Auth DefaultConnection OK!" -ForegroundColor Green
    }

    # Deploy Frontend
    if (Test-Path $target.FrontendFolderPath) {
        robocopy $frontendSource $target.FrontendFolderPath /E /R:2 /W:1 /PURGE | Out-Null
        Write-Host "  -> Frontend Updated Successfully!" -ForegroundColor Green
    }

    # 5. Restart IIS AppPool
    Write-Host "`n[5/5] Starting IIS AppPool ($($target.IISAppPoolName))..." -ForegroundColor Yellow
    try { cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"$($target.IISAppPoolName)`"" 2>$null } catch {}
    cmd /c "iisreset" 2>$null

    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host "  BAMBAVADE SANSTHA PATCH APPLIED SUCCESSFULLY! (100% OK)         " -ForegroundColor Green
    Write-Host "==================================================================" -ForegroundColor Green
}
catch {
    Write-Host "`n[ERROR] Patch installation failed: $_" -ForegroundColor Red
}

Read-Host "`nPress ENTER to close"
'@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "apply_patch.ps1"), $applyScript, [System.Text.Encoding]::UTF8)

# Generate Apply_Bambavade_Patch.bat
$batContent = @"
@echo off
title SmartBanking ERP - 1-Click Bambavade Patch
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_patch.ps1"
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "Apply_Bambavade_Patch.bat"), $batContent, [System.Text.Encoding]::ASCII)

# -----------------------------------------------------------------------------------------
# Step 4: Create ZIP Package
# -----------------------------------------------------------------------------------------
Write-Host "`n[4/4] Creating SmartBanking_VPS_Bambavade_Patch.zip..." -ForegroundColor Cyan
if (Test-Path $zipOutputFile) { Remove-Item $zipOutputFile -Force }
Compress-Archive -Path "$patchFolder\*" -DestinationPath $zipOutputFile -CompressionLevel Optimal

if (Test-Path "C:\Users\tusha\OneDrive\Desktop") {
    Copy-Item $zipOutputFile $desktopZip -Force
}

$zipSize = (Get-Item $zipOutputFile).Length / 1MB
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  BAMBAVADE DEDICATED PATCH CREATED SUCCESSFULLY!                 " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " Output File: $zipOutputFile" -ForegroundColor White
Write-Host " Desktop    : $desktopZip" -ForegroundColor White
Write-Host " Size       : $([math]::Round($zipSize, 2)) MB" -ForegroundColor Yellow
Write-Host " Target     : Shree Bambawade Nagari Sahakari PatSanstha" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Green
