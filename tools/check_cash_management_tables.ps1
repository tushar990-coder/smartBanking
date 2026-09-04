$dbs = @("SmartBanking", "SmartBanking_ShareTest", "SmartBanking_Gurudev")
foreach ($db in $dbs) {
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;")
        $conn.Open()
        
        Write-Host "`n=== Database: $db ==="
        $tables = @("CashManagementSettings", "Cashiers", "CashAllocations", "CashDenominations")
        foreach ($t in $tables) {
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = "SELECT COUNT(*) FROM sys.tables WHERE name = '$t'"
            $exists = [int]$cmd.ExecuteScalar()
            Write-Host "Table '$t' exists: $exists"
            if ($exists -gt 0) {
                $cmd2 = $conn.CreateCommand()
                $cmd2.CommandText = "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '$t'"
                $r = $cmd2.ExecuteReader()
                $cols = @()
                while($r.Read()) { $cols += ($r["COLUMN_NAME"] + " (" + $r["DATA_TYPE"] + ")") }
                Write-Host "  Columns: $($cols -join ', ')"
                $r.Close()
            }
        }
        $conn.Close()
    } catch {
        Write-Host "Error for $db : $($_.Exception.Message)"
    }
}
