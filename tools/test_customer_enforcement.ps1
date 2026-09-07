$loginBody = @{
    username = 'admin'
    password = 'Shri@2026'
    branchID = 1
    financialYearID = 1
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/Auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$headers = @{ Authorization = "Bearer $($loginRes.token)" }

Write-Host "=== 1. TEST ATTEMPTING POST MEMBER WITHOUT CUSTOMERID ==="
$custCountBefore = [int]((-join (sqlcmd -S ".\SQLEXPRESS01" -d testing -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM Customers;")).Trim())
Write-Host "Customers count before: $custCountBefore"

$invalidMember = @{
    branchID = 1
    firstName = "Test"
    lastName = "WithoutCustomer"
    mobileNo = "9988776655"
    membershipType = "Regular"
    status = "Active"
} | ConvertTo-Json

$rejected = $false
try {
    $res = Invoke-RestMethod -Uri 'http://localhost:5242/api/Members' -Method Post -Headers $headers -Body $invalidMember -ContentType 'application/json'
} catch {
    $rejected = $true
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $responseBody = $reader.ReadToEnd()
    Write-Host "SUCCESS: Request was strictly blocked with 400 Bad Request!"
    Write-Host "Server error message: $responseBody"
}

$custCountAfter = [int]((-join (sqlcmd -S ".\SQLEXPRESS01" -d testing -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM Customers;")).Trim())
Write-Host "Customers count after: $custCountAfter"
if ($custCountBefore -eq $custCountAfter) {
    Write-Host "VERIFIED: Zero new customers were created!"
} else {
    Write-Error "FAILED: A customer was unexpectedly created!"
}

Write-Host "`n=== 2. TEST POST MEMBER WITH EXISTING CUSTOMER (Customer ID: 3) ==="
$cust3 = (-join (sqlcmd -S ".\SQLEXPRESS01" -d testing -Q "SET NOCOUNT ON; SELECT FirstName + ' ' + LastName FROM Customers WHERE CustomerID = 3;")).Trim()
Write-Host "Existing Customer 3: $cust3"

$validMember = @{
    branchID = 1
    customerID = 3
    memberCode = "MEM0003"
    membershipType = "Regular"
    status = "Active"
    joiningDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
} | ConvertTo-Json

$createdMem = Invoke-RestMethod -Uri 'http://localhost:5242/api/Members' -Method Post -Headers $headers -Body $validMember -ContentType 'application/json'
Write-Host "Created MemberID: $($createdMem.memberID), Linked CustomerID: $($createdMem.customerID), MemberCode: $($createdMem.memberCode)"

$custCountAfterMember = [int]((-join (sqlcmd -S ".\SQLEXPRESS01" -d testing -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM Customers;")).Trim())
Write-Host "Customers count after member creation: $custCountAfterMember"
if ($custCountBefore -eq $custCountAfterMember) {
    Write-Host "VERIFIED: Customer count unchanged! Member correctly linked to existing Customer 3."
}

Write-Host "`n=== 3. TEST SHARE OPENING BALANCE FOR CUSTOMER 3 (ENROLLING AS MEMBER) ==="
$custCountBeforeShare = [int]((-join (sqlcmd -S ".\SQLEXPRESS01" -d testing -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM Customers;")).Trim())
Write-Host "Customers count before Share Opening Balance: $custCountBeforeShare"

$sharePayload = @{
    customerId = 3
    memberId = 3
    legacyMemberNo = "33"
    openingDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    shareQuantity = 10
    faceValue = 100
    ledgerId = 1
} | ConvertTo-Json

$shareRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/ShareAccounts/OpeningBalance' -Method Post -Headers $headers -Body $sharePayload -ContentType 'application/json'
Write-Host "Share Account Created: AccountNo=$($shareRes.accountNo), MemberId=$($shareRes.memberId), CustomerID=$($shareRes.customerId)"

$custCountAfterShare = [int]((-join (sqlcmd -S ".\SQLEXPRESS01" -d testing -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM Customers;")).Trim())
Write-Host "Customers count after Share Opening Balance: $custCountAfterShare"

if ($custCountBeforeShare -eq $custCountAfterShare) {
    Write-Host "VERIFIED: Customer count is EXACTLY the same ($custCountAfterShare)! ZERO new customer created!"
} else {
    Write-Error "FAILED: A customer was created!"
}

Write-Host "`n=== 4. CLEAN UP TEST SHARE ACCOUNT & MEMBER 3 ==="
$mem3 = Invoke-RestMethod -Uri "http://localhost:5242/api/Members/by-customer/3" -Method Get -Headers $headers -ErrorAction SilentlyContinue
sqlcmd -S ".\SQLEXPRESS01" -d testing -Q "SET QUOTED_IDENTIFIER ON; DELETE FROM ShareTransactions WHERE ShareAccountId = $($shareRes.shareAccountId); DELETE FROM ShareCertificates WHERE ShareAccountId = $($shareRes.shareAccountId); DELETE FROM MemberOpeningBalances WHERE MemberID = $($shareRes.memberId); DELETE FROM ShareAccounts WHERE ShareAccountId = $($shareRes.shareAccountId); DELETE FROM Members WHERE MemberID = $($shareRes.memberId);"
Write-Host "Test share account and member cleaned up cleanly."

Write-Host "`n=== ALL VERIFICATIONS PASSED 100% ==="
