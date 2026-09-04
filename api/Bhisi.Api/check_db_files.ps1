Add-Type -AssemblyName "System.Data"
$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=master;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT name, physical_name, type_desc FROM sys.master_files WHERE database_id = DB_ID('SmartBanking')"
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    Write-Host "File:" $r["name"] " -> " $r["physical_name"] "(" $r["type_desc"] ")"
}
$conn.Close()
