$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
Write-Host "Cleaning up LoanRates encoding in SQL Server database..." -ForegroundColor Cyan

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "UPDATE LoanRates SET InterestPostingFrequency = N'मासिक (Monthly)' WHERE InterestPostingFrequency IS NULL OR InterestPostingFrequency LIKE '%à%' OR InterestPostingFrequency LIKE '%®%'"
    $rowsAffected = $cmd.ExecuteNonQuery()
    Write-Host "SUCCESS: Updated $rowsAffected rows in LoanRates table!" -ForegroundColor Green

    $conn.Close()
} catch {
    Write-Host "ERROR updating LoanRates: $($_.Exception.Message)" -ForegroundColor Red
}
