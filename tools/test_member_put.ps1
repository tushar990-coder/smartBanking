$loginBody = @{
    username = 'admin'
    password = 'Shri@2026'
    branchID = 1
    financialYearID = 1
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/Auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$token = $loginRes.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "=== 1. GET MEMBER 1 ==="
$m1 = Invoke-RestMethod -Uri 'http://localhost:5242/api/Members/1' -Method Get -Headers $headers
Write-Host "MemberID: $($m1.memberID), CustomerID: $($m1.customerID), Name: $($m1.firstName) $($m1.lastName), Mobile: $($m1.mobileNo)"

Write-Host "`n=== 2. PUT MEMBER 1 (Update Mobile & Address) ==="
$m1.mobileNo = '9876543210'
$m1.address = 'Updated Address for Normalized Member 1'
$putBody = $m1 | ConvertTo-Json -Depth 5
$putRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/Members/1' -Method Put -Headers $headers -Body $putBody -ContentType 'application/json'
Write-Host "PUT Response: MemberID=$($putRes.memberID), Mobile=$($putRes.mobileNo), Address=$($putRes.address)"

Write-Host "`n=== 3. VERIFY GET AFTER PUT ==="
$m1_updated = Invoke-RestMethod -Uri 'http://localhost:5242/api/Members/1' -Method Get -Headers $headers
Write-Host "Fetched Updated: Mobile=$($m1_updated.mobileNo), Address=$($m1_updated.address)"

Write-Host "`n=== 4. TEST I-NAMUNA REGISTER REPORT ==="
$reportRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/Reports/i-namuna-register?branchId=1' -Method Get -Headers $headers
Write-Host "Total Members in Report: $($reportRes.totalMembers)"
if ($reportRes.rows.Count -gt 0) {
    Write-Host "First record: FullName=$($reportRes.rows[0].fullName), CIFNo=$($reportRes.rows[0].cifNo), Address=$($reportRes.rows[0].address)"
}

Write-Host "`n=== 5. TEST MEMBER 360 REPORT ==="
$m360Res = Invoke-RestMethod -Uri 'http://localhost:5242/api/Reports/Member360/1' -Method Get -Headers $headers
Write-Host "Member360 FullName: $($m360Res.memberInfo.firstName) $($m360Res.memberInfo.lastName), CIF: $($m360Res.memberInfo.cifNo), Mobile: $($m360Res.memberInfo.mobileNo)"

Write-Host "`n=== 6. TEST POST NEW MEMBER ==="
$rand = Get-Random -Minimum 1000 -Maximum 9999
$newMember = @{
    branchID = 1
    firstName = "Tushar"
    lastName = "Patil"
    mobileNo = "998877" + $rand
    aadhaarNo = "99887766" + $rand
    panNo = "ABCDE" + $rand + "Z"
    address = "Pune Road"
    village = "Baramati"
    taluka = "Baramati"
    district = "Pune"
    membershipType = "Regular"
    status = "Active"
    joiningDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
}
$postBody = $newMember | ConvertTo-Json
$createdMember = Invoke-RestMethod -Uri 'http://localhost:5242/api/Members' -Method Post -Headers $headers -Body $postBody -ContentType 'application/json'
Write-Host "Created Member: MemberID=$($createdMember.memberID), CustomerID=$($createdMember.customerID), Name=$($createdMember.firstName) $($createdMember.lastName), CIF=$($createdMember.cifNo)"

Write-Host "`n=== 7. TEST PUT ON NEW MEMBER ==="
$createdMember.mobileNo = "998878" + $rand
$createdMember.address = "Updated Pune Road"
$putNewBody = $createdMember | ConvertTo-Json -Depth 5
$putNewRes = Invoke-RestMethod -Uri "http://localhost:5242/api/Members/$($createdMember.memberID)" -Method Put -Headers $headers -Body $putNewBody -ContentType 'application/json'
Write-Host "Updated New Member: MemberID=$($putNewRes.memberID), Mobile=$($putNewRes.mobileNo), Address=$($putNewRes.address)"

Write-Host "`n=== 8. TEST DELETE ON NEW MEMBER & CUSTOMER ==="
$delRes = Invoke-RestMethod -Uri "http://localhost:5242/api/Members/$($createdMember.memberID)" -Method Delete -Headers $headers
Write-Host "Delete Member response: $($delRes.message)"
if ($createdMember.customerID) {
    try {
        $delCust = Invoke-RestMethod -Uri "http://localhost:5242/api/Customers/$($createdMember.customerID)" -Method Delete -Headers $headers
        Write-Host "Delete Customer response: $($delCust.message)"
    } catch {
        Write-Host "Customer delete not supported or already removed"
    }
}

Write-Host "`n=== ALL TESTS COMPLETED SUCCESSFULLY ==="
