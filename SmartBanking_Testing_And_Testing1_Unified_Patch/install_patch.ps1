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