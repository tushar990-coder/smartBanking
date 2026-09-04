# Test posting branch payload to API
$body = @{
    branchCode = "01"
    branchName = "मेन शाखा"
    branchType = "HeadOffice"
    address = "सांगली"
    ifscCode = "IFSC0000001"
    mobileNo = "7788994455"
    email = "mindspaceconsultancy2026@gmail.com"
    isActive = $true
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "http://localhost:5242/api/Branches" -Method Post -Body $body -ContentType "application/json"
    Write-Host "Success:" ($res | ConvertTo-Json)
} catch {
    Write-Host "Failed with status code:" $_.Exception.Response.StatusCode
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Response Body:" $reader.ReadToEnd()
}
