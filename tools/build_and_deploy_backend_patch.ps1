# =========================================================================================
# SMART BANKING - BACKEND-ONLY PATCH BUILDER & DEPLOYER
# =========================================================================================
# Publishes .NET Web API binaries and packages them with an automated deployer.
# Safely preserves: appsettings.json, appsettings.Production.json, license.lic, logs, uploads
# =========================================================================================

param(
    [switch]$ApplyLocal = $false
)

$ErrorActionPreference = "Stop"
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$workspaceRoot = Split-Path -Parent $toolsDir
$apiDir = Join-Path $workspaceRoot "api\Bhisi.Api"
$outputDir = Join-Path $workspaceRoot "publish_packages\backend_patch"
$tempPublish = Join-Path $workspaceRoot "scratch\api_publish_backend_temp"
$configFile = Join-Path $toolsDir "backend_patch_config.json"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       SMART BANKING - BACKEND-ONLY PATCH CREATOR           " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Verify configuration exists
if (-not (Test-Path $configFile)) {
    Write-Host "[ERROR] Configuration file not found: $configFile" -ForegroundColor Red
    exit 1
}

# 1. Clean and prepare directories
Write-Host "`n[1/4] Preparing directories..." -ForegroundColor Yellow
if (Test-Path $tempPublish) { Remove-Item -Recurse -Force $tempPublish -ErrorAction SilentlyContinue }
if (Test-Path $outputDir) { Remove-Item -Recurse -Force $outputDir -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $tempPublish -Force | Out-Null
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outputDir "binaries") -Force | Out-Null

# 2. Publish .NET Web API
Write-Host "`n[2/4] Compiling and Publishing .NET Web API (Release / win-x64)..." -ForegroundColor Yellow
Push-Location $apiDir
try {
    dotnet publish -c Release -r win-x64 --self-contained false -o $tempPublish
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $tempPublish "Bhisi.Api.dll"))) {
        Write-Host "[ERROR] Backend publish failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Write-Host "  -> Backend compiled and published successfully!" -ForegroundColor Green
}
finally {
    Pop-Location
}

# 3. Assemble patch package
Write-Host "`n[3/4] Assembling patch files into: $outputDir" -ForegroundColor Yellow
$binariesDest = Join-Path $outputDir "binaries"

# Robocopy binaries excluding sensitive server configs
robocopy $tempPublish $binariesDest /E /XD "logs" "wwwroot" "uploads" /XF "appsettings.Development.json" "appsettings.Production.json" "appsettings.json" "license.lic" | Out-Null

# Copy config file into patch folder
Copy-Item $configFile (Join-Path $outputDir "backend_patch_config.json") -Force

# Create apply_backend_patch.ps1 inside the patch package
$applyScript = @'
# =========================================================================================
# APPLY BACKEND PATCH SCRIPT
# Run this script with Administrator privileges on the server / VPS.
# =========================================================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$binariesSource = Join-Path $scriptDir "binaries"
$configPath = Join-Path $scriptDir "backend_patch_config.json"

if (-not (Test-Path $configPath)) {
    Write-Host "[ERROR] Configuration file 'backend_patch_config.json' not found!" -ForegroundColor Red
    pause
    exit 1
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$targets = $config.Targets | Where-Object { $_.Enabled -ne $false }

if (-not $targets -or $targets.Count -eq 0) {
    Write-Host "[WARNING] No enabled targets found in backend_patch_config.json." -ForegroundColor Yellow
    pause
    exit 0
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "        APPLYING BACKEND PATCH TO TARGETS                   " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

foreach ($target in $targets) {
    Write-Host "`n------------------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host "Target: $($target.SansthaName)" -ForegroundColor White
    Write-Host "Folder: $($target.BackendFolderPath)" -ForegroundColor Gray
    Write-Host "Pool  : $($target.IISAppPoolName)" -ForegroundColor Gray

    if (-not (Test-Path $target.BackendFolderPath)) {
        Write-Host "  -> [SKIP] Target folder does not exist: $($target.BackendFolderPath)" -ForegroundColor Yellow
        continue
    }

    # 1. Stop IIS AppPool
    if (![string]::IsNullOrWhiteSpace($target.IISAppPoolName)) {
        Write-Host "  -> Stopping IIS AppPool: $($target.IISAppPoolName)..." -ForegroundColor Yellow
        try {
            cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"$($target.IISAppPoolName)`"" 2>$null
        } catch {}
        Start-Sleep -Seconds 2
    }

    # 2. Copy updated binaries (strictly preserving existing appsettings and license)
    Write-Host "  -> Copying updated API binaries..." -ForegroundColor Yellow
    robocopy $binariesSource $target.BackendFolderPath /E /R:2 /W:1 /XF "appsettings.json" "appsettings.Production.json" "appsettings.Development.json" "license.lic" "web.config" /XD "logs" "uploads" "wwwroot" | Out-Null

    # 3. Start IIS AppPool
    if (![string]::IsNullOrWhiteSpace($target.IISAppPoolName)) {
        Write-Host "  -> Starting IIS AppPool: $($target.IISAppPoolName)..." -ForegroundColor Green
        try {
            cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"$($target.IISAppPoolName)`"" 2>$null
        } catch {}
    }

    Write-Host "  -> [SUCCESS] Backend updated for $($target.SansthaName)!" -ForegroundColor Green
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "        ALL ENABLED BACKEND TARGETS UPDATED SUCCESSFULLY!   " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
pause
'@

Set-Content -Path (Join-Path $outputDir "apply_backend_patch.ps1") -Value $applyScript -Encoding UTF8

# Clean temp directory
Remove-Item -Recurse -Force $tempPublish -ErrorAction SilentlyContinue

Write-Host "  -> Patch generated at: $outputDir" -ForegroundColor Green
Write-Host "  -> Contains:" -ForegroundColor White
Write-Host "     1. binaries/ (Compiled .NET 10 Web API DLLs)" -ForegroundColor Gray
Write-Host "     2. backend_patch_config.json (Folder & AppPool configuration)" -ForegroundColor Gray
Write-Host "     3. apply_backend_patch.ps1 (One-click server installer)" -ForegroundColor Gray

# 4. If requested to apply immediately
if ($ApplyLocal) {
    Write-Host "`n[4/4] Applying patch immediately..." -ForegroundColor Yellow
    & (Join-Path $outputDir "apply_backend_patch.ps1")
} else {
    Write-Host "`n[4/4] Done! You can now edit 'tools\backend_patch_config.json' and deploy." -ForegroundColor Cyan
}
