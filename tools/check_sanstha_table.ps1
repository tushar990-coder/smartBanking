$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SansthaDetails'"
$r = $cmd.ExecuteReader()
while($r.Read()) {
    Write-Host ($r["COLUMN_NAME"] + " (" + $r["DATA_TYPE"] + ")")
}
$conn.Close()

$conn.Open()
$cmd2 = $conn.CreateCommand()
$cmd2.CommandText = "SELECT * FROM SansthaDetails"
$r2 = $cmd2.ExecuteReader()
while($r2.Read()) {
    for($i = 0; $i -lt $r2.FieldCount; $i++) {
        Write-Host ($r2.GetName($i) + ": " + $r2.GetValue($i))
    }
}
$conn.Close()
