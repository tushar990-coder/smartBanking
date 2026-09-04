$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
Write-Host "Updating LoanRates with NCHAR Unicode math in T-SQL..." -ForegroundColor Cyan

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "UPDATE LoanRates SET InterestPostingFrequency = NCHAR(2350) + NCHAR(2366) + NCHAR(2360) + NCHAR(2367) + NCHAR(2325) + N' (Monthly)'"
    
    $rowsAffected = $cmd.ExecuteNonQuery()
    Write-Host "SUCCESS: Updated $rowsAffected rows in LoanRates table!" -ForegroundColor Green

    $conn.Close()
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
