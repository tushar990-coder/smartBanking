$workspaceRoot = "d:\Bhisi Software"
$apiDir = Join-Path $workspaceRoot "api\Bhisi.Api"
$clientDir = Join-Path $workspaceRoot "client"
$patchFolder = Join-Path $workspaceRoot "VPS_All_In_One_Patch"
$zipOutput = Join-Path $workspaceRoot "SmartBanking_VPS_All_In_One_Patch.zip"
$backendTempPublish = Join-Path $workspaceRoot "scratch\api_publish_temp"

Write-Host "Publishing .NET Backend..." -ForegroundColor Cyan
Push-Location $apiDir
dotnet publish -c Release -r win-x64 --self-contained false -o $backendTempPublish
Pop-Location

Write-Host "Assembling Patch..." -ForegroundColor Cyan
if (Test-Path $patchFolder) {
    Remove-Item -Path $patchFolder -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -Path $patchFolder -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "database") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "backend") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $patchFolder "frontend") -ItemType Directory -Force | Out-Null

Copy-Item (Join-Path $workspaceRoot "tools\master_vps_update_schema.sql") (Join-Path $patchFolder "database\update_schema.sql") -Force
robocopy $backendTempPublish (Join-Path $patchFolder "backend") /E /XD "logs" "wwwroot" "uploads" /XF "appsettings.Development.json" | Out-Null
robocopy (Join-Path $clientDir "dist") (Join-Path $patchFolder "frontend") /E | Out-Null

$configContent = @"
{
  "SansthaName": "Shree Jotirling Nagari Sahakari PatSanstha (Padawalwadi)",
  "TargetDatabase": "SmartBanking_JotirlingPdw",
  "SqlServerInstance": ".",
  "IISAppPoolName": "apitesting",
  "BackendFolderPath": "D:\\WebApps\\Testing\\api.testing.hellomindspace.in",
  "FrontendFolderPath": "D:\\WebApps\\Jotirlingpdw\\jotirlingpdw.hellomindspace.in",
  "TakeDbBackup": true,
  "BackupFolder": "D:\\Backups"
}
"@
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $patchFolder "patch_config.json"), $configContent, $utf8NoBom)

Copy-Item "d:\Bhisi Software\tools\apply_patch.ps1" (Join-Path $patchFolder "apply_patch.ps1") -Force
Copy-Item "d:\Bhisi Software\tools\Apply_VPS_Patch.bat" (Join-Path $patchFolder "Apply_VPS_Patch.bat") -Force

if (Test-Path $zipOutput) {
    Remove-Item -Path $zipOutput -Force -ErrorAction SilentlyContinue
}
[System.IO.Compression.ZipFile]::CreateFromDirectory($patchFolder, $zipOutput, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$desktop = [Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)
$desktopDest = Join-Path $desktop "SmartBanking_VPS_All_In_One_Patch.zip"
Copy-Item $zipOutput $desktopDest -Force

Write-Host "SUCCESS: Patch packaged at $zipOutput and $desktopDest" -ForegroundColor Green
