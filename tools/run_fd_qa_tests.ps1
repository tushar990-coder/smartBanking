# Comprehensive Core Banking QA Test Runner for Fixed Deposit Module
param (
    [string]$BaseUrl = "http://localhost:5242"
)

$ErrorActionPreference = "Continue"

$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Record-TestResult {
    param(
        [string]$TestId,
        [string]$Category,
        [string]$Description,
        [string]$Status, # PASS, FAIL, WARNING, DEFECT
        [string]$Details
    )
    $obj = [PSCustomObject]@{
        TestId      = $TestId
        Category    = $Category
        Description = $Description
        Status      = $Status
        Details     = $Details
    }
    $results.Add($obj)
    
    $color = switch ($Status) {
        "PASS"    { "Green" }
        "FAIL"    { "Red" }
        "DEFECT"  { "Magenta" }
        "WARNING" { "Yellow" }
        Default   { "White" }
    }
    Write-Host "[$Status] ${TestId}: $Description - $Details" -ForegroundColor $color
}

function Execute-SqlQuery {
    param([string]$Query)
    $connString = "Server=.\SQLEXPRESS01;Database=testing;Integrated Security=True;TrustServerCertificate=True;"
    $conn = New-Object System.Data.SqlClient.SqlConnection($connString)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $Query
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $table = New-Object System.Data.DataTable
    $adapter.Fill($table) | Out-Null
    $conn.Close()
    return , $table
}

function Invoke-ApiPost {
    param(
        [string]$Url,
        [hashtable]$Body,
        [hashtable]$Headers
    )
    $json = $Body | ConvertTo-Json -Depth 5
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    return Invoke-RestMethod -Uri $Url -Method Post -Body $bytes -Headers $Headers -ContentType "application/json; charset=utf-8"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CORE BANKING QA TEST SUITE: FIXED DEPOSIT MODULE       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Step 1: Authentication
Write-Host "`n[QA Init] Authenticating Admin..." -ForegroundColor Yellow
$token = $null
try {
    $loginPayload = @{ username = "admin"; password = "Shri@2026" } | ConvertTo-Json
    $loginRes = Invoke-RestMethod -Uri "$BaseUrl/api/Auth/login" -Method Post -Body $loginPayload -ContentType "application/json"
    $token = $loginRes.token
    Record-TestResult "AUTH-01" "Authentication" "Admin Login & JWT Token Generation" "PASS" "JWT Token Acquired"
} catch {
    Record-TestResult "AUTH-01" "Authentication" "Admin Login & JWT Token Generation" "FAIL" "Login failed: $($_.Exception.Message)"
    Write-Host "Stopping test run due to Auth failure." -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
}

# TC-01: Next Account Number Generation
Write-Host "`n[Test Group 1] Account Sequence & Number Generation" -ForegroundColor Yellow
try {
    $nextAccNo = Invoke-RestMethod -Uri "$BaseUrl/api/FdAccounts/next-account-no/1" -Method Get -Headers $headers
    if ($nextAccNo -match "FD") {
        Record-TestResult "FD-TC-01" "Sequencing" "Next FD Account Number Generation" "PASS" "Generated: $nextAccNo"
    } else {
        Record-TestResult "FD-TC-01" "Sequencing" "Next FD Account Number Generation" "WARNING" "Unexpected format: $nextAccNo"
    }
} catch {
    Record-TestResult "FD-TC-01" "Sequencing" "Next FD Account Number Generation" "FAIL" $_.Exception.Message
}

# TC-02: Single FD Account Opening (Cash Mode)
Write-Host "`n[Test Group 2] Single FD Account Opening & Vouchers" -ForegroundColor Yellow
$createdAcc = $null
try {
    $fdPayload = @{
        branchID        = 1
        customerID      = 1
        fdSchemeID      = 1
        openingDate     = (Get-Date).ToString("yyyy-MM-dd")
        depositAmount   = 50000
        paymentMode     = "Cash"
        nomineeName     = "Sunita Chavan"
        nomineeRelation = "Wife"
        remarks         = "QA Single FD Account Opening Test"
    }

    $createdAcc = Invoke-ApiPost -Url "$BaseUrl/api/FdAccounts" -Body $fdPayload -Headers $headers
    if ($createdAcc -and $createdAcc.fdAccountID -gt 0) {
        Record-TestResult "FD-TC-02" "Opening" "Single FD Account Creation (Cash)" "PASS" "FD Account ID: $($createdAcc.fdAccountID), AccNo: $($createdAcc.accountNo), Maturity: ₹$($createdAcc.maturityAmount)"
    } else {
        Record-TestResult "FD-TC-02" "Opening" "Single FD Account Creation (Cash)" "FAIL" "No Account ID returned"
    }
} catch {
    $err = $_.Exception.Message
    try {
        $s = $_.Exception.Response.GetResponseStream()
        $rd = New-Object System.IO.StreamReader($s)
        $err = $rd.ReadToEnd()
    } catch {}
    Record-TestResult "FD-TC-02" "Opening" "Single FD Account Creation (Cash)" "FAIL" $err
}

# TC-03: Double-Entry Voucher Integrity Verification (SQL Validation)
if ($createdAcc) {
    try {
        $accId = $createdAcc.fdAccountID
        $query = @"
SELECT v.VoucherID, v.VoucherNo, v.VoucherType, v.TotalAmount, vd.LedgerID, l.LedgerName, vd.DrCr, vd.Amount, vd.CustomerID, vd.MemberID
FROM FdTransactions t
JOIN Vouchers v ON t.VoucherID = v.VoucherID
JOIN VoucherDetails vd ON v.VoucherID = vd.VoucherID
JOIN Ledgers l ON vd.LedgerID = l.LedgerID
WHERE t.FdAccountID = $accId AND t.TransactionType = 'Opening';
"@
        $voucherTable = Execute-SqlQuery -Query $query
        $drTotal = 0
        $crTotal = 0
        $hasCustId = $false

        foreach ($row in $voucherTable.Rows) {
            if ($row.DrCr -eq "Dr") { $drTotal += [decimal]$row.Amount }
            if ($row.DrCr -eq "Cr") { $crTotal += [decimal]$row.Amount }
            if ($row.CustomerID -eq 1) { $hasCustId = $true }
        }

        if ($drTotal -eq 50000 -and $crTotal -eq 50000 -and $hasCustId) {
            Record-TestResult "FD-TC-03" "Accounting" "Opening Voucher Balance & Sub-Ledger Tagging" "PASS" "Dr ₹$drTotal == Cr ₹$crTotal, CustomerID=1 Tagged"
        } else {
            Record-TestResult "FD-TC-03" "Accounting" "Opening Voucher Balance & Sub-Ledger Tagging" "DEFECT" "Dr: $drTotal, Cr: $crTotal, HasCustId: $hasCustId"
        }
    } catch {
        Record-TestResult "FD-TC-03" "Accounting" "Opening Voucher Balance" "FAIL" $_.Exception.Message
    }
}

# TC-04: Bulk Split FD Account Opening
Write-Host "`n[Test Group 3] Bulk Split FD Account Opening" -ForegroundColor Yellow
$bulkRes = $null
try {
    $bulkPayload = @{
        branchID        = 1
        customerID      = 2
        fdSchemeID      = 1
        openingDate     = (Get-Date).ToString("yyyy-MM-dd")
        totalAmount     = 60000
        splitCount      = 2
        amountPerReceipt= 30000
        paymentMode     = "Cash"
        nomineeName     = "Suresh Patil"
        nomineeRelation = "Son"
        remarks         = "QA Bulk Split FD Test"
        isSeniorCitizen = $false
    }

    $bulkRes = Invoke-ApiPost -Url "$BaseUrl/api/FdAccounts/BulkCreate" -Body $bulkPayload -Headers $headers
    if ($bulkRes -and $bulkRes.accounts.Count -eq 2) {
        Record-TestResult "FD-TC-04" "Bulk Opening" "Bulk Split FD (2 Receipts x ₹30,000)" "PASS" "Created 2 accounts: $($bulkRes.accounts[0].accountNo), $($bulkRes.accounts[1].accountNo)"
    } else {
        Record-TestResult "FD-TC-04" "Bulk Opening" "Bulk Split FD" "FAIL" "Did not return 2 accounts"
    }
} catch {
    $err = $_.Exception.Message
    try {
        $s = $_.Exception.Response.GetResponseStream()
        $rd = New-Object System.IO.StreamReader($s)
        $err = $rd.ReadToEnd()
    } catch {}
    Record-TestResult "FD-TC-04" "Bulk Opening" "Bulk Split FD" "FAIL" $err
}

# TC-05: Interest Preview & Accrual Calculation
Write-Host "`n[Test Group 4] Interest Accrual & Calculation Engine" -ForegroundColor Yellow
try {
    $previewPayload = @{
        branchID          = 1
        accrualDate       = (Get-Date).AddMonths(1).ToString("yyyy-MM-dd")
        calculationMethod = "OnPrincipal"
    }

    $previewRes = Invoke-ApiPost -Url "$BaseUrl/api/FdAccounts/CalculateInterestPreview" -Body $previewPayload -Headers $headers
    if ($previewRes -and $previewRes.Count -gt 0) {
        $sample = $previewRes[0]
        if ($sample.customerID -gt 0 -and $sample.customerName -ne "" -and $sample.calculatedInterest -gt 0) {
            Record-TestResult "FD-TC-05" "Interest Accrual" "Accrual Calculation & DTO Mapping" "PASS" "Accrued: ₹$($sample.calculatedInterest) for $($sample.customerName) (CustID: $($sample.customerID), Account: $($sample.accountNo))"
        } else {
            Record-TestResult "FD-TC-05" "Interest Accrual" "Accrual Calculation & DTO Mapping" "DEFECT" "CustomerID missing or Zero Interest"
        }
    } else {
        Record-TestResult "FD-TC-05" "Interest Accrual" "Accrual Calculation Preview" "WARNING" "No active accounts returned in preview"
    }
} catch {
    Record-TestResult "FD-TC-05" "Interest Accrual" "Accrual Calculation" "FAIL" $_.Exception.Message
}

# TC-06: Premature Close with Penalty Clawback
Write-Host "`n[Test Group 5] Premature Closure & Clawback" -ForegroundColor Yellow
if ($createdAcc) {
    try {
        $accId = $createdAcc.fdAccountID
        $preclosePayload = @{
            closureDate     = (Get-Date).AddMonths(3).ToString("yyyy-MM-dd")
            paymentMode     = "Cash"
            narration       = "QA Premature Close Test"
        }

        $precloseRes = Invoke-ApiPost -Url "$BaseUrl/api/FdAccounts/$accId/PrematureClose" -Body $preclosePayload -Headers $headers
        if ($precloseRes -and ($precloseRes.message -match "Closed" -or $precloseRes.netPayout -gt 0)) {
            Record-TestResult "FD-TC-06" "Premature Close" "FD Premature Closure & Net Payout Calculation" "PASS" "Payout: ₹$($precloseRes.netPayout), Recalc Int: ₹$($precloseRes.recalcInt), Clawback: ₹$($precloseRes.clawback)"
        } else {
            Record-TestResult "FD-TC-06" "Premature Close" "FD Premature Closure" "WARNING" "$($precloseRes | ConvertTo-Json -Compress)"
        }
    } catch {
        Record-TestResult "FD-TC-06" "Premature Close" "FD Premature Closure" "FAIL" $_.Exception.Message
    }
}

# TC-07: FD Renewal (Using one of the bulk accounts)
Write-Host "`n[Test Group 6] FD Renewal Lifecycle & Regression Bug Fix Verification" -ForegroundColor Yellow
if ($bulkRes -and $bulkRes.accounts.Count -gt 0) {
    try {
        $targetRenewId = $bulkRes.accounts[0].fdAccountID
        $renewPayload = @{
            targetSchemeID        = 1
            renewalType           = "PrincipalAndInterest"
            interestPayoutLedgerId= 1
        }

        $renewRes = Invoke-ApiPost -Url "$BaseUrl/api/FdAccounts/$targetRenewId/Renew" -Body $renewPayload -Headers $headers
        
        # Verify CustomerID is properly assigned to the new renewed account in SQL
        $newAccNo = $renewRes.newAccountNo
        $chkQuery = "SELECT FdAccountID, CustomerID, AccountNo, DepositAmount, Status FROM FdAccounts WHERE AccountNo = '$newAccNo';"
        $renewedTable = Execute-SqlQuery -Query $chkQuery
        $renewedCustId = if ($renewedTable.Rows.Count -gt 0) { $renewedTable.Rows[0].CustomerID } else { $null }
        
        if ($renewedCustId -eq 2) {
            Record-TestResult "FD-TC-07" "Renewal" "Renewal CustomerID Integrity (Regression Bug Fix)" "PASS" "New Account: $newAccNo, CustomerID correctly set to $renewedCustId"
        } else {
            Record-TestResult "FD-TC-07" "Renewal" "Renewal CustomerID Integrity (Regression Bug Fix)" "DEFECT" "Renewed Account CustomerID is NULL or mismatched! Found: $renewedCustId"
        }
    } catch {
        Record-TestResult "FD-TC-07" "Renewal" "FD Renewal Test" "FAIL" $_.Exception.Message
    }
}

# TC-08: Negative Boundary Testing (Edge Cases)
Write-Host "`n[Test Group 7] Negative & Boundary Testing" -ForegroundColor Yellow

# Test 8A: Zero Amount FD Opening
try {
    $zeroPayload = @{
        branchID        = 1
        customerID      = 1
        fdSchemeID      = 1
        depositAmount   = 0
        paymentMode     = "Cash"
    }
    $res = Invoke-ApiPost -Url "$BaseUrl/api/FdAccounts" -Body $zeroPayload -Headers $headers
    Record-TestResult "FD-TC-08A" "Validation" "Zero Amount Deposit Rejection" "DEFECT" "API accepted zero deposit amount!"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Record-TestResult "FD-TC-08A" "Validation" "Zero Amount Deposit Rejection" "PASS" "Rejected with HTTP 400 Bad Request"
    } else {
        Record-TestResult "FD-TC-08A" "Validation" "Zero Amount Deposit Rejection" "WARNING" "Status code: $($_.Exception.Response.StatusCode.value__)"
    }
}

# Test 8B: Invalid Non-Existent Customer
try {
    $invalidCustPayload = @{
        branchID        = 1
        customerID      = 999999
        fdSchemeID      = 1
        depositAmount   = 10000
        paymentMode     = "Cash"
    }
    $res = Invoke-ApiPost -Url "$BaseUrl/api/FdAccounts" -Body $invalidCustPayload -Headers $headers
    Record-TestResult "FD-TC-08B" "Validation" "Invalid CustomerID Rejection" "DEFECT" "API accepted non-existent CustomerID 999999!"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400 -or $_.Exception.Response.StatusCode.value__ -eq 404) {
        Record-TestResult "FD-TC-08B" "Validation" "Invalid CustomerID Rejection" "PASS" "Rejected with HTTP $($_.Exception.Response.StatusCode.value__)"
    } else {
        Record-TestResult "FD-TC-08B" "Validation" "Invalid CustomerID Rejection" "WARNING" "Status: $($_.Exception.Response.StatusCode.value__)"
    }
}

# Test 8C: Double Closure of already closed account
if ($createdAcc) {
    try {
        $accId = $createdAcc.fdAccountID
        $closeAgainPayload = @{
            closureDate    = (Get-Date).ToString("yyyy-MM-dd")
            payoutLedgerId = 1
        }
        $res = Invoke-ApiPost -Url "$BaseUrl/api/FdAccounts/$accId/MaturedClose" -Body $closeAgainPayload -Headers $headers
        Record-TestResult "FD-TC-08C" "Validation" "Prevent Double Close on Closed Account" "DEFECT" "Allowed closing an already closed account!"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            Record-TestResult "FD-TC-08C" "Validation" "Prevent Double Close on Closed Account" "PASS" "Prevented with HTTP 400: $($_.Exception.Message)"
        } else {
            Record-TestResult "FD-TC-08C" "Validation" "Prevent Double Close on Closed Account" "WARNING" "Status: $($_.Exception.Response.StatusCode.value__)"
        }
    }
}

# TC-09: Customer 360 & Member FD Ledger Verification
Write-Host "`n[Test Group 8] Customer 360 & Reporting Verification" -ForegroundColor Yellow
try {
    $ledgerRes = Invoke-RestMethod -Uri "$BaseUrl/api/FdAccounts/CustomerLedger/2" -Method Get -Headers $headers
    if ($ledgerRes -and $ledgerRes.customerID -eq 2 -and $ledgerRes.accounts.Count -gt 0) {
        Record-TestResult "FD-TC-09" "Reporting" "Customer FD Ledger & 360 Statement" "PASS" "Found $($ledgerRes.accounts.Count) FD accounts for Customer 2 with principal ₹$($ledgerRes.totalPrincipalInvested)"
    } else {
        Record-TestResult "FD-TC-09" "Reporting" "Customer FD Ledger & 360 Statement" "WARNING" "No accounts found in ledger response"
    }
} catch {
    Record-TestResult "FD-TC-09" "Reporting" "Customer FD Ledger" "FAIL" $_.Exception.Message
}

# TC-10: Member Deletion / Integrity Guard Check
Write-Host "`n[Test Group 9] Core Banking Integrity - Member Deletion Guard" -ForegroundColor Yellow
try {
    $memTable = Execute-SqlQuery -Query "SELECT MemberID FROM Members WHERE CustomerID = 1;"
    if ($memTable.Rows.Count -gt 0) {
        $mId = $memTable.Rows[0].MemberID
        try {
            $deleteRes = Invoke-RestMethod -Uri "$BaseUrl/api/Members/$mId" -Method Delete -Headers $headers
            Record-TestResult "FD-TC-10" "Integrity Guard" "Prevent Member Deletion when Active FDs Exist" "DEFECT" "Allowed member deletion despite active FDs!"
        } catch {
            if ($_.Exception.Response.StatusCode.value__ -eq 400) {
                Record-TestResult "FD-TC-10" "Integrity Guard" "Prevent Member Deletion when Active FDs Exist" "PASS" "Successfully blocked with HTTP 400 (Active accounts guard)"
            } else {
                Record-TestResult "FD-TC-10" "Integrity Guard" "Prevent Member Deletion" "WARNING" "Status: $($_.Exception.Response.StatusCode.value__)"
            }
        }
    } else {
        Record-TestResult "FD-TC-10" "Integrity Guard" "Prevent Member Deletion" "WARNING" "No Member record for Customer 1"
    }
} catch {
    Record-TestResult "FD-TC-10" "Integrity Guard" "Prevent Member Deletion" "FAIL" $_.Exception.Message
}

# Summary Output
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "                QA TEST RESULTS SUMMARY                   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$defectCount = ($results | Where-Object { $_.Status -eq "DEFECT" }).Count
$warnCount = ($results | Where-Object { $_.Status -eq "WARNING" }).Count
$totalCount = $results.Count

Write-Host "Total Tests Executed: $totalCount" -ForegroundColor White
Write-Host "Passed:               $passCount" -ForegroundColor Green
Write-Host "Failed:               $failCount" -ForegroundColor Red
Write-Host "Defects Detected:     $defectCount" -ForegroundColor Magenta
Write-Host "Warnings:             $warnCount" -ForegroundColor Yellow

# Output json for report consumption
$jsonOut = $results | ConvertTo-Json -Depth 3
Set-Content -Path "d:\Bhisi Software\tools\qa_fd_test_results.json" -Value $jsonOut -Encoding UTF8
Write-Host "`nResults saved to d:\Bhisi Software\tools\qa_fd_test_results.json" -ForegroundColor Green
