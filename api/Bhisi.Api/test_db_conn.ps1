$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
Write-Host "Testing connection to: $connStr"

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    Write-Host "SUCCESS: Connected to SQL Server database successfully!" -ForegroundColor Green
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT COUNT(*) FROM sys.tables"
    $tableCount = $cmd.ExecuteScalar()
    Write-Host "Total Tables in SmartBanking Database: $tableCount" -ForegroundColor Cyan
    
    $cmd.CommandText = "SELECT COUNT(*) FROM Users"
    try {
        $userCount = $cmd.ExecuteScalar()
        Write-Host "Total Users in Database: $userCount" -ForegroundColor Yellow
    } catch {
        Write-Host "Users table check: $_"
    }

    $conn.Close()
} catch {
    Write-Host "ERROR: Connection failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
