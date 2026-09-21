$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=master;Trusted_Connection=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 AND state_desc = 'ONLINE'"
$reader = $cmd.ExecuteReader()
$databases = @()
while ($reader.Read()) {
    $databases += $reader[0]
}
$reader.Close()

Write-Host "Database Members Table Column Audit:" -ForegroundColor Cyan
Write-Host "------------------------------------" -ForegroundColor Gray
foreach ($db in $databases) {
    try {
        $cmd.CommandText = "SELECT COUNT(*) FROM [$db].sys.columns WHERE object_id = OBJECT_ID('[$db].[dbo].[Members]')"
        $colCount = $cmd.ExecuteScalar()
        if ($colCount -gt 0) {
            $cmd.CommandText = "SELECT COUNT(*) FROM [$db].[dbo].[Members]"
            $rowCount = $cmd.ExecuteScalar()
            $cmd.CommandText = "SELECT COUNT(*) FROM [$db].[dbo].[ShareAccounts] WHERE TotalShareCount > 0"
            $shCount = try { $cmd.ExecuteScalar() } catch { 0 }
            Write-Host "$db : Columns = $colCount | Members = $rowCount | Active Shareholders = $shCount"
        }
    } catch {
        # ignore non-app dbs
    }
}
$conn.Close()
