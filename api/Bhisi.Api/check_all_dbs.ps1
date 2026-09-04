$connStr = "Server=.;Database=master;Trusted_Connection=True;TrustServerCertificate=True"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT name, state_desc, create_date FROM sys.databases WHERE database_id > 4 ORDER BY name"
$reader = $cmd.ExecuteReader()

Write-Host "Databases on SQL Server (.):" -ForegroundColor Cyan
while ($reader.Read()) {
    $name = $reader.GetString(0)
    $state = $reader.GetString(1)
    Write-Host " - Database: $name ($state)" -ForegroundColor Green
}

$conn.Close()
