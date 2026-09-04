$connectionString = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True"

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "         AUDIT REPORT: LOAN DISBURSEMENT & INTEREST CALCULATION AUDIT          " -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan

    $sql = @"
SELECT 
    la.LoanAccountID,
    la.LoanAccountNo,
    m.FirstName + ' ' + m.LastName AS MemberName,
    lr.LoanType,
    lr.InterestRate AS LoanRatePercent,
    la.SanctionedAmount,
    la.PrincipalBalance,
    la.InterestBalance,
    la.LoanDisbursementDate,
    la.OpeningDate,
    la.LastInstallmentPaidDate,
    la.MaturityDate,
    DATEDIFF(day, COALESCE(la.LastInstallmentPaidDate, la.LoanDisbursementDate, la.OpeningDate), GETDATE()) AS CalculatedElapsedDays
FROM LoanAccounts la
INNER JOIN Members m ON la.MemberID = m.MemberID
LEFT JOIN LoanRates lr ON la.LoanRateID = lr.LoanRateID
ORDER BY la.LoanAccountID ASC
"@

    $cmd = $connection.CreateCommand()
    $cmd.CommandText = $sql
    $reader = $cmd.ExecuteReader()

    $today = Get-Date
    $auditResults = @()

    while ($reader.Read()) {
        $accId = $reader["LoanAccountID"]
        $accNo = $reader["LoanAccountNo"]
        $member = $reader["MemberName"]
        $type = $reader["LoanType"]
        $rate = [decimal]$reader["LoanRatePercent"]
        $sanctioned = [decimal]$reader["SanctionedAmount"]
        $principal = [decimal]$reader["PrincipalBalance"]
        $currInterestBalance = [decimal]$reader["InterestBalance"]
        
        $disbDate = if ($reader["LoanDisbursementDate"] -ne [DBNull]::Value) { [DateTime]$reader["LoanDisbursementDate"] } else { $null }
        $openDate = if ($reader["OpeningDate"] -ne [DBNull]::Value) { [DateTime]$reader["OpeningDate"] } else { $null }
        $lastPaidDate = if ($reader["LastInstallmentPaidDate"] -ne [DBNull]::Value) { [DateTime]$reader["LastInstallmentPaidDate"] } else { $null }

        $startDate = if ($lastPaidDate) { $lastPaidDate } elseif ($disbDate) { $disbDate } else { $openDate }
        
        $days = 0
        if ($startDate) {
            $days = [Math]::Max(0, ($today - $startDate).Days)
        }

        # Daily reducing interest formula: (Principal * Rate * Days) / 36500
        $expectedDailyInterest = [Math]::Round(($principal * $rate * $days) / 36500, 2)

        Write-Host "--------------------------------------------------------------------------------"
        Write-Host "Loan Account    : $accNo ($member)" -ForegroundColor Yellow
        Write-Host "Loan Type       : $type"
        Write-Host "Disbursement Date: $($disbDate.ToString('dd/MM/yyyy'))"
        Write-Host "Start Calc Date : $($startDate.ToString('dd/MM/yyyy')) (Source: $(if ($lastPaidDate) { 'Last Paid' } elseif ($disbDate) { 'Disbursement Date' } else { 'Opening Date' }))"
        Write-Host "Sanctioned Amt  : ₹ $sanctioned"
        Write-Host "Current Balance : ₹ $principal"
        Write-Host "Interest Rate   : $rate %"
        Write-Host "Elapsed Days    : $days days"
        Write-Host "Expected Interest (till today): ₹ $expectedDailyInterest"
        Write-Host "Stored Interest Balance      : ₹ $currInterestBalance"
    }

    $connection.Close()
} catch {
    Write-Host "Database Audit Error: $_" -ForegroundColor Red
}
