$connStr = "Server=tcp:43.239.93.47,15050;Database=SmartBanking_Testing;User Id=sa;Password=Mindspace2026;Trusted_Connection=False;MultipleActiveResultSets=true;Encrypt=true;TrustServerCertificate=True;Connection Timeout=15;"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('Members')"
    $colCount = $cmd.ExecuteScalar()
    $cmd.CommandText = "SELECT COUNT(*) FROM Members"
    $memCount = $cmd.ExecuteScalar()
    $cmd.CommandText = "SELECT COUNT(*) FROM ShareAccounts WHERE TotalShareCount > 0"
    $shCount = $cmd.ExecuteScalar()
    Write-Host "Online DB SmartBanking_Testing: Columns=$colCount | Members=$memCount | Shareholders=$shCount" -ForegroundColor Green
    $conn.Close()
} catch {
    Write-Host "Online DB connection failed or timeout: $($_.Exception.Message)" -ForegroundColor Yellow
}
