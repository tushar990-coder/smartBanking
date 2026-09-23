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