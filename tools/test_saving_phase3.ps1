$loginBody = @{
    username = 'admin'
    password = 'Shri@2026'
    branchID = 1
    financialYearID = 1
} | ConvertTo-Json

Write-Host "1. Logging in to get JWT token..."
$loginRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/Auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$headers = @{ Authorization = "Bearer $($loginRes.token)" }
Write-Host "-> Login success! Token acquired." -ForegroundColor Green

Write-Host "`n2. Testing GET /api/SavingAccounts..."
$accounts = Invoke-RestMethod -Uri 'http://localhost:5242/api/SavingAccounts' -Method Get -Headers $headers
Write-Host "-> Successfully fetched $($accounts.Count) saving accounts." -ForegroundColor Green
$sample = $accounts | Select-Object -First 1
Write-Host "Sample Account: No=$($sample.AccountNo), CustID=$($sample.CustomerID), CIF=$($sample.CIFNo), ResolvedMemberID=$($sample.MemberID)"

Write-Host "`n3. Checking SQL Server columns for SavingAccountMasters & SavingAccountJointHolders..."
$colsSql = @"
SET NOCOUNT ON;
SELECT TABLE_NAME, COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME IN ('SavingAccountMasters', 'SavingAccountJointHolders') 
  AND COLUMN_NAME IN ('MemberID', 'CustomerID')
ORDER BY TABLE_NAME, COLUMN_NAME;
"@
$colResults = sqlcmd -S ".\SQLEXPRESS01" -d testing -Q $colsSql
Write-Host $colResults

Write-Host "`n4. Testing Creation of New Saving Account via POST /api/SavingAccounts with CustomerID..."
# Get a customer ID
$customers = Invoke-RestMethod -Uri 'http://localhost:5242/api/Customers?searchTerm=a' -Method Get -Headers $headers
$testCust = $customers | Select-Object -First 1
if (-not $testCust) {
    Write-Host "No customer found for testing." -ForegroundColor Red
    exit 1
}
Write-Host "Using Test Customer: ID=$($testCust.customerID), CIF=$($testCust.cifNo), Name=$($testCust.fullName)"

$accNo = "SB-TEST-" + (Get-Random -Minimum 1000 -Maximum 9999)
$newAccBody = @{
    branchID = 1
    customerID = $testCust.customerID
    accountNo = $accNo
    accountType = "Personal"
    openingDate = (Get-Date).ToString("yyyy-MM-dd")
    openingBalance = 500
    interestRate = 4.0
    minimumBalance = 100
    status = "Active"
    nomineeName = "Test Nominee"
    nomineeRelation = "Brother"
    nomineeAddress = "Test City"
} | ConvertTo-Json

try {
    $createRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/SavingAccounts' -Method Post -Body $newAccBody -ContentType 'application/json' -Headers $headers
    Write-Host "-> Successfully created saving account: ID=$($createRes.savingAccountID), AccountNo=$($createRes.accountNo)" -ForegroundColor Green
    
    Write-Host "`n5. Testing GET /api/SavingAccounts/$($createRes.savingAccountID)..."
    $getRes = Invoke-RestMethod -Uri "http://localhost:5242/api/SavingAccounts/$($createRes.savingAccountID)" -Method Get -Headers $headers
    Write-Host "-> Retrieved Account: No=$($getRes.accountNo), CustID=$($getRes.customerID), CIF=$($getRes.cifNo), Name=$($getRes.memberName)" -ForegroundColor Green
} catch {
    Write-Host "Error creating/fetching saving account: $_" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode
    exit 1
}

Write-Host "`n=== ALL PHASE 3 VERIFICATION TESTS PASSED! ===" -ForegroundColor Green
