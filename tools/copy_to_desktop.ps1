$src = "d:\Bhisi Software\SmartBanking_VPS_All_In_One_Patch.zip"
$desktop = [Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)
$dest = Join-Path $desktop "SmartBanking_VPS_All_In_One_Patch.zip"
Copy-Item $src $dest -Force
Write-Host "COPIED TO DESKTOP: $dest" -ForegroundColor Green
