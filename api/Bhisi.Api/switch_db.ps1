# Easy database toggle script: switch between Main database and Test database
param(
    [string]$Target = "test" # Use 'test' for SmartBanking_ShareTest or 'main' for SmartBanking
)

$appsettingsPath = Join-Path $PSScriptRoot "appsettings.json"
$content = Get-Content $appsettingsPath -Raw

if ($Target.ToLower() -eq "main") {
    $updated = $content -replace "Database=SmartBanking_ShareTest", "Database=SmartBanking"
    Set-Content -Path $appsettingsPath -Value $updated
    Write-Host "Active database switched to MAIN: SmartBanking" -ForegroundColor Green
} else {
    $updated = $content -replace "Database=SmartBanking;", "Database=SmartBanking_ShareTest;"
    Set-Content -Path $appsettingsPath -Value $updated
    Write-Host "Active database switched to TEST: SmartBanking_ShareTest" -ForegroundColor Cyan
}
