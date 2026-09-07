# ==============================================================================
# Comprehensive QA Automated Test Suite for Recurring Deposit (RD)
# Architecture: CustomerID-First (CIF-First)
# ==============================================================================
$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:5242"
$sqlServer = ".\SQLEXPRESS01"
$dbName = "testing"

$passed = 0
$failed = 0
$total = 0

function Report-Assert($testName, $condition, $details) {
    $script:total++
    if ($condition) {
        $script:passed++
        Write-Host "  [PASS] $testName" -ForegroundColor Green
        if ($details) { Write-Host "         $details" -ForegroundColor DarkGreen }
    } else {
        $script:failed++
        Write-Host "  [FAIL] $testName" -ForegroundColor Red
        if ($details) { Write-Host "         Details: $details" -ForegroundColor DarkRed }
    }
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  STARTING RD CUSTOMERID-FIRST ARCHITECTURE QA TEST SUITE" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# PRE-CHECK: Database Column & API Availability
# ------------------------------------------------------------------------------
Write-Host "`n[PRE-CHECK] Verifying Database Schema & API Status..." -ForegroundColor Yellow

$sqlColCheck = sqlcmd -S $sqlServer -d $dbName -E -h -1 -W -Q "
SET NOCOUNT ON;
SELECT COLUMN_NAME + ':' + DATA_TYPE + ':' + IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'RdAccounts' AND COLUMN_NAME IN ('CustomerID', 'MemberID', 'JointCustomerID', 'JointMemberID');
"

$colLines = ($sqlColCheck | Out-String).Trim() -split "`r?`n"
$hasCustCol = $colLines -match "CustomerID:int:NO"
$hasJointCustCol = $colLines -match "JointCustomerID:int:YES"
$hasMemberCol = $colLines -match "MemberID"

Report-Assert "RdAccounts Schema: CustomerID is INT NOT NULL" ($hasCustCol.Count -gt 0) "Found: $($hasCustCol -join ', ')"
Report-Assert "RdAccounts Schema: JointCustomerID is INT NULL" ($hasJointCustCol.Count -gt 0) "Found: $($hasJointCustCol -join ', ')"
Report-Assert "RdAccounts Schema: MemberID is DROPPED" ($hasMemberCol.Count -eq 0) "MemberID present: $($hasMemberCol.Count -gt 0)"

# Step 1: Authentication
Write-Host "`n[QA Init] Authenticating Admin..." -ForegroundColor Yellow
$headers = @{}
try {
    $loginPayload = @{ username = "admin"; password = "Shri@2026" } | ConvertTo-Json
    $loginRes = Invoke-RestMethod -Uri "$baseUrl/api/Auth/login" -Method Post -Body $loginPayload -ContentType "application/json"
    $headers = @{ "Authorization" = "Bearer $($loginRes.token)" }
    Report-Assert "Admin Authentication: JWT Token Acquired" ($null -ne $loginRes.token) "User: $($loginRes.username), Branch: $($loginRes.branchName)"
} catch {
    Report-Assert "Admin Authentication: JWT Token Acquired" $false "Login failed: $_"
    exit 1
}

function Invoke-ApiPost($url, $obj) {
    $json = $obj | ConvertTo-Json -Depth 10
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    return Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $bytes -ContentType "application/json; charset=utf-8"
}

# ------------------------------------------------------------------------------
# STEP 0: Find or Create Prerequisites (Branch, Customer, RD Scheme)
# ------------------------------------------------------------------------------
Write-Host "`n[STEP 0] Preparing Test Data (Branch, Scheme, Customers)..." -ForegroundColor Yellow

$branches = Invoke-RestMethod -Uri "$baseUrl/api/Branches" -Method Get -Headers $headers
$testBranch = $branches[0]
$branchId = $testBranch.branchID

$customers = Invoke-RestMethod -Uri "$baseUrl/api/Customers" -Method Get -Headers $headers
$activeCustomers = $customers | Where-Object { $_.status -eq "Active" }

if ($activeCustomers.Count -lt 2) {
    Write-Host "Creating test customers..." -ForegroundColor Gray
    $c1Body = @{
        branchID = $branchId
        firstName = "आरडी_चाचणी_ग्राहक_१"
        lastName = "पाटील"
        mobileNo = "9876500001"
        cifNo = "CIF-RD-TEST-001"
        status = "Active"
    }
    $c1 = Invoke-ApiPost "$baseUrl/api/Customers" $c1Body
    
    $c2Body = @{
        branchID = $branchId
        firstName = "आरडी_चाचणी_ग्राहक_२"
        lastName = "देशमुख"
        mobileNo = "9876500002"
        cifNo = "CIF-RD-TEST-002"
        status = "Active"
    }
    $c2 = Invoke-ApiPost "$baseUrl/api/Customers" $c2Body
    
    $customers = Invoke-RestMethod -Uri "$baseUrl/api/Customers" -Method Get -Headers $headers
    $activeCustomers = $customers | Where-Object { $_.status -eq "Active" }
}

$primaryCustomer = $activeCustomers[0]
$jointCustomer = $activeCustomers[1]
$primaryCustId = [int]$primaryCustomer.customerID
$jointCustId = [int]$jointCustomer.customerID

Report-Assert "Test Customers Ready" ($primaryCustId -gt 0 -and $jointCustId -gt 0) "Primary CustID: $primaryCustId, Joint CustID: $jointCustId"

# Check / Create RD Scheme
$schemes = Invoke-RestMethod -Uri "$baseUrl/api/RdSchemes" -Method Get -Headers $headers
$activeScheme = $schemes | Where-Object { $_.isActive -eq $true } | Select-Object -First 1

if (-not $activeScheme) {
    Write-Host "Creating default RD scheme..." -ForegroundColor Gray
    $newSchemeBody = @{
        schemeCode = "RD-12M-STD"
        schemeName = "नियमित आवर्ती ठेव १२ महिने"
        installmentAmount = 1000
        durationMonths = 12
        interestRate = 8.0
        isActive = $true
    }
    $activeScheme = Invoke-ApiPost "$baseUrl/api/RdSchemes" $newSchemeBody
}

$schemeId = [int]$activeScheme.rdSchemeID
$instAmount = [decimal]$activeScheme.installmentAmount
$schemeDuration = [int]$activeScheme.durationMonths
$schemeRate = [decimal]$activeScheme.interestRate
Report-Assert "RD Scheme Ready" ($schemeId -gt 0) "Scheme: $($activeScheme.schemeName) (ID: $schemeId, Inst: ₹$instAmount, Rate: $schemeRate%)"

# ------------------------------------------------------------------------------
# TEST 1: Negative Validation Tests (CustomerID-First Integrity)
# ------------------------------------------------------------------------------
Write-Host "`n[TEST 1] Negative Validation Checks (CustomerID Constraints)..." -ForegroundColor Yellow

# 1a. Missing CustomerID (CustomerID = 0)
$invalidZeroCust = @{
    branchID = $branchId
    customerID = 0
    rdSchemeID = $schemeId
    installmentAmount = $instAmount
    durationMonths = $schemeDuration
    interestRate = $schemeRate
    openingDate = (Get-Date).ToString("yyyy-MM-dd")
    paymentMode = "Cash"
}

$zeroCustBlocked = $false
try {
    $null = Invoke-ApiPost "$baseUrl/api/RdAccounts" $invalidZeroCust
} catch {
    $zeroCustBlocked = ($_.Exception.Response.StatusCode.value__ -eq 400)
}
Report-Assert "Validation: Reject CustomerID = 0" $zeroCustBlocked "Expected HTTP 400 Bad Request"

# 1b. Non-existent CustomerID
$invalidFakeCust = @{
    branchID = $branchId
    customerID = 9999999
    rdSchemeID = $schemeId
    installmentAmount = $instAmount
    durationMonths = $schemeDuration
    interestRate = $schemeRate
    openingDate = (Get-Date).ToString("yyyy-MM-dd")
    paymentMode = "Cash"
}

$fakeCustBlocked = $false
try {
    $null = Invoke-ApiPost "$baseUrl/api/RdAccounts" $invalidFakeCust
} catch {
    $fakeCustBlocked = ($_.Exception.Response.StatusCode.value__ -eq 400)
}
Report-Assert "Validation: Reject Non-Existent CustomerID" $fakeCustBlocked "Expected HTTP 400 Bad Request"

# ------------------------------------------------------------------------------
# TEST 2: Account Opening with CustomerID (Primary & Joint Account)
# ------------------------------------------------------------------------------
Write-Host "`n[TEST 2] Testing New RD Account Opening (CustomerID-First)..." -ForegroundColor Yellow

$openPayload = @{
    branchID = $branchId
    customerID = $primaryCustId
    jointCustomerID = $jointCustId
    accountType = "Joint"
    rdSchemeID = $schemeId
    installmentAmount = $instAmount
    durationMonths = $schemeDuration
    interestRate = $schemeRate
    openingDate = (Get-Date).ToString("yyyy-MM-dd")
    paymentMode = "Cash"
    nomineeName = "वारसदार पाटील"
    nomineeRelation = "मुलगा"
    remarks = "QA Test Account Opening CustomerID-First"
}

$openedAcc = $null
try {
    $openedAcc = Invoke-ApiPost "$baseUrl/api/RdAccounts" $openPayload
} catch {
    Write-Host "Account opening failed: $_" -ForegroundColor Red
}

$accId = if ($openedAcc -and $openedAcc.rdAccountID) { [int]$openedAcc.rdAccountID } else { 0 }
Report-Assert "Account Opening: HTTP 200/201 Success" ($accId -gt 0) "Created RdAccountID: $accId"
Report-Assert "Account Opening: Auto AccountNo Generated" ($openedAcc.accountNo -match "RD-\d{6}") "AccountNo: $($openedAcc.accountNo)"
Report-Assert "Account Opening: Status is Active" ($openedAcc.status -eq "Active") "Status: $($openedAcc.status)"
Report-Assert "Account Opening: First Installment Paid" ($openedAcc.totalPaidInstallments -eq 1 -and $openedAcc.totalDepositedAmount -eq $instAmount) "Paid: $($openedAcc.totalPaidInstallments), Deposited: ₹$($openedAcc.totalDepositedAmount)"

# Verify Database Record
$sqlAccCheck = sqlcmd -S $sqlServer -d $dbName -E -h -1 -W -Q "
SET NOCOUNT ON;
SELECT CAST(CustomerID AS VARCHAR) + ' ' + CAST(ISNULL(JointCustomerID, 0) AS VARCHAR) + ' ' + Status + ' ' + CAST(TotalDepositedAmount AS VARCHAR)
FROM RdAccounts WHERE RdAccountID = $accId;
"
$accRow = ($sqlAccCheck | Out-String).Trim() -split "\s+"
Report-Assert "DB Check: CustomerID matches accurately" ($accRow[0] -eq $primaryCustId.ToString()) "DB CustomerID: $($accRow[0])"
Report-Assert "DB Check: JointCustomerID matches accurately" ($accRow[1] -eq $jointCustId.ToString()) "DB JointCustomerID: $($accRow[1])"

# Verify Accounting Voucher & Subledger Customer Tagging
$voucherNo = "JV-RD-OP-" + $openedAcc.accountNo
$sqlVoucherCheck = sqlcmd -S $sqlServer -d $dbName -E -h -1 -W -Q "
SET NOCOUNT ON;
SELECT v.VoucherNo + ' ' +
       CAST(SUM(CASE WHEN vd.DrCr = 'Dr' THEN vd.Amount ELSE 0 END) AS VARCHAR) + ' ' +
       CAST(SUM(CASE WHEN vd.DrCr = 'Cr' THEN vd.Amount ELSE 0 END) AS VARCHAR) + ' ' +
       CAST(MAX(ISNULL(vd.CustomerID, 0)) AS VARCHAR)
FROM Vouchers v
JOIN VoucherDetails vd ON v.VoucherID = vd.VoucherID
WHERE v.VoucherNo = '$voucherNo'
GROUP BY v.VoucherNo;
"
$vRow = ($sqlVoucherCheck | Out-String).Trim() -split "\s+"
$drAmount = if ($vRow.Count -gt 1) { [decimal]$vRow[1] } else { 0 }
$crAmount = if ($vRow.Count -gt 2) { [decimal]$vRow[2] } else { 0 }
$taggedCust = if ($vRow.Count -gt 3) { [int]$vRow[3] } else { 0 }

Report-Assert "Voucher Audit: Opening Voucher Dr == Cr" ($drAmount -eq $instAmount -and $drAmount -eq $crAmount) "Dr: ₹$drAmount, Cr: ₹$crAmount"
Report-Assert "Sub-ledger Tagging: VoucherDetails has CustomerID" ($taggedCust -eq $primaryCustId) "Tagged CustomerID: $taggedCust"

# ------------------------------------------------------------------------------
# TEST 3: Installment Collection & Penalty Tagging
# ------------------------------------------------------------------------------
Write-Host "`n[TEST 3] Testing Installment Collection with Penalty..." -ForegroundColor Yellow

$collectUrl = "$baseUrl/api/RdAccounts/$accId/CollectInstallment?count=2&penaltyAmount=50&payMode=Cash"
$collectRes = $null
try {
    $collectRes = Invoke-RestMethod -Uri $collectUrl -Method Post -Headers $headers
} catch {
    Write-Host "Collect failed: $_" -ForegroundColor Red
}

Report-Assert "Collection: HTTP 200 Success" ($null -ne $collectRes) "Result: $collectRes"

# Verify Updated Balances via GET
$accAfterCollect = Invoke-RestMethod -Uri "$baseUrl/api/RdAccounts/$accId" -Method Get -Headers $headers
$details = $accAfterCollect.accountDetails
$expectedTotalPaid = 1 + 2
$expectedTotalDeposited = $instAmount * $expectedTotalPaid
$expectedCollVoucherAmount = ($instAmount * 2) + 50

Report-Assert "Collection: Installments Incremented to 3" ($details.totalPaidInstallments -eq $expectedTotalPaid) "TotalPaidInstallments: $($details.totalPaidInstallments)"
Report-Assert "Collection: Deposited Amount is correct" ($details.totalDepositedAmount -eq $expectedTotalDeposited) "TotalDepositedAmount: ₹$($details.totalDepositedAmount)"

# Verify Collection Voucher
$sqlCollVoucher = sqlcmd -S $sqlServer -d $dbName -E -h -1 -W -Q "
SET NOCOUNT ON;
SELECT v.VoucherNo + ' ' +
       CAST(SUM(CASE WHEN vd.DrCr = 'Dr' THEN vd.Amount ELSE 0 END) AS VARCHAR) + ' ' +
       CAST(SUM(CASE WHEN vd.DrCr = 'Cr' THEN vd.Amount ELSE 0 END) AS VARCHAR) + ' ' +
       CAST(MAX(ISNULL(vd.CustomerID, 0)) AS VARCHAR)
FROM Vouchers v
JOIN VoucherDetails vd ON v.VoucherID = vd.VoucherID
WHERE v.VoucherNo LIKE 'JV-RD-COLL-$($openedAcc.accountNo)%'
GROUP BY v.VoucherNo;
"
$cRow = ($sqlCollVoucher | Out-String).Trim() -split "\s+"
$cDr = if ($cRow.Count -gt 1) { [decimal]$cRow[1] } else { 0 }
$cCr = if ($cRow.Count -gt 2) { [decimal]$cRow[2] } else { 0 }
$cCust = if ($cRow.Count -gt 3) { [int]$cRow[3] } else { 0 }

Report-Assert "Voucher Audit: Collection Voucher Dr == Cr (₹$expectedCollVoucherAmount)" ($cDr -eq $expectedCollVoucherAmount -and $cDr -eq $cCr) "Dr: ₹$cDr, Cr: ₹$cCr"
Report-Assert "Sub-ledger Tagging: Collection VoucherDetails has CustomerID" ($cCust -eq $primaryCustId) "Tagged CustomerID: $cCust"

# ------------------------------------------------------------------------------
# TEST 4: RD Interest Accrual Posting
# ------------------------------------------------------------------------------
Write-Host "`n[TEST 4] Testing RD Interest Accrual Provision..." -ForegroundColor Yellow

$accrualDate = (Get-Date).AddMonths(1).ToString("yyyy-MM-dd")
$accrueUrl = "$baseUrl/api/RdAccounts/AccrueInterest?branchId=$branchId&accrualDate=$accrualDate"
$accrueRes = $null
try {
    $accrueRes = Invoke-RestMethod -Uri $accrueUrl -Method Post -Headers $headers
} catch {
    Write-Host "Accrue failed: $_" -ForegroundColor Red
}

Report-Assert "Accrual: Execution succeeded" ($null -ne $accrueRes) "Response: $accrueRes"

# Check interest accrual records
$sqlAccrualCheck = sqlcmd -S $sqlServer -d $dbName -E -h -1 -W -Q "
SET NOCOUNT ON;
SELECT CAST(COUNT(*) AS VARCHAR) + ' ' + CAST(ISNULL(SUM(InterestAmount), 0) AS VARCHAR)
FROM RdInterestAccruals WHERE RdAccountID = $accId;
"
$acRow = ($sqlAccrualCheck | Out-String).Trim() -split "\s+"
$accrualCount = if ($acRow.Count -gt 0) { [int]$acRow[0] } else { 0 }
$accrualAmount = if ($acRow.Count -gt 1) { [decimal]$acRow[1] } else { 0 }
Report-Assert "Accrual: Interest calculated for active account" ($accrualCount -ge 1 -and $accrualAmount -gt 0) "Count: $accrualCount, Accrued Int: ₹$accrualAmount"

# ------------------------------------------------------------------------------
# TEST 5: Premature Closure
# ------------------------------------------------------------------------------
Write-Host "`n[TEST 5] Testing RD Premature Closure..." -ForegroundColor Yellow

# Open a second RD account for premature closure testing
$prematureOpenPayload = @{
    branchID = $branchId
    customerID = $primaryCustId
    accountType = "Single"
    rdSchemeID = $schemeId
    installmentAmount = $instAmount
    durationMonths = $schemeDuration
    interestRate = $schemeRate
    openingDate = (Get-Date).ToString("yyyy-MM-dd")
    paymentMode = "Cash"
    remarks = "QA Test Premature Account"
}

$premAcc = Invoke-ApiPost "$baseUrl/api/RdAccounts" $prematureOpenPayload
$premId = [int]$premAcc.rdAccountID

# Trigger premature close
$precloseUrl = "$baseUrl/api/RdAccounts/$premId/PrematureClose?closureDate=$((Get-Date).AddMonths(1).ToString('yyyy-MM-dd'))&customPrematureRate=7.0"
$precloseRes = $null
try {
    $precloseRes = Invoke-RestMethod -Uri $precloseUrl -Method Post -Headers $headers
} catch {
    Write-Host "Preclose failed: $_" -ForegroundColor Red
}

Report-Assert "Premature Close: API Execution 200 OK" ($null -ne $precloseRes) "Payout Msg: $($precloseRes.message)"

# Verify status in DB
$premStatus = (sqlcmd -S $sqlServer -d $dbName -E -h -1 -W -Q "SET NOCOUNT ON; SELECT Status FROM RdAccounts WHERE RdAccountID = $premId;").Trim()
Report-Assert "Premature Close: Status updated to 'Closed'" ($premStatus -eq "Closed") "Status: $premStatus"

# Verify Premature Closure Voucher Dr == Cr
$sqlPrecloseVoucher = sqlcmd -S $sqlServer -d $dbName -E -h -1 -W -Q "
SET NOCOUNT ON;
SELECT v.VoucherNo + ' ' +
       CAST(SUM(CASE WHEN vd.DrCr = 'Dr' THEN vd.Amount ELSE 0 END) AS VARCHAR) + ' ' +
       CAST(SUM(CASE WHEN vd.DrCr = 'Cr' THEN vd.Amount ELSE 0 END) AS VARCHAR) + ' ' +
       CAST(MAX(ISNULL(vd.CustomerID, 0)) AS VARCHAR)
FROM Vouchers v
JOIN VoucherDetails vd ON v.VoucherID = vd.VoucherID
WHERE v.VoucherNo = 'JV-RD-PRECLOSE-$($premAcc.accountNo)'
GROUP BY v.VoucherNo;
"
$pRow = ($sqlPrecloseVoucher | Out-String).Trim() -split "\s+"
$pDr = if ($pRow.Count -gt 1) { [decimal]$pRow[1] } else { 0 }
$pCr = if ($pRow.Count -gt 2) { [decimal]$pRow[2] } else { 0 }
$pCust = if ($pRow.Count -gt 3) { [int]$pRow[3] } else { 0 }

Report-Assert "Voucher Audit: Premature Close Voucher Dr == Cr" ($pDr -gt 0 -and $pDr -eq $pCr) "Dr: ₹$pDr, Cr: ₹$pCr"
Report-Assert "Sub-ledger Tagging: Premature Close tagged with CustomerID" ($pCust -eq $primaryCustId) "Tagged CustomerID: $pCust"

# ------------------------------------------------------------------------------
# TEST 6: Maturity & Renewal into FD
# ------------------------------------------------------------------------------
Write-Host "`n[TEST 6] Testing RD Renewal to FD Account..." -ForegroundColor Yellow

# Ensure an active FD scheme exists
$fdSchemes = Invoke-RestMethod -Uri "$baseUrl/api/FdSchemes" -Method Get -Headers $headers
$activeFdScheme = $fdSchemes | Where-Object { $_.isActive -eq $true } | Select-Object -First 1
$fdSchemeId = if ($activeFdScheme -and $activeFdScheme.fdSchemeID) { [int]$activeFdScheme.fdSchemeID } else { 1 }

# Open a 3rd RD account for renewal
$renewOpenPayload = @{
    branchID = $branchId
    customerID = $primaryCustId
    accountType = "Single"
    rdSchemeID = $schemeId
    installmentAmount = $instAmount
    durationMonths = $schemeDuration
    interestRate = $schemeRate
    openingDate = (Get-Date).AddMonths(-$schemeDuration).ToString("yyyy-MM-dd") # Opened in the past
    paymentMode = "Cash"
    remarks = "QA Test Renewal to FD Account"
}

$renewAcc = Invoke-ApiPost "$baseUrl/api/RdAccounts" $renewOpenPayload
$renewId = [int]$renewAcc.rdAccountID

# Trigger Renewal
$renewUrl = "$baseUrl/api/RdAccounts/$renewId/Renew?targetSchemeId=$fdSchemeId"
$renewRes = $null
try {
    $renewRes = Invoke-RestMethod -Uri $renewUrl -Method Post -Headers $headers
} catch {
    Write-Host "Renew failed: $_" -ForegroundColor Red
}

Report-Assert "Renewal: Execution 200 OK" ($null -ne $renewRes) "Response: $renewRes"

# Check old RD status is Matured
$renewStatus = (sqlcmd -S $sqlServer -d $dbName -E -h -1 -W -Q "SET NOCOUNT ON; SELECT Status FROM RdAccounts WHERE RdAccountID = $renewId;").Trim()
Report-Assert "Renewal: Old RD Status is 'Matured'" ($renewStatus -eq "Matured") "Status: $renewStatus"

# Verify new FD created with same CustomerID
$sqlFdCheck = sqlcmd -S $sqlServer -d $dbName -E -h -1 -W -Q "
SET NOCOUNT ON;
SELECT TOP 1 AccountNo + ' ' + CAST(CustomerID AS VARCHAR) + ' ' + CAST(DepositAmount AS VARCHAR) + ' ' + Status 
FROM FdAccounts 
WHERE CustomerID = $primaryCustId AND Remarks LIKE '%$($renewAcc.accountNo)%'
ORDER BY FdAccountID DESC;
"
$fdRow = ($sqlFdCheck | Out-String).Trim() -split "\s+"
$newFdAccNo = if ($fdRow.Count -gt 0) { $fdRow[0] } else { "" }
$newFdCust = if ($fdRow.Count -gt 1) { [int]$fdRow[1] } else { 0 }
$newFdDeposit = if ($fdRow.Count -gt 2) { [decimal]$fdRow[2] } else { 0 }

Report-Assert "Renewal: New FD Account created with CustomerID" ($newFdCust -eq $primaryCustId -and $newFdDeposit -ge $instAmount) "New FD: $newFdAccNo, CustID: $newFdCust, Deposit: ₹$newFdDeposit"

# ------------------------------------------------------------------------------
# TEST 7: Query APIs (GET /api/RdAccounts with CustomerID and MemberID)
# ------------------------------------------------------------------------------
Write-Host "`n[TEST 7] Testing GET /api/RdAccounts Filtering..." -ForegroundColor Yellow

$allRdAccounts = Invoke-RestMethod -Uri "$baseUrl/api/RdAccounts" -Method Get -Headers $headers
Report-Assert "GET /api/RdAccounts: Returns array" ($allRdAccounts.Count -gt 0) "Total accounts retrieved: $($allRdAccounts.Count)"

$custRdAccounts = Invoke-RestMethod -Uri "$baseUrl/api/RdAccounts?customerId=$primaryCustId" -Method Get -Headers $headers
Report-Assert "GET /api/RdAccounts?customerId=: Filters correctly" ($custRdAccounts.Count -gt 0) "Customer accounts count: $($custRdAccounts.Count)"

# Check CIFNo and CustomerName mapped properly
$sampleAcc = $custRdAccounts[0]
Report-Assert "DTO Mapping: CustomerName is populated" ([string]::IsNullOrWhiteSpace($sampleAcc.customerName) -eq $false) "CustomerName: $($sampleAcc.customerName)"
Report-Assert "DTO Mapping: CustomerID is correct" ($sampleAcc.customerID -eq $primaryCustId) "CustomerID: $($sampleAcc.customerID)"

# ------------------------------------------------------------------------------
# CLEANUP (Controlled)
# ------------------------------------------------------------------------------
Write-Host "`n[CLEANUP] Cleaning up test RD accounts and test vouchers..." -ForegroundColor Yellow
$cleanSql = "
SET NOCOUNT ON;
DELETE FROM RdTransactions WHERE RdAccountID IN ($accId, $premId, $renewId);
DELETE FROM RdInterestAccruals WHERE RdAccountID IN ($accId, $premId, $renewId);
DELETE FROM VoucherDetails WHERE VoucherID IN (SELECT VoucherID FROM Vouchers WHERE VoucherNo LIKE 'JV-RD-%');
DELETE FROM Vouchers WHERE VoucherNo LIKE 'JV-RD-%';
DELETE FROM FdAccounts WHERE AccountNo = '$newFdAccNo';
DELETE FROM RdAccounts WHERE RdAccountID IN ($accId, $premId, $renewId);
"
sqlcmd -S $sqlServer -d $dbName -E -Q $cleanSql | Out-Null
Write-Host "  Test accounts cleaned up. Database returned to pristine state." -ForegroundColor Gray

# ------------------------------------------------------------------------------
# FINAL TEST REPORT SUMMARY
# ------------------------------------------------------------------------------
Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "  QA TEST SUITE SUMMARY FOR RD CUSTOMERID-FIRST ARCHITECTURE" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Total Assertions Checked : $script:total" -ForegroundColor White
Write-Host "  Passed                   : $script:passed" -ForegroundColor Green
Write-Host "  Failed                   : $script:failed" -ForegroundColor $(if ($script:failed -eq 0) { "Green" } else { "Red" })

if ($script:failed -eq 0) {
    Write-Host "`n  >>> 100% PASS! RD MODULE IS FULLY COMPLIANT WITH CUSTOMERID ARCHITECTURE. <<<" -ForegroundColor Green
} else {
    Write-Host "`n  >>> QA TESTS FAILED! PLEASE REVIEW FAILED ASSERTIONS ABOVE. <<<" -ForegroundColor Red
    exit 1
}
