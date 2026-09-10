$connStr = "Server=.\SQLEXPRESS01;Database=SmartBanking_Template;Trusted_Connection=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT definition FROM sys.sql_modules WHERE object_id IN (SELECT object_id FROM sys.procedures WHERE is_ms_shipped = 0)"
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    Write-Output ("Length: " + $r[0].Length)
}
$conn.Close()
