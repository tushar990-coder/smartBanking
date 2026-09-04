$connStr = "Server=.;Database=master;Trusted_Connection=True;TrustServerCertificate=True"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'SmartBanking_Gurudev') CREATE DATABASE [SmartBanking_Gurudev];"
    $cmd.ExecuteNonQuery()
    $conn.Close()
    Write-Host "SUCCESS: Database SmartBanking_Gurudev created successfully!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}
