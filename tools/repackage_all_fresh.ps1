$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 1. Taking Fresh Database Backup..." -ForegroundColor Yellow
$backupSql = "BACKUP DATABASE [SmartBanking_JotirlingPdw] TO DISK = N'D:\SmartBanking_Backups\SmartBanking_JotirlingPdw_ReadyForVPS_20260823.bak' WITH FORMAT, INIT, NAME = N'SmartBanking_JotirlingPdw-Fresh-1623', SKIP, NOREWIND, NOUNLOAD, STATS = 10;"
sqlcmd -S . -E -Q $backupSql

Write-Host "`n 2. Packaging All-in-One SmartBanking_VPS_Patch_Padawalwadi.zip..." -ForegroundColor Yellow
& "d:\Bhisi Software\tools\build_vps_patch_package.ps1"

Write-Host "`n 3. Packaging Frontend_Patch.zip..." -ForegroundColor Yellow
if (Test-Path 'd:\Bhisi Software\Frontend_Patch.zip') { Remove-Item 'd:\Bhisi Software\Frontend_Patch.zip' -Force }
Compress-Archive -Path 'd:\Bhisi Software\client\dist\*' -DestinationPath 'd:\Bhisi Software\Frontend_Patch.zip' -Force

Write-Host "`n 4. Packaging Backend_Patch.zip..." -ForegroundColor Yellow
if (Test-Path 'd:\Bhisi Software\Backend_Patch.zip') { Remove-Item 'd:\Bhisi Software\Backend_Patch.zip' -Force }
Compress-Archive -Path 'd:\Bhisi Software\VPS_Deploy\*' -DestinationPath 'd:\Bhisi Software\Backend_Patch.zip' -Force

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " [SUCCESS] ALL FRESH PACKAGES CREATED AT CURRENT TIMESTAMP!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
