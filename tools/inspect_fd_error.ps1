$loginPayload = @{ username = 'admin'; password = 'Shri@2026' } | ConvertTo-Json
$token = (Invoke-RestMethod -Uri 'http://localhost:5242/api/Auth/login' -Method Post -Body $loginPayload -ContentType 'application/json').token

$fd = @{
    branchID        = 1
    customerID      = 1
    fdSchemeID      = 1
    depositAmount   = 50000
    paymentMode     = "Cash"
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri 'http://localhost:5242/api/FdAccounts' -Method Post -Body $fd -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json'
    Write-Host "Success: $($res | ConvertTo-Json -Compress)"
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "API Error Body: $($reader.ReadToEnd())"
}
