$databases = @("SmartBanking_ShareTest", "SmartBanking")

foreach ($db in $databases) {
    try {
        $connStr = "Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = @"
        -- Clean up any Mojibake or previous Marathi text in Voucher Narrations
        UPDATE Vouchers
        SET Narration = REPLACE(
                          REPLACE(
                            REPLACE(Narration, N' (à¤¸à¤à¤¾à¤¸à¤¦ à¤•à¥à¤°.: ', ' (Member No: '),
                          N' (सभासद क्र.: ', ' (Member No: '),
                        N' (सभासद क्र: ', ' (Member No: ')
        WHERE Narration LIKE '%à¤%' OR Narration LIKE N'%(सभासद क्र.%';
"@
        $count = $cmd.ExecuteNonQuery()
        $conn.Close()
        Write-Host "Database $db cleaned up $count Voucher Narrations successfully!" -ForegroundColor Green
    } catch {
        Write-Host "Error updating database $db : $($_.Exception.Message)" -ForegroundColor Red
    }
}
