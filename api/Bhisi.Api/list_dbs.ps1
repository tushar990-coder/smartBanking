$connStr = "Server=.;Database=master;Trusted_Connection=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT name FROM sys.databases"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Host $reader[0]
}
$conn.Close()
