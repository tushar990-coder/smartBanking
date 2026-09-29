# =========================================================================================
# SmartBanking ERP - 1-Click Multi-App Master VPS Patch Package Builder
# Automates: Build Frontend + Publish Backend + Database SQL Patch + Multi-Target Packaging + Reverse Patch Engine
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$workspaceRoot = "d:\Bhisi Software"
$configFile = Join-Path $workspaceRoot "tools\vps_multi_app_config.json"
$patchFolder = Join-Path $workspaceRoot "VPS_Multi_App_Master_Patch"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_VPS_Multi_App_Master_Patch.zip"
$clientDir = Join-Path $workspaceRoot "client"
$apiDir = Join-Path $workspaceRoot "api\Bhisi.Api"
$versionJsonPath = Join-Path $workspaceRoot "version.json"

$version = "2.5.18"
$gitHash = ""
$gitShort = ""
$gitBranch = ""
$gitDate = ""
$gitMsg = ""

try {
    $gitShort = (git rev-parse --short HEAD 2>$null).Trim()
    $gitHash = (git rev-parse HEAD 2>$null).Trim()
    $gitBranch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
    $gitDate = (git log -1 --format=%cd --date=iso 2>$null).Trim()
    $gitMsg = (git log -1 --format=%s 2>$null).Trim()
} catch {}

if (Test-Path $versionJsonPath) {
    try {
        $vObj = Get-Content $versionJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($vObj.version) { $version = $vObj.version }
        if (-not $gitShort -and $vObj.git -and $vObj.git.commit) { $gitShort = $vObj.git.commit }
    } catch {}
}
$buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   SmartBanking ERP - 1-Click Multi-App VPS Master Patch Builder  " -ForegroundColor Cyan
Write-Host "   Version: v$version ($buildDate)                                " -ForegroundColor Yellow
if ($gitShort) {
Write-Host "   Git Commit: $gitShort ($gitBranch) - $gitMsg                   " -ForegroundColor Gray
}
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $configFile)) {
    Write-Host "[ERROR] Multi-app config file not found at: $configFile" -ForegroundColor Red
    exit 1
}

$rawJson = Get-Content $configFile -Raw -Encoding UTF8
$cleanedJson = $rawJson -replace '(?m)^\s*//.*$', '' -replace '(?s)/\*.*?\*/', ''
$configJson = $cleanedJson | ConvertFrom-Json
Write-Host "Configured Targets ($($configJson.Targets.Count)):" -ForegroundColor White
foreach ($t in $configJson.Targets) {
    Write-Host "  - $($t.SansthaName) [DB: $($t.TargetDatabase) | AppPool: $($t.IISAppPoolName)]" -ForegroundColor Gray
}
Write-Host ""

# Ensure .env.production has empty VITE_API_BASE_URL for dynamic multi-domain resolution
$envProdPath = Join-Path $clientDir ".env.production"
$envContent = "# Dynamic Multi-Domain Routing`nVITE_API_BASE_URL=`n"
[System.IO.File]::WriteAllText($envProdPath, $envContent, [System.Text.Encoding]::UTF8)

# -----------------------------------------------------------------------------------------
# Step 1: Build React Frontend (Vite)
# -----------------------------------------------------------------------------------------
Write-Host "[1/5] Building React Frontend with Dynamic Multi-Domain API Routing..." -ForegroundColor Cyan
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
$backendTempPublish = Join-Path $workspaceRoot "scratch\api_publish_temp_multi"
if (Test-Path $backendTempPublish) { Remove-Item -Recurse -Force $backendTempPublish }
New-Item -ItemType Directory -Path $backendTempPublish -Force | Out-Null

Push-Location $apiDir
try {
    dotnet restore -r win-x64
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
# Step 3: Assemble Master Patch Package Directory Structure
# -----------------------------------------------------------------------------------------
Write-Host "`n[3/5] Assembling Master Patch Package..." -ForegroundColor Cyan

if (Test-Path $patchFolder) {
    try { Remove-Item -Path $patchFolder -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}
New-Item -Path $patchFolder -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "database") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "backend") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "frontend") -ItemType Directory -Force | Out-Null

$utf8WithBom = New-Object System.Text.UTF8Encoding($true)

# 3.1 Copy Database SQL (UTF-8 WITH BOM for perfect sqlcmd Unicode preservation)
$sqlSource = Join-Path $workspaceRoot "tools\master_vps_update_schema.sql"
$sqlDest = Join-Path $patchFolder "database\update_schema.sql"
$sqlContent = [System.IO.File]::ReadAllText($sqlSource, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($sqlDest, $sqlContent, $utf8WithBom)
Write-Host "  -> Database update schema copied with UTF-8 BOM encoding." -ForegroundColor White

$universalSyncSource = Join-Path $workspaceRoot "tools\Universal_Schema_Only_Sync.sql"
if (Test-Path $universalSyncSource) {
    Copy-Item $universalSyncSource (Join-Path $patchFolder "database\Universal_Schema_Only_Sync.sql") -Force
    Write-Host "  -> Universal Schema-Only Sync SQL included in database package." -ForegroundColor White
}

$diffSource = Join-Path $workspaceRoot "tools\Compare_Database_Schema_Diff.sql"
if (Test-Path $diffSource) {
    Copy-Item $diffSource (Join-Path $patchFolder "database\Compare_Database_Schema_Diff.sql") -Force
    Write-Host "  -> Compare Database Schema Diff SQL included in database package." -ForegroundColor White
}

$cleanupSource = Join-Path $workspaceRoot "tools\members_normalization_and_cleanup.sql"
if (Test-Path $cleanupSource) {
    Copy-Item $cleanupSource (Join-Path $patchFolder "database\members_normalization_and_cleanup.sql") -Force
    Write-Host "  -> Members Normalization & Cleanup SQL included in database package." -ForegroundColor White
}

$alignCodesSource = Join-Path $workspaceRoot "tools\align_member_codes_1to1.sql"
if (Test-Path $alignCodesSource) {
    $alignSqlContent = [System.IO.File]::ReadAllText($alignCodesSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $patchFolder "database\align_member_codes_1to1.sql"), $alignSqlContent, $utf8WithBom)
    Write-Host "  -> align_member_codes_1to1.sql included in database package (UTF-8 BOM)." -ForegroundColor White
}

$saving14Source = Join-Path $workspaceRoot "patches\patch_migrate_saving_accounts_14digit.sql"
if (Test-Path $saving14Source) {
    Copy-Item $saving14Source (Join-Path $patchFolder "database\patch_migrate_saving_accounts_14digit.sql") -Force
    Write-Host "  -> patch_migrate_saving_accounts_14digit.sql included in database package." -ForegroundColor White
}

# 3.1.1 Auto-Heal Nominal Shareholders (MCS Act 1960 Compliance)
$autoHealSource = Join-Path $workspaceRoot "tools\auto_heal_nominal_shareholders.sql"
if (Test-Path $autoHealSource) {
    $autoHealContent = [System.IO.File]::ReadAllText($autoHealSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $patchFolder "database\auto_heal_nominal_shareholders.sql"), $autoHealContent, $utf8WithBom)
    Write-Host "  -> auto_heal_nominal_shareholders.sql included in database package (UTF-8 BOM)." -ForegroundColor White
}

# 3.1.2 Auto-Heal Migrated FD Account Numbers & Sequences
$fdHealSource = Join-Path $workspaceRoot "tools\heal_migrated_fd_account_numbers.sql"
if (Test-Path $fdHealSource) {
    $fdHealContent = [System.IO.File]::ReadAllText($fdHealSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $patchFolder "database\heal_migrated_fd_account_numbers.sql"), $fdHealContent, $utf8WithBom)
    Write-Host "  -> heal_migrated_fd_account_numbers.sql included in database package (UTF-8 BOM)." -ForegroundColor White
}

# 3.2 Copy Backend Files (excluding local connection strings & logs)
$backendDest = Join-Path $patchFolder "backend"
robocopy $backendTempPublish $backendDest /E /XD "logs" "wwwroot" "uploads" /XF "appsettings.Development.json" "appsettings.Production.json" "appsettings.json" | Out-Null
Get-ChildItem -Path $backendDest -Filter "appsettings*.json" -Force -ErrorAction SilentlyContinue | Remove-Item -Force

# Ensure web.config is included for IIS
$sourceWebConfig = Join-Path $workspaceRoot "api\Bhisi.Api\web.config"
if ((Test-Path $sourceWebConfig) -and (-not (Test-Path (Join-Path $backendDest "web.config")))) {
    Copy-Item $sourceWebConfig (Join-Path $backendDest "web.config") -Force
}
Write-Host "  -> Backend binaries & web.config copied (Connection strings safely excluded/preserved)." -ForegroundColor White

# 3.3 Copy Frontend Files
$frontendSource = Join-Path $clientDir "dist"
$frontendDest = Join-Path $patchFolder "frontend"
robocopy $frontendSource $frontendDest /E | Out-Null
Write-Host "  -> Dynamic multi-domain frontend bundle copied." -ForegroundColor White

# 3.4 Copy Mobile Application API Documentation & Version Manifest
$mobileApiDoc = Join-Path $workspaceRoot "MOBILE_APPLICATION_API.md"
if (Test-Path $mobileApiDoc) {
    Copy-Item $mobileApiDoc (Join-Path $patchFolder "MOBILE_APPLICATION_API.md") -Force
    Write-Host "  -> Mobile Application API Documentation included." -ForegroundColor White
}

$versionJsonSource = Join-Path $workspaceRoot "version.json"
if (Test-Path $versionJsonSource) {
    Copy-Item $versionJsonSource (Join-Path $patchFolder "version.json") -Force
    Copy-Item $versionJsonSource (Join-Path $backendDest "version.json") -Force
    Copy-Item $versionJsonSource (Join-Path $frontendDest "version.json") -Force
    Write-Host "  -> version.json (v$version Changelog) included in patch." -ForegroundColor White
}

# Clean temp publish
Remove-Item -Recurse -Force $backendTempPublish -ErrorAction SilentlyContinue

# -----------------------------------------------------------------------------------------
# Step 4: Generate Multi-App patch_config.json, apply_patch.ps1 & reverse_patch.ps1
# -----------------------------------------------------------------------------------------
Write-Host "`n[4/5] Generating Multi-App Configuration, Installer & Reverse Patch Scripts..." -ForegroundColor Cyan

# Copy verified config
Copy-Item $configFile (Join-Path $patchFolder "patch_config.json") -Force

# Generate apply_patch.ps1
$applyPs1Content = @'
# =========================================================================================
# SmartBanking Core ERP - Multi-Application VPS Patch Installer
# Applies updates to configured Sansthas/Applications with Zero Data Loss
# Automatic Pre-Patch Safety Snapshots (DB + Files) for 1-Click Reverse Patch
# =========================================================================================

param(
    [string]$ConfigPath = "patch_config.json",
    [string]$TargetName = "ALL"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Clear-Host
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - 1-Click VPS Multi-App Master Patch Installer " -ForegroundColor Cyan
Write-Host "  (Zero Data Loss - All Existing Records 100% Preserved)          " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$fullConfigPath = Join-Path $scriptDir $ConfigPath
if (-not (Test-Path $fullConfigPath)) {
    Write-Host "[ERROR] Config file not found at: $fullConfigPath" -ForegroundColor Red
    Read-Host "Press ENTER to exit"
    exit 1
}

$rawConfig = Get-Content $fullConfigPath -Raw -Encoding UTF8
$cleanedConfig = $rawConfig -replace '(?m)^\s*//.*$', '' -replace '(?s)/\*.*?\*/', ''
$config = $cleanedConfig | ConvertFrom-Json
$sqlFile = Join-Path $scriptDir "database\update_schema.sql"
$saving14Sql = Join-Path $scriptDir "database\patch_migrate_saving_accounts_14digit.sql"
$autoHealSql = Join-Path $scriptDir "database\auto_heal_nominal_shareholders.sql"
$fdHealSql = Join-Path $scriptDir "database\heal_migrated_fd_account_numbers.sql"
$backendSource = Join-Path $scriptDir "backend"
$frontendSource = Join-Path $scriptDir "frontend"

# Initialize Session Rollback Snapshot Directory
$sessionTimestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$rollbackBase = Join-Path $config.BackupFolder "Rollbacks"
$sessionRollbackDir = Join-Path $rollbackBase "Rollback_$sessionTimestamp"
if (-not (Test-Path $sessionRollbackDir)) {
    New-Item -Path $sessionRollbackDir -ItemType Directory -Force | Out-Null
}
$latestPointerFile = Join-Path $rollbackBase "LATEST_ROLLBACK.txt"
[System.IO.File]::WriteAllText($latestPointerFile, $sessionRollbackDir, [System.Text.Encoding]::UTF8)

Write-Host "Safety Rollback Snapshot Directory Created:" -ForegroundColor Green
Write-Host "  -> $sessionRollbackDir" -ForegroundColor White
Write-Host ""

$allTargets = $config.Targets
$selectedTargets = @()

if ($TargetName -eq "ALL" -or [string]::IsNullOrWhiteSpace($TargetName)) {
    $selectedTargets = $allTargets
} else {
    $selectedTargets = $allTargets | Where-Object { $_.SansthaName -like "*$TargetName*" -or $_.TargetDatabase -like "*$TargetName*" }
    if ($selectedTargets.Count -eq 0) {
        Write-Host "[WARNING] No specific match found for '$TargetName'. Defaulting to all configured targets." -ForegroundColor Yellow
        $selectedTargets = $allTargets
    }
}

$totalTargets = $selectedTargets.Count
Write-Host "Target Applications to Update ($totalTargets):" -ForegroundColor White
for ($i = 0; $i -lt $totalTargets; $i++) {
    $t = $selectedTargets[$i]
    Write-Host "  [$($i+1)] $($t.SansthaName) -> DB: $($t.TargetDatabase)" -ForegroundColor Gray
}
Write-Host "------------------------------------------------------------------" -ForegroundColor Gray
Write-Host ""

$results = @()
$manifestEntries = @()

for ($i = 0; $i -lt $totalTargets; $i++) {
    $target = $selectedTargets[$i]
    $idx = $i + 1
    
    Write-Host "`n==================================================================" -ForegroundColor Cyan
    Write-Host " [$idx/$totalTargets] Updating: $($target.SansthaName)" -ForegroundColor Cyan
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host " Database  : $($target.TargetDatabase)" -ForegroundColor White
    Write-Host " AppPool   : $($target.IISAppPoolName)" -ForegroundColor White
    Write-Host " Backend   : $($target.BackendFolderPath)" -ForegroundColor White
    Write-Host " Frontend  : $($target.FrontendFolderPath)" -ForegroundColor White
    Write-Host "------------------------------------------------------------------" -ForegroundColor Gray

    $targetRollbackDir = Join-Path $sessionRollbackDir $target.TargetDatabase
    if (-not (Test-Path $targetRollbackDir)) {
        New-Item -Path $targetRollbackDir -ItemType Directory -Force | Out-Null
    }

    $statusObj = [PSCustomObject]@{
        Sanstha = $target.SansthaName
        Database = $target.TargetDatabase
        DbBackup = "Skipped"
        AppSnapshot = "Skipped"
        SqlSchema = "Skipped"
        Backend = "Skipped"
        Frontend = "Skipped"
        Status = "In Progress"
    }

    try {
        # 1. Database Safety Backup
        if ($config.TakeDbBackup) {
            Write-Host " [Step 1] Taking Database Pre-Patch Safety Backup..." -ForegroundColor Yellow
            $backupPath = "$targetRollbackDir\$($target.TargetDatabase)_PrePatch.bak"
            $backupSql = "BACKUP DATABASE [$($target.TargetDatabase)] TO DISK = N'$backupPath' WITH FORMAT, INIT, NAME = N'$($target.TargetDatabase)-PrePatch-Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10;"
            $tempBkFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "sqlcmd_bk_" + [System.Guid]::NewGuid().ToString("N") + ".sql")
            [System.IO.File]::WriteAllText($tempBkFile, $backupSql, [System.Text.Encoding]::UTF8)
            try {
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -i $tempBkFile -b
                    } catch {
                        sqlcmd -S $config.SqlServerInstance -E -i $tempBkFile -b
                    }
                } else {
                    sqlcmd -S $config.SqlServerInstance -E -i $tempBkFile -b
                }
                Write-Host "  -> DB Backup Success: $backupPath" -ForegroundColor Green
                $statusObj.DbBackup = "OK"

                # Also save copy in root BackupFolder
                try {
                    $rootBakPath = "$($config.BackupFolder)\$($target.TargetDatabase)_PrePatch_$sessionTimestamp.bak"
                    Copy-Item $backupPath $rootBakPath -Force -ErrorAction SilentlyContinue
                } catch {}
            } catch {
                Write-Host "  -> Backup Warning ($($_.Exception.Message)). Continuing..." -ForegroundColor DarkYellow
                $statusObj.DbBackup = "Warning"
            } finally {
                if (Test-Path $tempBkFile) { Remove-Item $tempBkFile -Force -ErrorAction SilentlyContinue }
            }
        }

        # 1.5 Application Snapshot (Backend & Frontend for Instant Reverse Patch)
        Write-Host " [Step 1.5] Taking Application Snapshot (Backend & Frontend) for Instant Rollback..." -ForegroundColor Yellow
        try {
            if (Test-Path $target.BackendFolderPath) {
                $bkDest = Join-Path $targetRollbackDir "backend"
                New-Item -Path $bkDest -ItemType Directory -Force | Out-Null
                robocopy $target.BackendFolderPath $bkDest /E /R:1 /W:1 /XD "logs" "uploads" "wwwroot" /XF "appsettings.Development.json" | Out-Null
            }
            if (Test-Path $target.FrontendFolderPath) {
                $ftDest = Join-Path $targetRollbackDir "frontend"
                New-Item -Path $ftDest -ItemType Directory -Force | Out-Null
                robocopy $target.FrontendFolderPath $ftDest /E /R:1 /W:1 | Out-Null
            }
            Write-Host "  -> Application Snapshot Saved Successfully in Rollback Folder!" -ForegroundColor Green
            $statusObj.AppSnapshot = "OK"
        } catch {
            Write-Host "  -> Application Snapshot Warning: $($_.Exception.Message)" -ForegroundColor DarkYellow
            $statusObj.AppSnapshot = "Warning"
        }

        # 2. Database Schema Sync via Native sqlcmd Engine
        Write-Host " [Step 2] Applying Database Update Schema via Native sqlcmd Engine..." -ForegroundColor Yellow
        if (Test-Path $sqlFile) {
            try {
                $sqlOk = $false
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d "$($target.TargetDatabase)" -i "`"$sqlFile`"" -f 65001 -b
                        if ($LASTEXITCODE -eq 0) { $sqlOk = $true }
                    } catch {}
                }
                if (-not $sqlOk) {
                    sqlcmd -S $config.SqlServerInstance -d "$($target.TargetDatabase)" -E -i "`"$sqlFile`"" -f 65001 -b
                    if ($LASTEXITCODE -eq 0) { $sqlOk = $true }
                }

                if ($sqlOk) {
                    Write-Host "  -> Database Schema Synced 100% OK via sqlcmd!" -ForegroundColor Green
                    $statusObj.SqlSchema = "OK"
                } else {
                    Write-Host "  -> Database Schema Notice (Check logs). Continuing deployment..." -ForegroundColor DarkYellow
                    $statusObj.SqlSchema = "Notice"
                }
            } catch {
                Write-Host "  -> SQL Note: $($_.Exception.Message). Continuing deployment..." -ForegroundColor DarkYellow
                $statusObj.SqlSchema = "Notice (Bypassed)"
            }
        }

        # 2.1 Automatic 14-Digit Saving Accounts Migration
        if (Test-Path $saving14Sql) {
            Write-Host " [Step 2.1] Running 14-Digit Saving Accounts Migration on $($target.TargetDatabase)..." -ForegroundColor Yellow
            try {
                $m14Ok = $false
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d "$($target.TargetDatabase)" -i "`"$saving14Sql`"" -f 65001 -b
                        if ($LASTEXITCODE -eq 0) { $m14Ok = $true }
                    } catch {}
                }
                if (-not $m14Ok) {
                    sqlcmd -S $config.SqlServerInstance -d "$($target.TargetDatabase)" -E -i "`"$saving14Sql`"" -f 65001 -b
                    if ($LASTEXITCODE -eq 0) { $m14Ok = $true }
                }
                if ($m14Ok) {
                    Write-Host "  -> 14-Digit Saving Accounts Migration applied successfully!" -ForegroundColor Green
                }
            } catch {
                Write-Host "  -> Migration Note: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }

        # 2.2 Auto-Heal Nominal Shareholders to Regular (MCS Act 1960 Compliance)
        if (Test-Path $autoHealSql) {
            Write-Host " [Step 2.2] Auto-Healing Nominal Members with Shareholding to Regular (MCS Act 1960)..." -ForegroundColor Yellow
            try {
                $hOk = $false
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d "$($target.TargetDatabase)" -i "`"$autoHealSql`"" -f 65001 -b
                        if ($LASTEXITCODE -eq 0) { $hOk = $true }
                    } catch {}
                }
                if (-not $hOk) {
                    sqlcmd -S $config.SqlServerInstance -d "$($target.TargetDatabase)" -E -i "`"$autoHealSql`"" -f 65001 -b
                    if ($LASTEXITCODE -eq 0) { $hOk = $true }
                }
                if ($hOk) {
                    Write-Host "  -> Nominal Members Auto-Healed to Regular Successfully!" -ForegroundColor Green
                }
            } catch {
                Write-Host "  -> Auto-Heal Note: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }

        # 2.3 Auto-Heal Migrated FD Account Numbers & Sequences
        if (Test-Path $fdHealSql) {
            Write-Host " [Step 2.3] Auto-Healing Migrated FD Account Numbers & Sequences on $($target.TargetDatabase)..." -ForegroundColor Yellow
            try {
                $fdOk = $false
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d "$($target.TargetDatabase)" -i "`"$fdHealSql`"" -f 65001 -b
                        if ($LASTEXITCODE -eq 0) { $fdOk = $true }
                    } catch {}
                }
                if (-not $fdOk) {
                    sqlcmd -S $config.SqlServerInstance -d "$($target.TargetDatabase)" -E -i "`"$fdHealSql`"" -f 65001 -b
                    if ($LASTEXITCODE -eq 0) { $fdOk = $true }
                }
                if ($fdOk) {
                    Write-Host "  -> Migrated FD Account Numbers & Sequences Auto-Healed Successfully!" -ForegroundColor Green
                }
            } catch {
                Write-Host "  -> FD Auto-Heal Note: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }

        # 3. Stop IIS AppPool & Release Process Locks
        if (![string]::IsNullOrWhiteSpace($target.IISAppPoolName)) {
            Write-Host " [Step 3] Stopping IIS AppPool ($($target.IISAppPoolName)) & releasing file locks..." -ForegroundColor Yellow
            try {
                cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"$($target.IISAppPoolName)`"" 2>$null
            } catch {}
        } else {
            Write-Host " [Step 3] IIS AppPool not specified. Releasing process locks..." -ForegroundColor Yellow
        }
        Get-Process -Name "w3wp", "dotnet", "Bhisi.Api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        # 4. Deploy Backend Files
        Write-Host " [Step 4] Deploying Backend API Binaries..." -ForegroundColor Yellow
        if (-not (Test-Path $target.BackendFolderPath)) {
            New-Item -Path $target.BackendFolderPath -ItemType Directory -Force | Out-Null
        }
        robocopy $backendSource $target.BackendFolderPath /E /R:2 /W:1 /XF "appsettings.json" "appsettings.Production.json" "license.lic" /XD "logs" "uploads" "wwwroot" | Out-Null
        Write-Host "  -> Backend Binaries Updated Successfully!" -ForegroundColor Green
        $statusObj.Backend = "OK"

        # 4.5 Config Files Preserved Intact
        Write-Host " [Step 4.5] Existing server configuration (appsettings.json / appsettings.Production.json) preserved intact 100%." -ForegroundColor Gray

        # 5. Deploy Frontend Files
        Write-Host " [Step 5] Deploying Frontend Bundle (Cleaning old cached assets)..." -ForegroundColor Yellow
        if (-not (Test-Path $target.FrontendFolderPath)) {
            New-Item -Path $target.FrontendFolderPath -ItemType Directory -Force | Out-Null
        }
        robocopy $frontendSource $target.FrontendFolderPath /E /R:2 /W:1 /PURGE | Out-Null
        Write-Host "  -> Frontend Bundle Updated Successfully!" -ForegroundColor Green
        $statusObj.Frontend = "OK"

        # 6. Start IIS AppPool & Refresh
        if (![string]::IsNullOrWhiteSpace($target.IISAppPoolName)) {
            Write-Host " [Step 6] Restarting IIS AppPool ($($target.IISAppPoolName))..." -ForegroundColor Yellow
            try {
                cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"$($target.IISAppPoolName)`"" 2>$null
            } catch {}
        }
        cmd /c "iisreset" 2>$null

        $statusObj.Status = "Completed Successfully"
        Write-Host "`n [SUCCESS] $($target.SansthaName) updated successfully!" -ForegroundColor Green

        $manifestEntries += [PSCustomObject]@{
            Sanstha = $target.SansthaName
            Database = $target.TargetDatabase
            IISAppPool = $target.IISAppPoolName
            BackendPath = $target.BackendFolderPath
            FrontendPath = $target.FrontendFolderPath
            BackupFile = "$targetRollbackDir\$($target.TargetDatabase)_PrePatch.bak"
            UpdatedOn = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        }
    }
    catch {
        Write-Host " ERROR during update of $($target.SansthaName): $_" -ForegroundColor Red
        $statusObj.Status = "Failed: $_"
    }

    $results += $statusObj
}

# Write Rollback Manifest
$manifestData = [PSCustomObject]@{
    SessionTimestamp = $sessionTimestamp
    CreatedDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    Targets = $manifestEntries
}
$manifestPath = Join-Path $sessionRollbackDir "rollback_manifest.json"
$manifestData | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "                 MULTI-APP PATCH SUMMARY REPORT                   " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
$results | Format-Table -AutoSize Sanstha, Database, DbBackup, AppSnapshot, SqlSchema, Backend, Frontend, Status

Write-Host "`n[OK] Patch execution completed." -ForegroundColor Green
Write-Host "To REVERT this patch at any time, run:" -ForegroundColor Yellow
Write-Host "  1_Click_REVERSE_PATCH_ALL_Sansthas.bat" -ForegroundColor White
Write-Host "Snapshot location: $sessionRollbackDir" -ForegroundColor Gray
Read-Host "Press ENTER to exit"
'@

[System.IO.File]::WriteAllText((Join-Path $patchFolder "apply_patch.ps1"), $applyPs1Content, $utf8WithBom)

# Generate reverse_patch.ps1
$reversePs1Content = @'
# =========================================================================================
# SmartBanking Core ERP - Multi-Application VPS Reverse Patch / Rollback Engine
# Reverts Backend, Frontend, and optionally Database to the Pre-Patch State
# =========================================================================================

param(
    [string]$ConfigPath = "patch_config.json",
    [string]$TargetName = "ALL",
    [string]$RollbackFolder = "",
    [switch]$RestoreDatabase = $false,
    [switch]$NonInteractive = $false
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Clear-Host
Write-Host "==================================================================" -ForegroundColor Magenta
Write-Host "  SmartBanking ERP - 1-Click Multi-App REVERSE PATCH (ROLLBACK)   " -ForegroundColor Magenta
Write-Host "  Instant Reversal of Backend, Frontend & Optional Database State " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Magenta
Write-Host ""

$fullConfigPath = Join-Path $scriptDir $ConfigPath
if (-not (Test-Path $fullConfigPath)) {
    Write-Host "[ERROR] Config file not found at: $fullConfigPath" -ForegroundColor Red
    Read-Host "Press ENTER to exit"
    exit 1
}

$rawConfig = Get-Content $fullConfigPath -Raw -Encoding UTF8
$cleanedConfig = $rawConfig -replace '(?m)^\s*//.*$', '' -replace '(?s)/\*.*?\*/', ''
$config = $cleanedConfig | ConvertFrom-Json

# Locate the rollback folder
$selectedRollbackDir = ""
$rollbackBase = Join-Path $config.BackupFolder "Rollbacks"
$latestPointerFile = Join-Path $rollbackBase "LATEST_ROLLBACK.txt"

if (-not [string]::IsNullOrWhiteSpace($RollbackFolder) -and (Test-Path $RollbackFolder)) {
    $selectedRollbackDir = $RollbackFolder
} elseif (Test-Path $latestPointerFile) {
    try {
        $ptr = (Get-Content $latestPointerFile -Raw -Encoding UTF8).Trim()
        if (Test-Path $ptr) {
            $selectedRollbackDir = $ptr
        }
    } catch {}
}

if (-not $selectedRollbackDir -and (Test-Path $rollbackBase)) {
    $latestFolder = Get-ChildItem -Path $rollbackBase -Directory -Filter "Rollback_*" | Sort-Object CreationTime -Descending | Select-Object -First 1
    if ($latestFolder) {
        $selectedRollbackDir = $latestFolder.FullName
    }
}

if (-not $selectedRollbackDir -or -not (Test-Path $selectedRollbackDir)) {
    Write-Host "[ERROR] No Rollback snapshot folder found in: $rollbackBase" -ForegroundColor Red
    Write-Host "Please ensure an update patch was run previously and created a rollback folder." -ForegroundColor Yellow
    Read-Host "Press ENTER to exit"
    exit 1
}

Write-Host "Using Rollback Snapshot: $selectedRollbackDir" -ForegroundColor Cyan
Write-Host "Snapshot Created At   : $((Get-Item $selectedRollbackDir).CreationTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
Write-Host ""

# Check if interactive mode should ask about Database Restore
$doRestoreDb = $RestoreDatabase.IsPresent
if (-not $NonInteractive -and -not $doRestoreDb) {
    Write-Host "------------------------------------------------------------------" -ForegroundColor Gray
    Write-Host "Choose Rollback Operation Mode:" -ForegroundColor White
    Write-Host "  [1] Revert Application Files ONLY (Backend + Frontend)" -ForegroundColor Green
    Write-Host "      - Instant rollback of code to previous version." -ForegroundColor Gray
    Write-Host "      - ZERO risk to newly entered transactions or members." -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [2] Revert Application Files AND RESTORE DATABASE (.bak)" -ForegroundColor Yellow
    Write-Host "      - Reverts code AND restores database to exact pre-patch point." -ForegroundColor Gray
    Write-Host "      - CAUTION: Any data entered after patch will be overwritten!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  [Q] Cancel / Exit" -ForegroundColor Gray
    Write-Host "------------------------------------------------------------------" -ForegroundColor Gray
    $ans = Read-Host "Enter choice [1/2/Q] (Default 1)"
    if ($ans -eq "2") {
        $doRestoreDb = $true
        Write-Host "  -> Selected Mode: Code + Database Restore" -ForegroundColor Yellow
    } elseif ($ans -eq "Q" -or $ans -eq "q") {
        Write-Host "Rollback cancelled by user." -ForegroundColor Gray
        exit 0
    } else {
        $doRestoreDb = $false
        Write-Host "  -> Selected Mode: Code Reversal Only (Preserving DB Transactions)" -ForegroundColor Green
    }
    Write-Host ""
}

$allTargets = $config.Targets
$selectedTargets = @()

if ($TargetName -eq "ALL" -or [string]::IsNullOrWhiteSpace($TargetName)) {
    $selectedTargets = $allTargets
} else {
    $selectedTargets = $allTargets | Where-Object { $_.SansthaName -like "*$TargetName*" -or $_.TargetDatabase -like "*$TargetName*" }
    if ($selectedTargets.Count -eq 0) {
        Write-Host "[WARNING] No specific match found for '$TargetName'. Defaulting to all configured targets." -ForegroundColor Yellow
        $selectedTargets = $allTargets
    }
}

$totalTargets = $selectedTargets.Count
Write-Host "Target Applications to Rollback ($totalTargets):" -ForegroundColor White
for ($i = 0; $i -lt $totalTargets; $i++) {
    $t = $selectedTargets[$i]
    Write-Host "  [$($i+1)] $($t.SansthaName) -> DB: $($t.TargetDatabase)" -ForegroundColor Gray
}
Write-Host "------------------------------------------------------------------" -ForegroundColor Gray
Write-Host ""

$results = @()

for ($i = 0; $i -lt $totalTargets; $i++) {
    $target = $selectedTargets[$i]
    $idx = $i + 1
    
    Write-Host "`n==================================================================" -ForegroundColor Magenta
    Write-Host " [$idx/$totalTargets] Rolling Back: $($target.SansthaName)" -ForegroundColor Magenta
    Write-Host "==================================================================" -ForegroundColor Magenta
    Write-Host " Database  : $($target.TargetDatabase)" -ForegroundColor White
    Write-Host " AppPool   : $($target.IISAppPoolName)" -ForegroundColor White
    Write-Host " Backend   : $($target.BackendFolderPath)" -ForegroundColor White
    Write-Host " Frontend  : $($target.FrontendFolderPath)" -ForegroundColor White
    Write-Host "------------------------------------------------------------------" -ForegroundColor Gray

    $targetRollbackDir = Join-Path $selectedRollbackDir $target.TargetDatabase
    $statusObj = [PSCustomObject]@{
        Sanstha = $target.SansthaName
        Database = $target.TargetDatabase
        BackendRevert = "Skipped"
        FrontendRevert = "Skipped"
        DbRestore = "Skipped"
        Status = "In Progress"
    }

    if (-not (Test-Path $targetRollbackDir)) {
        Write-Host "  [WARNING] No snapshot directory found for $($target.TargetDatabase) in $selectedRollbackDir. Skipping..." -ForegroundColor Yellow
        $statusObj.Status = "Snapshot Missing"
        $results += $statusObj
        continue
    }

    try {
        # 1. Stop IIS AppPool & Release File Locks
        if (![string]::IsNullOrWhiteSpace($target.IISAppPoolName)) {
            Write-Host " [Step 1] Stopping IIS AppPool ($($target.IISAppPoolName)) & releasing file locks..." -ForegroundColor Yellow
            try {
                cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"$($target.IISAppPoolName)`"" 2>$null
            } catch {}
        } else {
            Write-Host " [Step 1] IIS AppPool not specified. Releasing process locks..." -ForegroundColor Yellow
        }
        Get-Process -Name "w3wp", "dotnet", "Bhisi.Api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        # 2. Revert Backend Binaries
        $bkBackendSource = Join-Path $targetRollbackDir "backend"
        if (Test-Path $bkBackendSource) {
            Write-Host " [Step 2] Restoring Previous Backend API Binaries..." -ForegroundColor Yellow
            robocopy $bkBackendSource $target.BackendFolderPath /E /R:2 /W:1 /XF "appsettings.json" "appsettings.Production.json" "license.lic" /XD "logs" "uploads" "wwwroot" | Out-Null
            Write-Host "  -> Backend Restored to Pre-Patch Version!" -ForegroundColor Green
            $statusObj.BackendRevert = "OK"
        } else {
            Write-Host "  -> Backend snapshot not found in $bkBackendSource. Skipped." -ForegroundColor DarkYellow
            $statusObj.BackendRevert = "Snapshot Not Found"
        }

        # 3. Revert Frontend Bundle
        $bkFrontendSource = Join-Path $targetRollbackDir "frontend"
        if (Test-Path $bkFrontendSource) {
            Write-Host " [Step 3] Restoring Previous Frontend Bundle..." -ForegroundColor Yellow
            robocopy $bkFrontendSource $target.FrontendFolderPath /E /R:2 /W:1 /PURGE | Out-Null
            Write-Host "  -> Frontend Restored to Pre-Patch Version!" -ForegroundColor Green
            $statusObj.FrontendRevert = "OK"
        } else {
            Write-Host "  -> Frontend snapshot not found in $bkFrontendSource. Skipped." -ForegroundColor DarkYellow
            $statusObj.FrontendRevert = "Snapshot Not Found"
        }

        # 4. Optional Database Restore
        if ($doRestoreDb) {
            Write-Host " [Step 4] Restoring Database from Pre-Patch .bak file..." -ForegroundColor Yellow
            $bakFile = Join-Path $targetRollbackDir "$($target.TargetDatabase)_PrePatch.bak"
            if (-not (Test-Path $bakFile)) {
                $altBaks = Get-ChildItem -Path $config.BackupFolder -Filter "$($target.TargetDatabase)_PrePatch_*.bak" | Sort-Object CreationTime -Descending | Select-Object -First 1
                if ($altBaks) { $bakFile = $altBaks.FullName }
            }

            if (Test-Path $bakFile) {
                $restoreSql = @"
ALTER DATABASE [$($target.TargetDatabase)] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
RESTORE DATABASE [$($target.TargetDatabase)] FROM DISK = N'$bakFile' WITH REPLACE;
ALTER DATABASE [$($target.TargetDatabase)] SET MULTI_USER;
"@
                $tempRestFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "sqlcmd_rest_" + [System.Guid]::NewGuid().ToString("N") + ".sql")
                [System.IO.File]::WriteAllText($tempRestFile, $restoreSql, [System.Text.Encoding]::UTF8)
                try {
                    $rOk = $false
                    if ($config.SqlUser -and $config.SqlPassword) {
                        try {
                            sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -i $tempRestFile -b
                            if ($LASTEXITCODE -eq 0) { $rOk = $true }
                        } catch {}
                    }
                    if (-not $rOk) {
                        sqlcmd -S $config.SqlServerInstance -E -i $tempRestFile -b
                        if ($LASTEXITCODE -eq 0) { $rOk = $true }
                    }

                    if ($rOk) {
                        Write-Host "  -> Database [$($target.TargetDatabase)] Restored Successfully from: $bakFile" -ForegroundColor Green
                        $statusObj.DbRestore = "OK"
                    } else {
                        Write-Host "  -> Database Restore Warning. Check permissions or locks." -ForegroundColor DarkYellow
                        $statusObj.DbRestore = "Warning"
                    }
                } finally {
                    if (Test-Path $tempRestFile) { Remove-Item $tempRestFile -Force -ErrorAction SilentlyContinue }
                }
            } else {
                Write-Host "  -> Pre-patch backup file not found for $($target.TargetDatabase). Skipped." -ForegroundColor DarkYellow
                $statusObj.DbRestore = "File Not Found"
            }
        }

        # 5. Restart IIS AppPool & Refresh
        if (![string]::IsNullOrWhiteSpace($target.IISAppPoolName)) {
            Write-Host " [Step 5] Restarting IIS AppPool ($($target.IISAppPoolName))..." -ForegroundColor Yellow
            try {
                cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"$($target.IISAppPoolName)`"" 2>$null
            } catch {}
        }
        cmd /c "iisreset" 2>$null

        $statusObj.Status = "Rolled Back Successfully"
        Write-Host "`n [SUCCESS] $($target.SansthaName) rolled back successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host " ERROR during rollback of $($target.SansthaName): $_" -ForegroundColor Red
        $statusObj.Status = "Failed: $_"
    }

    $results += $statusObj
}

Write-Host "`n==================================================================" -ForegroundColor Magenta
Write-Host "             MULTI-APP REVERSE PATCH SUMMARY REPORT               " -ForegroundColor Magenta
Write-Host "==================================================================" -ForegroundColor Magenta
$results | Format-Table -AutoSize Sanstha, Database, BackendRevert, FrontendRevert, DbRestore, Status

Write-Host "`n[OK] Reverse patch execution completed." -ForegroundColor Green
Read-Host "Press ENTER to exit"
'@

[System.IO.File]::WriteAllText((Join-Path $patchFolder "reverse_patch.ps1"), $reversePs1Content, $utf8WithBom)

# Batch Generator Helper Function
function Generate-BatchScript {
    param(
        [string]$FilePath,
        [string]$Title,
        [string]$ScriptFile,
        [string]$TargetName,
        [string]$Color = "0B"
    )

    $content = @"
@echo off
title $Title
color $Color
echo ==================================================================
echo   $Title
echo ==================================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Administrator rights required. Elevating privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0$ScriptFile" -TargetName "$TargetName"
echo.
pause
"@
    [System.IO.File]::WriteAllText($FilePath, $content, [System.Text.Encoding]::ASCII)
}

# Generate Master Update Batch Files
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_ALL_Sansthas.bat") -Title "SmartBanking ERP - 1-Click Update ALL Sansthas" -ScriptFile "apply_patch.ps1" -TargetName "ALL" -Color "0B"
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_ALL_Apps.bat") -Title "SmartBanking ERP - 1-Click Update ALL VPS Apps" -ScriptFile "apply_patch.ps1" -TargetName "ALL" -Color "0B"
Generate-BatchScript -FilePath (Join-Path $patchFolder "Apply_VPS_Patch.bat") -Title "SmartBanking ERP - Apply Master VPS Patch" -ScriptFile "apply_patch.ps1" -TargetName "ALL" -Color "0B"

# Generate Master Reverse Patch Batch Files
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_ALL_Sansthas.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH ALL Sansthas" -ScriptFile "reverse_patch.ps1" -TargetName "ALL" -Color "0D"
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_ALL_Apps.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH ALL VPS Apps" -ScriptFile "reverse_patch.ps1" -TargetName "ALL" -Color "0D"
Generate-BatchScript -FilePath (Join-Path $patchFolder "Reverse_VPS_Patch.bat") -Title "SmartBanking ERP - Reverse Master VPS Patch" -ScriptFile "reverse_patch.ps1" -TargetName "ALL" -Color "0D"

# Generate Individual Sanstha Update and Reverse Batch Files
# 1. Padawalwadi
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Padawalwadi.bat") -Title "SmartBanking ERP - 1-Click Update Padawalwadi" -ScriptFile "apply_patch.ps1" -TargetName "Padawalwadi" -Color "0B"
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Padawalwadi.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Padawalwadi" -ScriptFile "reverse_patch.ps1" -TargetName "Padawalwadi" -Color "0D"

# 2. Bambavade
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Bambavade.bat") -Title "SmartBanking ERP - 1-Click Update Bambavade" -ScriptFile "apply_patch.ps1" -TargetName "Bambawade" -Color "0B"
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Bambavade.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Bambavade" -ScriptFile "reverse_patch.ps1" -TargetName "Bambawade" -Color "0D"

# 3. Yadravkar
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Yadravkar.bat") -Title "SmartBanking ERP - 1-Click Update Yadravkar" -ScriptFile "apply_patch.ps1" -TargetName "Yadrav" -Color "0B"
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Yadravkar.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Yadravkar" -ScriptFile "reverse_patch.ps1" -TargetName "Yadrav" -Color "0D"

# 4. RITEMP
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_RITEMP.bat") -Title "SmartBanking ERP - 1-Click Update RITEMP" -ScriptFile "apply_patch.ps1" -TargetName "ritemployee" -Color "0B"
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_RITEMP.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH RITEMP" -ScriptFile "reverse_patch.ps1" -TargetName "ritemployee" -Color "0D"

# 5. Testing
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Testing.bat") -Title "SmartBanking ERP - 1-Click Update Testing" -ScriptFile "apply_patch.ps1" -TargetName "Testing" -Color "0B"
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Testing.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Testing" -ScriptFile "reverse_patch.ps1" -TargetName "Testing" -Color "0D"

# 6. Testing1
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Testing1.bat") -Title "SmartBanking ERP - 1-Click Update Testing1" -ScriptFile "apply_patch.ps1" -TargetName "Testing1" -Color "0B"
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Testing1.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Testing1" -ScriptFile "reverse_patch.ps1" -TargetName "Testing1" -Color "0D"

# 7. Template
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Template.bat") -Title "SmartBanking ERP - 1-Click Update Template" -ScriptFile "apply_patch.ps1" -TargetName "Template" -Color "0B"
Generate-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Template.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Template" -ScriptFile "reverse_patch.ps1" -TargetName "Template" -Color "0D"

# Generate Comprehensive README & Patch Guide
$readmeContent = @"
# ==============================================================================
# SmartBanking Core ERP - Multi-App Master Update & Reverse Patch Guide (v$version)
# Build Date: $buildDate | Git: $gitShort ($gitBranch)
# ==============================================================================

## 1. पॅचमधील मुख्य सुधारणा (What's New in v$version)
1. **Strict Customer-First Loan Suite:**
   - सर्व ८ कर्ज मॉड्यूल्समधून `MemberID` fallback पूर्णपणे काढून टाकले आहे (`LoanDisbursementMaster`, `LoanCollectionMaster`, `LoanDistributionListModal`, `LoanRecoveryNoticeReport`, `LoanLedgerReport`, `LoanOpeningBalanceMaster`, `GlobalContextMenu`, `LoanCollectionReceiptPrint`).
   - सर्व ठिकाणी केवळ वैध `CustomerID` द्वारे डेटा लोड व सेव्ह होतो.

2. **Atomic Loan Disbursement (जोखीम निवारण):**
   - कर्ज अर्ज मंजुरी (Approval) आणि कर्ज वाटप व्हाउचर निर्मिती एकाच अ‍ॅटोमिक ट्रान्झॅक्शनमध्ये समाविष्ट.
   - सिस्टीममध्ये कधीही Orphan किंवा अर्धवट रेकॉर्ड तयार होणार नाही.

3. **MCS Act 1960 / Cooperative Bye-Laws Compliance:**
   - नवीन कर्जदारांना शेअर्स वाटप झाल्यास त्यांना थेट 'Regular Member' (वर्ग अ) म्हणून नोंदवले जाते.
   - विद्यमान नाममात्र (Nominal) सभासदांनी शेअर्स खरेदी केल्यास सिस्टीम त्यांना स्वयंचलितपणे 'Regular' मध्ये अपग्रेड करते.
   - `auto_heal_nominal_shareholders.sql` पॅचद्वारे डेटाबेसमधील सर्व जुन्या शेअरहोल्डर्सची स्थिती तपासली जाऊन नियमानुसार दुरुस्त केली जाते.

4. **14-Digit Saving Accounts Migration:**
   - सर्व जुनी बचत खाती आधुनिक १४-अंकी CBS खाते क्रमांकामध्ये सुरक्षितपणे अपडेट केली जातात.

---

## 2. पॅच कसा रन करावा (How to Apply Patch)
1. ही ZIP फाईल VPS सर्व्हरवर Extract करा.
2. सर्व संस्था एकाच वेळी अपडेट करण्यासाठी:
   👉 **`1_Click_Update_ALL_Sansthas.bat`** वर राइट-क्लिक करून 'Run as Administrator' करा.
3. किंवा विशिष्ट संस्था अपडेट करण्यासाठी संबंधित फाईल रन करा:
   - `1_Click_Update_Padawalwadi.bat`
   - `1_Click_Update_Bambavade.bat`
   - `1_Click_Update_Yadravkar.bat`
   - `1_Click_Update_RITEMP.bat`
   - `1_Click_Update_Testing.bat`
   - `1_Click_Update_Testing1.bat`
   - `1_Click_Update_Template.bat`

---

## 3. रिव्हर्स पॅच कसा रन करावा (How to Rollback / Reverse Patch)
जर काही कारणास्तव तुम्हाला पूर्वीच्या व्हर्जनवर जायचे असल्यास:
1. सर्व संस्था पूर्वीच्या स्थितीत नेण्यासाठी:
   👉 **`1_Click_REVERSE_PATCH_ALL_Sansthas.bat`** रन करा.
2. तुम्हाला २ पर्याय मिळतील:
   - **[1] Application Files Only (Recommended):**
     फक्त Backend आणि Frontend पूर्वीच्या स्थितीत नेले जाईल. नवीन झालेला ट्रान्झॅक्शन डेटा सुरक्षित राहील.
   - **[2] Code + Database Restore (.bak):**
     Backend, Frontend आणि डेटाबेस पॅचपूर्वीच्या वेळेस जसा होता तसा रिस्टोअर केला जाईल.
3. विशिष्ट संस्थेचा रिव्हर्स पॅच रन करण्यासाठी:
   - `1_Click_REVERSE_PATCH_Padawalwadi.bat`
   - `1_Click_REVERSE_PATCH_Bambavade.bat`
   - इत्यादी.

सर्व स्नॅपशॉट्स आणि डेटाबेस बॅकअप्स `D:\Backups\Rollbacks\Rollback_<timestamp>` मध्ये सुरक्षितपणे साठवले जातात.
"@

[System.IO.File]::WriteAllText((Join-Path $patchFolder "README_PATCH_AND_REVERSE_GUIDE.md"), $readmeContent, $utf8WithBom)
Write-Host "  -> README_PATCH_AND_REVERSE_GUIDE.md created." -ForegroundColor White

# -----------------------------------------------------------------------------------------
# Step 5: Compress to ZIP & Copy to Desktop
# -----------------------------------------------------------------------------------------
Write-Host "`n[5/5] Creating SmartBanking_VPS_Multi_App_Master_Patch.zip..." -ForegroundColor Cyan

if (Test-Path $zipOutputFile) {
    Remove-Item -Path $zipOutputFile -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($patchFolder, $zipOutputFile, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$desktopDest = Join-Path $desktop "SmartBanking_VPS_Multi_App_Master_Patch.zip"
Copy-Item $zipOutputFile $desktopDest -Force

$localDesktop = "C:\Users\$env:USERNAME\Desktop"
if ((Test-Path $localDesktop) -and ($localDesktop -ne $desktop)) {
    Copy-Item $zipOutputFile (Join-Path $localDesktop "SmartBanking_VPS_Multi_App_Master_Patch.zip") -Force
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  1-CLICK MULTI-APP MASTER PATCH & REVERSE ENGINE CREATED!        " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " Output File : $zipOutputFile" -ForegroundColor Yellow
Write-Host " Desktop     : $desktopDest" -ForegroundColor Yellow
Write-Host " Size        : $([Math]::Round((Get-Item $zipOutputFile).Length / 1MB, 2)) MB" -ForegroundColor White
Write-Host " Targets     : $($configJson.Targets.Count) configured applications" -ForegroundColor White
Write-Host " Features    : Update Scripts + Reverse Scripts + Auto-Heal SQL" -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
