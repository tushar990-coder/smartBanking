function Check-Counts($db) {
    $connStr = "Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        $cmd = $conn.CreateCommand()
        
        $cmd.CommandText = "SELECT COUNT(*) FROM Members"
        $mCount = $cmd.ExecuteScalar()
        
        $cmd.CommandText = "SELECT COUNT(*) FROM LoanAccounts"
        $lCount = $cmd.ExecuteScalar()
        
        $cmd.CommandText = "SELECT COUNT(*) FROM SavingAccountMasters"
        $sCount = $cmd.ExecuteScalar()
        
        Write-Host "Database '$db': Members=$mCount, LoanAccounts=$lCount, SavingAccounts=$sCount" -ForegroundColor Green
        $conn.Close()
    } catch {
        Write-Host "Database '$db' error: $_" -ForegroundColor Red
    }
}

Check-Counts "Gurudev_SmartBanking"
Check-Counts "SmartBanking"
