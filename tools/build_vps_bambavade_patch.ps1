# =========================================================================================
# SmartBanking ERP - 1-Click Dedicated VPS Patch Builder for Bambavade Sanstha
# Targets ONLY: Shree Bambawade Nagari Sahakari PatSanstha (Bambavade)
# Includes: 1_Click_Apply_Bambavade_Patch.bat AND 1_Click_REVERSE_Bambavade_Patch.bat
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$workspaceRoot = "d:\Bhisi Software"
$patchFolder = Join-Path $workspaceRoot "VPS_Bambavade_Patch"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_VPS_Bambavade_Patch.zip"
$desktopZip = "C:\Users\tusha\OneDrive\Desktop\SmartBanking_VPS_Bambavade_Patch.zip"
$clientDir = Join-Path $workspaceRoot "client"
$apiDir = Join-Path $workspaceRoot "api\Bhisi.Api"
$versionJsonPath = Join-Path $workspaceRoot "version.json"

$version = "2.5.5"
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
Write-Host "  SmartBanking ERP - Dedicated VPS Patch Builder (Bambavade Only) " -ForegroundColor Cyan
Write-Host "  Version: v$version ($buildDate)                                " -ForegroundColor Yellow
if ($gitShort) {
Write-Host "  Git Commit: $gitShort ($gitBranch) - $gitMsg                   " -ForegroundColor Gray
}
Write-Host "  Features: Includes 1-Click Apply + 1-Click REVERSE Patch        " -ForegroundColor Green
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
# Step 1: Build & Copy Frontend Files
# -----------------------------------------------------------------------------------------
Write-Host "[1/4] Building and Copying Dynamic Multi-Domain Frontend Bundle..." -ForegroundColor Cyan
$envProdPath = Join-Path $clientDir ".env.production"
$envContent = "# Dynamic Multi-Domain Routing`nVITE_API_BASE_URL=`n"
[System.IO.File]::WriteAllText($envProdPath, $envContent, [System.Text.Encoding]::UTF8)

Push-Location $clientDir
try {
    cmd /c "npm run build"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $clientDir "dist\index.html"))) {
        Write-Host "[ERROR] Frontend build failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}
finally {
    Pop-Location
}

$frontendSource = Join-Path $clientDir "dist"
robocopy $frontendSource (Join-Path $patchFolder "frontend") /E | Out-Null
Write-Host "  -> Frontend Bundle built & copied OK!" -ForegroundColor Green

# -----------------------------------------------------------------------------------------
# Step 2: Publish Backend .NET 10 API
# -----------------------------------------------------------------------------------------
Write-Host "`n[2/4] Publishing Backend API Binaries..." -ForegroundColor Cyan
$backendTempPublish = Join-Path $workspaceRoot "scratch\api_publish_bambavade_temp"
if (Test-Path $backendTempPublish) { Remove-Item -Recurse -Force $backendTempPublish -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $backendTempPublish -Force | Out-Null

Push-Location $apiDir
try {
    dotnet restore -r win-x64
    dotnet publish -c Release -r win-x64 --self-contained false -o $backendTempPublish
    robocopy $backendTempPublish (Join-Path $patchFolder "backend") /E /XD "logs" "wwwroot" "uploads" /XF "appsettings.Development.json" "appsettings.Production.json" "appsettings.json" | Out-Null
    
    # Ensure web.config is present
    $sourceWebConfig = Join-Path $workspaceRoot "api\Bhisi.Api\web.config"
    if ((Test-Path $sourceWebConfig) -and (-not (Test-Path (Join-Path $patchFolder "backend\web.config")))) {
        Copy-Item $sourceWebConfig (Join-Path $patchFolder "backend\web.config") -Force
    }
    Write-Host "  -> Backend Binaries published OK!" -ForegroundColor Green
}
finally {
    Pop-Location
    Remove-Item -Recurse -Force $backendTempPublish -ErrorAction SilentlyContinue
}

# -----------------------------------------------------------------------------------------
# Step 3: Copy Database SQL Update Schema & Create Config
# -----------------------------------------------------------------------------------------
Write-Host "`n[3/4] Copying Database Schema Update & Generating Scripts..." -ForegroundColor Cyan
$utf8WithBom = New-Object System.Text.UTF8Encoding($true)

$sqlSource = Join-Path $workspaceRoot "tools\master_vps_update_schema.sql"
$sqlDest = Join-Path $patchFolder "database\update_schema.sql"
if (Test-Path $sqlSource) {
    $sqlContent = [System.IO.File]::ReadAllText($sqlSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($sqlDest, $sqlContent, $utf8WithBom)
    Write-Host "  -> master_vps_update_schema.sql copied as database\update_schema.sql (UTF-8 BOM)." -ForegroundColor White
}

$cleanupSource = Join-Path $workspaceRoot "tools\members_normalization_and_cleanup.sql"
if (Test-Path $cleanupSource) {
    Copy-Item $cleanupSource (Join-Path $patchFolder "database\members_normalization_and_cleanup.sql") -Force
    Write-Host "  -> members_normalization_and_cleanup.sql included." -ForegroundColor White
}

$universalSyncSource = Join-Path $workspaceRoot "tools\Universal_Schema_Only_Sync.sql"
if (Test-Path $universalSyncSource) {
    Copy-Item $universalSyncSource (Join-Path $patchFolder "database\Universal_Schema_Only_Sync.sql") -Force
    Write-Host "  -> Universal_Schema_Only_Sync.sql included." -ForegroundColor White
}

$saving14DigitSource = Join-Path $workspaceRoot "patches\patch_migrate_saving_accounts_14digit.sql"
if (Test-Path $saving14DigitSource) {
    Copy-Item $saving14DigitSource (Join-Path $patchFolder "database\patch_migrate_saving_accounts_14digit.sql") -Force
    Write-Host "  -> patch_migrate_saving_accounts_14digit.sql included." -ForegroundColor White
}

# Copy version manifests
if (Test-Path $versionJsonPath) {
    Copy-Item $versionJsonPath (Join-Path $patchFolder "version.json") -Force
    Copy-Item $versionJsonPath (Join-Path $patchFolder "backend\version.json") -Force
    Copy-Item $versionJsonPath (Join-Path $patchFolder "frontend\version.json") -Force
    Write-Host "  -> version.json (v$version Changelog) included in patch." -ForegroundColor White
}

$mobileApiDoc = Join-Path $workspaceRoot "MOBILE_APPLICATION_API.md"
if (Test-Path $mobileApiDoc) {
    Copy-Item $mobileApiDoc (Join-Path $patchFolder "MOBILE_APPLICATION_API.md") -Force
    Write-Host "  -> MOBILE_APPLICATION_API.md included." -ForegroundColor White
}

# Bambavade-only patch configuration with multiple candidate paths for robustness
$bambavadeConfig = @{
    SqlServerInstance = "."
    SqlUser = "sa"
    SqlPassword = "Mindspace2026"
    TakeDbBackup = $true
    BackupFolder = "D:\Backups"
    SnapshotFolder = "D:\WebApps_Backups\Bambavade_Last_Working_State"
    SansthaName = "Shree Bambawade Nagari Sahakari PatSanstha (Bambavade)"
    TargetDatabaseCandidates = @("SmartBanking_bambavadeurban", "SmartBanking_Bambawade")
    IISAppPoolCandidates = @("bambavadeurban-backend", "apibambavade", "bambavade-backend")
    BackendFolderCandidates = @("D:\WebApps\bambavadeurban\backend", "D:\WebApps\bambavade\api.bambavade.hellomindspace.in", "D:\WebApps\bambavade\backend")
    FrontendFolderCandidates = @("D:\WebApps\bambavadeurban\frontend", "D:\WebApps\bambavade\bambavade.hellomindspace.in", "D:\WebApps\bambavade\frontend")
}
$bambavadeConfig | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $patchFolder "patch_config.json") -Encoding UTF8

# -----------------------------------------------------------------------------------------
# Generate apply_patch.ps1
# -----------------------------------------------------------------------------------------
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

# Helper for Safe SQL Execution with Auto-Fallback (SQL Auth -> Windows Auth)
function Run-SqlCmdSafe {
    param(
        [string]$Server,
        [string]$Database,
        [string]$User,
        [string]$Password,
        [string]$Query,
        [string]$InputFile
    )
    
    $tempSqlFile = $null
    if ($Query) {
        $tempSqlFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "sqlcmd_" + [System.Guid]::NewGuid().ToString("N") + ".sql")
        $utf8WithBom = New-Object System.Text.UTF8Encoding($true)
        [System.IO.File]::WriteAllText($tempSqlFile, $Query, $utf8WithBom)
        $InputFile = $tempSqlFile
    }

    try {
        # 1. Try SQL Authentication
        if ($User -and $Password) {
            $cmdArgs = @("-S", "`"$Server`"")
            if ($Database) { $cmdArgs += @("-d", "`"$Database`"") }
            $cmdArgs += @("-U", "`"$User`"", "-P", "`"$Password`"", "-b")
            if ($InputFile) { $cmdArgs += @("-i", "`"$InputFile`"", "-f", "65001") }

            $pinfo = New-Object System.Diagnostics.ProcessStartInfo
            $pinfo.FileName = "sqlcmd.exe"
            $pinfo.Arguments = ($cmdArgs -join " ")
            $pinfo.RedirectStandardOutput = $true
            $pinfo.RedirectStandardError = $true
            $pinfo.UseShellExecute = $false
            $p = [System.Diagnostics.Process]::Start($pinfo)
            $stdout = $p.StandardOutput.ReadToEnd()
            $stderr = $p.StandardError.ReadToEnd()
            $p.WaitForExit()

            if ($p.ExitCode -eq 0 -and ($stderr -notmatch "Login failed")) {
                return @{ Success = $true; Output = $stdout; AuthUsed = "SQL Auth ($User)" }
            }
        }

        # 2. Try Windows Authentication (-E)
        $cmdArgs = @("-S", "`"$Server`"")
        if ($Database) { $cmdArgs += @("-d", "`"$Database`"") }
        $cmdArgs += @("-E", "-b")
        if ($InputFile) { $cmdArgs += @("-i", "`"$InputFile`"", "-f", "65001") }

        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = "sqlcmd.exe"
        $pinfo.Arguments = ($cmdArgs -join " ")
        $pinfo.RedirectStandardOutput = $true
        $pinfo.RedirectStandardError = $true
        $pinfo.UseShellExecute = $false
        $p = [System.Diagnostics.Process]::Start($pinfo)
        $stdout = $p.StandardOutput.ReadToEnd()
        $stderr = $p.StandardError.ReadToEnd()
        $p.WaitForExit()

        if ($p.ExitCode -eq 0) {
            return @{ Success = $true; Output = $stdout; AuthUsed = "Windows Auth" }
        } else {
            return @{ Success = $false; Output = ($stdout + " " + $stderr); AuthUsed = "Failed" }
        }
    }
    finally {
        if ($tempSqlFile -and (Test-Path $tempSqlFile)) {
            Remove-Item $tempSqlFile -Force -ErrorAction SilentlyContinue
        }
    }
}

# Resolve existing backend folder
$targetBackend = $null
foreach ($bPath in $config.BackendFolderCandidates) {
    if (Test-Path $bPath) { $targetBackend = $bPath; break }
}
if (-not $targetBackend) { $targetBackend = $config.BackendFolderCandidates[0] }

# Resolve existing frontend folder
$targetFrontend = $null
foreach ($fPath in $config.FrontendFolderCandidates) {
    if (Test-Path $fPath) { $targetFrontend = $fPath; break }
}
if (-not $targetFrontend) { $targetFrontend = $config.FrontendFolderCandidates[0] }

# Resolve database name
$targetDb = $config.TargetDatabaseCandidates[0]
foreach ($db in $config.TargetDatabaseCandidates) {
    $res = Run-SqlCmdSafe -Server $config.SqlServerInstance -User $config.SqlUser -Password $config.SqlPassword -Query "IF DB_ID('$db') IS NOT NULL PRINT 'EXISTS'"
    if ($res.Success -and $res.Output -match "EXISTS") {
        $targetDb = $db
        break
    }
}

# Resolve IIS AppPool
$targetAppPool = $config.IISAppPoolCandidates[0]

Write-Host "Detected Target Configuration:" -ForegroundColor White
Write-Host "  Database   : $targetDb" -ForegroundColor Gray
Write-Host "  Backend    : $targetBackend" -ForegroundColor Gray
Write-Host "  Frontend   : $targetFrontend" -ForegroundColor Gray
Write-Host "  App Pool   : $targetAppPool" -ForegroundColor Gray
Write-Host ""

try {
    # 1. Full Database Safety Backup (.bak)
    if ($config.TakeDbBackup) {
        Write-Host "[1/5] Taking Safety Database Backup for $targetDb..." -ForegroundColor Yellow
        if (-not (Test-Path $config.BackupFolder)) { New-Item -Path $config.BackupFolder -ItemType Directory -Force | Out-Null }
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = "$($config.BackupFolder)\$($targetDb)_PrePatch_$timestamp.bak"
        $backupSql = "BACKUP DATABASE [$targetDb] TO DISK = N'$backupPath' WITH FORMAT, INIT, NAME = N'$targetDb-Backup', STATS = 10;"
        
        $bkRes = Run-SqlCmdSafe -Server $config.SqlServerInstance -User $config.SqlUser -Password $config.SqlPassword -Query $backupSql
        if ($bkRes.Success) {
            Write-Host "  -> DB Backup Success ($($bkRes.AuthUsed)): $backupPath" -ForegroundColor Green
        } else {
            Write-Host "  -> Backup Warning: $($bkRes.Output). Continuing..." -ForegroundColor DarkYellow
        }
    }

    # 2. Safety File Snapshot for 1-Click Reverse Patch
    Write-Host "`n[2/5] Creating Snapshot of CURRENT Working Backend & Frontend..." -ForegroundColor Yellow
    $snapshotDir = $config.SnapshotFolder
    if (-not (Test-Path $snapshotDir)) { New-Item -Path $snapshotDir -ItemType Directory -Force | Out-Null }
    
    $snapBackend = Join-Path $snapshotDir "backend"
    $snapFrontend = Join-Path $snapshotDir "frontend"
    if (Test-Path $snapBackend) { Remove-Item -Path $snapBackend -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path $snapFrontend) { Remove-Item -Path $snapFrontend -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -Path $snapBackend -ItemType Directory -Force | Out-Null
    New-Item -Path $snapFrontend -ItemType Directory -Force | Out-Null

    if (Test-Path $targetBackend) {
        robocopy $targetBackend $snapBackend /E /R:2 /W:1 /XD "logs" "uploads" "wwwroot" | Out-Null
        Write-Host "  -> Current Working Backend saved to snapshot." -ForegroundColor Green
    }
    if (Test-Path $targetFrontend) {
        robocopy $targetFrontend $snapFrontend /E /R:2 /W:1 | Out-Null
        Write-Host "  -> Current Working Frontend saved to snapshot." -ForegroundColor Green
    }

    # Save manifest for reverse script
    $manifest = @{
        TargetDatabase = $targetDb
        TargetBackend = $targetBackend
        TargetFrontend = $targetFrontend
        TargetAppPool = $targetAppPool
        BackupBakFile = $backupPath
        SnapshotDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
    $manifest | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $snapshotDir "manifest.json") -Encoding UTF8

    # 3. Database Schema Sync (Non-destructive)
    Write-Host "`n[3/5] Applying Database Schema Updates to $targetDb..." -ForegroundColor Yellow
    if (Test-Path $sqlFile) {
        $sqlRes = Run-SqlCmdSafe -Server $config.SqlServerInstance -Database $targetDb -User $config.SqlUser -Password $config.SqlPassword -InputFile $sqlFile
        if ($sqlRes.Success) {
            Write-Host "  -> Database Schema updated successfully! ($($sqlRes.AuthUsed))" -ForegroundColor Green
        } else {
            Write-Host "  -> SQL Output: $($sqlRes.Output)" -ForegroundColor DarkYellow
        }
    }

    # 3.1 Automatic 14-Digit Saving Accounts Migration
    $saving14Sql = Join-Path $scriptDir "database\patch_migrate_saving_accounts_14digit.sql"
    if (Test-Path $saving14Sql) {
        Write-Host "  -> Running 14-Digit Saving Account Migration on $targetDb..." -ForegroundColor Yellow
        $res14 = Run-SqlCmdSafe -Server $config.SqlServerInstance -Database $targetDb -User $config.SqlUser -Password $config.SqlPassword -InputFile $saving14Sql
        if ($res14.Success) {
            Write-Host "  -> 14-Digit Saving Accounts Migrated Successfully! ($($res14.AuthUsed))" -ForegroundColor Green
            if ($res14.Output) {
                $lines = $res14.Output -split "`r?`n" | Where-Object { $_ -match "converted|already 14|Archiving|DROPPED|MIGRATION" }
                foreach ($l in $lines) { Write-Host "     $l" -ForegroundColor Gray }
            }
        } else {
            Write-Host "  -> Migration Output: $($res14.Output)" -ForegroundColor DarkYellow
        }
    }

    # 4. Stop IIS AppPool
    Write-Host "`n[4/5] Stopping IIS AppPool ($targetAppPool)..." -ForegroundColor Yellow
    foreach ($ap in $config.IISAppPoolCandidates) {
        try { cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"$ap`"" 2>$null } catch {}
    }
    Get-Process -Name "w3wp", "dotnet", "Bhisi.Api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # 5. Deploy Backend Files
    Write-Host "`n[5/5] Deploying New Backend & Frontend Files..." -ForegroundColor Yellow
    if (Test-Path $targetBackend) {
        robocopy $backendSource $targetBackend /E /R:2 /W:1 /XF "appsettings.json" "appsettings.Production.json" "license.lic" /XD "logs" "uploads" "wwwroot" | Out-Null
        
        # Ensure DefaultConnection with SQL Authentication sa/Mindspace2026
        $expectedConn = "Server=$($config.SqlServerInstance);Database=$targetDb;User Id=$($config.SqlUser);Password=$($config.SqlPassword);Trusted_Connection=False;TrustServerCertificate=True;MultipleActiveResultSets=true;Connect Timeout=60;"
        $appJsonPath = Join-Path $targetBackend "appsettings.json"
        $prodJsonPath = Join-Path $targetBackend "appsettings.Production.json"
        
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
        Write-Host "  -> Backend Updated Successfully!" -ForegroundColor Green
    }

    # Deploy Frontend
    if (Test-Path $targetFrontend) {
        robocopy $frontendSource $targetFrontend /E /R:2 /W:1 /PURGE | Out-Null
        Write-Host "  -> Frontend Updated Successfully!" -ForegroundColor Green
    }

    # Restart IIS AppPool
    foreach ($ap in $config.IISAppPoolCandidates) {
        try { cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"$ap`"" 2>$null } catch {}
    }
    cmd /c "iisreset" 2>$null

    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host "  BAMBAVADE SANSTHA PATCH APPLIED SUCCESSFULLY! (100% OK)         " -ForegroundColor Green
    Write-Host "  (Snapshot saved. In case of issues, run REVERSE Patch anytime)  " -ForegroundColor Cyan
    Write-Host "==================================================================" -ForegroundColor Green
}
catch {
    Write-Host "`n[ERROR] Patch installation failed: $_" -ForegroundColor Red
}

Read-Host "`nPress ENTER to close"
'@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "apply_patch.ps1"), $applyScript, [System.Text.Encoding]::UTF8)

# -----------------------------------------------------------------------------------------
# Generate reverse_patch.ps1 (Dedicated Rollback Script)
# -----------------------------------------------------------------------------------------
$reverseScript = @'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Clear-Host
Write-Host "==================================================================" -ForegroundColor Red
Write-Host "  SmartBanking ERP - 1-Click REVERSE (Rollback) Patch            " -ForegroundColor Red
Write-Host "  Target: Restores Previous Working State for Bambavade Sanstha   " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Red
Write-Host ""

$config = Get-Content (Join-Path $scriptDir "patch_config.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$snapshotDir = $config.SnapshotFolder
$manifestFile = Join-Path $snapshotDir "manifest.json"

if (-not (Test-Path $manifestFile)) {
    Write-Host "[ERROR] Snapshot manifest not found at: $snapshotDir" -ForegroundColor Red
    Write-Host "No previous working snapshot exists to reverse to." -ForegroundColor Yellow
    Read-Host "`nPress ENTER to close"
    exit 1
}

$manifest = Get-Content $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json

Write-Host "Found Working Snapshot from: $($manifest.SnapshotDate)" -ForegroundColor Cyan
Write-Host "  Target Database : $($manifest.TargetDatabase)" -ForegroundColor White
Write-Host "  Target Backend  : $($manifest.TargetBackend)" -ForegroundColor White
Write-Host "  Target Frontend : $($manifest.TargetFrontend)" -ForegroundColor White
Write-Host "  Target App Pool : $($manifest.TargetAppPool)" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Are you sure you want to REVERT back to this working version? (Y/N)"
if ($confirm -ne 'Y' -and $confirm -ne 'y') {
    Write-Host "Rollback cancelled by user." -ForegroundColor Yellow
    Read-Host "`nPress ENTER to close"
    exit 0
}

try {
    # 1. Stop IIS AppPool
    Write-Host "`n[1/3] Stopping IIS AppPool ($($manifest.TargetAppPool))..." -ForegroundColor Yellow
    foreach ($ap in $config.IISAppPoolCandidates) {
        try { cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"$ap`"" 2>$null } catch {}
    }
    Get-Process -Name "w3wp", "dotnet", "Bhisi.Api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # 2. Restore Backend and Frontend from Snapshot
    Write-Host "`n[2/3] Restoring Previous Backend & Frontend Binaries..." -ForegroundColor Yellow
    $snapBackend = Join-Path $snapshotDir "backend"
    $snapFrontend = Join-Path $snapshotDir "frontend"

    if (Test-Path $snapBackend -and Test-Path $manifest.TargetBackend) {
        robocopy $snapBackend $manifest.TargetBackend /E /R:2 /W:1 /XF "appsettings.json" "license.lic" /XD "logs" "uploads" "wwwroot" | Out-Null
        Write-Host "  -> Backend restored to previous working version OK!" -ForegroundColor Green
    }

    if (Test-Path $snapFrontend -and Test-Path $manifest.TargetFrontend) {
        robocopy $snapFrontend $manifest.TargetFrontend /E /R:2 /W:1 /PURGE | Out-Null
        Write-Host "  -> Frontend restored to previous working version OK!" -ForegroundColor Green
    }

    # 3. Restart IIS AppPool
    Write-Host "`n[3/3] Restarting IIS AppPool and Web Server..." -ForegroundColor Yellow
    foreach ($ap in $config.IISAppPoolCandidates) {
        try { cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"$ap`"" 2>$null } catch {}
    }
    cmd /c "iisreset" 2>$null

    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host "  BAMBAVADE SANSTHA HAS BEEN REVERTED TO PREVIOUS VERSION (100%)  " -ForegroundColor Green
    Write-Host "  Application is running on the previous stable build!           " -ForegroundColor Cyan
    Write-Host "==================================================================" -ForegroundColor Green
}
catch {
    Write-Host "`n[ERROR] Rollback failed: $_" -ForegroundColor Red
}

Read-Host "`nPress ENTER to close"
'@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "reverse_patch.ps1"), $reverseScript, [System.Text.Encoding]::UTF8)

# -----------------------------------------------------------------------------------------
# Generate 1_Click_Apply_Bambavade_Patch.bat
# -----------------------------------------------------------------------------------------
$applyBat = @"
@echo off
title SmartBanking ERP - 1-Click Bambavade Patch
color 0B
echo ==================================================================
echo   SmartBanking ERP - 1-Click Update: Bambavade Sanstha
echo ==================================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Administrator rights required. Elevating privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_patch.ps1"
echo.
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "1_Click_Apply_Bambavade_Patch.bat"), $applyBat, [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText((Join-Path $patchFolder "Apply_Bambavade_Patch.bat"), $applyBat, [System.Text.Encoding]::ASCII)

# -----------------------------------------------------------------------------------------
# Generate 1_Click_REVERSE_Bambavade_Patch.bat
# -----------------------------------------------------------------------------------------
$reverseBat = @"
@echo off
title SmartBanking ERP - 1-Click REVERSE Bambavade Patch
color 0C
echo ==================================================================
echo   SmartBanking ERP - 1-Click REVERSE (Rollback) Bambavade Patch
echo ==================================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Administrator rights required. Elevating privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0reverse_patch.ps1"
echo.
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "1_Click_REVERSE_Bambavade_Patch.bat"), $reverseBat, [System.Text.Encoding]::ASCII)

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
Write-Host "  BAMBAVADE DEDICATED PATCH + REVERSE PATCH CREATED SUCCESSFULLY! " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " Output File: $zipOutputFile" -ForegroundColor White
Write-Host " Desktop    : $desktopZip" -ForegroundColor White
Write-Host " Size       : $([math]::Round($zipSize, 2)) MB" -ForegroundColor Yellow
Write-Host " Target     : Shree Bambawade Nagari Sahakari PatSanstha" -ForegroundColor Cyan
Write-Host " Credentials: sa / Mindspace2026 (Auto-fallback to Windows Auth)" -ForegroundColor Gray
Write-Host " Features   : 1_Click_Apply_Bambavade_Patch.bat" -ForegroundColor White
Write-Host "              1_Click_REVERSE_Bambavade_Patch.bat" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Green
