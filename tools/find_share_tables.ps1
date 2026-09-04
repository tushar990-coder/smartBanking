$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%Share%'"
$r = $cmd.ExecuteReader()
while($r.Read()) {
    Write-Host ("Table found: " + $r["TABLE_NAME"])
}
$conn.Close()
