$path = "d:\Bhisi Software\tools\master_vps_update_schema.sql"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($path, $content, $utf8Bom)
Write-Host "master_vps_update_schema.sql saved with UTF-8 BOM!" -ForegroundColor Green
