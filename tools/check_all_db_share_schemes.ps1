$dbs = @("SmartBanking", "SmartBanking_ShareTest", "SmartBanking_Gurudev")
foreach ($db in $dbs) {
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;")
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT COUNT(*) FROM sys.tables WHERE name = 'ShareSchemes'"
        $cnt = [int]$cmd.ExecuteScalar()
        Write-Host "Database '$db': ShareSchemes table exists = $cnt"
        if ($cnt -gt 0) {
            $cmd2 = $conn.CreateCommand()
            $cmd2.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ShareSchemes'"
            $r = $cmd2.ExecuteReader()
            $cols = @()
            while($r.Read()) { $cols += $r["COLUMN_NAME"] }
            Write-Host "Columns: $($cols -join ', ')"
        }
        $conn.Close()
    } catch {
        Write-Host "Error for $db : $($_.Exception.Message)"
    }
}
