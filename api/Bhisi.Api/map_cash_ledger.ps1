$databases = @("SmartBanking_ShareTest", "SmartBanking")

foreach ($db in $databases) {
    try {
        $connStr = "Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "UPDATE Ledgers SET AccountType = 'Cash' WHERE LedgerID = 47 OR LedgerName LIKE N'%हातावरील रोख शिल्लक%'"
        $c1 = $cmd.ExecuteNonQuery()
        
        $cmd2 = $conn.CreateCommand()
        $cmd2.CommandText = "SELECT COUNT(*) FROM VoucherMappings WHERE TransactionType = 'Share Capital'"
        $exists = $cmd2.ExecuteScalar()
        
        if ($exists -gt 0) {
            $cmd3 = $conn.CreateCommand()
            $cmd3.CommandText = "UPDATE VoucherMappings SET DebitLedgerID = 47 WHERE TransactionType = 'Share Capital'"
            $c2 = $cmd3.ExecuteNonQuery()
        }
        $conn.Close()
        Write-Host "Database $db updated Cash Ledger 47 successfully!" -ForegroundColor Green
    } catch {
        Write-Host "Error updating database $db : $($_.Exception.Message)" -ForegroundColor Red
    }
}
