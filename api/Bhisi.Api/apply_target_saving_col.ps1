$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
Write-Host "Connecting to SmartBanking DB..."

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingTransactions]') AND name = 'TargetSavingAccountID')
        BEGIN
            ALTER TABLE [SavingTransactions] ADD [TargetSavingAccountID] int NULL;
            PRINT 'Added TargetSavingAccountID column to SavingTransactions';
        END
    "
    $cmd.ExecuteNonQuery()
    Write-Host "SUCCESS: TargetSavingAccountID column check/addition completed successfully!" -ForegroundColor Green
    $conn.Close()
} catch {
    Write-Host "ERROR: Operation failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
