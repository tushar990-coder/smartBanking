$path = "d:\Bhisi Software\VPS_All_In_One_Patch\database\update_schema.sql"
$bytes = [System.IO.File]::ReadAllBytes($path)
Write-Host ("Total bytes: " + $bytes.Length)
Write-Host ("First 3 bytes (Hex): " + $bytes[0].ToString("X2") + " " + $bytes[1].ToString("X2") + " " + $bytes[2].ToString("X2"))

if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "Encoding: UTF-8 WITH BOM (Perfect for sqlcmd & Unicode Devanagari)" -ForegroundColor Green
} elseif ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
    Write-Host "Encoding: UTF-16 LE WITH BOM (Perfect for sqlcmd & Unicode Devanagari)" -ForegroundColor Green
} else {
    Write-Host "Encoding: UTF-8 WITHOUT BOM (Needs BOM to guarantee sqlcmd Unicode preservation)" -ForegroundColor Yellow
}
