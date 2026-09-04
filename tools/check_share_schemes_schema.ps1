$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ShareSchemes'"
$r = $cmd.ExecuteReader()
while($r.Read()) {
    Write-Host ($r["COLUMN_NAME"] + " (" + $r["DATA_TYPE"] + ", Nullable: " + $r["IS_NULLABLE"] + ", Default: " + $r["COLUMN_DEFAULT"] + ")")
}
$conn.Close()
