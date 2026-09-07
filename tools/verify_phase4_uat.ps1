# ==============================================================================
# PHASE 4: COMPREHENSIVE SYSTEM VERIFICATION & UAT
# Pure CustomerID Architecture Verification (No MemberID dependency)
# ==============================================================================

$ErrorActionPreference = "Stop"
$results = [ordered]@{}

function Report-Result($testName, $passed, $details) {
    if ($passed) {
        $results[$testName] = "PASSED: $details"
        Write-Host "  [PASSED] $testName : $details" -ForegroundColor Green
    } else {
        $results[$testName] = "FAILED: $details"
        Write-Host "  [FAILED] $testName : $details" -ForegroundColor Red
    }
}

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "STEP 0: AUTHENTICATION & DATABASE SCHEMA INTEGRITY" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

$loginBody = @{
    username = 'admin'
    password = 'Shri@2026'
    branchID = 1
    financialYearID = 1
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/Auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$headers = @{ Authorization = "Bearer $($loginRes.token)" }
Report-Result "Auth.Login" ($loginRes.token.Length -gt 20) "Token acquired for admin user"

# Verify SQL columns are absent
$rawCount = sqlcmd -S ".\SQLEXPRESS01" -d testing -h -1 -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('SavingAccountMasters', 'SavingAccountJointHolders') AND COLUMN_NAME = 'MemberID';"
$memberIdColCount = [int]($rawCount | Where-Object { $_ -match '^\s*\d+\s*$' } | ForEach-Object { $_.Trim() } | Select-Object -First 1)
Report-Result "Schema.NoMemberIDInDb" ($memberIdColCount -eq 0) "MemberID column count in DB is $memberIdColCount (0 expected)"


Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "SUITE 1: ACCOUNT OPENING (PURE CUSTOMERID & JOINT)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

$nextCifRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/Customers/next-cif' -Method Get -Headers $headers
$nextCifNo = if ($nextCifRes.nextCifNo) { $nextCifRes.nextCifNo } else { "CIF" + (Get-Random -Minimum 100000 -Maximum 999999) }

# 1A. Create a pure Non-Member Customer
$nonMemberCustBody = @{
    branchID = 1
    cifNo = $nextCifNo
    customerType = "Individual"
    firstName = "Rajesh"
    middleName = "Bapurao"
    lastName = "Deshmukh"
    firstNameEng = "Rajesh"
    middleNameEng = "Bapurao"
    lastNameEng = "Deshmukh"
    mobileNo = "98" + (Get-Random -Minimum 10000000 -Maximum 99999999)
    panNo = "ABCDE" + (Get-Random -Minimum 1000 -Maximum 9999) + "F"
    aadhaarNo = "" + (Get-Random -Minimum 100000000000 -Maximum 999999999999)
    gender = "Male"
    status = "Active"
    address = "Satara"
} | ConvertTo-Json

try {
    $newCust = Invoke-RestMethod -Uri 'http://localhost:5242/api/Customers' -Method Post -Body $nonMemberCustBody -ContentType 'application/json' -Headers $headers
    Report-Result "Suite1.CreateNonMemberCustomer" ($newCust.customerID -gt 0) "Created CustomerID=$($newCust.customerID), CIF=$($newCust.cifNo)"
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $respBody = $reader.ReadToEnd()
    Write-Host "Error details: $respBody" -ForegroundColor Red
    throw
}

# 1B. Open Saving Account for this Non-Member Customer (NO MemberID)
$accNo1 = "SB-NM-" + (Get-Random -Minimum 1000 -Maximum 9999)
$saving1Body = @{
    branchID = 1
    customerID = $newCust.customerID
    accountNo = $accNo1
    accountType = "Personal"
    openingDate = (Get-Date).ToString("yyyy-MM-dd")
    openingBalance = 1000
    interestRate = 4.0
    minimumBalance = 500
    status = "Active"
    nomineeName = "Sunita Deshmukh"
    nomineeRelation = "Wife"
    nomineeAddress = "Satara"
} | ConvertTo-Json

$acc1 = Invoke-RestMethod -Uri 'http://localhost:5242/api/SavingAccounts' -Method Post -Body $saving1Body -ContentType 'application/json' -Headers $headers
Report-Result "Suite1.OpenNonMemberSavingAccount" ($acc1.savingAccountID -gt 0) "Opened Account ID=$($acc1.savingAccountID), No=$($acc1.accountNo), CustID=$($acc1.customerID)"

# 1C. Open Saving Account for Member with Joint Holder Customer
# Customer 1 (Member) and Customer 2 as joint holder
$jointCust = Invoke-RestMethod -Uri 'http://localhost:5242/api/Customers/2' -Method Get -Headers $headers
$accNo2 = "SB-JT-" + (Get-Random -Minimum 1000 -Maximum 9999)
$saving2Body = @{
    branchID = 1
    customerID = 1
    accountNo = $accNo2
    accountType = "Joint"
    openingDate = (Get-Date).ToString("yyyy-MM-dd")
    openingBalance = 2000
    interestRate = 4.0
    minimumBalance = 500
    status = "Active"
    nomineeName = "Nominee Son"
    nomineeRelation = "Son"
    nomineeAddress = "Satara"
    jointHolderCustomerIDs = @($jointCust.customerID)
} | ConvertTo-Json

$acc2 = Invoke-RestMethod -Uri 'http://localhost:5242/api/SavingAccounts' -Method Post -Body $saving2Body -ContentType 'application/json' -Headers $headers
Report-Result "Suite1.OpenJointSavingAccount" ($acc2.savingAccountID -gt 0) "Opened Joint Account ID=$($acc2.savingAccountID), No=$($acc2.accountNo)"

# Verify Joint Holder saved in GET
$acc2Details = Invoke-RestMethod -Uri "http://localhost:5242/api/SavingAccounts/$($acc2.savingAccountID)" -Method Get -Headers $headers
$jhFound = ($acc2Details.jointHolders.Count -gt 0) -and ($acc2Details.jointHolders[0].customerID -eq $jointCust.customerID)
Report-Result "Suite1.VerifyJointHolderMapping" $jhFound "Joint holder mapped: CustID=$($acc2Details.jointHolders[0].customerID), Name=$($acc2Details.jointHolders[0].memberName)"


Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "SUITE 2: TRANSACTIONS & RUNNING BALANCES" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 2A. Cash Deposit of 5000 on Account 1
$depositBody = @{
    savingAccountID = $acc1.savingAccountID
    transactionType = "Deposit"
    amount = 5000
    paymentMode = "Cash"
    transactionDate = (Get-Date).ToString("yyyy-MM-dd")
    narration = "Cash Deposit Phase 4 UAT"
} | ConvertTo-Json

$depRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/SavingTransactions' -Method Post -Body $depositBody -ContentType 'application/json' -Headers $headers

# Check Balance after deposit: Opening 1000 + 5000 = 6000
$acc1Check1 = Invoke-RestMethod -Uri "http://localhost:5242/api/SavingAccounts/$($acc1.savingAccountID)" -Method Get -Headers $headers
Report-Result "Suite2.DepositTransaction" ($acc1Check1.currentBalance -eq 6000) "Balance after 5,000 deposit is $($acc1Check1.currentBalance) (expected 6000)"

# 2B. Cash Withdrawal of 1500
$withdrawalBody = @{
    savingAccountID = $acc1.savingAccountID
    transactionType = "Withdrawal"
    amount = 1500
    paymentMode = "Cash"
    transactionDate = (Get-Date).ToString("yyyy-MM-dd")
    narration = "Cash Withdrawal Phase 4 UAT"
} | ConvertTo-Json

$withRes = Invoke-RestMethod -Uri 'http://localhost:5242/api/SavingTransactions' -Method Post -Body $withdrawalBody -ContentType 'application/json' -Headers $headers

# Check Balance after withdrawal: 6000 - 1500 = 4500
$acc1Check2 = Invoke-RestMethod -Uri "http://localhost:5242/api/SavingAccounts/$($acc1.savingAccountID)" -Method Get -Headers $headers
Report-Result "Suite2.WithdrawalTransaction" ($acc1Check2.currentBalance -eq 4500) "Balance after ₹1,500 withdrawal is ₹$($acc1Check2.currentBalance) (expected 4500)"

# 2C. Verify Transactions History
$txList = Invoke-RestMethod -Uri "http://localhost:5242/api/SavingTransactions/account/$($acc1.savingAccountID)" -Method Get -Headers $headers
Report-Result "Suite2.TransactionHistory" ($txList.Count -ge 2) "Found $($txList.Count) transactions for Account ID $($acc1.savingAccountID)"


Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "SUITE 3: INTER-MODULE DUAL LOOKUP (MEMBER & CUSTOMER)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 3A. Lookup by MemberID=1
$byMember = Invoke-RestMethod -Uri "http://localhost:5242/api/SavingAccounts/ByMember/1" -Method Get -Headers $headers
$memberHasAccounts = $byMember.Count -gt 0
Report-Result "Suite3.LookupByMemberID" $memberHasAccounts "Found $($byMember.Count) accounts for Member 1 via linked Customer"

# 3B. Lookup by CustomerID=1
$byCust = Invoke-RestMethod -Uri "http://localhost:5242/api/SavingAccounts?customerId=1" -Method Get -Headers $headers
$custHasAccounts = $byCust.Count -gt 0
Report-Result "Suite3.LookupByCustomerID" $custHasAccounts "Found $($byCust.Count) accounts for Customer 1 directly"


Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "SUITE 4: 360-DEGREE VIEW, REPORTS & LIFECYCLE AUDIT" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 4A. Customer 360 View
$c360 = Invoke-RestMethod -Uri "http://localhost:5242/api/Customers/$($newCust.customerID)/360" -Method Get -Headers $headers
$savingIn360 = $c360.savings | Where-Object { $_.savingAccountID -eq $acc1.savingAccountID }
Report-Result "Suite4.Customer360View" ($null -ne $savingIn360) "Saving Account present in Customer 360 view with balance $($savingIn360.currentBalance)"

# 4B. Member Summary
$mSummary = Invoke-RestMethod -Uri "http://localhost:5242/api/Members/1/Summary" -Method Get -Headers $headers
Report-Result "Suite4.MemberSummary" ($null -ne $mSummary.savingsBalance) "Member Summary returns total savings balance: $($mSummary.savingsBalance)"

# 4C. Member Closure Info (checks saving balances before resignation)
$mClosure = Invoke-RestMethod -Uri "http://localhost:5242/api/Members/1/ClosureInfo" -Method Get -Headers $headers
Report-Result "Suite4.MemberClosureCheck" ($null -ne $mClosure.savingBalance) "Member Closure Info correctly checks saving balance: $($mClosure.savingBalance)"

# 4D. Saving Khatavani Report
$todayStr = (Get-Date).ToString("yyyy-MM-dd")
$khatavani = Invoke-RestMethod -Uri "http://localhost:5242/api/Reports/SavingKhatavani/$($acc1.savingAccountID)?fromDate=2026-01-01&toDate=$todayStr" -Method Get -Headers $headers
Report-Result "Suite4.SavingKhatavaniReport" ($khatavani.transactions.Count -ge 2) "Khatavani generated successfully with $($khatavani.transactions.Count) entries and balance ₹$($khatavani.closingBalance)"


Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "FINAL UAT SUMMARY REPORT" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

$passedCount = ($results.Values | Where-Object { $_ -like "PASSED*" }).Count
$failedCount = ($results.Values | Where-Object { $_ -like "FAILED*" }).Count
$totalCount = $results.Count

Write-Host "TOTAL TESTS RUN : $totalCount"
Write-Host "TOTAL PASSED    : $passedCount" -ForegroundColor Green
$failColor = if ($failedCount -gt 0) { "Red" } else { "Green" }
Write-Host "TOTAL FAILED    : $failedCount" -ForegroundColor $failColor

if ($failedCount -eq 0) {
    Write-Host "`n>>> ALL PHASE 4 UAT TESTS COMPLETED WITH 100% SUCCESS! <<<" -ForegroundColor Green
} else {
    Write-Host "`n>>> SOME TESTS FAILED! PLEASE REVIEW LOGS! <<<" -ForegroundColor Red
    exit 1
}
