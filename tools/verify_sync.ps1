param(
    [string]$TargetDb = "SmartBanking_SyncVerification"
)

$ErrorActionPreference = "Stop"

Write-Host "Preparing test sync script for Target DB [$TargetDb]..." -ForegroundColor Cyan

$content = [System.IO.File]::ReadAllText("tools\Universal_Schema_Only_Sync.sql")
$testContent = $content.Replace("[YOUR_TARGET_DATABASE_NAME]", "[$TargetDb]")

$tempScript = "tools\temp_execute_sync.sql"
[System.IO.File]::WriteAllText($tempScript, $testContent, [System.Text.Encoding]::UTF8)

Write-Host "Executing sync on [$TargetDb] via sqlcmd..." -ForegroundColor Cyan
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$proc = Start-Process -FilePath "sqlcmd" -ArgumentList "-S . -E -i `"$tempScript`" -b" -NoNewWindow -Wait -PassThru

$sw.Stop()

if ($proc.ExitCode -ne 0) {
    Write-Host "Sync failed with exit code: $($proc.ExitCode)" -ForegroundColor Red
} else {
    Write-Host "Sync executed successfully in $($sw.Elapsed.TotalSeconds) seconds!" -ForegroundColor Green
}

# Cleanup temp script
if (Test-Path $tempScript) {
    Remove-Item $tempScript -Force
}
