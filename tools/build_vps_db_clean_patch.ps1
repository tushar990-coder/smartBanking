# =========================================================================================
# SmartBanking ERP - 1-Click Database Only Clean Patch Builder
# Generates a standalone patch package to wipe transactions, accounts & customers
# while strictly keeping Logins, Financial Years, Branches, Account Groups & Ledgers.
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$workspaceRoot = "d:\Bhisi Software"
$configFile = Join-Path $workspaceRoot "tools\vps_multi_app_config.json"
$patchFolder = Join-Path $workspaceRoot "VPS_DB_Clean_Patch"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_VPS_DB_Clean_Patch.zip"
$sqlScript = Join-Path $workspaceRoot "tools\clean_database_keep_masters.sql"
$buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - 1-Click Database Clean Patch Builder        " -ForegroundColor Cyan
Write-Host "  Build Date: $buildDate                                         " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $configFile)) {
    Write-Host "[ERROR] Config file not found: $configFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $sqlScript)) {
    Write-Host "[ERROR] Clean SQL script not found: $sqlScript" -ForegroundColor Red
    exit 1
}

if (Test-Path $patchFolder) {
    try { Remove-Item -Path $patchFolder -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}
New-Item -Path $patchFolder -ItemType Directory -Force | Out-Null

# 1. Copy SQL script
$sqlDest = Join-Path $patchFolder "clean_database_keep_masters.sql"
$sqlContent = [System.IO.File]::ReadAllText($sqlScript, [System.Text.Encoding]::UTF8)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($sqlDest, $sqlContent, $utf8NoBom)
Write-Host " [Step 1] Clean SQL script packaged OK!" -ForegroundColor Green

# 2. Copy Config
$cfgDest = Join-Path $patchFolder "vps_multi_app_config.json"
Copy-Item $configFile $cfgDest -Force
Write-Host " [Step 2] VPS multi-app config packaged OK!" -ForegroundColor Green

# 3. Create apply_db_clean.ps1
$applyPs1Content = @'
# =========================================================================================
# SmartBanking ERP - 1-Click Database Clean & Fresh Start Installer
# Automatically backs up databases before clearing data!
# =========================================================================================

param(
    [string]$TargetName = "PROMPT"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$patchRoot = $PSScriptRoot
$configFile = Join-Path $patchRoot "vps_multi_app_config.json"
$sqlFile = Join-Path $patchRoot "clean_database_keep_masters.sql"

Write-Host "==================================================================" -ForegroundColor Magenta
Write-Host "  SmartBanking ERP - 1-Click Database Clean & Fresh Start Tool   " -ForegroundColor Magenta
Write-Host "==================================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  [PRESERVED] Users, Passwords, Branches, Financial Years, Account Groups & Ledgers" -ForegroundColor Green
Write-Host "  [CLEARED]   Customers, Members, Accounts, Transactions, Vouchers, Logs & Opening Balances" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $configFile)) {
    Write-Host "[ERROR] Config file missing: $configFile" -ForegroundColor Red
    Read-Host "Press ENTER to exit"
    exit 1
}

$config = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
$sqlServerInstance = if ($config.SqlServerInstance) { $config.SqlServerInstance } else { "." }
$backupFolder = if ($config.BackupFolder) { $config.BackupFolder } else { "D:\Backups" }

if (-not (Test-Path $backupFolder)) {
    New-Item -Path $backupFolder -ItemType Directory -Force | Out-Null
}

$selectedTargets = @()
if ($TargetName -eq "ALL") {
    $selectedTargets = $config.Targets
} elseif ($TargetName -ne "PROMPT") {
    $selectedTargets = $config.Targets | Where-Object { 
        $_.SansthaName -like "*$TargetName*" -or $_.TargetDatabase -like "*$TargetName*" 
    }
}

if ($selectedTargets.Count -eq 0) {
    Write-Host "Available Sansthas to Clean:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $config.Targets.Count; $i++) {
        $t = $config.Targets[$i]
        Write-Host "  [$($i + 1)] $($t.SansthaName) [DB: $($t.TargetDatabase)]" -ForegroundColor White
    }
    Write-Host "  [A] ALL Databases (Clean All Sansthas)" -ForegroundColor Yellow
    Write-Host "  [Q] Quit / Cancel" -ForegroundColor Gray
    Write-Host ""
    $choice = Read-Host "Select option (1-$($config.Targets.Count), A, Q)"

    if ($choice -eq "A" -or $choice -eq "a") {
        $selectedTargets = $config.Targets
    } elseif ($choice -eq "Q" -or $choice -eq "q") {
        Write-Host "Operation cancelled by user." -ForegroundColor Gray
        exit 0
    } else {
        $idx = [int]$choice - 1
        if ($idx -ge 0 -and $idx -lt $config.Targets.Count) {
            $selectedTargets = @($config.Targets[$idx])
        } else {
            Write-Host "[ERROR] Invalid selection." -ForegroundColor Red
            Read-Host "Press ENTER to exit"
            exit 1
        }
    }
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Red
Write-Host "                         CRITICAL WARNING                         " -ForegroundColor Red
Write-Host "==================================================================" -ForegroundColor Red
Write-Host "You are about to WIPE transactional & customer data for:" -ForegroundColor Yellow
foreach ($t in $selectedTargets) {
    Write-Host "  - $($t.SansthaName) (DB: $($t.TargetDatabase))" -ForegroundColor White
}
Write-Host ""
Write-Host "A FULL DATABASE BACKUP will be taken automatically before wiping." -ForegroundColor Green
Write-Host ""
$confirm = Read-Host "Type 'YES' to proceed with Database Clean, or any other key to CANCEL"
if ($confirm -ne "YES" -and $confirm -ne "yes") {
    Write-Host "Aborted. No databases were modified." -ForegroundColor Gray
    Read-Host "Press ENTER to exit"
    exit 0
}

# Function to execute SQL
function Invoke-SqlExecution {
    param([string]$Server, [string]$Database, [string]$SqlScriptPath)
    if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
        Invoke-Sqlcmd -ServerInstance $Server -Database $Database -InputFile $SqlScriptPath -QueryTimeout 600
    } else {
        $cmd = "sqlcmd -S `"$Server`" -d `"$Database`" -i `"$SqlScriptPath`" -b -f 65001"
        cmd /c $cmd
        if ($LASTEXITCODE -ne 0) { throw "sqlcmd execution failed with exit code $LASTEXITCODE" }
    }
}

$results = @()
$sqlText = [System.IO.File]::ReadAllText($sqlFile, [System.Text.Encoding]::UTF8)

foreach ($target in $selectedTargets) {
    Write-Host "`n------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host " Processing: $($target.SansthaName)" -ForegroundColor Cyan
    Write-Host " Database  : $($target.TargetDatabase)" -ForegroundColor White
    Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan

    $statusObj = [PSCustomObject]@{
        Sanstha = $target.SansthaName
        Database = $target.TargetDatabase
        Backup = "Pending"
        CleanStatus = "Pending"
        UsersPreserved = 0
        LedgersPreserved = 0
    }

    try {
        # 1. Take Backup
        $timestamp = (Get-Date -Format "yyyyMMdd_HHmmss")
        $backupFile = Join-Path $backupFolder "PreClean_Backup_$($target.TargetDatabase)_$timestamp.bak"
        Write-Host " [Step 1] Creating Safety Backup -> $backupFile..." -ForegroundColor Yellow
        
        $backupSql = "BACKUP DATABASE [$($target.TargetDatabase)] TO DISK = N'$backupFile' WITH NOFORMAT, NOINIT, NAME = N'Pre-Clean Safety Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10;"
        if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
            Invoke-Sqlcmd -ServerInstance $sqlServerInstance -Query $backupSql -QueryTimeout 600
        } else {
            cmd /c "sqlcmd -S `"$sqlServerInstance`" -Q `"$backupSql`" -b"
        }
        Write-Host "  -> Safety Backup Created OK!" -ForegroundColor Green
        $statusObj.Backup = "OK ($timestamp)"

        # 2. Execute Clean Script
        Write-Host " [Step 2] Executing Database Clean Script (Keep Masters)..." -ForegroundColor Yellow
        Invoke-SqlExecution -Server $sqlServerInstance -Database $target.TargetDatabase -SqlScriptPath $sqlFile
        Write-Host "  -> Database Clean & Identity Reset Completed OK!" -ForegroundColor Green
        $statusObj.CleanStatus = "Success (Cleaned & Reset)"

        # 3. Verify Remaining Masters
        $verifySql = "SELECT (SELECT COUNT(*) FROM Users) AS UserCount, (SELECT COUNT(*) FROM Ledgers) AS LedgerCount;"
        $vResult = $null
        if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
            $vResult = Invoke-Sqlcmd -ServerInstance $sqlServerInstance -Database $target.TargetDatabase -Query $verifySql
            if ($vResult) {
                $statusObj.UsersPreserved = $vResult.UserCount
                $statusObj.LedgersPreserved = $vResult.LedgerCount
            }
        }
    }
    catch {
        Write-Host " [ERROR] Failed to clean $($target.TargetDatabase): $_" -ForegroundColor Red
        $statusObj.CleanStatus = "Failed: $_"
    }

    $results += $statusObj
}

Write-Host "`n==================================================================" -ForegroundColor Magenta
Write-Host "                 DATABASE CLEAN SUMMARY REPORT                    " -ForegroundColor Magenta
Write-Host "==================================================================" -ForegroundColor Magenta
$results | Format-Table -AutoSize Sanstha, Database, Backup, UsersPreserved, LedgersPreserved, CleanStatus

Write-Host "`n[OK] Database clean operation completed." -ForegroundColor Green
Read-Host "Press ENTER to exit"
'@

[System.IO.File]::WriteAllText((Join-Path $patchFolder "apply_db_clean.ps1"), $applyPs1Content, $utf8NoBom)
Write-Host " [Step 3] Installer runner apply_db_clean.ps1 created OK!" -ForegroundColor Green

# 4. Generate 1-Click Batch files
# 4.1 ALL
$batAll = @"
@echo off
title SmartBanking ERP - 1-Click Clean ALL Databases
color 0D
echo ==================================================================
echo   SmartBanking ERP - 1-Click Clean ALL VPS Databases
echo ==================================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Administrator rights required. Elevating privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_db_clean.ps1" -TargetName "ALL"
echo.
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "1_Click_Clean_ALL_Databases.bat"), $batAll, [System.Text.Encoding]::ASCII)

# 4.2 Bambavade
$batBambavade = @"
@echo off
title SmartBanking ERP - 1-Click Clean Bambavade Database
color 0D
echo ==================================================================
echo   SmartBanking ERP - 1-Click Clean: Bambavade Sanstha
echo ==================================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Administrator rights required. Elevating privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_db_clean.ps1" -TargetName "Bambawade"
echo.
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "1_Click_Clean_Bambavade.bat"), $batBambavade, [System.Text.Encoding]::ASCII)

# 4.3 Padawalwadi
$batPadawalwadi = @"
@echo off
title SmartBanking ERP - 1-Click Clean Padawalwadi Database
color 0D
echo ==================================================================
echo   SmartBanking ERP - 1-Click Clean: Padawalwadi Sanstha
echo ==================================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Administrator rights required. Elevating privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_db_clean.ps1" -TargetName "Padawalwadi"
echo.
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "1_Click_Clean_Padawalwadi.bat"), $batPadawalwadi, [System.Text.Encoding]::ASCII)

# 4.4 Gurudev
$batGurudev = @"
@echo off
title SmartBanking ERP - 1-Click Clean Gurudev Database
color 0D
echo ==================================================================
echo   SmartBanking ERP - 1-Click Clean: Gurudev Sanstha
echo ==================================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Administrator rights required. Elevating privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_db_clean.ps1" -TargetName "Gurudev"
echo.
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "1_Click_Clean_Gurudev.bat"), $batGurudev, [System.Text.Encoding]::ASCII)

# 4.5 Testing
$batTesting = @"
@echo off
title SmartBanking ERP - 1-Click Clean Testing Database
color 0D
echo ==================================================================
echo   SmartBanking ERP - 1-Click Clean: Testing Database
echo ==================================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Administrator rights required. Elevating privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_db_clean.ps1" -TargetName "Testing"
echo.
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "1_Click_Clean_Testing.bat"), $batTesting, [System.Text.Encoding]::ASCII)
Write-Host " [Step 4] 1-Click batch files generated OK!" -ForegroundColor Green

# 5. Compress to ZIP & Copy to Desktop
Write-Host "`n[Step 5] Creating SmartBanking_VPS_DB_Clean_Patch.zip..." -ForegroundColor Cyan

if (Test-Path $zipOutputFile) {
    Remove-Item -Path $zipOutputFile -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($patchFolder, $zipOutputFile, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$desktopLocations = @(
    [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop),
    "C:\Users\tusha\Desktop",
    "C:\Users\tusha\OneDrive\Desktop"
) | Select-Object -Unique

foreach ($d in $desktopLocations) {
    if (Test-Path $d) {
        $dest = Join-Path $d "SmartBanking_VPS_DB_Clean_Patch.zip"
        Copy-Item $zipOutputFile $dest -Force
        Write-Host "  -> Copied to: $dest" -ForegroundColor Green
    }
}

$freshItem = Get-Item $zipOutputFile

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  DATABASE CLEAN PATCH CREATED SUCCESSFULLY!                      " -ForegroundColor Green
Write-Host "  Output File: $zipOutputFile" -ForegroundColor Yellow
Write-Host "  Timestamp  : $($freshItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Yellow
Write-Host "  Size       : $($freshItem.Length) bytes" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Green
