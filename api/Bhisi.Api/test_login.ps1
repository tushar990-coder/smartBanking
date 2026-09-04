$body = @{ username = "admin"; password = "admin123" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:5242/api/Auth/login" -Method Post -Body $body -ContentType "application/json"
Write-Host "Login API Success! Token received:" -ForegroundColor Green
$response | Format-List
