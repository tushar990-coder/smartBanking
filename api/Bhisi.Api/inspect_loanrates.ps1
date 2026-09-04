$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT LoanRateID, LoanType, InterestPostingFrequency FROM LoanRates"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        Write-Host "ID: $($reader['LoanRateID']) | Type: $($reader['LoanType']) | Frequency: '$($reader['InterestPostingFrequency'])'"
    }

    $conn.Close()
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
