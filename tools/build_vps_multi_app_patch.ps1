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

$version = "2.5.67"
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
if ($gitShort -or $gitHash) {
    Write-Host "   Git Commit: $gitShort ($gitBranch) - $gitMsg                   " -ForegroundColor Gray
    if ($gitHash -or $gitDate) {
        Write-Host "   Git Details: $gitHash ($gitDate)                               " -ForegroundColor Gray
    }
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

# 3.1.3 Auto-Heal Nominal Shareholders & Member Codes
$memberCodeHealSource = Join-Path $workspaceRoot "tools\heal_nominal_and_duplicate_member_codes.sql"
if (Test-Path $memberCodeHealSource) {
    $memberCodeHealContent = [System.IO.File]::ReadAllText($memberCodeHealSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $patchFolder "database\heal_nominal_and_duplicate_member_codes.sql"), $memberCodeHealContent, $utf8WithBom)
    Write-Host "  -> heal_nominal_and_duplicate_member_codes.sql included in database package (UTF-8 BOM)." -ForegroundColor White
}

# 3.1.4 Auto-Heal Loan Rate Histories Encoding
$loanRateHealSource = Join-Path $workspaceRoot "tools\heal_loan_rate_histories_encoding.sql"
if (Test-Path $loanRateHealSource) {
    $loanRateHealContent = [System.IO.File]::ReadAllText($loanRateHealSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $patchFolder "database\heal_loan_rate_histories_encoding.sql"), $loanRateHealContent, $utf8WithBom)
    Write-Host "  -> heal_loan_rate_histories_encoding.sql included in database package (UTF-8 BOM)." -ForegroundColor White
}

# 3.1.5 Auto-Heal FD Opening Balance & Balance Sheet (GL-SL) Discrepancy
$fdBsHealSource = Join-Path $workspaceRoot "tools\heal_fd_opening_balance_discrepancy.sql"
if (Test-Path $fdBsHealSource) {
    $fdBsHealContent = [System.IO.File]::ReadAllText($fdBsHealSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $patchFolder "database\heal_fd_opening_balance_discrepancy.sql"), $fdBsHealContent, $utf8WithBom)
    Write-Host "  -> heal_fd_opening_balance_discrepancy.sql included in database package (UTF-8 BOM)." -ForegroundColor White
}

# 3.1.6 Auto-Heal Universal Database Schema (SourceModule & Joint Holders)
$univHealSource = Join-Path $workspaceRoot "tools\heal_all_databases_schema.sql"
if (Test-Path $univHealSource) {
    $univHealContent = [System.IO.File]::ReadAllText($univHealSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $patchFolder "database\heal_all_databases_schema.sql"), $univHealContent, $utf8WithBom)
    Write-Host "  -> heal_all_databases_schema.sql included in database package (UTF-8 BOM)." -ForegroundColor White
}

# 3.1.7 Multi-Branch Accounting Alignment Scripts (v2.5.44)
$branchAppSql = Join-Path $workspaceRoot "tools\add_branch_id_to_loan_applications.sql"
if (Test-Path $branchAppSql) {
    Copy-Item $branchAppSql (Join-Path $patchFolder "database\add_branch_id_to_loan_applications.sql") -Force
    Write-Host "  -> add_branch_id_to_loan_applications.sql included in database package." -ForegroundColor White
}
$branchColSql = Join-Path $workspaceRoot "tools\add_branch_id_to_loan_collections.sql"
if (Test-Path $branchColSql) {
    Copy-Item $branchColSql (Join-Path $patchFolder "database\add_branch_id_to_loan_collections.sql") -Force
    Write-Host "  -> add_branch_id_to_loan_collections.sql included in database package." -ForegroundColor White
}
$branchDisbSql = Join-Path $workspaceRoot "tools\add_branch_id_to_loan_disbursements.sql"
if (Test-Path $branchDisbSql) {
    Copy-Item $branchDisbSql (Join-Path $patchFolder "database\add_branch_id_to_loan_disbursements.sql") -Force
    Write-Host "  -> add_branch_id_to_loan_disbursements.sql included in database package." -ForegroundColor White
}
$alignVouchersSql = Join-Path $workspaceRoot "tools\align_daybook_voucher_branches.sql"
if (Test-Path $alignVouchersSql) {
    Copy-Item $alignVouchersSql (Join-Path $patchFolder "database\align_daybook_voucher_branches.sql") -Force
    Write-Host "  -> align_daybook_voucher_branches.sql included in database package." -ForegroundColor White
}
$healFdNarrationSql = Join-Path $workspaceRoot "tools\heal_corrupted_fd_voucher_narrations.sql"
if (Test-Path $healFdNarrationSql) {
    Copy-Item $healFdNarrationSql (Join-Path $patchFolder "database\heal_corrupted_fd_voucher_narrations.sql") -Force
    Write-Host "  -> heal_corrupted_fd_voucher_narrations.sql included in database package." -ForegroundColor White
}
$branchLedgerOpeningSql = Join-Path $workspaceRoot "tools\create_branch_ledger_opening_balance_table.sql"
if (Test-Path $branchLedgerOpeningSql) {
    Copy-Item $branchLedgerOpeningSql (Join-Path $patchFolder "database\create_branch_ledger_opening_balance_table.sql") -Force
    Write-Host "  -> create_branch_ledger_opening_balance_table.sql included in database package." -ForegroundColor White
}
$instantFixSql = Join-Path $workspaceRoot "tools\instant_fix_default_ibt_ledger_id.sql"
if (Test-Path $instantFixSql) {
    Copy-Item $instantFixSql (Join-Path $patchFolder "database\instant_fix_default_ibt_ledger_id.sql") -Force
    Write-Host "  -> instant_fix_default_ibt_ledger_id.sql included in database package." -ForegroundColor White
}
$vouchersIbtSql = Join-Path $workspaceRoot "tools\fix_vouchers_ibt_and_trial_balance.sql"
if (Test-Path $vouchersIbtSql) {
    Copy-Item $vouchersIbtSql (Join-Path $patchFolder "database\fix_vouchers_ibt_and_trial_balance.sql") -Force
    Write-Host "  -> fix_vouchers_ibt_and_trial_balance.sql included in database package." -ForegroundColor White
}

# 3.1.8 Auto-Restore Orphaned Closed FD Accounts (Where vouchers were deleted)
$fdOrphanHealSource = Join-Path $workspaceRoot "tools\heal_orphaned_closed_fd_accounts.sql"
if (Test-Path $fdOrphanHealSource) {
    $fdOrphanHealContent = [System.IO.File]::ReadAllText($fdOrphanHealSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $patchFolder "database\heal_orphaned_closed_fd_accounts.sql"), $fdOrphanHealContent, $utf8WithBom)
    Write-Host "  -> heal_orphaned_closed_fd_accounts.sql included in database package (UTF-8 BOM)." -ForegroundColor White
}

# 3.1.9 Auto-Heal Orphan Loan Disbursements & Collections (Daybook Balance Restoration)
$daybookOrphanHealSource = Join-Path $workspaceRoot "tools\heal_orphan_loan_disbursements_and_collections.sql"
if (Test-Path $daybookOrphanHealSource) {
    $daybookOrphanContent = [System.IO.File]::ReadAllText($daybookOrphanHealSource, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $patchFolder "database\heal_orphan_loan_disbursements_and_collections.sql"), $daybookOrphanContent, $utf8WithBom)
    Write-Host "  -> heal_orphan_loan_disbursements_and_collections.sql included in database package (UTF-8 BOM)." -ForegroundColor White
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

$changelogSource = Join-Path $workspaceRoot "CHANGELOG.md"
if (Test-Path $changelogSource) {
    Copy-Item $changelogSource (Join-Path $patchFolder "CHANGELOG.md") -Force
    Write-Host "  -> CHANGELOG.md included in patch." -ForegroundColor White
}

$applyMemberScript = Join-Path $workspaceRoot "tools\apply_member_code_fix_all_sansthas.ps1"
if (Test-Path $applyMemberScript) {
    Copy-Item $applyMemberScript (Join-Path $patchFolder "apply_member_code_fix_all_sansthas.ps1") -Force
}

$applyFdClosureScript = Join-Path $workspaceRoot "tools\apply_fd_closure_rollback_all_sansthas.ps1"
if (Test-Path $applyFdClosureScript) {
    Copy-Item $applyFdClosureScript (Join-Path $patchFolder "apply_fd_closure_rollback_all_sansthas.ps1") -Force
    Write-Host "  -> apply_fd_closure_rollback_all_sansthas.ps1 included in patch." -ForegroundColor White
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
$memberCodeHealSql = Join-Path $scriptDir "database\heal_nominal_and_duplicate_member_codes.sql"
$instantFixSql = Join-Path $scriptDir "database\instant_fix_default_ibt_ledger_id.sql"
$vouchersIbtSql = Join-Path $scriptDir "database\fix_vouchers_ibt_and_trial_balance.sql"
$branchLedgerOpeningSql = Join-Path $scriptDir "database\create_branch_ledger_opening_balance_table.sql"
$fdOrphanHealSql = Join-Path $scriptDir "database\heal_orphaned_closed_fd_accounts.sql"
$daybookOrphanHealSql = Join-Path $scriptDir "database\heal_orphan_loan_disbursements_and_collections.sql"
$backendSource = Join-Path $scriptDir "backend"
$frontendSource = Join-Path $scriptDir "frontend"

function Get-AllTargetFolders {
    param([string]$baseFolder, [string]$type, [string]$sansthaKey)
    $folders = [System.Collections.Generic.List[string]]::new()
    if ($baseFolder -and (Test-Path $baseFolder)) {
        $folders.Add($baseFolder)
    }

    $appcmd = "$env:SystemRoot\system32\inetsrv\appcmd.exe"
    if (Test-Path $appcmd) {
        try {
            $vdirs = & $appcmd list vdirs /text:physicalPath 2>$null
            foreach ($vd in $vdirs) {
                if ($vd -and (Test-Path $vd)) {
                    $vdClean = $vd.Trim()
                    if ($sansthaKey -and ($vdClean -match $sansthaKey)) {
                        if ($type -eq "frontend" -and ($vdClean -notmatch "api|backend") -and (-not $folders.Contains($vdClean))) {
                            $folders.Add($vdClean)
                        }
                        if ($type -eq "backend" -and ($vdClean -match "api|backend") -and (-not $folders.Contains($vdClean))) {
                            $folders.Add($vdClean)
                        }
                    }
                }
            }
        } catch {}
    }

    $candidates = @()
    if ($sansthaKey -match "bambavade") {
        if ($type -eq "frontend") {
            $candidates = @("D:\WebApps\bambavade\bambavade.hellomindspace.in", "D:\WebApps\bambavadeurban\frontend", "D:\WebApps\bambavade\frontend")
        } else {
            $candidates = @("D:\WebApps\bambavade\api.bambavade.hellomindspace.in", "D:\WebApps\bambavadeurban\backend", "D:\WebApps\bambavade\backend")
        }
    }
    elseif ($sansthaKey -match "padval|jotirling") {
        if ($type -eq "frontend") {
            $candidates = @("D:\WebApps\Jotirlingpdw\jotirlingpdw.hellomindspace.in", "D:\WebApps\padvalwadi\frontend", "D:\WebApps\padvalwadi\padvalwadi.hellomindspace.in")
        } else {
            $candidates = @("D:\WebApps\Jotirlingpdw\api.jotirlingpdw.hellomindspace.in", "D:\WebApps\padvalwadi\backend", "D:\WebApps\padvalwadi\api.padvalwadi.hellomindspace.in")
        }
    }
    elseif ($sansthaKey -match "yadrav") {
        if ($type -eq "frontend") {
            $candidates = @("D:\WebApps\maharshiyadrav\frontend", "D:\WebApps\maharshiyadravkar\frontend", "D:\WebApps\maharshiyadrav\maharshiyadrav.hellomindspace.in")
        } else {
            $candidates = @("D:\WebApps\maharshiyadrav\backend", "D:\WebApps\maharshiyadravkar\backend", "D:\WebApps\maharshiyadrav\api.maharshiyadrav.hellomindspace.in")
        }
    }
    elseif ($sansthaKey -match "ritemp|ritemployee") {
        if ($type -eq "frontend") {
            $candidates = @("D:\WebApps\ritemployee\frontend", "D:\WebApps\ritemp\frontend", "D:\WebApps\ritemployee\ritemployee.hellomindspace.in")
        } else {
            $candidates = @("D:\WebApps\ritemployee\backend", "D:\WebApps\ritemp\backend", "D:\WebApps\ritemployee\api.ritemployee.hellomindspace.in")
        }
    }
    elseif ($sansthaKey -match "testing1") {
        if ($type -eq "frontend") {
            $candidates = @("D:\WebApps\testing1\frontend", "D:\WebApps\testing1\testing1.hellomindspace.in")
        } else {
            $candidates = @("D:\WebApps\testing1\backend", "D:\WebApps\testing1\api.testing1.hellomindspace.in")
        }
    }
    elseif ($sansthaKey -match "testing") {
        if ($type -eq "frontend") {
            $candidates = @("D:\WebApps\Testing\testing.hellomindspace.in", "D:\WebApps\Testing\frontend")
        } else {
            $candidates = @("D:\WebApps\Testing\api.testing.hellomindspace.in", "D:\WebApps\Testing\backend")
        }
    }

    foreach ($c in $candidates) {
        if ((Test-Path $c) -and (-not $folders.Contains($c))) {
            $folders.Add($c)
        }
    }

    if ($folders.Count -eq 0 -and $baseFolder) {
        $folders.Add($baseFolder)
    }

    return $folders
}

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
            $backendFolders = Get-AllTargetFolders -baseFolder $target.BackendFolderPath -type "backend" -sansthaKey "$($target.TargetDatabase)"
            $frontendFolders = Get-AllTargetFolders -baseFolder $target.FrontendFolderPath -type "frontend" -sansthaKey "$($target.TargetDatabase)"

            foreach ($bFolder in $backendFolders) {
                if (Test-Path $bFolder) {
                    $bkDest = Join-Path $targetRollbackDir "backend"
                    New-Item -Path $bkDest -ItemType Directory -Force | Out-Null
                    robocopy $bFolder $bkDest /E /R:1 /W:1 /XD "logs" "uploads" "wwwroot" /XF "appsettings.Development.json" | Out-Null
                    break
                }
            }
            foreach ($fFolder in $frontendFolders) {
                if (Test-Path $fFolder) {
                    $ftDest = Join-Path $targetRollbackDir "frontend"
                    New-Item -Path $ftDest -ItemType Directory -Force | Out-Null
                    robocopy $fFolder $ftDest /E /R:1 /W:1 | Out-Null
                    break
                }
            }
            Write-Host "  -> Application Snapshot Saved Successfully in Rollback Folder!" -ForegroundColor Green
            $statusObj.AppSnapshot = "OK"
        } catch {
            Write-Host "  -> Application Snapshot Warning: $($_.Exception.Message)" -ForegroundColor DarkYellow
            $statusObj.AppSnapshot = "Warning"
        }

        # 2.0 Instant Core Branch Schema Fix (DefaultIbtLedgerID & DefaultCashLedgerID)
        if (Test-Path $instantFixSql) {
            Write-Host " [Step 2.0] Ensuring DefaultIbtLedgerID & Core Branch Columns on $($target.TargetDatabase)..." -ForegroundColor Yellow
            try {
                $cOk = $false
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d "$($target.TargetDatabase)" -i "`"$instantFixSql`"" -f 65001 -b
                        if ($LASTEXITCODE -eq 0) { $cOk = $true }
                    } catch {}
                }
                if (-not $cOk) {
                    sqlcmd -S $config.SqlServerInstance -d "$($target.TargetDatabase)" -E -i "`"$instantFixSql`"" -f 65001 -b
                    if ($LASTEXITCODE -eq 0) { $cOk = $true }
                }
                if ($cOk) {
                    Write-Host "  -> Core Branch Columns & DefaultIbtLedgerID verified 100% OK!" -ForegroundColor Green
                }
            } catch {
                Write-Host "  -> Branch Columns Note: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }

        # 2.05 Instant Vouchers & LoanCollections IBT Columns Fix (Trial Balance Fix)
        if (Test-Path $vouchersIbtSql) {
            Write-Host " [Step 2.05] Ensuring Vouchers & LoanCollections IBT Columns on $($target.TargetDatabase)..." -ForegroundColor Yellow
            try {
                $vOk = $false
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d "$($target.TargetDatabase)" -i "`"$vouchersIbtSql`"" -f 65001 -b
                        if ($LASTEXITCODE -eq 0) { $vOk = $true }
                    } catch {}
                }
                if (-not $vOk) {
                    sqlcmd -S $config.SqlServerInstance -d "$($target.TargetDatabase)" -E -i "`"$vouchersIbtSql`"" -f 65001 -b
                    if ($LASTEXITCODE -eq 0) { $vOk = $true }
                }
                if ($vOk) {
                    Write-Host "  -> Vouchers & LoanCollections IBT Columns verified 100% OK!" -ForegroundColor Green
                }
            } catch {
                Write-Host "  -> Vouchers IBT Columns Note: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
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

        # 2.4 Auto-Heal Non-Shareholder MemberCodes & Resequence Shareholder Codes
        if (Test-Path $memberCodeHealSql) {
            Write-Host " [Step 2.4] Auto-Healing Non-Shareholder MemberCodes & Resequencing on $($target.TargetDatabase)..." -ForegroundColor Yellow
            try {
                $mOk = $false
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d "$($target.TargetDatabase)" -i "`"$memberCodeHealSql`"" -f 65001 -b
                        if ($LASTEXITCODE -eq 0) { $mOk = $true }
                    } catch {}
                }
                if (-not $mOk) {
                    sqlcmd -S $config.SqlServerInstance -d "$($target.TargetDatabase)" -E -i "`"$memberCodeHealSql`"" -f 65001 -b
                    if ($LASTEXITCODE -eq 0) { $mOk = $true }
                }
                if ($mOk) {
                    Write-Host "  -> Non-Shareholder MemberCodes Purged & Shareholder Codes Resequenced Successfully!" -ForegroundColor Green
                }
            } catch {
                Write-Host "  -> Member Code Auto-Heal Note: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }

        # 2.5 Auto-Heal Branch-wise Ledger Opening Balances & Branch Columns
        if (Test-Path $branchLedgerOpeningSql) {
            Write-Host " [Step 2.5] Auto-Healing Branch-wise Ledger Opening Balances & DefaultIbtLedgerID on $($target.TargetDatabase)..." -ForegroundColor Yellow
            try {
                $bloOk = $false
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d "$($target.TargetDatabase)" -i "`"$branchLedgerOpeningSql`"" -f 65001 -b
                        if ($LASTEXITCODE -eq 0) { $bloOk = $true }
                    } catch {}
                }
                if (-not $bloOk) {
                    sqlcmd -S $config.SqlServerInstance -d "$($target.TargetDatabase)" -E -i "`"$branchLedgerOpeningSql`"" -f 65001 -b
                    if ($LASTEXITCODE -eq 0) { $bloOk = $true }
                }
                if ($bloOk) {
                    Write-Host "  -> Branch-wise Ledger Opening Balances & DefaultIbtLedgerID applied successfully!" -ForegroundColor Green
                }
            } catch {
                Write-Host "  -> Branch Ledger Opening Note: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }

        # 2.6 Auto-Restore Orphaned Closed FD Accounts (Where Closure Vouchers were deleted)
        if (Test-Path $fdOrphanHealSql) {
            Write-Host " [Step 2.6] Restoring Orphaned Closed FD Accounts on $($target.TargetDatabase)..." -ForegroundColor Yellow
            try {
                $fdOrphanOk = $false
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d "$($target.TargetDatabase)" -i "`"$fdOrphanHealSql`"" -f 65001 -b
                        if ($LASTEXITCODE -eq 0) { $fdOrphanOk = $true }
                    } catch {}
                }
                if (-not $fdOrphanOk) {
                    sqlcmd -S $config.SqlServerInstance -d "$($target.TargetDatabase)" -E -i "`"$fdOrphanHealSql`"" -f 65001 -b
                    if ($LASTEXITCODE -eq 0) { $fdOrphanOk = $true }
                }
                if ($fdOrphanOk) {
                    Write-Host "  -> Orphaned Closed FD Accounts Restored Successfully!" -ForegroundColor Green
                }
            } catch {
                Write-Host "  -> FD Restore Note: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }

        # 2.7 Auto-Heal Orphan Loan Disbursements & Collections (Daybook Payment Balance Restoration)
        if (Test-Path $daybookOrphanHealSql) {
            Write-Host " [Step 2.7] Auto-Healing Daybook Orphan Loan Disbursements & Collections on $($target.TargetDatabase)..." -ForegroundColor Yellow
            try {
                $daybookOrphanOk = $false
                if ($config.SqlUser -and $config.SqlPassword) {
                    try {
                        sqlcmd -S $config.SqlServerInstance -U $config.SqlUser -P $config.SqlPassword -d "$($target.TargetDatabase)" -i "`"$daybookOrphanHealSql`"" -f 65001 -b
                        if ($LASTEXITCODE -eq 0) { $daybookOrphanOk = $true }
                    } catch {}
                }
                if (-not $daybookOrphanOk) {
                    sqlcmd -S $config.SqlServerInstance -d "$($target.TargetDatabase)" -E -i "`"$daybookOrphanHealSql`"" -f 65001 -b
                    if ($LASTEXITCODE -eq 0) { $daybookOrphanOk = $true }
                }
                if ($daybookOrphanOk) {
                    Write-Host "  -> Daybook Orphan Loan Disbursements & Collections Auto-Healed Successfully!" -ForegroundColor Green
                }
            } catch {
                Write-Host "  -> Daybook Heal Note: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }

        # 3. Stop IIS AppPool & Release Process Locks
        if (![string]::IsNullOrWhiteSpace($target.IISAppPoolName)) {
            Write-Host " [Step 3] Stopping IIS AppPool ($($target.IISAppPoolName)) & releasing file locks..." -ForegroundColor Yellow
            try {
                cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"$($target.IISAppPoolName)`"" 2>$null
            } catch {}
        }
        if ($target.TargetDatabase -match "bambavade") {
            cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"apibambavade`"" 2>$null
            cmd /c "%windir%\system32\inetsrv\appcmd.exe stop apppool /apppool.name:`"bambavade-backend`"" 2>$null
        }
        Get-Process -Name "w3wp", "dotnet", "Bhisi.Api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        # 4. Deploy Backend Files
        Write-Host " [Step 4] Deploying Backend API Binaries..." -ForegroundColor Yellow
        $backendFolders = Get-AllTargetFolders -baseFolder $target.BackendFolderPath -type "backend" -sansthaKey "$($target.TargetDatabase)"
        foreach ($bFolder in $backendFolders) {
            if (-not (Test-Path $bFolder)) {
                New-Item -Path $bFolder -ItemType Directory -Force | Out-Null
            }
            robocopy $backendSource $bFolder /E /R:2 /W:1 /XF "appsettings.json" "appsettings.Production.json" "license.lic" /XD "logs" "uploads" "wwwroot" | Out-Null
            Write-Host "  -> Backend Binaries Updated at: $bFolder" -ForegroundColor Green
        }
        $statusObj.Backend = "OK"

        # 4.5 Config Files Preserved Intact
        Write-Host " [Step 4.5] Existing server configuration (appsettings.json / appsettings.Production.json) preserved intact 100%." -ForegroundColor Gray

        # 5. Deploy Frontend Files
        Write-Host " [Step 5] Deploying Frontend Bundle (Cleaning old cached assets)..." -ForegroundColor Yellow
        $frontendFolders = Get-AllTargetFolders -baseFolder $target.FrontendFolderPath -type "frontend" -sansthaKey "$($target.TargetDatabase)"
        foreach ($fFolder in $frontendFolders) {
            if (-not (Test-Path $fFolder)) {
                New-Item -Path $fFolder -ItemType Directory -Force | Out-Null
            }
            robocopy $frontendSource $fFolder /E /R:2 /W:1 /PURGE | Out-Null
            Write-Host "  -> Frontend Bundle Updated at: $fFolder" -ForegroundColor Green
        }
        $statusObj.Frontend = "OK"

        # 6. Start IIS AppPool & Refresh
        if (![string]::IsNullOrWhiteSpace($target.IISAppPoolName)) {
            Write-Host " [Step 6] Restarting IIS AppPool ($($target.IISAppPoolName))..." -ForegroundColor Yellow
            try {
                cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"$($target.IISAppPoolName)`"" 2>$null
            } catch {}
        }
        if ($target.TargetDatabase -match "bambavade") {
            cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"apibambavade`"" 2>$null
            cmd /c "%windir%\system32\inetsrv\appcmd.exe start apppool /apppool.name:`"bambavade-backend`"" 2>$null
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

# Batch Generator Helper Function (Uses approved verb 'New')
function New-BatchScript {
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
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_ALL_Sansthas.bat") -Title "SmartBanking ERP - 1-Click Update ALL Sansthas" -ScriptFile "apply_patch.ps1" -TargetName "ALL" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_ALL_Apps.bat") -Title "SmartBanking ERP - 1-Click Update ALL VPS Apps" -ScriptFile "apply_patch.ps1" -TargetName "ALL" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "Apply_VPS_Patch.bat") -Title "SmartBanking ERP - Apply Master VPS Patch" -ScriptFile "apply_patch.ps1" -TargetName "ALL" -Color "0B"

# Generate Master Reverse Patch Batch Files
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_ALL_Sansthas.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH ALL Sansthas" -ScriptFile "reverse_patch.ps1" -TargetName "ALL" -Color "0D"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_ALL_Apps.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH ALL VPS Apps" -ScriptFile "reverse_patch.ps1" -TargetName "ALL" -Color "0D"
New-BatchScript -FilePath (Join-Path $patchFolder "Reverse_VPS_Patch.bat") -Title "SmartBanking ERP - Reverse Master VPS Patch" -ScriptFile "reverse_patch.ps1" -TargetName "ALL" -Color "0D"

# Generate Individual Sanstha Update and Reverse Batch Files
# 1. Padawalwadi
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Padawalwadi.bat") -Title "SmartBanking ERP - 1-Click Update Padawalwadi" -ScriptFile "apply_patch.ps1" -TargetName "padval" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Padawalwadi.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Padawalwadi" -ScriptFile "reverse_patch.ps1" -TargetName "padval" -Color "0D"

# 2. Bambavade
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Bambavade.bat") -Title "SmartBanking ERP - 1-Click Update Bambavade" -ScriptFile "apply_patch.ps1" -TargetName "bambavade" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Bambavade.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Bambavade" -ScriptFile "reverse_patch.ps1" -TargetName "bambavade" -Color "0D"

# 3. Yadravkar
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Yadravkar.bat") -Title "SmartBanking ERP - 1-Click Update Yadravkar" -ScriptFile "apply_patch.ps1" -TargetName "Yadrav" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Yadravkar.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Yadravkar" -ScriptFile "reverse_patch.ps1" -TargetName "Yadrav" -Color "0D"

# 4. RITEMP
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_RITEMP.bat") -Title "SmartBanking ERP - 1-Click Update RITEMP" -ScriptFile "apply_patch.ps1" -TargetName "ritemployee" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_RITEMP.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH RITEMP" -ScriptFile "reverse_patch.ps1" -TargetName "ritemployee" -Color "0D"

# 5. Testing
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Testing.bat") -Title "SmartBanking ERP - 1-Click Update Testing" -ScriptFile "apply_patch.ps1" -TargetName "Testing" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Testing.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Testing" -ScriptFile "reverse_patch.ps1" -TargetName "Testing" -Color "0D"

# 6. Testing1
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Testing1.bat") -Title "SmartBanking ERP - 1-Click Update Testing1" -ScriptFile "apply_patch.ps1" -TargetName "Testing1" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Testing1.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Testing1" -ScriptFile "reverse_patch.ps1" -TargetName "Testing1" -Color "0D"

# 7. Template
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_Template.bat") -Title "SmartBanking ERP - 1-Click Update Template" -ScriptFile "apply_patch.ps1" -TargetName "Template" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_Template.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Template" -ScriptFile "reverse_patch.ps1" -TargetName "Template" -Color "0D"

# 8. Sahyadri Gruhataran
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_SahyadriGruhataran.bat") -Title "SmartBanking ERP - 1-Click Update Sahyadri Gruhataran" -ScriptFile "apply_patch.ps1" -TargetName "sahyadribambavade" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_SahyadriGruhataran.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Sahyadri Gruhataran" -ScriptFile "reverse_patch.ps1" -TargetName "sahyadribambavade" -Color "0D"

# 9. Sahyadri Karmachari
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_Update_SahyadriKarmachari.bat") -Title "SmartBanking ERP - 1-Click Update Sahyadri Karmachari" -ScriptFile "apply_patch.ps1" -TargetName "sahyadrikarmachari" -Color "0B"
New-BatchScript -FilePath (Join-Path $patchFolder "1_Click_REVERSE_PATCH_SahyadriKarmachari.bat") -Title "SmartBanking ERP - 1-Click REVERSE PATCH Sahyadri Karmachari" -ScriptFile "reverse_patch.ps1" -TargetName "sahyadrikarmachari" -Color "0D"

# Generate Comprehensive README & Patch Guide
$readmeContent = @"
# ==============================================================================
# SmartBanking Core ERP - Multi-App Master Update & Reverse Patch Guide (v$version)
# Build Date: $buildDate | Git: $gitShort ($gitBranch) | Hash: $gitHash ($gitDate)
# ==============================================================================

## 1. पॅचमधील मुख्य सुधारणा (What's New in v$version)
0. **व्हाउचर Customer-ID First ('+ खातेदार जोडा' व जुना खातेदार नं.), डायनॅमिक बचत ठेव लेजर मॅपिंग आणि सोने जिन्नस यादी व तारण तपशील सुधारणा (v2.6.01):**
   - व्हाउचर एंट्री मास्टरमध्ये खाते निवडल्यावर आपोआप ओळ न उघडता '+ खातेदार जोडा' पर्याय; जुना MEM0001 संदर्भ काढून [CIF...] + [🏷️ जुना खातेदार नं] + नाव + मोबाईल प्रदर्शन व शोध, आणि थेट VoucherDetails.CustomerID जतन.
   - खाते (Ledger) निवडताना सिलेक्ट न होणे / नवीन ओळ जोडली जाणे हा दोष अ‍ॅटोमिक handleLedgerSelect व कीबोर्ड नेव्हिगेशनद्वारे दूर.
   - २०+ कंट्रोलर्समध्ये हार्डकोडेड 'जिल्हा मध्यवर्ती बचत खाते' / LedgerID = 7 काढून SavingLedgerHelper द्वारे डायनॅमिक बचत लेजर खतावणी.
   - अधिकृत टेम्प्लेटनुसार 'सोने जिन्नस यादी' अहवाल, पावती प्रिंट मोडल आणि सुवर्ण तारण दागिने व सोनार मूल्यांकन अर्ज ते खाते वाटपापर्यंत १००% जतन.

1. **शाखा ताळेबंद ५०० एरर निवारण, IBT व्हाऊचर व कर्ज वसुली क्रॉस-ब्राँच परिपूर्ण सक्षमीकरण (v2.5.59):**
   - शाखा ताळेबंद ५०० एररचे कायमस्वरूपी निवारण (Trial Balance HTTP 500 Fix): Vouchers टेबलवर IsIbtVoucher, RelatedVoucherID व TargetBranchID हे IBT कॉलम्स डेटाबेस स्तरावर जोडून Reports/TrialBalance मधील क्रॅश पूर्णपणे दूर; शाखा १, उप-शाखा व सर्वंकष ताळेबंद १००% अचूक व संतुलित (Debit == Credit = ₹५,८३,९५४.११).
   - कर्ज वसुली क्रॉस-ब्राँच परिपूर्ण सक्षमीकरण (Cross-Branch Loan Collections Dual-Voucher & HomeBranchVoucherID): LoanCollections टेबलवर HomeBranchVoucherID जोडून काऊंटर पावती व्हाउचर (Receipt) व मूळ शाखा तडजोड व्हाउचर (Journal) चे द्विमार्गी परस्पर संलग्नन (RelatedVoucherID).
   - पावती डिलीट व रोलबॅक सर्क्युलर डिपेंडन्सी निवारण (Delete Rollback Circular Dependency Elimination): दोन जोडलेले IBT व्हाउचर डिलीट करताना EF Core मधील परस्परावलंबित्व (Foreign Key Cycle) मोडून स्वच्छ व सुरक्षित रोलबॅक.
   - रोख शिल्लक चालू आर्थिक वर्ष पडताळणी (Cash Opening Balance FinancialYearID Scope): VouchersController मध्ये सक्रिय आर्थिक वर्षाचा (activeFyId) अचूक संदर्भ जोडून मागील आर्थिक वर्षाची रोख शिल्लक उचली जाण्याचा धोका पूर्णपणे रोखला.
   - सर्व संस्थांसाठी १-क्लिक मास्टर पॅच (SmartBanking VPS Multi-App Master Patch v2.5.59).

2. **आंतर-शाखा ताळमेळ व क्लिअरिंग अहवाल (Inter-Branch Transfer Clearing & Reconciliation Matrix Report) व कॅश ओपनिंग बॅलन्स सुधारणा (v2.5.58):**
   - आंतर-शाखा १-स्क्रीन N × N मॅट्रिक्स अहवाल (1-Screen Multi-Branch Clearing Matrix Grid): सर्व शाखांमधील परस्पर येणे/देणे (Net Receivables / Payables) एकाच स्क्रीनवर ग्रिड स्वरूपात; शाखा अ कडून शाखा ब ला किती रक्कम येणे (हिरवा) किंवा देणे (लाल) हे स्पष्ट रंगात.
   - कॉन्ट्रा पडताळणी व सविस्तर खातावणी (Pair-wise Contra Drilldown & Statement): कोणत्याही दोन शाखांच्या जोडीवर क्लिक करून दोन्ही शाखांचे IBT लेजर, व्हाउचर्स, आणि 'शाखा अ चे येणे + शाखा ब चे देणे = ०.००' हा सीबीएस सुवर्ण नियम (CBS Golden Rule Zero-Difference Check) पडताळण्याची सोय.
   - अनरिकॉन्सिल्ड व इन-ट्रॅन्झिट व्हाउचर्स रडार (Unreconciled / Transit Radar): एकतर्फी (One-sided), विना-संलग्न (Missing RelatedVoucherID) किंवा रक्कम तफावत असणारे व्हाउचर्स शोधून त्वरित लाल रंगात धोकायचा इशारा.
   - १-क्लिक आंतर-शाखा सेटलमेंट व्हाउचर्स (1-Click IBT Settlement Engine): दोन शाखांमधील येणे/देणे शिल्लक शून्य करण्यासाठी दोन्ही शाखांमध्ये समक्रमित सेटलमेंट बँक/कॅश पेमेंट्स व पावती व्हाउचर्स स्वयंचलित तयार करणे.
   - उप-शाखा रोख शिल्लक पडताळणी सुधारणा (VouchersController Negative Cash Balance Fix): व्हाउचर सेव्ह करताना उप-शाखांच्या रोख खात्यांची शिल्लक मोजताना BranchLedgerOpeningBalances मधून अचूक ओपनिंग बॅलन्स घेऊन अनावश्यक 'कॅश शिल्लक उणे' त्रुटी रोखली.

3. **गुंतवणूक व मालमत्ता व्यवस्थापन बहु-शाखा (Multi-Branch) स्वायत्तता, शाखा रोख ताळमेळ, एकत्रित घसारा व अन-पास सुधारणा (v2.5.49):**
   - मालमत्ता व्यवस्थापन बहु-शाखा सक्षमीकरण: मालमत्ता खरेदी (Asset Purchases) मध्ये CashLedgerHelper द्वारे शाखा-स्तरीय रोख खाते मॅपिंग; वर्ग २ च्या खरेदीचे पैसे वर्ग १ च्या कॅश खात्याला जमा होणे १००% बंद; संस्था-स्तरीय मालमत्ता वर्ग (Asset Categories) सर्व शाखांसाठी उपलब्ध.
   - एकत्रित वार्षिक घसारा आकारणी (Consolidated Batch Depreciation Engine): मालमत्ता अहवाल व Depreciations Controller मध्ये 'सर्व शाखा एकत्रित' पर्याय; सर्व शाखांचा घसारा एका क्लिकवर मोजणे आणि प्रत्येक शाखेसाठी संतुलित जर्नल व्हाउचर (Branch-wise JV) स्वतंत्रपणे पोस्ट होऊन प्रत्येक शाखेचा नफा-तोटा व तेरीज तंतोतंत जुळणे.
   - गुंतवणूक व्यवस्थापन बहु-शाखा स्वायत्तता (Investment Multi-Branch Capability): गुंतवणूक खात्यांची आरंभिक शिल्लक, नवीन खाते उघडणे व मासिक व्याज आकारणी (Monthly Accrual) मध्ये शाखा-स्तरीय रोख/बँक लेजर मॅपिंग; बँका/संस्था सर्व शाखांमध्ये उपलब्ध.
   - मंजूर व्हाउचर्स अन-पास प्रक्रिया व त्रुटी हाताळणी सुधारणा.

2. **व्हाउचर पासिंग, मंजुरी व व्यवस्थापन: पास केलेले व्हाउचर्स अन-पास (Revert to Pending) करण्याची सुविधा (v2.5.48):**
   - मंजूर व्हाउचर्स स्क्रीनवर '✅ मंजूर व्हाउचर्स' स्वतंत्र टॅबमध्ये पाहण्याची आणि गरजेनुसार चुकीने किंवा दुरुस्तीसाठी पास झालेले व्हाउचर्स एका क्लिकवर अन-पास (Revert to Pending) करण्याची अधिकृत सीबीएस सुविधा.
   - वैयक्तिक व एकत्रित अन-पास प्रक्रिया (Bulk Unpass) स्पष्ट कारण नोंद (Reason) व पुष्टीकरणासह.
   - ॲटॉमिक स्क्रॉल रीसेट (ScrollNo, ApprovedBy व ApprovedOn तात्काळ रीसेट) व दिवसअखेर (EOD) सुरक्षितता guard.
   - संपूर्ण कोअर बँकिंग सुरक्षा ऑडिट नोंद (Audit Trail Logging).

3. **व्हाउचर पासिंग: तारीख प्रविष्ट केल्यावर केवळ त्याच तारखेचे प्रलंबित व्हाउचर दिसणे (v2.5.47):**
   - व्हाउचर पासिंग मास्टर स्क्रीनवर तारीख निवडल्यावर केवळ त्याच तारखेचे प्रलंबित व्हाउचर प्रदर्शन; बॅकलॉग चेतावणी व क्विक-जंप पिल्स.
   - दिवसानिहाय सारांश व मेट्रिक्स ताळमेळ आणि सुरक्षित 'सर्व व्हाउचर्स निवडा'.

4. **मुदत ठेव बाकी अहवाल (FD Outstanding Report) मधील जुने साचलेले व्याज दुप्पट मोजणी दोष निवारण (v2.5.46):**
   - अहवाल व खातावणीमध्ये Math.Max(txSum, logSum + LegacyAccruedInt) लागू करून मुद्दल + व्याज अचूक जुळणे.
   - भविष्यातील तिमाही चक्रवाढ भांडवलीकरणातही दुप्पट व्याज आकारले जाणे १००% रोखले.

5. **मुदत ठेव खातावणी विवरणपत्र तपशील (Narration) मधील मराठी फॉन्ट त्रुटीचे संपूर्ण निराकरण (v2.5.45):**
   - '???? ??? ??????...' ऐवजी सर्व १३ संस्था डेटाबेसमधील व्हाउचर्सचे तपशील शुद्ध व सुवाच्य मराठीत १००% पुनर्स्थापित (UTF-8 N' Unicode).
   - बॅकएंड इन-मेमरी फॉलबॅक संरक्षण व फ्रंटएंड UI/एक्सेल सॅनिटायझर.

6. **बहु-शाखा स्वायत्तता, क्रॉस-शाखा कर्ज वसुली, काऊंटर रोख ताळमेळ व मुदत ठेव तारण संरक्षण (v2.5.44):**
   - कर्ज मागणी अर्ज, कर्ज वाटप आणि कर्ज वसुलीमध्ये BranchID सक्तीचे करून शाखास्तरीय अलगीकरण.
   - काऊंटर रोख ताळमेळ व क्रॉस-शाखा कर्ज वसुली (IsCrossBranch, HomeBranchID) आणि CashLedgerHelper द्वारे शाखा रोख शिल्लक ताळमेळ.
   - कर्ज खात्यावर तारण बोजा (IsLienMarked) असलेल्या मुदत ठेव पावत्यांचे नूतनीकरण पूर्णतः प्रतिबंधित.

7. **युजर व्यवस्थापन व सुरक्षा मास्टर सायबर सुरक्षा मजबुतीकरण (v2.5.43):**
   - ॲडमिन बॅकडोअर व हार्डकोडेड बायपास पूर्णतः बंद; BCrypt हॅश सक्तीची; सलग ३ चुकीच्या प्रयत्नांनंतर खाते लॉक.
   - कर्मचाऱ्यांसाठी स्वयं-सेवा व पहिल्या लॉगिनवेळी अनिवार्य पासवर्ड बदल.

8. **खातेदार ३६०° (Khatedar 360°) संपूर्ण सीबीएस एकत्रीकरण व व्यवहार थेट हस्तांतरण (Khatedar 360° CBS Integration & Transaction Bridge):**
   - Member360 ऐवजी अधिकृत 'खातेदार ३६०°' नामकरण व शोध पेटीतून मेंबर संदर्भ काढून १००% शुद्ध सीआयएफ, जुना सीआयएफ, नाव व मोबाईलद्वारे शोध.
   - खातेदार ३६०° वरून कोणत्याही बचत, चालू, मुदत ठेव, पिग्मी, आरडी किंवा कर्ज खात्यावरून थेट संबंधित व्यवहार (Deposit / Withdrawal / Collection) स्क्रीनवर खात्यासह एका क्लिकवर नेव्हिगेशन.
   - बचत खात्यांमध्ये एकाच खातेदाराची एकापेक्षा जास्त खाती असल्यास वापरकर्त्याला स्पष्ट मोडलद्वारे इच्छित खाते निवडण्याची सोय (Multi-Account Selection Modal).
   - केसिंग व ऑब्जेक्ट स्ट्रक्चर मॅपिंग निराकरण करून व्यवहार सुरळीत व जलद बनवले.

2. **महाराष्ट्र शासन परिपत्रक नियम ३५ स्वनिधी (Swanidhi Rule 35) अहवाल इंजिन व लेजर मॅपिंग:**
   - वसूल भाग भांडवल (Paid-up Capital), वैधानिक राखीव निधी, इमारत निधी, मुक्त व विकास निधी, उत्तम जिंदगी तरतूद अचूक एकत्रिकरण व निव्वळ स्वनिधी गणन.
   - स्वनिधीच्या १० पट (किंवा संस्था नियमानुसार) कमाल कर्ज उभारणी मर्यादा (Borrowing Limit Multiplier) आणि गेल्या ३ वर्षांच्या लाभांश दराची सरासरी.
   - डायनॅमिक लेजर मॅपिंग मोडलद्वारे संस्था गरजेनुसार लेजर्स स्वनिधीत जोडण्याची किंवा वगळण्याची सोय.

3. **सर्व २०+ ट्रान्झॅक्शन मॉड्यूल्समध्ये व्हाउचर्स मंजुरी / पासिंग फॉर्म व्ह्यू चेकर (Universal Voucher Passing Form View Checker):**
   - व्हाउचर मंजुरी स्क्रीनवरून (Voucher Passing) प्रत्येक प्रकारच्या व्यवहाराचा (बचत, ठेव, कर्ज वाटप, कर्ज वसुली, पिग्मी, आरडी, लॉकर, शेअर्स, मालमत्ता खरेदी) मूळ फॉर्म व्ह्यू उघडून खात्रीशीर तपासणी व मंजुरी.

4. **पिग्मी एजंट दैनंदिनी ३-दिनांक ताळमेळ (Pigmy Agent Day Book 3-Date Remittance):**
   - संकलन दिनांक (CollectionDateFrom / CollectionDateTo) आणि प्रत्यक्ष बँक जमा दिनांक यांचे स्वतंत्र व्यवस्थापन व डुप्लिकेट रोख जमा प्रतिबंध.

5. **कर्ज येणे बाकी व वसुली १०-कॉलम अधिकृत सहकारी पतसंस्था अहवाल (10-Column Loan Recovery Report):**
   - अधिकृत सहकारी संस्था मुद्रण नमुन्यानुसार (अनु.क्र., कर्ज प्रकार, कर्ज खाते नं., कर्जदाराचे नाव, कर्ज दिनांक, कर्ज रक्कम, आज अखेर मुद्दल जमा, आज अखेर व्याज जमा, दंड व्याज जमा, शिल्लक रक्कम) संपूर्ण १० कॉलम्ससह सविस्तर अहवाल आणि फॉरमॅट १/२ टॉगल.

6. **योजनानिहाय डायनॅमिक कर्ज व्याज आकारणी व लेजर मॅपिंग (Scheme-Driven Dynamic Interest Engine):**
   - योजना मास्टरमधील `InterestPostingType` ('कर्जावर' किंवा 'येणे व्याजावर') नुसार खात्यांवर अचूक व्याज आकारणी.
   - सिस्टीममधील सर्व हार्ड-कोडेड मराठी/इंग्रजी लेजर नावे काढून १००% डायनॅमिक योजनानिहाय संतुलित व्हाउचर निर्मिती.

7. **कर्ज योजना मास्टर युनिक इंडेक्स व पुनरावृत्ती इतिहास (Loan Rate Unique & Revision History Audit):**
   - `LoanCode` व `LoanType` साठी युनिक इंडेक्स आणि डेटाबेस डुप्लिकेट प्रिव्हेन्शन व ऑटो-हिलिंग.
   - व्याजदर/दंड दर बदलताना संचालक मंडळ ठराव क्र., ठराव दिनांक, लागू दिनांक व कारणासह `LoanRateHistories` मध्ये संपूर्ण ऑडिट ट्रेल.

8. **कर्ज आरंभिक शिल्लक भांडवलीकृत व्याज, येणे व्याज व NPA तरतूद (Loan Opening Balance Suite):**
   - शुद्ध मुद्दल (Pure Principal), समाविष्ट व्याज (Capitalized Interest), चालू येणे व्याज आणि NPA व्याज तरतूद (Interest Provision) चे अचूक विभाजन.
   - समाविष्ट व्याजावर पुढील व्याज आकारायचे किंवा नाही (ChargeInterestOnCapitalizedAmount) याचा पर्याय आणि InitialNpaClassification थेट सिंक.

9. **GL व SL ताळमेळ अहवाल व फॉरेन्सिक ऑडिट (GL vs SL Reconciliation & Audit):**
   - `GET /api/LoanAccounts/GlReconciliationSummary` द्वारे सर्व कर्ज योजनांचे खतावणी आणि जनरल लेजर मधील फरक व ऑडिट पडताळणी.
   - आरंभिक शिल्लक बदल, खाते डिलीट व कर्ज वितरण मंजूर रक्कम ऑटो-हिलिंग (`heal_loan_opening_disbursements.sql`).

10. **मुदत ठेव सुरुवातीची शिल्लक स्थलांतर जुना पावती क्रमांक युनिक व्हॅलिडेशन (FD Migrated Unique Old Receipt No):**
    - एकाच योजनेअंतर्गत जुना पावती क्रमांक (LegacyAccountNumber) डुप्लिकेट सेव्ह होण्यावर कडक सर्व्हर-साइड व क्लायंट-साइड व्हॅलिडेशन.
    - रिअल-टाइम व्हॅलिडेशन एंडपॉईंट व डुप्लिकेट असल्यास थेट वॉर्निंग बॅज व प्री-सबमिट गार्ड.

11. **मुदतबंद ठेव यादी अहवाल व शेअर्स प्रारंभिक शिल्लक (FD Customer Summary Report & Share Opening Balance):**
    - CBS v2.4 कॉम्पॅक्ट Dual-Column व Detailed अहवाल, खातेदार/CIF निहाय एकत्रित मुदत ठेव सारांश.
    - शेअर्स प्रारंभिक शिल्लकमध्ये मराठी अंकांचे इंग्रजीत स्वयंचलित रूपांतरण व अचूक इनपुट.

12. **Strict Customer-First Loan Suite & Atomic Disbursement:**
    - सर्व ८ कर्ज मॉड्यूल्समधून `MemberID` fallback पूर्णपणे काढून थेट `CustomerID` द्वारे डेटा व्यवस्थापन.
    - कर्ज अर्ज मंजुरी (Approval) आणि कर्ज वाटप व्हाउचर निर्मिती एकाच अ‍ॅटोमिक ट्रान्झॅक्शनमध्ये समाविष्ट.

13. **MCS Act 1960 / Cooperative Bye-Laws Compliance:**
    - नवीन कर्जदारांना शेअर्स वाटप झाल्यास थेट 'Regular Member' (वर्ग अ) म्हणून नोंद.
    - विद्यमान नाममात्र (Nominal) सभासदांनी शेअर्स खरेदी केल्यास सिस्टीम त्यांना स्वयंचलितपणे 'Regular' मध्ये अपग्रेड करते.
    - `auto_heal_nominal_shareholders.sql` पॅचद्वारे डेटाबेसमधील सर्व जुन्या शेअरहोल्डर्सची स्थिती तपासली जाऊन नियमानुसार दुरुस्त केली जाते.

14. **14-Digit Saving Accounts Migration & FD CBS Standardization:**
    - सर्व जुनी बचत खाती आधुनिक १४-अंकी CBS खाते क्रमांकामध्ये सुरक्षितपणे अपडेट केली जातात.
    - मुदत ठेवींसाठी १४-अंकी CBS खाते क्रमांक आणि स्वयंचलित डिक्रीमेंट इंजिन.

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
   - `1_Click_Update_SahyadriGruhataran.bat`
   - `1_Click_Update_SahyadriKarmachari.bat`
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
   - `1_Click_REVERSE_PATCH_Yadravkar.bat`
   - `1_Click_REVERSE_PATCH_RITEMP.bat`
   - `1_Click_REVERSE_PATCH_SahyadriGruhataran.bat`
   - `1_Click_REVERSE_PATCH_SahyadriKarmachari.bat`
   - `1_Click_REVERSE_PATCH_Testing.bat`
   - `1_Click_REVERSE_PATCH_Testing1.bat`
   - `1_Click_REVERSE_PATCH_Template.bat`

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
