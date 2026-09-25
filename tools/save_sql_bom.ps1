$utf8Bom = New-Object System.Text.UTF8Encoding($true)

$files = @(
    "d:\Bhisi Software\tools\master_vps_update_schema.sql",
    "d:\Bhisi Software\patches\patch_migrate_saving_accounts_14digit.sql"
)

foreach ($f in $files) {
    if (Test-Path $f) {
        $content = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
        [System.IO.File]::WriteAllText($f, $content, $utf8Bom)
        Write-Host "$f saved with UTF-8 BOM!" -ForegroundColor Green
    }
}
