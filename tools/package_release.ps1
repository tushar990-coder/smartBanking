# SmartBanking ERP - 1-Click Update Package Generator
param (
    [string]$Version = "2.0.0",
    [string]$ReleaseDate = (Get-Date -Format "yyyy-MM-dd"),
    [string]$Changelog = "नवीन आवृत्ती व सुरक्षा सुधारणा (General stability & schema updates)"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "    SmartBanking ERP - 1-Click Update Package Generator          " -ForegroundColor Cyan
Write-Host "    Target Version: v$Version                                    " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $PSScriptRoot
$clientDir = Join-Path $rootDir "client"
$apiDir = Join-Path $rootDir "api\Bhisi.Api"
$outputDir = Join-Path $rootDir "publish_packages"
$stagingDir = Join-Path $outputDir "staging_v$Version"

if (-not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir | Out-Null }
if (Test-Path $stagingDir) { Remove-Item -Recurse -Force $stagingDir }
New-Item -ItemType Directory -Path $stagingDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stagingDir "wwwroot") | Out-Null

Write-Host "[1/5] Building React Frontend (Vite)..." -ForegroundColor Cyan
Push-Location $clientDir
cmd /c "npm run build"
Pop-Location

if (-not (Test-Path (Join-Path $clientDir "dist"))) {
    Write-Host "[ERROR] React client build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[2/5] Publishing .NET 10 Web API Executable..." -ForegroundColor Cyan
Push-Location $apiDir
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o (Join-Path $stagingDir "bin_temp")
Pop-Location

$publishedExe = Join-Path $stagingDir "bin_temp\Bhisi.Api.exe"
if (-not (Test-Path $publishedExe)) {
    Write-Host "[ERROR] API build failed! Bhisi.Api.exe not found." -ForegroundColor Red
    exit 1
}

# Move exe to staging root and clean bin_temp
Move-Item $publishedExe (Join-Path $stagingDir "Bhisi.Api.exe")
Remove-Item -Recurse -Force (Join-Path $stagingDir "bin_temp")

Write-Host "[3/5] Copying Frontend & Launchers to Package..." -ForegroundColor Cyan
Copy-Item -Recurse (Join-Path $clientDir "dist\*") (Join-Path $stagingDir "wwwroot")

$launcherStart = Join-Path $rootDir "StartSmartBanking.bat"
$launcherStop = Join-Path $rootDir "StopSmartBanking.bat"
if (Test-Path $launcherStart) { Copy-Item $launcherStart $stagingDir }
if (Test-Path $launcherStop) { Copy-Item $launcherStop $stagingDir }

# Cumulative migration script if present
$migrateSql = Join-Path $rootDir "tools\migrate.sql"
if (Test-Path $migrateSql) {
    Copy-Item $migrateSql (Join-Path $stagingDir "migrate.sql")
}

Write-Host "[4/5] Generating version.json metadata..." -ForegroundColor Cyan
$changelogArray = @($Changelog -split ";") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
$versionJsonObj = @{
    version = $Version
    releaseDate = $ReleaseDate
    changelog = $changelogArray
}
$versionJsonContent = $versionJsonObj | ConvertTo-Json -Depth 5
Set-Content -Path (Join-Path $stagingDir "version.json") -Value $versionJsonContent -Encoding UTF8
Set-Content -Path (Join-Path $rootDir "version.json") -Value $versionJsonContent -Encoding UTF8

Write-Host "[5/5] Compressing Update Package into .zip..." -ForegroundColor Cyan
$zipFileName = "SmartBanking_Update_v$Version.zip"
$zipFilePath = Join-Path $outputDir $zipFileName
if (Test-Path $zipFilePath) { Remove-Item -Force $zipFilePath }

[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $zipFilePath)

$zipSizeMb = [Math]::Round(((Get-Item $zipFilePath).Length / 1MB), 2)

# Generate latest-release.json manifest for Cloud / Online Updates
$manifestObj = @{
    latestVersion = $Version
    releaseDate = $ReleaseDate
    downloadUrl = "https://raw.githubusercontent.com/tushar990-coder/smart-banking/main/publish_packages/$zipFileName"
    downloadSizeMb = $zipSizeMb
    isCritical = $false
    changelog = $changelogArray
}
$manifestContent = $manifestObj | ConvertTo-Json -Depth 5
Set-Content -Path (Join-Path $outputDir "latest-release.json") -Value $manifestContent -Encoding UTF8
Set-Content -Path (Join-Path $rootDir "latest-release.json") -Value $manifestContent -Encoding UTF8

# Clean staging directory
Remove-Item -Recurse -Force $stagingDir

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "       1-CLICK UPDATE PACKAGE GENERATED SUCCESSFULLY!             " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  -> ZIP Package:  $zipFilePath ($zipSizeMb MB)" -ForegroundColor Green
Write-Host "  -> Manifest:     $(Join-Path $outputDir 'latest-release.json')" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
