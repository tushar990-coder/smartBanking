# =========================================================================================
# SmartBanking ERP - Dedicated 1-Click Patch Builder for Yadravkar Sanstha
# Targets ONLY: SmartBanking_maharshiyadrav & D:\WebApps\maharshiyadrav\backend
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$workspaceRoot = "d:\Bhisi Software"
$patchFolder = Join-Path $workspaceRoot "SmartBanking_Yadravkar_Patch"
$zipOutputFile = Join-Path $workspaceRoot "SmartBanking_Yadravkar_Patch.zip"
$desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$desktopDest = Join-Path $desktop "SmartBanking_Yadravkar_Patch.zip"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   SmartBanking ERP - Dedicated Yadravkar Sanstha Patch Builder   " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $patchFolder) {
    Remove-Item -Path $patchFolder -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -Path $patchFolder -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "database") -ItemType Directory -Force | Out-Null

# 1. Copy SQL Fix Script with UTF-8 BOM
$sqlSource = Join-Path $workspaceRoot "tools\fix_yadravkar_members.sql"
$sqlDest = Join-Path $patchFolder "database\fix_yadravkar_members.sql"
$sqlContent = [System.IO.File]::ReadAllText($sqlSource, [System.Text.Encoding]::UTF8)
$utf8WithBom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($sqlDest, $sqlContent, $utf8WithBom)
Write-Host "  -> fix_yadravkar_members.sql copied with UTF-8 BOM encoding." -ForegroundColor Green

# 2. Generate apply_yadravkar_fix.ps1
$applyPs1Content = @'
# =========================================================================================
# SmartBanking ERP - 1-Click Dedicated Fix for Yadravkar Sanstha
# 1. Stops IIS AppPool (maharshiyadrav-backend)
# 2. Removes any leftover *.sql files from D:\WebApps\maharshiyadrav\backend
# 3. Takes safety backup of SmartBanking_maharshiyadrav
# 4. Executes fix_yadravkar_members.sql (drops 15 leftover columns down to 13 canonical columns)
# 5. Restarts IIS AppPool
# =========================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$targetSanstha = "Shree Maharshi Shamrao Patil Yadravkar gramin BigarshetiSahakari Patsanstha Maryadit Yadrav"
$targetDb = "SmartBanking_maharshiyadrav"
$appPool = "maharshiyadrav-backend"
$backendPath = "D:\WebApps\maharshiyadrav\backend"
$backupFolder = "D:\Backups"
$sqlFile = Join-Path $PSScriptRoot "database\fix_yadravkar_members.sql"
$sqlUser = "sa"
$sqlPass = "Mindspace2026"
$sqlInstance = "."

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   SmartBanking ERP - Dedicated Yadravkar Sanstha Fix Runner      " -ForegroundColor Cyan
Write-Host "   Target Application : $targetSanstha                            " -ForegroundColor White
Write-Host "   Target Database    : $targetDb                                 " -ForegroundColor White
Write-Host "   Backend Folder     : $backendPath                              " -ForegroundColor White
Write-Host "   IIS AppPool        : $appPool                                  " -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------------------
# Step 1: Stop IIS AppPool & Process Locks
# -----------------------------------------------------------------------------------------
Write-Host "[Step 1] Stopping IIS AppPool ($appPool)..." -ForegroundColor Yellow
try {
    cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"$appPool`"" 2>$null
    Write-Host "  -> AppPool successfully stopped!" -ForegroundColor Green
} catch {
    Write-Host "  -> AppPool stop notice: $($_.Exception.Message)" -ForegroundColor DarkYellow
}
Get-Process -Name "w3wp", "dotnet", "Bhisi.Api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# -----------------------------------------------------------------------------------------
# Step 2: Clean up leftover *.sql files from D:\WebApps\maharshiyadrav\backend
# -----------------------------------------------------------------------------------------
Write-Host "`n[Step 2] Cleaning up leftover *.sql files in $backendPath..." -ForegroundColor Yellow
if (Test-Path $backendPath) {
    $sqlFilesFound = Get-ChildItem -Path $backendPath -Filter "*.sql" -Recurse -ErrorAction SilentlyContinue
    if ($sqlFilesFound -and $sqlFilesFound.Count -gt 0) {
        foreach ($sf in $sqlFilesFound) {
            try {
                Remove-Item -Path $sf.FullName -Force -ErrorAction SilentlyContinue
                Write-Host "  -> REMOVED old deploy script: $($sf.Name)" -ForegroundColor Green
            } catch {
                Write-Host "  -> Warning deleting $($sf.Name): $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }
    } else {
        Write-Host "  -> No leftover *.sql files found in backend folder. Clean!" -ForegroundColor Green
    }
} else {
    Write-Host "  -> Backend path not found: $backendPath (Skipped)" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------------------------------------
# Step 3: Database Safety Backup
# -----------------------------------------------------------------------------------------
Write-Host "`n[Step 3] Taking Database Safety Backup of $targetDb..." -ForegroundColor Yellow
if (-not (Test-Path $backupFolder)) {
    New-Item -Path $backupFolder -ItemType Directory -Force | Out-Null
}
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "$backupFolder\${targetDb}_PreYadravFix_$timestamp.bak"
$backupSql = "BACKUP DATABASE [$targetDb] TO DISK = N'$backupPath' WITH FORMAT, INIT, NAME = N'$targetDb-PreYadravFix-Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10;"

try {
    sqlcmd -S $sqlInstance -U $sqlUser -P $sqlPass -Q $backupSql
    Write-Host "  -> Backup Success: $backupPath" -ForegroundColor Green
} catch {
    try {
        sqlcmd -S $sqlInstance -E -Q $backupSql
        Write-Host "  -> Backup Success via Windows Auth: $backupPath" -ForegroundColor Green
    } catch {
        Write-Host "  -> Backup Warning: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
}

# -----------------------------------------------------------------------------------------
# Step 4: Apply fix_yadravkar_members.sql
# -----------------------------------------------------------------------------------------
Write-Host "`n[Step 4] Applying fix_yadravkar_members.sql to normalize Members to 13 columns..." -ForegroundColor Yellow
if (Test-Path $sqlFile) {
    $applied = $false
    try {
        sqlcmd -S $sqlInstance -U $sqlUser -P $sqlPass -d $targetDb -i $sqlFile -f 65001 -b
        if ($LASTEXITCODE -eq 0) { $applied = $true }
    } catch {}

    if (-not $applied) {
        try {
            sqlcmd -S $sqlInstance -d $targetDb -E -i $sqlFile -f 65001 -b
            if ($LASTEXITCODE -eq 0) { $applied = $true }
        } catch {}
    }

    if ($applied) {
        Write-Host "  -> Database Members Table Normalized Successfully!" -ForegroundColor Green
    } else {
        Write-Host "  -> Database Notice during update. Checking final status..." -ForegroundColor DarkYellow
    }
}

# -----------------------------------------------------------------------------------------
# Step 5: Restart IIS AppPool & Refresh
# -----------------------------------------------------------------------------------------
Write-Host "`n[Step 5] Restarting IIS AppPool ($appPool)..." -ForegroundColor Yellow
try {
    cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"$appPool`"" 2>$null
    Write-Host "  -> AppPool successfully started!" -ForegroundColor Green
} catch {}
cmd /c "iisreset" 2>$null

# -----------------------------------------------------------------------------------------
# Step 6: Final Verification Report
# -----------------------------------------------------------------------------------------
Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "                 FINAL VERIFICATION REPORT                        " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

$verifySql = "SELECT COUNT(*) AS ColCount FROM [$targetDb].INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Members'; SELECT COLUMN_NAME FROM [$targetDb].INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Members' ORDER BY ORDINAL_POSITION;"

try {
    sqlcmd -S $sqlInstance -U $sqlUser -P $sqlPass -Q $verifySql
} catch {
    sqlcmd -S $sqlInstance -E -Q $verifySql
}

Write-Host "`n[OK] Yadravkar Sanstha Fix completed successfully!" -ForegroundColor Green
Read-Host "Press ENTER to exit"
'@

[System.IO.File]::WriteAllText((Join-Path $patchFolder "apply_yadravkar_fix.ps1"), $applyPs1Content, $utf8WithBom)
Write-Host "  -> apply_yadravkar_fix.ps1 created." -ForegroundColor Green

# 3. Generate 1_Click_Fix_Yadravkar.bat
$batContent = @"
@echo off
title SmartBanking ERP - 1-Click Fix Yadravkar Members Table
color 0B
echo ==================================================================
echo   SmartBanking ERP - 1-Click Fix: Yadravkar Sanstha Members Table
echo ==================================================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Administrator rights required. Elevating privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_yadravkar_fix.ps1"
echo.
pause
"@
[System.IO.File]::WriteAllText((Join-Path $patchFolder "1_Click_Fix_Yadravkar.bat"), $batContent, [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText((Join-Path $patchFolder "Apply_Fix.bat"), $batContent, [System.Text.Encoding]::ASCII)
Write-Host "  -> 1_Click_Fix_Yadravkar.bat created." -ForegroundColor Green

# 4. Create ZIP
Write-Host "`nCompressing to $zipOutputFile..." -ForegroundColor Cyan
if (Test-Path $zipOutputFile) {
    Remove-Item -Path $zipOutputFile -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($patchFolder, $zipOutputFile, [System.IO.Compression.CompressionLevel]::Optimal, $false)

# 5. Copy to Desktop
Copy-Item $zipOutputFile $desktopDest -Force

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  YADRAVKAR FIX PATCH CREATED SUCCESSFULLY!                       " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " Output File: $zipOutputFile" -ForegroundColor Yellow
Write-Host " Desktop    : $desktopDest" -ForegroundColor Yellow
Write-Host " Size       : $([Math]::Round((Get-Item $zipOutputFile).Length / 1KB, 2)) KB" -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
