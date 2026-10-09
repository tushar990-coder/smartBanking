$loginBody = @{
    username = 'admin'
    password = 'Shri@2026'
    branchID = 1
    financialYearID = 1
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/Auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$token = $loginRes.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "=== 1. CHECK INITIAL REPORT SUMMARY ==="
$repInitial = Invoke-RestMethod -Uri 'http://localhost:5242/api/Reports/CustomerListReport' -Method Get
Write-Host "Total: $($repInitial.totalCustomers) | Verified: $($repInitial.kycVerifiedCount) | Pending: $($repInitial.kycPendingCount)"

Write-Host "`n=== 2. FETCH CUSTOMER 39 ==="
$c39 = Invoke-RestMethod -Uri 'http://localhost:5242/api/customers/39' -Method Get -Headers $headers
Write-Host "Customer 39: Name=$($c39.fullName), Current KYCStatus=$($c39.kycStatus)"

Write-Host "`n=== 3. UPDATE CUSTOMER 39 KYC STATUS TO 'Pending' ==="
$c39.kycStatus = 'Pending'
$c39.riskCategory = 'High'
$putBody = $c39 | ConvertTo-Json -Depth 5
$putRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/customers/39' -Method Put -Headers $headers -Body $putBody -ContentType 'application/json'
Write-Host "PUT Response: KYCStatus=$($putRes.kycStatus), RiskCategory=$($putRes.riskCategory)"

Write-Host "`n=== 4. CHECK REPORT SUMMARY AFTER UPDATE ==="
$repUpdated = Invoke-RestMethod -Uri 'http://localhost:5242/api/Reports/CustomerListReport' -Method Get
Write-Host "Total: $($repUpdated.totalCustomers) | Verified: $($repUpdated.kycVerifiedCount) | Pending: $($repUpdated.kycPendingCount)"

Write-Host "`n=== 5. QUERY REPORT FILTERED BY KYC 'Pending' ==="
$repPending = Invoke-RestMethod -Uri 'http://localhost:5242/api/Reports/CustomerListReport?kycStatus=Pending' -Method Get
Write-Host "Pending Filter Count: $($repPending.totalCustomers)"
foreach ($row in $repPending.rows) {
    Write-Host "  -> Row CIF: $($row.cifNo), Name: $($row.fullName), KYCStatus: $($row.kycStatus), Risk: $($row.riskCategory)"
}

Write-Host "`n=== 6. RESTORE CUSTOMER 39 KYC STATUS TO 'Verified' ==="
$c39.kycStatus = 'Verified'
$c39.riskCategory = 'Low'
$putBodyRestore = $c39 | ConvertTo-Json -Depth 5
$putResRestore = Invoke-RestMethod -Uri 'http://localhost:5242/api/customers/39' -Method Put -Headers $headers -Body $putBodyRestore -ContentType 'application/json'
Write-Host "Restored Customer 39: KYCStatus=$($putResRestore.kycStatus)"

$repRestored = Invoke-RestMethod -Uri 'http://localhost:5242/api/Reports/CustomerListReport' -Method Get
Write-Host "Final Report Summary: Total: $($repRestored.totalCustomers) | Verified: $($repRestored.kycVerifiedCount) | Pending: $($repRestored.kycPendingCount)"
